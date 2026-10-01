import { describe, expect, it } from 'vitest';
import { Coordonnees } from '../../../src/domain/coordonnees.js';
import { Emplacement } from '../../../src/domain/emplacement.js';
import { ErreurValidation } from '../../../src/domain/erreurs.js';
import { typeParentAttendu } from '../../../src/domain/type-emplacement.js';
import { construireHierarchie } from '../../fixtures/hierarchie.js';

describe('Emplacement', () => {
  describe('règle de hiérarchie stricte', () => {
    it('définit le type parent attendu pour chaque type', () => {
      expect(typeParentAttendu('etage')).toBeNull();
      expect(typeParentAttendu('salle')).toBe('etage');
      expect(typeParentAttendu('rayon')).toBe('salle');
      expect(typeParentAttendu('etagere')).toBe('rayon');
      expect(typeParentAttendu('niveau')).toBe('etagere');
    });

    it('crée une hiérarchie complète valide', () => {
      const { salle, etage } = construireHierarchie();
      expect(salle.parentId).toBe(etage.id);
    });

    it('refuse un étage avec un parent', () => {
      const { etage } = construireHierarchie();
      expect(() => Emplacement.creer({ id: 'e2', type: 'etage', nom: 'Étage 2', parent: etage })).toThrow(
        expect.objectContaining({ code: 'HIERARCHIE_INVALIDE' }),
      );
    });

    it('refuse une salle sans parent', () => {
      expect(() => Emplacement.creer({ id: 's', type: 'salle', nom: 'Salle', parent: null })).toThrow(ErreurValidation);
    });

    it('refuse de sauter un niveau de hiérarchie (étagère directement dans une salle)', () => {
      const { salle } = construireHierarchie();
      expect(() => Emplacement.creer({ id: 'x', type: 'etagere', nom: 'Étagère', parent: salle })).toThrow(
        /doit avoir un parent de type « rayon »/,
      );
    });

    it('refuse un parent de type plus profond (rayon sous une étagère)', () => {
      const { etagere1 } = construireHierarchie();
      expect(() => Emplacement.creer({ id: 'x', type: 'rayon', nom: 'Rayon', parent: etagere1 })).toThrow(ErreurValidation);
    });

    it('permet de déplacer un rayon vers une autre salle', () => {
      const { etage, rayon } = construireHierarchie();
      const salleB = Emplacement.creer({ id: 'salle-b', type: 'salle', nom: 'Salle B', parent: etage });
      rayon.deplacerSous(salleB);
      expect(rayon.parentId).toBe('salle-b');
    });

    it('refuse un déplacement qui viole la hiérarchie', () => {
      const { etage, rayon } = construireHierarchie();
      expect(() => rayon.deplacerSous(etage)).toThrow(ErreurValidation);
      expect(rayon.parentId).toBe('salle-a');
    });
  });

  describe('nom', () => {
    it('normalise les espaces', () => {
      const e = Emplacement.creer({ id: 'e', type: 'etage', nom: '  Rez   de chaussée ', parent: null });
      expect(e.nom).toBe('Rez de chaussée');
    });

    it('refuse un nom vide, y compris au renommage', () => {
      expect(() => Emplacement.creer({ id: 'e', type: 'etage', nom: '   ', parent: null })).toThrow(
        expect.objectContaining({ code: 'CHAMP_OBLIGATOIRE' }),
      );
      const { etage } = construireHierarchie();
      expect(() => etage.renommer('')).toThrow(ErreurValidation);
    });
  });

  describe('coordonnées', () => {
    it('sont facultatives', () => {
      expect(construireHierarchie().etagere2.coordonnees).toBeNull();
    });

    it('refusent les valeurs non finies', () => {
      expect(() => Coordonnees.creer(Number.NaN, 1)).toThrow(expect.objectContaining({ code: 'COORDONNEES_INVALIDES' }));
      expect(() => Coordonnees.creer(1, Number.POSITIVE_INFINITY)).toThrow(ErreurValidation);
    });

    it('peuvent être modifiées ou retirées', () => {
      const { etagere2 } = construireHierarchie();
      etagere2.definirCoordonnees(Coordonnees.creer(3, 4));
      expect(etagere2.coordonnees?.versDonnees()).toEqual({ x: 3, y: 4 });
      etagere2.definirCoordonnees(null);
      expect(etagere2.coordonnees).toBeNull();
    });
  });

  it('seule une étagère peut accueillir un exemplaire', () => {
    const h = construireHierarchie();
    expect(h.etagere1.peutAccueillirExemplaire()).toBe(true);
    for (const e of [h.etage, h.salle, h.rayon, h.niveau]) {
      expect(e.peutAccueillirExemplaire()).toBe(false);
    }
  });

  it('se reconstitue à l’identique depuis son snapshot', () => {
    const { etagere1 } = construireHierarchie();
    const copie = Emplacement.reconstituer(etagere1.versSnapshot());
    expect(copie.versSnapshot()).toEqual(etagere1.versSnapshot());
  });
});
