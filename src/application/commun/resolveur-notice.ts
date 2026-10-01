import { ErreurValidation } from '../../domain/erreurs.js';
import type { Isbn } from '../../domain/isbn.js';
import type { Livre } from '../../domain/livre.js';
import type { CatalogueExterne, InfosLivreCatalogue } from '../../ports/catalogue-externe.js';
import type { LivreRepository } from '../../ports/livre-repository.js';

/** Notice trouvée pour un ISBN : déjà en base (entité) ou fournie par le catalogue (données brutes). */
export type NoticeResolue =
  | { readonly source: 'base'; readonly livre: Livre }
  | { readonly source: 'catalogue'; readonly infos: InfosLivreCatalogue };

/**
 * Règle de résolution d'une notice à partir d'un ISBN, partagée par l'aperçu
 * (ConsulterNotice) et l'ajout (AjouterExemplaire) :
 *   1. livre déjà connu en base → aucun appel externe
 *   2. sinon, catalogue externe ; s'il est indisponible ou ne connaît pas
 *      l'ISBN, erreur explicite invitant à une saisie manuelle.
 * Aucun effet de bord : rien n'est enregistré ici.
 */
export class ResolveurNotice {
  constructor(
    private readonly livres: LivreRepository,
    private readonly catalogue: CatalogueExterne,
  ) {}

  async resoudre(isbn: Isbn): Promise<NoticeResolue> {
    const connu = await this.livres.trouverParIsbn(isbn);
    if (connu) return { source: 'base', livre: connu };

    const resultat = await this.catalogue.rechercherParIsbn(isbn);
    switch (resultat.statut) {
      case 'trouve':
        return { source: 'catalogue', infos: resultat.livre };
      case 'introuvable':
        throw new ErreurValidation(
          'LIVRE_INCONNU_DU_CATALOGUE',
          `L'ISBN ${isbn.valeur} est inconnu du catalogue : saisissez le titre et les auteurs manuellement`,
        );
      case 'indisponible':
        throw new ErreurValidation(
          'CATALOGUE_INDISPONIBLE',
          `Le catalogue est indisponible (${resultat.raison}) : saisissez le titre et les auteurs manuellement`,
        );
    }
  }
}
