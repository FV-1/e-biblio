import { describe, expect, it } from 'vitest';
import { construireDonneesDemo, peuplerDemo } from '../../src/seed-demo-donnees.js';
import { construireEmplacementsSeed } from '../../src/seed-donnees.js';
import { ExemplaireRepositoryEnMemoire } from '../fakes/exemplaire-repository-en-memoire.js';
import { LivreRepositoryEnMemoire } from '../fakes/livre-repository-en-memoire.js';

describe('données de démonstration', () => {
  const emplacements = construireEmplacementsSeed();
  const maintenant = new Date('2026-10-28T10:00:00Z');
  const { livres, exemplaires } = construireDonneesDemo(emplacements, maintenant);

  it('contient plus de 25 œuvres, pour avoir plusieurs pages dans la vue « base de données »', () => {
    expect(livres.length).toBeGreaterThan(25);
  });

  it('a des identifiants et des ISBN uniques', () => {
    expect(new Set(livres.map((l) => l.id)).size).toBe(livres.length);
    expect(new Set(exemplaires.map((e) => e.id)).size).toBe(exemplaires.length);
    const isbns = livres.flatMap((l) => (l.isbn ? [l.isbn.valeur] : []));
    expect(new Set(isbns).size).toBe(isbns.length);
  });

  it('couvre les cas utiles : sans ISBN, sans couverture, sans auteur, plusieurs auteurs', () => {
    expect(livres.some((l) => l.isbn === null)).toBe(true);
    expect(livres.some((l) => l.isbn !== null && l.couverture === null)).toBe(true);
    expect(livres.some((l) => l.auteurs.length === 0)).toBe(true);
    expect(livres.some((l) => l.auteurs.length > 1)).toBe(true);
  });

  it('mélange exemplaires jamais détectés, bien rangés et mal rangés', () => {
    const jamaisDetectes = exemplaires.filter((e) => e.derniereDetection === null);
    const malRanges = exemplaires.filter((e) => e.estMalRange());
    expect(jamaisDetectes.length).toBeGreaterThan(0);
    expect(malRanges.length).toBeGreaterThan(0);
    expect(exemplaires.length - jamaisDetectes.length - malRanges.length).toBeGreaterThan(0);
  });

  it('numérote les exemplaires de chaque œuvre à partir de 1', () => {
    for (const livre of livres) {
      const numeros = exemplaires.filter((e) => e.livreId === livre.id).map((e) => e.numero);
      expect(numeros).toEqual(numeros.map((_, i) => i + 1));
    }
  });

  it('date les détections dans le passé, à partir de maintenant', () => {
    for (const e of exemplaires) {
      if (e.derniereDetection) expect(e.derniereDetection.date.getTime()).toBeLessThanOrEqual(maintenant.getTime());
    }
  });

  it('enregistre le fonds via les ports', async () => {
    const livreRepo = new LivreRepositoryEnMemoire();
    const exemplaireRepo = new ExemplaireRepositoryEnMemoire(livreRepo);
    await peuplerDemo(livreRepo, exemplaireRepo, emplacements, maintenant);

    expect(livreRepo.tous()).toHaveLength(livres.length);
    expect(exemplaireRepo.tous()).toHaveLength(exemplaires.length);
    expect(await exemplaireRepo.rechercher('zola')).toHaveLength(3);
  });
});
