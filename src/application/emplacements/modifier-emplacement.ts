import { Coordonnees } from '../../domain/coordonnees.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import { chargerEmplacement } from '../commun/chargement.js';
import { vueEmplacement, type VueEmplacement } from '../commun/vues.js';

/**
 * Modification partielle : un champ absent (undefined) est inchangé,
 * `null` retire les coordonnées ou détache du parent (étage uniquement).
 * Le type n'est pas modifiable : il définit la place dans la hiérarchie.
 */
export interface CommandeModifierEmplacement {
  readonly nom?: string;
  readonly parentId?: string | null;
  readonly coordonnees?: { readonly x: number; readonly y: number } | null;
}

export class ModifierEmplacement {
  constructor(private readonly emplacements: EmplacementRepository) {}

  async executer(id: string, commande: CommandeModifierEmplacement): Promise<VueEmplacement> {
    const emplacement = await chargerEmplacement(this.emplacements, id);

    if (commande.nom !== undefined) emplacement.renommer(commande.nom);
    if (commande.coordonnees !== undefined) {
      emplacement.definirCoordonnees(
        commande.coordonnees === null ? null : Coordonnees.creer(commande.coordonnees.x, commande.coordonnees.y),
      );
    }
    if (commande.parentId !== undefined) {
      const parent = commande.parentId === null ? null : await chargerEmplacement(this.emplacements, commande.parentId);
      emplacement.deplacerSous(parent);
    }

    await this.emplacements.enregistrer(emplacement);
    return vueEmplacement(emplacement);
  }
}
