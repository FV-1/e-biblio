import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { chargerEmplacement } from '../commun/chargement.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

/**
 * Contenu d'une étagère (vue « étagère » du plan) : les exemplaires qui y sont
 * rangés et ceux qui y ont été vus en dernier. Chaque vue porte `malRange`, ce
 * qui permet au client de distinguer les intrus des absents.
 */
export class ListerExemplairesDeLEmplacement {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    livres: LivreRepository,
    private readonly emplacements: EmplacementRepository,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(emplacementId: string): Promise<VueExemplaire[]> {
    await chargerEmplacement(this.emplacements, emplacementId);
    return this.presentateur.presenterTous(await this.exemplaires.trouverParEmplacement(emplacementId));
  }
}
