import type { Isbn } from '../domain/isbn.js';

export interface InfosLivreCatalogue {
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

/**
 * Résultat explicite plutôt qu'une exception : l'appelant est obligé de traiter
 * le cas « catalogue indisponible » (réseau coupé, timeout, erreur 5xx…),
 * qui est un cas normal de fonctionnement et non une anomalie.
 */
export type ResultatCatalogue =
  | { readonly statut: 'trouve'; readonly livre: InfosLivreCatalogue }
  | { readonly statut: 'introuvable' }
  | { readonly statut: 'indisponible'; readonly raison: string };

/** Source externe de notices bibliographiques (Open Library pour le MVP). */
export interface CatalogueExterne {
  rechercherParIsbn(isbn: Isbn): Promise<ResultatCatalogue>;
}
