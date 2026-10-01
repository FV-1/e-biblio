import type { Isbn } from '../domain/isbn.js';
import type { Livre } from '../domain/livre.js';

/** Stockage des notices bibliographiques (sert aussi de cache du catalogue externe). */
export interface LivreRepository {
  trouverParId(id: string): Promise<Livre | null>;
  /** L'ISBN est unique parmi les livres qui en ont un. */
  trouverParIsbn(isbn: Isbn): Promise<Livre | null>;
  /** Crée ou met à jour (upsert). */
  enregistrer(livre: Livre): Promise<void>;
}
