import type { Isbn } from '../../domain/isbn.js';
import { Livre } from '../../domain/livre.js';
import { normaliserPourRecherche } from '../../domain/texte.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import type { BaseSqlite } from './connexion.js';

interface LigneLivre {
  isbn: string;
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

export class SqliteLivreRepository implements LivreRepository {
  private readonly requetes;

  constructor(db: BaseSqlite) {
    this.requetes = {
      parIsbn: db.prepare<[string], LigneLivre>('SELECT isbn, titre, auteurs, couverture FROM livres WHERE isbn = ?'),
      upsert: db.prepare<[LigneLivre & { texte_recherche: string }]>(`
        INSERT INTO livres (isbn, titre, auteurs, couverture, texte_recherche)
        VALUES (@isbn, @titre, @auteurs, @couverture, @texte_recherche)
        ON CONFLICT (isbn) DO UPDATE SET
          titre = excluded.titre, auteurs = excluded.auteurs,
          couverture = excluded.couverture, texte_recherche = excluded.texte_recherche
      `),
    };
  }

  async trouverParIsbn(isbn: Isbn): Promise<Livre | null> {
    const ligne = this.requetes.parIsbn.get(isbn.valeur);
    return ligne ? versEntite(ligne) : null;
  }

  async enregistrer(livre: Livre): Promise<void> {
    const s = livre.versSnapshot();
    this.requetes.upsert.run({
      isbn: s.isbn,
      titre: s.titre,
      auteurs: JSON.stringify(s.auteurs),
      couverture: s.couverture,
      texte_recherche: texteRecherche(livre),
    });
  }
}

function versEntite(ligne: LigneLivre): Livre {
  return Livre.reconstituer({
    isbn: ligne.isbn,
    titre: ligne.titre,
    auteurs: JSON.parse(ligne.auteurs) as string[],
    couverture: ligne.couverture,
  });
}
