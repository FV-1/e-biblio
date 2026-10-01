import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { Horloge } from '../../ports/horloge.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { chargerEmplacement, chargerExemplaire } from '../commun/chargement.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

export interface CommandeEnregistrerDetection {
  readonly exemplaireId: string;
  readonly emplacementId: string;
}

/**
 * Un scan a vu l'exemplaire sur un emplacement : met à jour sa position
 * constatée, puis publie l'événement ExemplaireDetecte.
 *
 * L'événement est publié APRÈS l'enregistrement : on ne diffuse jamais un fait
 * qui n'a pas été persisté. (Pour garantir aussi la publication en cas de panne
 * entre les deux, il faudrait un « outbox » transactionnel : hors MVP.)
 */
export class EnregistrerDetection {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    livres: LivreRepository,
    private readonly emplacements: EmplacementRepository,
    private readonly publisher: EventPublisher,
    private readonly horloge: Horloge,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(commande: CommandeEnregistrerDetection): Promise<VueExemplaire> {
    const exemplaire = await chargerExemplaire(this.exemplaires, commande.exemplaireId);
    const emplacement = await chargerEmplacement(this.emplacements, commande.emplacementId);

    const evenement = exemplaire.enregistrerDetection(emplacement, this.horloge.maintenant());
    await this.exemplaires.enregistrer(exemplaire);
    await this.publisher.publier(evenement);

    return this.presentateur.presenter(exemplaire);
  }
}
