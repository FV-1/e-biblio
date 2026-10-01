import { describe, expect, it } from 'vitest';
import { ErreurValidation } from '../../../src/domain/erreurs.js';
import { Isbn } from '../../../src/domain/isbn.js';

describe('Isbn', () => {
  it('accepte un ISBN-13 valide', () => {
    expect(Isbn.creer('9780306406157').valeur).toBe('9780306406157');
  });

  it('ignore les tirets et les espaces', () => {
    expect(Isbn.creer(' 978-0-306-40615-7 ').valeur).toBe('9780306406157');
  });

  it('convertit un ISBN-10 en ISBN-13', () => {
    expect(Isbn.creer('0-306-40615-2').valeur).toBe('9780306406157');
  });

  it('accepte un ISBN-10 dont la clé est X (majuscule ou minuscule)', () => {
    expect(Isbn.creer('080442957X').valeur).toBe('9780804429573');
    expect(Isbn.creer('080442957x').valeur).toBe('9780804429573');
  });

  it('considère égaux les ISBN-10 et ISBN-13 d’un même livre', () => {
    expect(Isbn.creer('0306406152').egale(Isbn.creer('9780306406157'))).toBe(true);
  });

  it.each([
    ['9780306406158', 'clé ISBN-13 fausse'],
    ['0306406153', 'clé ISBN-10 fausse'],
    ['1234567890123', 'préfixe autre que 978/979'],
    ['12345', 'longueur incorrecte'],
    ['97803064061X7', 'caractère non numérique'],
    ['', 'chaîne vide'],
  ])('refuse %s (%s)', (brut) => {
    expect(() => Isbn.creer(brut)).toThrow(ErreurValidation);
  });

  it('expose un code d’erreur stable', () => {
    expect(() => Isbn.creer('123')).toThrow(expect.objectContaining({ code: 'ISBN_INVALIDE' }));
  });
});
