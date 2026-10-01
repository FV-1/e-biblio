import { Exemplaire, type ExemplaireSnapshot } from '../../src/domain/exemplaire.js';
import type { ExemplaireRepository } from '../../src/ports/exemplaire-repository.js';
import type { LivreRepositoryEnMemoire } from './livre-repository-en-memoire.js';

/** Recherche et filtre en s'appuyant directement sur les règles du domaine. */
export class ExemplaireRepositoryEnMemoire implements ExemplaireRepository {
  private readonly donnees = new Map<string, ExemplaireSnapshot>();

  constructor(
    private readonly livres: LivreRepositoryEnMemoire,
    initiaux: readonly Exemplaire[] = [],
  ) {
    initiaux.forEach((e) => this.donnees.set(e.id, e.versSnapshot()));
  }

  async trouverParId(id: string): Promise<Exemplaire | null> {
    const s = this.donnees.get(id);
    return s ? Exemplaire.reconstituer(s) : null;
  }

  async enregistrer(exemplaire: Exemplaire): Promise<void> {
    this.donnees.set(exemplaire.id, exemplaire.versSnapshot());
  }

  async rechercher(terme: string): Promise<Exemplaire[]> {
    const livresCorrespondants = new Set(this.livres.tous().filter((l) => l.correspond(terme)).map((l) => l.id));
    return this.tous().filter((e) => livresCorrespondants.has(e.livreId));
  }

  async trouverMalRanges(): Promise<Exemplaire[]> {
    return this.tous().filter((e) => e.estMalRange());
  }

  async existeAvecEmplacement(emplacementId: string): Promise<boolean> {
    return this.tous().some(
      (e) => e.emplacementId === emplacementId || e.derniereDetection?.emplacementId === emplacementId,
    );
  }

  private tous(): Exemplaire[] {
    return [...this.donnees.values()].map((s) => Exemplaire.reconstituer(s));
  }
}
