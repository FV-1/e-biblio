import { describe, expect, it } from 'vitest';
import { ErreurValidation } from '../../../src/domain/erreurs.js';
import { Exemplaire } from '../../../src/domain/exemplaire.js';
import { Isbn } from '../../../src/domain/isbn.js';
import { construireHierarchie } from '../../fixtures/hierarchie.js';

const isbn = Isbn.creer('9780306406157');
const date = new Date('2026-03-01T09:30:00.000Z');

function exemplaireSurR1() {
  const h = construireHierarchie();
  return { h, exemplaire: Exemplaire.creer({ id: 'ex-1', isbn, emplacement: h.etagere1 }) };
}

describe('Exemplaire', () => {
  describe('création', () => {
    it('est rangé sur une étagère, sans détection', () => {
      const { exemplaire } = exemplaireSurR1();
      expect(exemplaire.emplacementId).toBe('etagere-r1');
      expect(exemplaire.derniereDetection).toBeNull();
    });

    it.each(['etage', 'salle', 'rayon', 'niveau'] as const)('refuse un rangement sur un emplacement de type %s', (type) => {
      const h = construireHierarchie();
      const emplacement = h.tous.find((e) => e.type === type)!;
      expect(() => Exemplaire.creer({ id: 'ex', isbn, emplacement })).toThrow(
        expect.objectContaining({ code: 'EMPLACEMENT_NON_RANGEABLE' }),
      );
    });
  });

  describe('estMalRange', () => {
    it('est faux tant qu’il n’a jamais été détecté', () => {
      expect(exemplaireSurR1().exemplaire.estMalRange()).toBe(false);
    });

    it('est faux si détecté à sa place', () => {
      const { h, exemplaire } = exemplaireSurR1();
      exemplaire.enregistrerDetection(h.etagere1, date);
      expect(exemplaire.estMalRange()).toBe(false);
    });

    it('est vrai si détecté ailleurs', () => {
      const { h, exemplaire } = exemplaireSurR1();
      exemplaire.enregistrerDetection(h.etagere2, date);
      expect(exemplaire.estMalRange()).toBe(true);
    });

    it('redevient faux quand il est de nouveau détecté à sa place', () => {
      const { h, exemplaire } = exemplaireSurR1();
      exemplaire.enregistrerDetection(h.etagere2, date);
      exemplaire.enregistrerDetection(h.etagere1, new Date(date.getTime() + 1000));
      expect(exemplaire.estMalRange()).toBe(false);
    });
  });

  describe('enregistrerDetection', () => {
    it('met à jour la position constatée sans toucher à la position théorique', () => {
      const { h, exemplaire } = exemplaireSurR1();
      exemplaire.enregistrerDetection(h.etagere2, date);
      expect(exemplaire.derniereDetection).toEqual({ emplacementId: 'etagere-r2', date });
      expect(exemplaire.emplacementId).toBe('etagere-r1');
    });

    it('renvoie un événement ExemplaireDetecte complet', () => {
      const { h, exemplaire } = exemplaireSurR1();
      expect(exemplaire.enregistrerDetection(h.etagere2, date)).toEqual({
        type: 'ExemplaireDetecte',
        exemplaireId: 'ex-1',
        isbn: '9780306406157',
        emplacementDetecteId: 'etagere-r2',
        emplacementTheoriqueId: 'etagere-r1',
        malRange: true,
        dateDetection: date,
      });
    });

    it('refuse une détection hors étagère et conserve l’état précédent', () => {
      const { h, exemplaire } = exemplaireSurR1();
      exemplaire.enregistrerDetection(h.etagere2, date);
      expect(() => exemplaire.enregistrerDetection(h.rayon, date)).toThrow(ErreurValidation);
      expect(exemplaire.derniereDetection?.emplacementId).toBe('etagere-r2');
    });

    it('protège son état interne contre les modifications extérieures de la date', () => {
      const { h, exemplaire } = exemplaireSurR1();
      const dateMutable = new Date(date);
      exemplaire.enregistrerDetection(h.etagere1, dateMutable);
      dateMutable.setFullYear(2000);
      exemplaire.derniereDetection!.date.setFullYear(1990);
      expect(exemplaire.derniereDetection?.date).toEqual(date);
    });
  });

  it('se reconstitue à l’identique depuis son snapshot (avec détection)', () => {
    const { h, exemplaire } = exemplaireSurR1();
    exemplaire.enregistrerDetection(h.etagere2, date);
    const copie = Exemplaire.reconstituer(exemplaire.versSnapshot());
    expect(copie.versSnapshot()).toEqual(exemplaire.versSnapshot());
    expect(copie.estMalRange()).toBe(true);
  });
});
