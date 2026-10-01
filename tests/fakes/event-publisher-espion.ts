import type { EvenementDomaine } from '../../src/domain/evenements.js';
import type { EventPublisher } from '../../src/ports/event-publisher.js';

/** Enregistre les événements publiés pour pouvoir les vérifier dans les tests. */
export class EventPublisherEspion implements EventPublisher {
  readonly publies: EvenementDomaine[] = [];

  async publier(evenement: EvenementDomaine): Promise<void> {
    this.publies.push(evenement);
  }
}
