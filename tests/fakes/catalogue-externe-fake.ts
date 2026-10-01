import type { Isbn } from '../../src/domain/isbn.js';
import type { CatalogueExterne, InfosLivreCatalogue, ResultatCatalogue } from '../../src/ports/catalogue-externe.js';

/**
 * Catalogue simulé : on lui déclare les livres connus, ou on le met « hors ligne ».
 * Garde la trace des ISBN demandés pour vérifier qu'un appel a (ou n'a pas) eu lieu.
 */
export class CatalogueExterneFake implements CatalogueExterne {
  private readonly livres = new Map<string, InfosLivreCatalogue>();
  private horsLigne = false;
  readonly appels: string[] = [];

  connaitre(isbn: Isbn, infos: InfosLivreCatalogue): this {
    this.livres.set(isbn.valeur, infos);
    return this;
  }

  mettreHorsLigne(): this {
    this.horsLigne = true;
    return this;
  }

  async rechercherParIsbn(isbn: Isbn): Promise<ResultatCatalogue> {
    this.appels.push(isbn.valeur);
    if (this.horsLigne) return { statut: 'indisponible', raison: 'catalogue simulé hors ligne' };
    const livre = this.livres.get(isbn.valeur);
    return livre ? { statut: 'trouve', livre } : { statut: 'introuvable' };
  }
}
