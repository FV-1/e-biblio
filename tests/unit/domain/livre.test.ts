import { describe, expect, it } from 'vitest';
import { ErreurValidation } from '../../../src/domain/erreurs.js';
import { Isbn } from '../../../src/domain/isbn.js';
import { Livre } from '../../../src/domain/livre.js';

const isbn = Isbn.creer('9780306406157');

function livre(surcharges: Partial<Parameters<typeof Livre.creer>[0]> = {}): Livre {
  return Livre.creer({ id: 'livre-1', isbn, titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: null, ...surcharges });
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
      ['0-306-40615-2', 'ISBN-10 complet (converti en ISBN-13)'],
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

  it('exige un identifiant', () => {
    expect(() => livre({ id: ' ' })).toThrow(ErreurValidation);
  });

  describe('sans ISBN', () => {
    const sansIsbn = () => livre({ isbn: null, titre: 'Registre paroissial 1789' });

    it('est accepté et se reconstitue à l’identique', () => {
      const l = sansIsbn();
      expect(l.isbn).toBeNull();
      expect(Livre.reconstituer(l.versSnapshot()).versSnapshot()).toEqual(l.versSnapshot());
    });

    it('reste trouvable par titre et auteur, jamais par un ISBN', () => {
      expect(sansIsbn().correspond('paroissial')).toBe(true);
      expect(sansIsbn().correspond('hugo')).toBe(true);
      expect(sansIsbn().correspond('978-0-306')).toBe(false);
      expect(sansIsbn().correspond('0306406152')).toBe(false);
    });
  });
});
