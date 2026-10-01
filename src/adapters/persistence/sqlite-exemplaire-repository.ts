import { Exemplaire } from '../../domain/exemplaire.js';
import { formeIsbnRecherchee } from '../../domain/livre.js';
import { normaliserPourRecherche } from '../../domain/texte.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { BaseSqlite } from './connexion.js';

interface LigneExemplaire {
  id: string;
  livre_id: string;
  emplacement_id: string;
  detection_emplacement_id: string | null;
  detection_date: string | null;
}

export class SqliteExemplaireRepository implements ExemplaireRepository {
  private readonly requetes;

  constructor(db: BaseSqlite) {
    this.requetes = {
      parId: db.prepare<[string], LigneExemplaire>('SELECT * FROM exemplaires WHERE id = ?'),
      upsert: db.prepare<[LigneExemplaire]>(`
        INSERT INTO exemplaires (id, livre_id, emplacement_id, detection_emplacement_id, detection_date)
        VALUES (@id, @livre_id, @emplacement_id, @detection_emplacement_id, @detection_date)
        ON CONFLICT (id) DO UPDATE SET
          livre_id = excluded.livre_id, emplacement_id = excluded.emplacement_id,
          detection_emplacement_id = excluded.detection_emplacement_id,
          detection_date = excluded.detection_date
      `),
      rechercher: db.prepare<[{ motif: string; motifIsbn: string | null }], LigneExemplaire>(`
        SELECT e.* FROM exemplaires e
        JOIN livres l ON l.id = e.livre_id
        WHERE l.texte_recherche LIKE @motif ESCAPE '\\'
           OR (@motifIsbn IS NOT NULL AND l.isbn LIKE @motifIsbn ESCAPE '\\')
        ORDER BY l.titre, e.id
      `),
      // Pré-filtrage SQL pour la performance ; la règle de référence est Exemplaire.estMalRange.
      malRanges: db.prepare<[], LigneExemplaire>(`
        SELECT * FROM exemplaires
        WHERE detection_emplacement_id IS NOT NULL AND detection_emplacement_id <> emplacement_id
        ORDER BY detection_date DESC, id
      `),
      parLivre: db.prepare<[string], LigneExemplaire>('SELECT * FROM exemplaires WHERE livre_id = ? ORDER BY id'),
      existeAvecEmplacement: db.prepare<[{ id: string }], { existe: number }>(`
        SELECT EXISTS (
          SELECT 1 FROM exemplaires WHERE emplacement_id = @id OR detection_emplacement_id = @id
        ) AS existe
      `),
    };
  }

  async trouverParId(id: string): Promise<Exemplaire | null> {
    const ligne = this.requetes.parId.get(id);
    return ligne ? versEntite(ligne) : null;
  }

  async enregistrer(exemplaire: Exemplaire): Promise<void> {
    const s = exemplaire.versSnapshot();
    this.requetes.upsert.run({
      id: s.id,
      livre_id: s.livreId,
      emplacement_id: s.emplacementId,
      detection_emplacement_id: s.derniereDetection?.emplacementId ?? null,
      detection_date: s.derniereDetection?.date.toISOString() ?? null,
    });
  }

  async rechercher(terme: string): Promise<Exemplaire[]> {
    const t = normaliserPourRecherche(terme);
    if (t.length === 0) return [];
    const termeIsbn = formeIsbnRecherchee(t);
    return this.requetes.rechercher
      .all({ motif: `%${echapperLike(t)}%`, motifIsbn: termeIsbn ? `%${echapperLike(termeIsbn)}%` : null })
      .map(versEntite);
  }

  async trouverMalRanges(): Promise<Exemplaire[]> {
    return this.requetes.malRanges.all().map(versEntite);
  }

  async trouverParLivre(livreId: string): Promise<Exemplaire[]> {
    return this.requetes.parLivre.all(livreId).map(versEntite);
  }

  async existeAvecEmplacement(emplacementId: string): Promise<boolean> {
    return this.requetes.existeAvecEmplacement.get({ id: emplacementId })?.existe === 1;
  }
}

/** Neutralise les jokers LIKE (% et _) présents dans la saisie de l'utilisateur. */
function echapperLike(texte: string): string {
  return texte.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function versEntite(ligne: LigneExemplaire): Exemplaire {
  return Exemplaire.reconstituer({
    id: ligne.id,
    livreId: ligne.livre_id,
    emplacementId: ligne.emplacement_id,
    derniereDetection:
      ligne.detection_emplacement_id !== null && ligne.detection_date !== null
        ? { emplacementId: ligne.detection_emplacement_id, date: new Date(ligne.detection_date) }
        : null,
  });
}
