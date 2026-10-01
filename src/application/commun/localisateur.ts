import type { Emplacement } from '../../domain/emplacement.js';
import { calculerLocalisation, type Localisation } from '../../domain/localisation.js';
import { TYPES_EMPLACEMENT } from '../../domain/type-emplacement.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';

/**
 * Remonte la hiérarchie d'un emplacement jusqu'à l'étage, puis délègue le
 * calcul au domaine. Garde en cache les emplacements déjà chargés : à créer
 * pour un seul cas d'usage (une liste d'exemplaires partage souvent les mêmes ancêtres).
 */
export class Localisateur {
  private readonly cache = new Map<string, Emplacement>();

  constructor(private readonly emplacements: EmplacementRepository) {}

  async localiser(emplacementId: string): Promise<Localisation> {
    const chemin: Emplacement[] = [];
    let courantId: string | null = emplacementId;

    while (courantId !== null) {
      if (chemin.length >= TYPES_EMPLACEMENT.length) {
        throw new Error(`Hiérarchie incohérente au-dessus de « ${emplacementId} »`);
      }
      const emplacement = await this.charger(courantId);
      chemin.unshift(emplacement);
      courantId = emplacement.parentId;
    }
    return calculerLocalisation(chemin);
  }

  private async charger(id: string): Promise<Emplacement> {
    const enCache = this.cache.get(id);
    if (enCache) return enCache;
    const emplacement = await this.emplacements.trouverParId(id);
    // Les clés étrangères garantissent l'existence : une absence est une incohérence interne.
    if (!emplacement) throw new Error(`Emplacement « ${id} » absent de la hiérarchie`);
    this.cache.set(id, emplacement);
    return emplacement;
  }
}
