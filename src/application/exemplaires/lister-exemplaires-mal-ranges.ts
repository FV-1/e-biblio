import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

export class ListerExemplairesMalRanges {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    livres: LivreRepository,
    emplacements: EmplacementRepository,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(): Promise<VueExemplaire[]> {
    const candidats = await this.exemplaires.trouverMalRanges();
    // Le repository peut pré-filtrer, mais la règle qui fait foi est celle du domaine.
    return this.presentateur.presenterTous(candidats.filter((e) => e.estMalRange()));
  }
}
