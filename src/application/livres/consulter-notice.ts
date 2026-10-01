import { Isbn } from '../../domain/isbn.js';
import type { CatalogueExterne } from '../../ports/catalogue-externe.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { ResolveurNotice } from '../commun/resolveur-notice.js';
import { vueLivre } from '../commun/vues.js';

export interface VueNotice {
  /** `base` : livre déjà enregistré (id renseigné) ; `catalogue` : notice externe, pas encore enregistrée. */
  readonly source: 'base' | 'catalogue';
  readonly livre: {
    readonly id: string | null;
    readonly isbn: string;
    readonly titre: string;
    readonly auteurs: readonly string[];
    readonly couverture: string | null;
  };
}

/**
 * Aperçu de la notice d'un ISBN AVANT l'ajout d'un exemplaire (scan, saisie) :
 * l'utilisateur vérifie qu'il s'agit du bon livre. Lecture seule : rien n'est enregistré.
 */
export class ConsulterNotice {
  private readonly resolveur: ResolveurNotice;

  constructor(livres: LivreRepository, catalogue: CatalogueExterne) {
    this.resolveur = new ResolveurNotice(livres, catalogue);
  }

  async executer(isbnSaisi: string): Promise<VueNotice> {
    const isbn = Isbn.creer(isbnSaisi);
    const notice = await this.resolveur.resoudre(isbn);
    if (notice.source === 'base') {
      return { source: 'base', livre: { ...vueLivre(notice.livre), isbn: isbn.valeur } };
    }
    return {
      source: 'catalogue',
      livre: { id: null, isbn: isbn.valeur, titre: notice.infos.titre, auteurs: notice.infos.auteurs, couverture: notice.infos.couverture },
    };
  }
}
