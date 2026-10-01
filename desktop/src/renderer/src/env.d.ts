import type { ServiceBibliotheque } from '../../commun/service-bibliotheque';

declare global {
  interface Window {
    /** Exposé par le preload (src/preload/index.ts). */
    readonly biblio: ServiceBibliotheque;
  }
}
