import { Emplacement, type EmplacementSnapshot } from '../../src/domain/emplacement.js';
import type { EmplacementRepository } from '../../src/ports/emplacement-repository.js';

/**
 * Stocke des snapshots (copies) et non les entités elles-mêmes : une
 * modification non suivie d'un `enregistrer` n'est donc pas « persistée »,
 * comme avec une vraie base.
 */
export class EmplacementRepositoryEnMemoire implements EmplacementRepository {
  private readonly donnees = new Map<string, EmplacementSnapshot>();

  constructor(initiaux: readonly Emplacement[] = []) {
    initiaux.forEach((e) => this.donnees.set(e.id, e.versSnapshot()));
  }

  async trouverParId(id: string): Promise<Emplacement | null> {
    const s = this.donnees.get(id);
    return s ? Emplacement.reconstituer(s) : null;
  }

  async trouverTous(): Promise<Emplacement[]> {
    return [...this.donnees.values()].map((s) => Emplacement.reconstituer(s));
  }

  async trouverEnfants(parentId: string): Promise<Emplacement[]> {
    return [...this.donnees.values()].filter((s) => s.parentId === parentId).map((s) => Emplacement.reconstituer(s));
  }

  async enregistrer(emplacement: Emplacement): Promise<void> {
    this.donnees.set(emplacement.id, emplacement.versSnapshot());
  }

  async supprimer(id: string): Promise<void> {
    this.donnees.delete(id);
  }
}
