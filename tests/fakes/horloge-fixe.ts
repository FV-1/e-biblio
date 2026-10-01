import type { Horloge } from '../../src/ports/horloge.js';

export class HorlogeFixe implements Horloge {
  constructor(private instant: Date = new Date('2026-01-15T10:00:00.000Z')) {}

  maintenant(): Date {
    return new Date(this.instant);
  }

  avancer(millisecondes: number): void {
    this.instant = new Date(this.instant.getTime() + millisecondes);
  }
}
