import { Coordonnees } from '../../domain/coordonnees.js';
import { Emplacement } from '../../domain/emplacement.js';
import type { TypeEmplacement } from '../../domain/type-emplacement.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { GenerateurId } from '../../ports/generateur-id.js';
import { chargerEmplacement } from '../commun/chargement.js';
import { vueEmplacement, type VueEmplacement } from '../commun/vues.js';

export interface CommandeCreerEmplacement {
  readonly type: TypeEmplacement;
  readonly nom: string;
  readonly parentId: string | null;
  readonly coordonnees: { readonly x: number; readonly y: number } | null;
}

export class CreerEmplacement {
  constructor(
    private readonly emplacements: EmplacementRepository,
    private readonly generateurId: GenerateurId,
  ) {}

  async executer(commande: CommandeCreerEmplacement): Promise<VueEmplacement> {
    const parent = commande.parentId === null ? null : await chargerEmplacement(this.emplacements, commande.parentId);

    const emplacement = Emplacement.creer({
      id: this.generateurId.generer(),
      type: commande.type,
      nom: commande.nom,
      parent,
      coordonnees: commande.coordonnees ? Coordonnees.creer(commande.coordonnees.x, commande.coordonnees.y) : null,
    });

    await this.emplacements.enregistrer(emplacement);
    return vueEmplacement(emplacement);
  }
}
