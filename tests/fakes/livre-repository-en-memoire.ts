import type { Isbn } from '../../src/domain/isbn.js';
import { Livre, type LivreSnapshot } from '../../src/domain/livre.js';
import type { LivreRepository } from '../../src/ports/livre-repository.js';

export class LivreRepositoryEnMemoire implements LivreRepository {
  private readonly donnees = new Map<string, LivreSnapshot>();

  constructor(initiaux: readonly Livre[] = []) {
    initiaux.forEach((l) => this.donnees.set(l.id, l.versSnapshot()));
  }

  async trouverParId(id: string): Promise<Livre | null> {
    const s = this.donnees.get(id);
    return s ? Livre.reconstituer(s) : null;
  }

  async trouverParIsbn(isbn: Isbn): Promise<Livre | null> {
    const s = [...this.donnees.values()].find((l) => l.isbn === isbn.valeur);
    return s ? Livre.reconstituer(s) : null;
  }

  async enregistrer(livre: Livre): Promise<void> {
    this.donnees.set(livre.id, livre.versSnapshot());
  }

  /** Accès synchrone réservé aux autres fakes (jointure livre ↔ exemplaire). */
  tous(): Livre[] {
    return [...this.donnees.values()].map((s) => Livre.reconstituer(s));
  }
}
