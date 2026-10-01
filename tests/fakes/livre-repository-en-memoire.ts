import type { Isbn } from '../../src/domain/isbn.js';
import { Livre, type LivreSnapshot } from '../../src/domain/livre.js';
import type { LivreRepository } from '../../src/ports/livre-repository.js';

export class LivreRepositoryEnMemoire implements LivreRepository {
  private readonly donnees = new Map<string, LivreSnapshot>();

  constructor(initiaux: readonly Livre[] = []) {
    initiaux.forEach((l) => this.donnees.set(l.isbn.valeur, l.versSnapshot()));
  }

  async trouverParIsbn(isbn: Isbn): Promise<Livre | null> {
    const s = this.donnees.get(isbn.valeur);
    return s ? Livre.reconstituer(s) : null;
  }

  async enregistrer(livre: Livre): Promise<void> {
    this.donnees.set(livre.isbn.valeur, livre.versSnapshot());
  }

  /** Accès synchrone réservé aux autres fakes (jointure livre ↔ exemplaire). */
  tous(): Livre[] {
    return [...this.donnees.values()].map((s) => Livre.reconstituer(s));
  }
}
