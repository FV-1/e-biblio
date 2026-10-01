import { Isbn } from './isbn.js';
import { normaliserPourRecherche, texteObligatoire } from './texte.js';

export interface LivreSnapshot {
  readonly id: string;
  readonly isbn: string | null;
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

export interface NouveauLivre {
  readonly id: string;
  /** Facultatif : ouvrages anciens, documents internes… n'ont pas toujours d'ISBN. */
  readonly isbn: Isbn | null;
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture?: string | null;
}

/**
 * Notice bibliographique, partagée par tous les exemplaires d'un même ouvrage. Immuable.
 * Son identité est un identifiant interne : l'ISBN, quand il existe, est un attribut
 * (unique) qui permet de retrouver la notice, pas son identité.
 */
export class Livre {
  private constructor(
    readonly id: string,
    readonly isbn: Isbn | null,
    readonly titre: string,
    readonly auteurs: readonly string[],
    readonly couverture: string | null,
  ) {}

  static creer(donnees: NouveauLivre): Livre {
    const auteurs = donnees.auteurs
      .map((a) => a.trim().replace(/\s+/g, ' '))
      .filter((a, i, tous) => a.length > 0 && tous.indexOf(a) === i);
    const couverture = donnees.couverture?.trim() || null;
    return new Livre(
      texteObligatoire(donnees.id, 'id'),
      donnees.isbn,
      texteObligatoire(donnees.titre, 'titre', 500),
      auteurs,
      couverture,
    );
  }

  static reconstituer(snapshot: LivreSnapshot): Livre {
    return new Livre(
      snapshot.id,
      snapshot.isbn === null ? null : Isbn.creer(snapshot.isbn),
      snapshot.titre,
      [...snapshot.auteurs],
      snapshot.couverture,
    );
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
      (this.isbn !== null && termeIsbn.length > 0 && this.isbn.valeur.includes(termeIsbn))
    );
  }

  versSnapshot(): LivreSnapshot {
    return {
      id: this.id,
      isbn: this.isbn?.valeur ?? null,
      titre: this.titre,
      auteurs: [...this.auteurs],
      couverture: this.couverture,
    };
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
