import { Isbn } from './isbn.js';
import { normaliserPourRecherche, texteObligatoire } from './texte.js';

export interface LivreSnapshot {
  readonly isbn: string;
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

export interface NouveauLivre {
  readonly isbn: Isbn;
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture?: string | null;
}

/** Notice bibliographique, partagée par tous les exemplaires d'un même ISBN. Immuable. */
export class Livre {
  private constructor(
    readonly isbn: Isbn,
    readonly titre: string,
    readonly auteurs: readonly string[],
    readonly couverture: string | null,
  ) {}

  static creer(donnees: NouveauLivre): Livre {
    const auteurs = donnees.auteurs
      .map((a) => a.trim().replace(/\s+/g, ' '))
      .filter((a, i, tous) => a.length > 0 && tous.indexOf(a) === i);
    const couverture = donnees.couverture?.trim() || null;
    return new Livre(donnees.isbn, texteObligatoire(donnees.titre, 'titre', 500), auteurs, couverture);
  }

  static reconstituer(snapshot: LivreSnapshot): Livre {
    return new Livre(Isbn.creer(snapshot.isbn), snapshot.titre, [...snapshot.auteurs], snapshot.couverture);
  }

  /**
   * Règle de recherche : le terme apparaît dans le titre, dans un auteur
   * (sans tenir compte de la casse ni des accents) ou dans l'ISBN (tirets ignorés).
   */
  correspond(terme: string): boolean {
    const t = normaliserPourRecherche(terme);
    if (t.length === 0) return false;
    const termeIsbn = formeIsbnRecherchee(t);
    return (
      normaliserPourRecherche(this.titre).includes(t) ||
      this.auteurs.some((a) => normaliserPourRecherche(a).includes(t)) ||
      (termeIsbn.length > 0 && this.isbn.valeur.includes(termeIsbn))
    );
  }

  versSnapshot(): LivreSnapshot {
    return { isbn: this.isbn.valeur, titre: this.titre, auteurs: [...this.auteurs], couverture: this.couverture };
  }
}

/**
 * Forme sous laquelle un terme (déjà normalisé) est cherché dans l'ISBN :
 * un ISBN complet valide (10 ou 13) est converti en ISBN-13, sinon on retire
 * simplement tirets et espaces pour permettre une recherche partielle.
 * Exportée pour que les adapters de persistance appliquent la même règle.
 */
export function formeIsbnRecherchee(termeNormalise: string): string {
  return Isbn.essayer(termeNormalise)?.valeur ?? termeNormalise.replace(/[\s-]/g, '');
}
