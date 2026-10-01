import type { Horloge } from '../../ports/horloge.js';

export class HorlogeSysteme implements Horloge {
  maintenant(): Date {
    return new Date();
  }
}
