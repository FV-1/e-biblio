import type { Isbn } from '../../domain/isbn.js';
import { cleTriAuteur, cleTriTitre, Livre } from '../../domain/livre.js';
import { normaliserPourRecherche } from '../../domain/texte.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import type { BaseSqlite } from './connexion.js';

interface LigneLivre {
  id: string;
  isbn: string | null;
  titre: string;
  auteurs: string;
  couverture: string | null;
}

/**
 * Colonne dénormalisée pour la recherche : titre et auteurs normalisés par la
 * fonction du domaine, séparés par des retours à la ligne. Un terme normalisé ne
 * contient jamais de retour à la ligne : il ne peut donc pas « chevaucher » deux
 * champs, ce qui reproduit exactement la sémantique de Livre.correspond.
 */
export function texteRecherche(livre: Livre): string {
  return [livre.titre, ...livre.auteurs].map(normaliserPourRecherche).join('\n');
}

const COLONNES = 'id, isbn, titre, auteurs, couverture';

export class SqliteLivreRepository implements LivreRepository {
  private readonly requetes;

  constructor(db: BaseSqlite) {
    this.requetes = {
      parId: db.prepare<[string], LigneLivre>(`SELECT ${COLONNES} FROM livres WHERE id = ?`),
      parIsbn: db.prepare<[string], LigneLivre>(`SELECT ${COLONNES} FROM livres WHERE isbn = ?`),
      upsert: db.prepare<[LigneLivre & { texte_recherche: string; titre_tri: string; auteur_tri: string }]>(`
        INSERT INTO livres (id, isbn, titre, auteurs, couverture, texte_recherche, titre_tri, auteur_tri)
        VALUES (@id, @isbn, @titre, @auteurs, @couverture, @texte_recherche, @titre_tri, @auteur_tri)
        ON CONFLICT (id) DO UPDATE SET
          isbn = excluded.isbn, titre = excluded.titre, auteurs = excluded.auteurs,
          couverture = excluded.couverture, texte_recherche = excluded.texte_recherche,
          titre_tri = excluded.titre_tri, auteur_tri = excluded.auteur_tri
      `),
    };
  }

  async trouverParId(id: string): Promise<Livre | null> {
    const ligne = this.requetes.parId.get(id);
    return ligne ? versEntite(ligne) : null;
  }

  async trouverParIsbn(isbn: Isbn): Promise<Livre | null> {
    const ligne = this.requetes.parIsbn.get(isbn.valeur);
    return ligne ? versEntite(ligne) : null;
  }

  async enregistrer(livre: Livre): Promise<void> {
    const s = livre.versSnapshot();
    this.requetes.upsert.run({
      id: s.id,
      isbn: s.isbn,
      titre: s.titre,
      auteurs: JSON.stringify(s.auteurs),
      couverture: s.couverture,
      texte_recherche: texteRecherche(livre),
      titre_tri: cleTriTitre(livre),
      auteur_tri: cleTriAuteur(livre),
    });
  }
}

function versEntite(ligne: LigneLivre): Livre {
  return Livre.reconstituer({
    id: ligne.id,
    isbn: ligne.isbn,
    titre: ligne.titre,
    auteurs: JSON.parse(ligne.auteurs) as string[],
    couverture: ligne.couverture,
  });
}
