import { formeIsbnRecherchee, Livre } from '../../domain/livre.js';
import { normaliserPourRecherche } from '../../domain/texte.js';
import type { CriteresLivres, InventaireLivres, Ordre, PageInventaire, TriLivres } from '../../ports/inventaire-livres.js';
import type { BaseSqlite } from './connexion.js';

interface LigneSql {
  id: string;
  isbn: string | null;
  titre: string;
  auteurs: string;
  couverture: string | null;
  nombre_exemplaires: number;
  nombre_mal_ranges: number;
}

interface Parametres {
  motif: string | null;
  motifIsbn: string | null;
  avecIsbn: number | null;
  avecCouverture: number | null;
}

/**
 * Même filtre de recherche que SqliteExemplaireRepository.rechercher
 * (sémantique de Livre.correspond), et filtres facultatifs ISBN / couverture.
 */
const FILTRES = `
  WHERE (@motif IS NULL OR l.texte_recherche LIKE @motif ESCAPE '\\'
         OR (@motifIsbn IS NOT NULL AND l.isbn LIKE @motifIsbn ESCAPE '\\'))
    AND (@avecIsbn IS NULL OR (l.isbn IS NOT NULL) = @avecIsbn)
    AND (@avecCouverture IS NULL OR (l.couverture IS NOT NULL) = @avecCouverture)
`;

/**
 * Tri : liste blanche d'expressions (jamais de SQL construit à partir de la saisie).
 * Le départage par titre puis par id rend l'ordre stable d'une page à l'autre.
 */
const ORDRES: Record<TriLivres, (sens: string) => string> = {
  titre: (sens) => `l.titre_tri ${sens}, l.id`,
  // Livres sans auteur toujours en dernier, quel que soit le sens.
  auteur: (sens) => `(l.auteur_tri = '') ASC, l.auteur_tri ${sens}, l.titre_tri, l.id`,
  exemplaires: (sens) => `nombre_exemplaires ${sens}, l.titre_tri, l.id`,
  malRanges: (sens) => `nombre_mal_ranges ${sens}, l.titre_tri, l.id`,
};

/**
 * Modèle de lecture SQLite de l'inventaire : une seule requête agrège les
 * compteurs par livre. La condition « mal rangé » traduit en SQL la règle
 * Exemplaire.estMalRange (équivalence garantie par les tests de contrat).
 */
export class SqliteInventaireLivres implements InventaireLivres {
  private readonly compter;
  private readonly requetesParTri = new Map<string, ReturnType<BaseSqlite['prepare']>>();

  constructor(private readonly db: BaseSqlite) {
    this.compter = db.prepare<[Parametres], { total: number }>(`SELECT COUNT(*) AS total FROM livres l ${FILTRES}`);
  }

  async lister(criteres: CriteresLivres): Promise<PageInventaire> {
    const parametres = parametresDe(criteres);
    const total = this.compter.get(parametres)?.total ?? 0;
    const lignes = this.requete(criteres.tri, criteres.ordre).all({
      ...parametres,
      limite: criteres.parPage,
      decalage: (criteres.page - 1) * criteres.parPage,
    }) as LigneSql[];

    return {
      total,
      lignes: lignes.map((l) => ({
        livre: Livre.reconstituer({ ...l, auteurs: JSON.parse(l.auteurs) as string[] }),
        nombreExemplaires: l.nombre_exemplaires,
        nombreMalRanges: l.nombre_mal_ranges,
      })),
    };
  }

  /** Une requête préparée par combinaison tri × ordre, créée à la première utilisation. */
  private requete(tri: TriLivres, ordre: Ordre) {
    const cle = `${tri}:${ordre}`;
    let requete = this.requetesParTri.get(cle);
    if (!requete) {
      requete = this.db.prepare(`
        SELECT l.id, l.isbn, l.titre, l.auteurs, l.couverture,
               COUNT(e.id) AS nombre_exemplaires,
               COALESCE(SUM(e.detection_emplacement_id IS NOT NULL
                            AND e.detection_emplacement_id <> e.emplacement_id), 0) AS nombre_mal_ranges
        FROM livres l
        LEFT JOIN exemplaires e ON e.livre_id = l.id
        ${FILTRES}
        GROUP BY l.id
        ORDER BY ${ORDRES[tri](ordre === 'desc' ? 'DESC' : 'ASC')}
        LIMIT @limite OFFSET @decalage
      `);
      this.requetesParTri.set(cle, requete);
    }
    return requete;
  }
}

function parametresDe(criteres: CriteresLivres): Parametres {
  const t = normaliserPourRecherche(criteres.terme ?? '');
  const termeIsbn = t ? formeIsbnRecherchee(t) : '';
  const booleen = (v: boolean | undefined) => (v === undefined ? null : v ? 1 : 0);
  return {
    motif: t ? `%${echapperLike(t)}%` : null,
    motifIsbn: termeIsbn ? `%${echapperLike(termeIsbn)}%` : null,
    avecIsbn: booleen(criteres.avecIsbn),
    avecCouverture: booleen(criteres.avecCouverture),
  };
}

function echapperLike(texte: string): string {
  return texte.replace(/[\\%_]/g, (c) => `\\${c}`);
}
