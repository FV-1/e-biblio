import { beforeEach, describe, expect, it } from 'vitest';
import { ConsulterEmplacement } from '../../../src/application/emplacements/consulter-emplacement.js';
import { CreerEmplacement } from '../../../src/application/emplacements/creer-emplacement.js';
import { ListerEmplacements } from '../../../src/application/emplacements/lister-emplacements.js';
import { ModifierEmplacement } from '../../../src/application/emplacements/modifier-emplacement.js';
import { SupprimerEmplacement } from '../../../src/application/emplacements/supprimer-emplacement.js';
import { ErreurConflit, ErreurIntrouvable, ErreurValidation } from '../../../src/domain/erreurs.js';
import { ajouterExemplaireHugo, creerContexte, type Contexte } from './contexte.js';

let ctx: Contexte;
beforeEach(() => {
  ctx = creerContexte();
});

describe('CreerEmplacement', () => {
  const creer = () => new CreerEmplacement(ctx.emplacements, ctx.generateurId);

  it('crée un emplacement avec un id généré et le persiste', async () => {
    const vue = await creer().executer({ type: 'etagere', nom: 'Étagère R3', parentId: 'rayon-romans', coordonnees: { x: 30, y: 20 } });

    expect(vue).toEqual({ id: 'gen-1', type: 'etagere', nom: 'Étagère R3', parentId: 'rayon-romans', coordonnees: { x: 30, y: 20 } });
    expect((await ctx.emplacements.trouverParId('gen-1'))?.nom).toBe('Étagère R3');
  });

  it('crée un étage sans parent', async () => {
    const vue = await creer().executer({ type: 'etage', nom: 'Étage 2', parentId: null, coordonnees: null });
    expect(vue.parentId).toBeNull();
  });

  it('échoue avec 404 métier si le parent n’existe pas', async () => {
    await expect(creer().executer({ type: 'salle', nom: 'S', parentId: 'fantome', coordonnees: null })).rejects.toThrow(
      ErreurIntrouvable,
    );
  });

  it('applique la règle de hiérarchie du domaine et ne persiste rien en cas d’échec', async () => {
    const avant = (await ctx.emplacements.trouverTous()).length;
    await expect(
      creer().executer({ type: 'etagere', nom: 'Mal placée', parentId: 'salle-a', coordonnees: null }),
    ).rejects.toThrow(expect.objectContaining({ code: 'HIERARCHIE_INVALIDE' }));
    expect(await ctx.emplacements.trouverTous()).toHaveLength(avant);
  });
});

describe('ListerEmplacements', () => {
  it('liste tout, par type ou par parent', async () => {
    const lister = new ListerEmplacements(ctx.emplacements);
    expect(await lister.executer()).toHaveLength(6);
    expect((await lister.executer({ type: 'etagere' })).map((e) => e.id)).toEqual(['etagere-r1', 'etagere-r2']);
    expect((await lister.executer({ parentId: 'salle-a' })).map((e) => e.id)).toEqual(['rayon-romans']);
    expect(await lister.executer({ parentId: 'salle-a', type: 'etagere' })).toEqual([]);
  });
});

describe('ConsulterEmplacement', () => {
  it('renvoie la localisation complète et les enfants directs', async () => {
    const vue = await new ConsulterEmplacement(ctx.emplacements).executer('rayon-romans');
    expect(vue.localisation.libelle).toBe('Étage 1 > Salle A > Rayon Romans');
    expect(vue.enfants.map((e) => e.id)).toEqual(['etagere-r1', 'etagere-r2']);
  });

  it('échoue si l’emplacement n’existe pas', async () => {
    await expect(new ConsulterEmplacement(ctx.emplacements).executer('fantome')).rejects.toThrow(
      expect.objectContaining({ code: 'EMPLACEMENT_INTROUVABLE' }),
    );
  });
});

describe('ModifierEmplacement', () => {
  const modifier = () => new ModifierEmplacement(ctx.emplacements);

  it('modifie uniquement les champs fournis', async () => {
    const vue = await modifier().executer('etagere-r1', { nom: 'Étagère principale' });
    expect(vue).toMatchObject({ nom: 'Étagère principale', parentId: 'rayon-romans', coordonnees: { x: 10, y: 20 } });
  });

  it('retire les coordonnées avec null', async () => {
    await modifier().executer('etagere-r1', { coordonnees: null });
    expect((await ctx.emplacements.trouverParId('etagere-r1'))?.coordonnees).toBeNull();
  });

  it('déplace un emplacement sous un nouveau parent valide', async () => {
    await new CreerEmplacement(ctx.emplacements, ctx.generateurId).executer({
      type: 'rayon', nom: 'Rayon BD', parentId: 'salle-a', coordonnees: null,
    });
    await modifier().executer('etagere-r2', { parentId: 'gen-1' });
    expect((await ctx.emplacements.trouverParId('etagere-r2'))?.parentId).toBe('gen-1');
  });

  it('ne persiste rien si une des modifications est invalide', async () => {
    await expect(modifier().executer('etagere-r1', { nom: 'Nouveau nom', parentId: 'salle-a' })).rejects.toThrow(
      ErreurValidation,
    );
    expect((await ctx.emplacements.trouverParId('etagere-r1'))?.nom).toBe('Étagère R1');
  });

  it('échoue si l’emplacement ou le nouveau parent n’existe pas', async () => {
    await expect(modifier().executer('fantome', { nom: 'x' })).rejects.toThrow(ErreurIntrouvable);
    await expect(modifier().executer('etagere-r1', { parentId: 'fantome' })).rejects.toThrow(ErreurIntrouvable);
  });
});

describe('SupprimerEmplacement', () => {
  const supprimer = () => new SupprimerEmplacement(ctx.emplacements, ctx.exemplaires);

  it('supprime un emplacement vide', async () => {
    await supprimer().executer('etagere-r2');
    expect(await ctx.emplacements.trouverParId('etagere-r2')).toBeNull();
  });

  it('refuse (409) si l’emplacement a des enfants', async () => {
    await expect(supprimer().executer('rayon-romans')).rejects.toThrow(ErreurConflit);
    expect(await ctx.emplacements.trouverParId('rayon-romans')).not.toBeNull();
  });

  it('refuse (409) si un exemplaire y est rangé', async () => {
    await ajouterExemplaireHugo(ctx);
    await ctx.emplacements.supprimer('niveau-bas'); // R1 n'a plus d'enfant
    await expect(supprimer().executer('etagere-r1')).rejects.toThrow(
      expect.objectContaining({ code: 'EMPLACEMENT_NON_VIDE' }),
    );
  });

  it('refuse (409) si un exemplaire y a été détecté en dernier', async () => {
    const ex = await ajouterExemplaireHugo(ctx);
    ex.enregistrerDetection(ctx.hierarchie.etagere2, new Date());
    await ctx.exemplaires.enregistrer(ex);
    await expect(supprimer().executer('etagere-r2')).rejects.toThrow(ErreurConflit);
  });

  it('échoue si l’emplacement n’existe pas', async () => {
    await expect(supprimer().executer('fantome')).rejects.toThrow(ErreurIntrouvable);
  });
});
