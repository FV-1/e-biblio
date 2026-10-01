/**
 * Événements du domaine : faits métier passés, publiés via le port EventPublisher.
 * Ce sont des données pures (sérialisables), indépendantes du transport
 * (console aujourd'hui, WebSocket demain).
 */
export interface ExemplaireDetecte {
  readonly type: 'ExemplaireDetecte';
  readonly exemplaireId: string;
  readonly isbn: string;
  readonly emplacementDetecteId: string;
  readonly emplacementTheoriqueId: string;
  readonly malRange: boolean;
  readonly dateDetection: Date;
}

/** Union de tous les événements du domaine (un seul pour le MVP). */
export type EvenementDomaine = ExemplaireDetecte;
