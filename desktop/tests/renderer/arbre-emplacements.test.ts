import { describe, expect, it } from 'vitest';
import { cheminVers, completerSelection, enfantsDe } from '../../src/renderer/src/ajout/arbre-emplacements';
import { formeIsbnValide, nettoyerIsbn } from '../../src/renderer/src/ajout/isbn';
import { emplacements } from '../fixtures/exemplaires';

describe('arbre des emplacements', () => {
  it('liste les enfants directs, triés par nom (numéros dans l’ordre naturel)', () => {
    expect(enfantsDe(emplacements, null).map((e) => e.id)).toEqual(['etage-1']);
    expect(enfantsDe(emplacements, 'etage-1').map((e) => e.nom)).toEqual(['Salle A', 'Salle B']);
    expect(enfantsDe(emplacements, 'etagere-1-1-1')).toEqual([]);
  });

  it('reconstitue le chemin racine → emplacement', () => {
    expect(cheminVers(emplacements, 'etagere-2-1-1').map((e) => e.id)).toEqual(['etage-1', 'salle-2', 'rayon-2-1', 'etagere-2-1-1']);
    expect(cheminVers(emplacements, 'inconnu')).toEqual([]);
  });

  it('complète automatiquement les niveaux à option unique', () => {
    // Un seul étage : il est choisi d'office, puis il faut choisir la salle.
    expect(completerSelection(emplacements, [])).toEqual(['etage-1']);
    // Salle B n'a qu'un rayon, qui n'a qu'une étagère : on descend jusqu'à l'étagère.
    expect(completerSelection(emplacements, ['etage-1', 'salle-2'])).toEqual(['etage-1', 'salle-2', 'rayon-2-1', 'etagere-2-1-1']);
    // Rayon Romans a deux étagères : on s'arrête au rayon.
    expect(completerSelection(emplacements, ['etage-1', 'salle-1'])).toEqual(['etage-1', 'salle-1', 'rayon-1-1']);
  });
});

describe('forme d’un ISBN', () => {
  it.each(['978-2-07-036822-8', '9782070368228', '0-8044-2957-x', '207036822X'])('accepte %s', (isbn) => {
    expect(formeIsbnValide(isbn)).toBe(true);
  });

  it.each(['', '12345', '1234567890123', '97820703682', 'abcdefghij'])('refuse « %s »', (isbn) => {
    expect(formeIsbnValide(isbn)).toBe(false);
  });

  it('retire tirets et espaces, met le X en majuscule', () => {
    expect(nettoyerIsbn(' 0-8044 2957-x ')).toBe('080442957X');
  });
});
