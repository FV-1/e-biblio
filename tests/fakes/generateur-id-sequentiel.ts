import type { GenerateurId } from '../../src/ports/generateur-id.js';

/** Produit des identifiants prévisibles : prefixe-1, prefixe-2, … */
export class GenerateurIdSequentiel implements GenerateurId {
  private compteur = 0;

  constructor(private readonly prefixe = 'id') {}

  generer(): string {
    this.compteur += 1;
    return `${this.prefixe}-${this.compteur}`;
  }
}
