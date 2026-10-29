import { describe, expect, it } from 'vitest';
import type { Exemplaire } from '../../src/commun/api';
import { apparenceLivre, bilanEtagere, repartirSurPlanches, statutSurEtagere } from '../../src/renderer/src/plan/contenu-etagere';
import { exemplaireBienRange, exemplaireMalRange, exemplaireSansIsbn } from '../fixtures/exemplaires';

// exemplaireMalRange : rangé sur etagere-1-1-1, vu en dernier sur etagere-1-1-3.
describe('statutSurEtagere', () => {
  it('« ici » pour un exemplaire rangé sur l’étagère et pas vu ailleurs', () => {
    expect(statutSurEtagere(exemplaireBienRange, 'etagere-1-1-1')).toBe('ici');
  });

  it('« absent » sur l’étagère où il devrait être, « intrus » sur celle où il a été vu', () => {
    expect(statutSurEtagere(exemplaireMalRange, 'etagere-1-1-1')).toBe('absent');
    expect(statutSurEtagere(exemplaireMalRange, 'etagere-1-1-3')).toBe('intrus');
  });
});

describe('repartirSurPlanches', () => {
  const titre = (e: Exemplaire, t: string, numero = 1): Exemplaire => ({ ...e, id: `${t}-${numero}`, numero, livre: { ...e.livre, titre: t } });

  it('trie par titre sans tenir compte des accents ni de la casse, puis par numéro', () => {
    const livres = [titre(exemplaireBienRange, 'zola'), titre(exemplaireBienRange, 'Émile', 2), titre(exemplaireBienRange, 'emile', 1)];
    const planches = repartirSurPlanches(livres, 'etagere-1-1-1', 1);
    expect(planches[0]!.map((l) => l.exemplaire.id)).toEqual(['emile-1', 'Émile-2', 'zola-1']);
  });

  it('répartit les livres sur les planches, à une unité près, de haut en bas', () => {
    const livres = ['a', 'b', 'c', 'd', 'e', 'f'].map((t) => titre(exemplaireBienRange, t));
    expect(repartirSurPlanches(livres, 'etagere-1-1-1').map((p) => p.length)).toEqual([2, 2, 1, 1]);
  });

  it('garde des planches vides quand l’étagère est vide', () => {
    expect(repartirSurPlanches([], 'etagere-1-1-1')).toEqual([[], [], [], []]);
  });
});

describe('bilanEtagere', () => {
  it('compte les exemplaires à leur place, les intrus et les absents', () => {
    expect(bilanEtagere([exemplaireBienRange, exemplaireMalRange, exemplaireSansIsbn], 'etagere-1-1-1')).toEqual({
      total: 3,
      ici: 2,
      intrus: 0,
      absents: 1,
    });
  });
});

describe('apparenceLivre', () => {
  it('donne toujours la même tranche au même livre', () => {
    expect(apparenceLivre('livre-1984')).toEqual(apparenceLivre('livre-1984'));
    expect(apparenceLivre('livre-1984').hauteur).toBeGreaterThanOrEqual(0.72);
    expect(apparenceLivre('livre-1984').hauteur).toBeLessThan(0.96);
  });
});
