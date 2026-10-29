import { beforeEach, describe, expect, it } from 'vitest';
import { ListerExemplairesDeLEmplacement } from '../../../src/application/exemplaires/lister-exemplaires-de-l-emplacement.js';
import { ListerExemplairesDuLivre } from '../../../src/application/exemplaires/lister-exemplaires-du-livre.js';
import { ListerLivres } from '../../../src/application/livres/lister-livres.js';
import { Exemplaire } from '../../../src/domain/exemplaire.js';
import { Livre } from '../../../src/domain/livre.js';
import { ajouterExemplaireHugo, creerContexte, type Contexte } from './contexte.js';

let ctx: Contexte;

beforeEach(async () => {
  ctx = creerContexte();
  // Fonds : Les Misérables (2 exemplaires, 1 mal rangé) + 30 livres sans ISBN ni exemplaire.
  const mal = await ajouterExemplaireHugo(ctx, 'ex-1');
  mal.enregistrerDetection(ctx.hierarchie.etagere2, ctx.horloge.maintenant());
  await ctx.exemplaires.enregistrer(mal);
  await ajouterExemplaireHugo(ctx, 'ex-2');
  for (let i = 1; i <= 30; i++) {
    await ctx.livres.enregistrer(Livre.creer({ id: `l-${i}`, isbn: null, titre: `Archive n°${String(i).padStart(2, '0')}`, auteurs: [] }));
  }
});

describe('ListerLivres', () => {
  const lister = () => new ListerLivres(ctx.inventaire);

  it('applique les valeurs par défaut : tri par titre, page 1, 25 par page', async () => {
    const page = await lister().executer();
    expect(page).toMatchObject({ total: 31, page: 1, parPage: 25, pages: 2 });
    expect(page.livres).toHaveLength(25);
    expect(page.livres[0]?.titre).toBe('Archive n°01');
  });

  it('renvoie les compteurs et la notice de chaque œuvre', async () => {
    const page = await lister().executer({ terme: 'hugo' });
    expect(page.livres).toEqual([
      {
        id: 'livre-hugo',
        isbn: '9780306406157',
        titre: 'Les Misérables',
        auteurs: ['Victor Hugo'],
        couverture: null,
        nombreExemplaires: 2,
        nombreMalRanges: 1,
      },
    ]);
  });

  it('borne la taille de page (1 à 100) et le numéro de page (≥ 1)', async () => {
    expect(await lister().executer({ parPage: 1000, page: -3 })).toMatchObject({ parPage: 100, page: 1, pages: 1 });
    expect(await lister().executer({ parPage: 0 })).toMatchObject({ parPage: 1, pages: 31 });
  });

  it('ignore un terme vide et transmet filtres et tri', async () => {
    const page = await lister().executer({ terme: '   ', avecIsbn: true, tri: 'malRanges', ordre: 'desc' });
    expect(page.livres.map((l) => l.titre)).toEqual(['Les Misérables']);
  });

  it('indique au moins une page même sans résultat', async () => {
    expect(await lister().executer({ terme: 'balzac' })).toMatchObject({ total: 0, pages: 1, livres: [] });
  });
});

describe('ListerExemplairesDuLivre', () => {
  const lister = () => new ListerExemplairesDuLivre(ctx.exemplaires, ctx.livres, ctx.emplacements);

  it('renvoie les exemplaires de l’œuvre avec leur localisation', async () => {
    const vues = await lister().executer('livre-hugo');
    expect(vues.map((v) => [v.id, v.malRange, v.emplacementTheorique.localisation.libelle])).toEqual([
      ['ex-1', true, 'Étage 1 > Salle A > Rayon Romans > Étagère R1'],
      ['ex-2', false, 'Étage 1 > Salle A > Rayon Romans > Étagère R1'],
    ]);
  });

  it('renvoie une liste vide pour une œuvre sans exemplaire', async () => {
    expect(await lister().executer('l-1')).toEqual([]);
  });

  it('échoue si l’œuvre n’existe pas', async () => {
    await expect(lister().executer('fantome')).rejects.toThrow(expect.objectContaining({ code: 'LIVRE_INTROUVABLE' }));
  });

  it('ne mélange pas les exemplaires de deux œuvres', async () => {
    const autre = Livre.creer({ id: 'l-autre', isbn: null, titre: 'Autre', auteurs: [] });
    await ctx.livres.enregistrer(autre);
    await ctx.exemplaires.enregistrer(Exemplaire.creer({ id: 'ex-autre', livre: autre, numero: 1, emplacement: ctx.hierarchie.etagere2 }));
    expect((await lister().executer('livre-hugo')).map((v) => v.id)).toEqual(['ex-1', 'ex-2']);
  });
});

describe('ListerExemplairesDeLEmplacement', () => {
  const lister = () => new ListerExemplairesDeLEmplacement(ctx.exemplaires, ctx.livres, ctx.emplacements);

  it('renvoie les exemplaires rangés sur l’étagère, avec leur statut', async () => {
    const vues = await lister().executer('etagere-r1');
    expect(vues.map((v) => [v.id, v.malRange])).toEqual([
      ['ex-1', true],
      ['ex-2', false],
    ]);
  });

  it('inclut les exemplaires vus sur l’étagère alors qu’ils sont rangés ailleurs', async () => {
    const vues = await lister().executer('etagere-r2');
    expect(vues.map((v) => [v.id, v.emplacementTheorique.emplacementId, v.derniereDetection?.emplacementId])).toEqual([
      ['ex-1', 'etagere-r1', 'etagere-r2'],
    ]);
  });

  it('échoue si l’emplacement n’existe pas', async () => {
    await expect(lister().executer('fantome')).rejects.toThrow(expect.objectContaining({ code: 'EMPLACEMENT_INTROUVABLE' }));
  });
});
