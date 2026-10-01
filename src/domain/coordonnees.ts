import { ErreurValidation } from './erreurs.js';

/** Position (x, y) sur le plan de l'étage. Objet valeur immuable. */
export class Coordonnees {
  private constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  static creer(x: number, y: number): Coordonnees {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new ErreurValidation('COORDONNEES_INVALIDES', 'Les coordonnées doivent être des nombres finis');
    }
    return new Coordonnees(x, y);
  }

  versDonnees(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
