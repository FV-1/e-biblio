import { ErreurConflit } from '../../domain/erreurs.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import { chargerEmplacement } from '../commun/chargement.js';

/** Suppression refusée tant que l'emplacement a des enfants ou des exemplaires rattachés. */
export class SupprimerEmplacement {
  constructor(
    private readonly emplacements: EmplacementRepository,
    private readonly exemplaires: ExemplaireRepository,
  ) {}

  async executer(id: string): Promise<void> {
    const emplacement = await chargerEmplacement(this.emplacements, id);

    const enfants = await this.emplacements.trouverEnfants(id);
    if (enfants.length > 0) {
      throw new ErreurConflit(
        'EMPLACEMENT_NON_VIDE',
        `« ${emplacement.nom} » contient ${enfants.length} sous-emplacement(s) : supprimez-les d'abord`,
      );
    }
    if (await this.exemplaires.existeAvecEmplacement(id)) {
      throw new ErreurConflit(
        'EMPLACEMENT_NON_VIDE',
        `Des exemplaires sont rangés ou ont été détectés sur « ${emplacement.nom} »`,
      );
    }

    await this.emplacements.supprimer(id);
  }
}
