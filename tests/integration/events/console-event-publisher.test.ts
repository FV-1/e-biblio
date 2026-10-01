import { describe, expect, it } from 'vitest';
import { ConsoleEventPublisher } from '../../../src/adapters/events/console-event-publisher.js';

describe('ConsoleEventPublisher', () => {
  it('écrit l’événement sur une ligne JSON préfixée par son type', async () => {
    const lignes: string[] = [];
    await new ConsoleEventPublisher((l) => lignes.push(l)).publier({
      type: 'ExemplaireDetecte',
      exemplaireId: 'ex-1',
      livreId: 'livre-1',
      emplacementDetecteId: 'etagere-2',
      emplacementTheoriqueId: 'etagere-1',
      malRange: true,
      dateDetection: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatch(/^\[evenement\] ExemplaireDetecte \{/);
    expect(JSON.parse(lignes[0]!.replace(/^\[evenement\] ExemplaireDetecte /, ''))).toMatchObject({
      exemplaireId: 'ex-1',
      malRange: true,
      dateDetection: '2026-01-01T00:00:00.000Z',
    });
  });
});
