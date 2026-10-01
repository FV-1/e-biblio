import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { chargerExemplaire } from '../commun/chargement.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

export class ConsulterExemplaire {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    livres: LivreRepository,
    emplacements: EmplacementRepository,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(id: string): Promise<VueExemplaire> {
    return this.presentateur.presenter(await chargerExemplaire(this.exemplaires, id));
  }
}
