import type { Exemplaire } from '../domain/exemplaire.js';

/** Stockage des exemplaires. */
export interface ExemplaireRepository {
  trouverParId(id: string): Promise<Exemplaire | null>;
  /** Crée ou met à jour (upsert). */
  enregistrer(exemplaire: Exemplaire): Promise<void>;
  /**
   * Exemplaires dont le livre correspond au terme.
   * Contrat : même sémantique que Livre.correspond (titre, auteur ou ISBN,
   * insensible à la casse et aux accents, correspondance partielle).
   */
  rechercher(terme: string): Promise<Exemplaire[]>;
  /**
   * Exemplaires mal rangés. L'implémentation peut pré-filtrer côté stockage
   * pour la performance ; la règle de référence reste Exemplaire.estMalRange.
   */
  trouverMalRanges(): Promise<Exemplaire[]>;
  /** Vrai si au moins un exemplaire y est rangé ou y a été détecté en dernier. */
  existeAvecEmplacement(emplacementId: string): Promise<boolean>;
}
