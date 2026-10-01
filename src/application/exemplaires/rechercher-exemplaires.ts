import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

/** Recherche par titre, auteur ou ISBN, avec la localisation complète de chaque exemplaire. */
export class RechercherExemplaires {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    livres: LivreRepository,
    emplacements: EmplacementRepository,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(terme: string): Promise<VueExemplaire[]> {
    if (terme.trim().length === 0) return [];
    return this.presentateur.presenterTous(await this.exemplaires.rechercher(terme));
  }
}
