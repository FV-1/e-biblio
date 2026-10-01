import type { Emplacement } from '../domain/emplacement.js';

/** Stockage de la hiérarchie des emplacements. */
export interface EmplacementRepository {
  trouverParId(id: string): Promise<Emplacement | null>;
  trouverTous(): Promise<Emplacement[]>;
  trouverEnfants(parentId: string): Promise<Emplacement[]>;
  /** Crée ou met à jour (upsert). */
  enregistrer(emplacement: Emplacement): Promise<void>;
  supprimer(id: string): Promise<void>;
}
