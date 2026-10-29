import { describe, expect, it } from 'vitest';
import { corpsAjouterExemplaire, requeteExemplaires, requeteLivres } from '../../../src/adapters/http/schemas.js';

/** Validation des entrées HTTP (forme uniquement ; les règles métier restent dans le domaine). */
describe('schémas HTTP', () => {
  describe('GET /exemplaires', () => {
    it.each([[{ q: ' hugo ' }, { q: 'hugo' }], [{ livreId: 'livre-1' }, { livreId: 'livre-1' }], [{ emplacementId: 'etagere-1-1-1' }, { emplacementId: 'etagere-1-1-1' }]])(
      'accepte %j',
      (requete, attendu) => {
        expect(requeteExemplaires.parse(requete)).toEqual(attendu);
      },
    );

    it.each([{}, { q: '' }, { q: 'a', livreId: 'b' }, { livreId: '' }, { emplacementId: '' }, { livreId: 'a', emplacementId: 'b' }])('refuse %j', (requete) => {
      expect(requeteExemplaires.safeParse(requete).success).toBe(false);
    });
  });

  describe('GET /livres', () => {
    it('convertit les paramètres de la chaîne de requête', () => {
      expect(
        requeteLivres.parse({ q: ' zola ', isbn: 'sans', couverture: 'avec', tri: 'auteur', ordre: 'desc', page: '2', parPage: '50' }),
      ).toEqual({ q: 'zola', isbn: false, couverture: true, tri: 'auteur', ordre: 'desc', page: 2, parPage: 50 });
      expect(requeteLivres.parse({})).toEqual({});
    });

    it.each([{ tri: 'pirate' }, { isbn: 'oui' }, { page: '0' }, { parPage: '101' }, { page: 'abc' }, { ordre: 'haut' }])(
      'refuse %j',
      (requete) => {
        expect(requeteLivres.safeParse(requete).success).toBe(false);
      },
    );
  });

  describe('POST /exemplaires', () => {
    it.each([
      { emplacementId: 'e', isbn: '9782070368228' },
      { emplacementId: 'e', titre: 'Registre' },
      { emplacementId: 'e', isbn: '9782070368228', titre: 'T', auteurs: ['A'], couverture: null },
      { emplacementId: 'e', livreId: 'livre-1' },
    ])('accepte %j', (corps) => {
      expect(corpsAjouterExemplaire.safeParse(corps).success).toBe(true);
    });

    it.each([
      { emplacementId: 'e' },
      { emplacementId: 'e', livreId: 'l', isbn: '9782070368228' },
      { emplacementId: 'e', livreId: 'l', titre: 'T' },
      { emplacementId: 'e', auteurs: ['A'] },
      { emplacementId: 'e', titre: 'T', couverture: 'ftp://x' },
      { emplacementId: 'e', isbn: '9782070368228', inconnu: 1 },
    ])('refuse %j', (corps) => {
      expect(corpsAjouterExemplaire.safeParse(corps).success).toBe(false);
    });
  });
});
