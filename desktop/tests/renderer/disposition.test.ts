import { describe, expect, it } from 'vitest';
import type { Emplacement } from '../../src/commun/api';
import { construireDisposition, ETAGERE } from '../../src/renderer/src/plan/disposition';
import { emplacements } from '../fixtures/exemplaires';

describe('construireDisposition', () => {
  it('place chaque étagère au sol : x du plan en x, y du plan en z', () => {
    const { etageres } = construireDisposition(emplacements);
    expect(etageres.map((e) => e.id)).toEqual(['etagere-1-1-1', 'etagere-1-1-2', 'etagere-2-1-1']);
    expect(etageres[0]).toMatchObject({ x: 10, y: 0, z: 10, salleId: 'salle-1', approchee: false });
  });

  it('donne le même rang aux étagères d’un même rayon, pour leur couleur', () => {
    const { etageres } = construireDisposition(emplacements);
    expect(etageres.map((e) => e.rangRayon)).toEqual([0, 0, 1]);
  });

  it('dessine le sol d’une salle autour de ses étagères, avec une marge', () => {
    const salleA = construireDisposition(emplacements).salles.find((s) => s.id === 'salle-1')!;
    expect(salleA.xMin).toBe(10 - ETAGERE.largeur / 2 - 4);
    expect(salleA.xMax).toBe(20 + ETAGERE.largeur / 2 + 4);
    expect(salleA.zMin).toBeCloseTo(10 - ETAGERE.profondeur / 2 - 4);
  });

  it('prend les coordonnées de l’ancêtre le plus proche, et le signale', () => {
    const avecSansCoordonnees: Emplacement[] = [
      ...emplacements,
      { id: 'rayon-2-2', type: 'rayon', nom: 'Rayon Histoire', parentId: 'salle-2', coordonnees: { x: 55, y: 30 } },
      { id: 'etagere-2-2-1', type: 'etagere', nom: 'Étagère Histoire 1', parentId: 'rayon-2-2', coordonnees: null },
    ];
    const etagere = construireDisposition(avecSansCoordonnees).etageres.find((e) => e.id === 'etagere-2-2-1');
    expect(etagere).toMatchObject({ x: 55, z: 30, approchee: true });
  });

  it('écarte une étagère qu’aucune coordonnée ne permet de placer', () => {
    const sansRien: Emplacement[] = [
      { id: 'etage-1', type: 'etage', nom: 'Étage 1', parentId: null, coordonnees: null },
      { id: 'etagere-x', type: 'etagere', nom: 'Étagère X', parentId: 'etage-1', coordonnees: null },
    ];
    const disposition = construireDisposition(sansRien);
    expect(disposition.etageres).toEqual([]);
    expect(disposition.nonPlacees).toEqual(['etagere-x']);
  });

  it('empile les étages dans l’ordre de leur nom', () => {
    const deuxEtages: Emplacement[] = [
      ...emplacements,
      { id: 'etage-2', type: 'etage', nom: 'Étage 2', parentId: null, coordonnees: null },
      { id: 'salle-3', type: 'salle', nom: 'Salle C', parentId: 'etage-2', coordonnees: null },
      { id: 'rayon-3-1', type: 'rayon', nom: 'Rayon BD', parentId: 'salle-3', coordonnees: null },
      { id: 'etagere-3-1-1', type: 'etagere', nom: 'Étagère BD 1', parentId: 'rayon-3-1', coordonnees: { x: 10, y: 10 } },
    ];
    const disposition = construireDisposition(deuxEtages);
    expect(disposition.etageres.find((e) => e.id === 'etagere-3-1-1')!.y).toBeGreaterThan(0);
    expect(disposition.etageres.find((e) => e.id === 'etagere-1-1-1')!.y).toBe(0);
  });

  it('renvoie une disposition vide, sans erreur, s’il n’y a aucun emplacement', () => {
    const disposition = construireDisposition([]);
    expect(disposition.etageres).toEqual([]);
    expect(disposition.etendue).toBeGreaterThan(0);
  });
});
