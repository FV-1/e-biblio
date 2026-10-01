import { ErreurIntrouvable } from '../../domain/erreurs.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

/** Tous les exemplaires d'une œuvre, avec leur localisation (ligne dépliée de la vue « base »). */
export class ListerExemplairesDuLivre {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    private readonly livres: LivreRepository,
    emplacements: EmplacementRepository,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(livreId: string): Promise<VueExemplaire[]> {
    if (!(await this.livres.trouverParId(livreId))) {
      throw new ErreurIntrouvable('LIVRE_INTROUVABLE', `Livre « ${livreId} » introuvable`);
    }
    return this.presentateur.presenterTous(await this.exemplaires.trouverParLivre(livreId));
  }
}
