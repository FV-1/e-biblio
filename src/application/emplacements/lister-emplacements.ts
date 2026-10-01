import type { TypeEmplacement } from '../../domain/type-emplacement.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import { vueEmplacement, type VueEmplacement } from '../commun/vues.js';

export interface FiltreEmplacements {
  readonly type?: TypeEmplacement;
  readonly parentId?: string;
}

export class ListerEmplacements {
  constructor(private readonly emplacements: EmplacementRepository) {}

  async executer(filtre: FiltreEmplacements = {}): Promise<VueEmplacement[]> {
    const candidats =
      filtre.parentId !== undefined
        ? await this.emplacements.trouverEnfants(filtre.parentId)
        : await this.emplacements.trouverTous();

    return candidats.filter((e) => filtre.type === undefined || e.type === filtre.type).map(vueEmplacement);
  }
}
