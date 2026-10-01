import type { Livre } from '../domain/livre.js';

export type TriLivres = 'titre' | 'auteur' | 'exemplaires' | 'malRanges';
export type Ordre = 'asc' | 'desc';

export interface CriteresLivres {
  /** Recherche texte (sémantique de Livre.correspond) ; absent = tous les livres. */
  readonly terme?: string;
  /** true : seulement les livres avec ISBN ; false : seulement sans ISBN ; absent : tous. */
  readonly avecIsbn?: boolean;
  /** Idem pour la couverture. */
  readonly avecCouverture?: boolean;
  readonly tri: TriLivres;
  readonly ordre: Ordre;
  /** Numéro de page, à partir de 1. */
  readonly page: number;
  readonly parPage: number;
}

export interface LigneInventaire {
  readonly livre: Livre;
  readonly nombreExemplaires: number;
  readonly nombreMalRanges: number;
}

export interface PageInventaire {
  readonly lignes: readonly LigneInventaire[];
  /** Nombre total de livres correspondant aux critères (toutes pages confondues). */
  readonly total: number;
}

/**
 * Port de LECTURE : consultation paginée du fonds, avec compteurs agrégés.
 * Séparé des repositories (orientés écriture d'agrégats) : c'est un modèle de
 * lecture, que l'adapter peut optimiser librement (jointure, agrégation SQL).
 *
 * Contrat :
 *   - les livres sans exemplaire sont inclus (nombreExemplaires = 0) ;
 *   - nombreMalRanges suit la règle Exemplaire.estMalRange ;
 *   - tri alphabétique sur cleTriTitre / cleTriAuteur (livres sans auteur en
 *     dernier), puis départage par titre puis par id, pour un ordre stable.
 */
export interface InventaireLivres {
  lister(criteres: CriteresLivres): Promise<PageInventaire>;
}
