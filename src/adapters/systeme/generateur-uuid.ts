import { randomUUID } from 'node:crypto';
import type { GenerateurId } from '../../ports/generateur-id.js';

export class GenerateurUuid implements GenerateurId {
  generer(): string {
    return randomUUID();
  }
}
