import { describe, expect, it } from 'vitest';
import { calculerLocalisation } from '../../../src/domain/localisation.js';
import { construireHierarchie } from '../../fixtures/hierarchie.js';

describe('calculerLocalisation', () => {
  it('construit le chemin complet et le libellé', () => {
    const { etage, salle, rayon, etagere1 } = construireHierarchie();
    const loc = calculerLocalisation([etage, salle, rayon, etagere1]);

    expect(loc.libelle).toBe('Étage 1 > Salle A > Rayon Romans > Étagère R1');
    expect(loc.chemin.map((e) => e.type)).toEqual(['etage', 'salle', 'rayon', 'etagere']);
  });

  it('utilise les coordonnées propres de l’emplacement quand elles existent', () => {
    const { etage, salle, rayon, etagere1 } = construireHierarchie();
    expect(calculerLocalisation([etage, salle, rayon, etagere1]).coordonnees).toEqual({ x: 10, y: 20 });
  });

  it('hérite des coordonnées de l’ancêtre le plus proche sinon', () => {
    const { etage, salle, rayon, etagere2 } = construireHierarchie();
    expect(calculerLocalisation([etage, salle, rayon, etagere2]).coordonnees).toEqual({ x: 5, y: 5 });
  });

  it('renvoie null si aucun maillon n’a de coordonnées', () => {
    const { etage } = construireHierarchie();
    expect(calculerLocalisation([etage]).coordonnees).toBeNull();
  });

  it('refuse un chemin vide, incomplet ou incohérent', () => {
    const { etage, salle, rayon, etagere1 } = construireHierarchie();
    expect(() => calculerLocalisation([])).toThrow();
    expect(() => calculerLocalisation([salle, rayon])).toThrow(/racine/);
    expect(() => calculerLocalisation([etage, rayon, etagere1])).toThrow(/incohérent/);
  });
});
