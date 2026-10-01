import { describe, expect, it } from 'vitest';
import { calculerLocalisation } from '../../src/domain/localisation.js';
import { construireEmplacementsSeed, peuplerEmplacements } from '../../src/seed-donnees.js';
import { EmplacementRepositoryEnMemoire } from '../fakes/emplacement-repository-en-memoire.js';

describe('données du seed', () => {
  const emplacements = construireEmplacementsSeed();
  const compter = (type: string) => emplacements.filter((e) => e.type === type).length;

  it('contient 1 étage, 2 salles, 4 rayons, 3 étagères par rayon et aucun niveau', () => {
    expect(compter('etage')).toBe(1);
    expect(compter('salle')).toBe(2);
    expect(compter('rayon')).toBe(4);
    expect(compter('etagere')).toBe(12);
    expect(compter('niveau')).toBe(0);
  });

  it('a des identifiants uniques et stables', () => {
    expect(new Set(emplacements.map((e) => e.id)).size).toBe(emplacements.length);
    expect(emplacements.map((e) => e.id)).toContain('etagere-2-1-3');
  });

  it('chaque rayon contient exactement 3 étagères', () => {
    for (const rayon of emplacements.filter((e) => e.type === 'rayon')) {
      expect(emplacements.filter((e) => e.parentId === rayon.id)).toHaveLength(3);
    }
  });

  it('place les parents avant les enfants', () => {
    const vus = new Set<string>();
    for (const e of emplacements) {
      if (e.parentId !== null) expect(vus.has(e.parentId)).toBe(true);
      vus.add(e.id);
    }
  });

  it('donne une localisation complète et des coordonnées à chaque étagère', async () => {
    const repo = new EmplacementRepositoryEnMemoire();
    await peuplerEmplacements(repo);
    const parId = new Map((await repo.trouverTous()).map((e) => [e.id, e]));

    const chemin = ['etage-1', 'salle-2', 'rayon-2-1', 'etagere-2-1-3'].map((id) => parId.get(id)!);
    const loc = calculerLocalisation(chemin);
    expect(loc.libelle).toBe('Étage 1 > Salle B > Rayon Sciences > Étagère Sciences 3');
    expect(loc.coordonnees).toEqual({ x: 80, y: 10 });

    for (const e of emplacements.filter((x) => x.type === 'etagere')) {
      expect(e.coordonnees).not.toBeNull();
    }
  });
});
