import type { EvenementDomaine } from '../../domain/evenements.js';
import type { EventPublisher } from '../../ports/event-publisher.js';

/**
 * Implémentation MVP du port EventPublisher : écrit chaque événement sur une
 * ligne JSON. Sera remplacée (dans main.ts uniquement) par un publisher
 * WebSocket diffusant vers les fronts, sans modifier le métier.
 */
export class ConsoleEventPublisher implements EventPublisher {
  constructor(private readonly ecrire: (ligne: string) => void = console.log) {}

  async publier(evenement: EvenementDomaine): Promise<void> {
    this.ecrire(`[evenement] ${evenement.type} ${JSON.stringify(evenement)}`);
  }
}
