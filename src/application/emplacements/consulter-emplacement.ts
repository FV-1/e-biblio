import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import { chargerEmplacement } from '../commun/chargement.js';
import { Localisateur } from '../commun/localisateur.js';
import { vueEmplacement, type VueDetailEmplacement } from '../commun/vues.js';

/** Détail d'un emplacement : chemin complet, coordonnées et enfants directs. */
export class ConsulterEmplacement {
  constructor(private readonly emplacements: EmplacementRepository) {}

  async executer(id: string): Promise<VueDetailEmplacement> {
    const emplacement = await chargerEmplacement(this.emplacements, id);
    const [localisation, enfants] = await Promise.all([
      new Localisateur(this.emplacements).localiser(id),
      this.emplacements.trouverEnfants(id),
    ]);
    return { ...vueEmplacement(emplacement), localisation, enfants: enfants.map(vueEmplacement) };
  }
}
