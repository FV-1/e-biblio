import type { EvenementDomaine } from '../domain/evenements.js';

/**
 * Diffusion des événements du domaine.
 * MVP : log console. Plus tard : WebSocket vers les fronts, sans toucher au métier.
 */
export interface EventPublisher {
  publier(evenement: EvenementDomaine): Promise<void>;
}
