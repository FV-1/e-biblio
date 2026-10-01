import type { CriteresLivres, InventaireLivres, Ordre, TriLivres } from '../../ports/inventaire-livres.js';
import { vueLivre, type VueLivre } from '../commun/vues.js';

export const PAR_PAGE_DEFAUT = 25;
export const PAR_PAGE_MAX = 100;

export interface DemandeListeLivres {
  readonly terme?: string;
  readonly avecIsbn?: boolean;
  readonly avecCouverture?: boolean;
  readonly tri?: TriLivres;
  readonly ordre?: Ordre;
  readonly page?: number;
  readonly parPage?: number;
}

export interface VueLigneLivre extends VueLivre {
  readonly nombreExemplaires: number;
  readonly nombreMalRanges: number;
}

export interface VuePageLivres {
  readonly livres: readonly VueLigneLivre[];
  readonly total: number;
  readonly page: number;
  readonly parPage: number;
  /** Nombre de pages (au moins 1, même sans résultat). */
  readonly pages: number;
}

/** Consultation paginée du fonds : toutes les œuvres, avec recherche, filtres et tri. */
export class ListerLivres {
  constructor(private readonly inventaire: InventaireLivres) {}

  async executer(demande: DemandeListeLivres = {}): Promise<VuePageLivres> {
    const terme = demande.terme?.trim();
    const criteres: CriteresLivres = {
      ...(terme ? { terme } : {}),
      ...(demande.avecIsbn !== undefined ? { avecIsbn: demande.avecIsbn } : {}),
      ...(demande.avecCouverture !== undefined ? { avecCouverture: demande.avecCouverture } : {}),
      tri: demande.tri ?? 'titre',
      ordre: demande.ordre ?? 'asc',
      page: Math.max(1, Math.floor(demande.page ?? 1)),
      parPage: Math.min(PAR_PAGE_MAX, Math.max(1, Math.floor(demande.parPage ?? PAR_PAGE_DEFAUT))),
    };

    const { lignes, total } = await this.inventaire.lister(criteres);
    return {
      livres: lignes.map((l) => ({ ...vueLivre(l.livre), nombreExemplaires: l.nombreExemplaires, nombreMalRanges: l.nombreMalRanges })),
      total,
      page: criteres.page,
      parPage: criteres.parPage,
      pages: Math.max(1, Math.ceil(total / criteres.parPage)),
    };
  }
}
