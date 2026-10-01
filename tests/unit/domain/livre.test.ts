import { describe, expect, it } from 'vitest';
import { ErreurValidation } from '../../../src/domain/erreurs.js';
import { Isbn } from '../../../src/domain/isbn.js';
import { Livre } from '../../../src/domain/livre.js';

const isbn = Isbn.creer('9780306406157');

function livre(surcharges: Partial<Parameters<typeof Livre.creer>[0]> = {}): Livre {
  return Livre.creer({ isbn, titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: null, ...surcharges });
}

describe('Livre', () => {
  it('exige un titre', () => {
    expect(() => livre({ titre: '  ' })).toThrow(ErreurValidation);
  });

  it('nettoie la liste des auteurs (vides et doublons retirés)', () => {
    expect(livre({ auteurs: [' Victor  Hugo ', '', 'Victor Hugo', 'Autre'] }).auteurs).toEqual(['Victor Hugo', 'Autre']);
  });

  it('accepte un livre sans auteur ni couverture', () => {
    const l = livre({ auteurs: [], couverture: '  ' });
    expect(l.auteurs).toEqual([]);
    expect(l.couverture).toBeNull();
  });

  describe('correspond (règle de recherche)', () => {
    it.each([
      ['misérables', 'titre partiel'],
      ['MISERABLES', 'casse et accents ignorés'],
      ['hugo', 'auteur'],
      ['978030640', 'début d’ISBN'],
      ['978-0-306', 'ISBN avec tirets'],
    ])('trouve « %s » (%s)', (terme) => {
      expect(livre().correspond(terme)).toBe(true);
    });

    it.each(['zola', '', '   ', '-'])('ne trouve pas « %s »', (terme) => {
      expect(livre().correspond(terme)).toBe(false);
    });
  });

  it('se reconstitue à l’identique depuis son snapshot', () => {
    const l = livre({ couverture: 'https://covers.example/1.jpg' });
    expect(Livre.reconstituer(l.versSnapshot()).versSnapshot()).toEqual(l.versSnapshot());
  });
});
