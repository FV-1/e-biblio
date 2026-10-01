import { beforeEach, describe, expect, it } from 'vitest';
import { EnregistrerDetection } from '../../../src/application/detections/enregistrer-detection.js';
import { ErreurIntrouvable, ErreurValidation } from '../../../src/domain/erreurs.js';
import type { EvenementDomaine } from '../../../src/domain/evenements.js';
import type { EventPublisher } from '../../../src/ports/event-publisher.js';
import { ajouterExemplaireHugo, creerContexte, type Contexte } from './contexte.js';

let ctx: Contexte;
beforeEach(async () => {
  ctx = creerContexte();
  await ajouterExemplaireHugo(ctx);
});

const detecter = (publisher: EventPublisher = ctx.publisher) =>
  new EnregistrerDetection(ctx.exemplaires, ctx.livres, ctx.emplacements, publisher, ctx.horloge);

describe('EnregistrerDetection', () => {
  it('met à jour la position constatée avec la date de l’horloge et la persiste', async () => {
    const vue = await detecter().executer({ exemplaireId: 'ex-hugo', emplacementId: 'etagere-r2' });

    expect(vue.derniereDetection).toMatchObject({ emplacementId: 'etagere-r2', date: ctx.horloge.maintenant() });
    expect(vue.malRange).toBe(true);
    expect((await ctx.exemplaires.trouverParId('ex-hugo'))?.derniereDetection?.emplacementId).toBe('etagere-r2');
  });

  it('publie un événement ExemplaireDetecte', async () => {
    await detecter().executer({ exemplaireId: 'ex-hugo', emplacementId: 'etagere-r2' });

    expect(ctx.publisher.publies).toEqual([
      {
        type: 'ExemplaireDetecte',
        exemplaireId: 'ex-hugo',
        isbn: '9780306406157',
        emplacementDetecteId: 'etagere-r2',
        emplacementTheoriqueId: 'etagere-r1',
        malRange: true,
        dateDetection: ctx.horloge.maintenant(),
      },
    ]);
  });

  it('une détection à la bonne place rend l’exemplaire bien rangé', async () => {
    await detecter().executer({ exemplaireId: 'ex-hugo', emplacementId: 'etagere-r2' });
    ctx.horloge.avancer(60_000);
    const vue = await detecter().executer({ exemplaireId: 'ex-hugo', emplacementId: 'etagere-r1' });

    expect(vue.malRange).toBe(false);
    expect(ctx.publisher.publies.map((e) => e.malRange)).toEqual([true, false]);
  });

  it('persiste AVANT de publier (aucun événement pour un fait non enregistré)', async () => {
    const ordre: string[] = [];
    const enregistrerOriginal = ctx.exemplaires.enregistrer.bind(ctx.exemplaires);
    ctx.exemplaires.enregistrer = async (e) => {
      ordre.push('enregistrer');
      return enregistrerOriginal(e);
    };
    const publisher: EventPublisher = {
      publier: async (_: EvenementDomaine) => {
        ordre.push('publier');
      },
    };

    await detecter(publisher).executer({ exemplaireId: 'ex-hugo', emplacementId: 'etagere-r2' });
    expect(ordre).toEqual(['enregistrer', 'publier']);
  });

  it('échoue si l’exemplaire ou l’emplacement n’existe pas, sans rien publier', async () => {
    await expect(detecter().executer({ exemplaireId: 'fantome', emplacementId: 'etagere-r1' })).rejects.toThrow(
      expect.objectContaining({ code: 'EXEMPLAIRE_INTROUVABLE' }),
    );
    await expect(detecter().executer({ exemplaireId: 'ex-hugo', emplacementId: 'fantome' })).rejects.toThrow(
      ErreurIntrouvable,
    );
    expect(ctx.publisher.publies).toEqual([]);
  });

  it('refuse une détection hors étagère, sans rien persister ni publier', async () => {
    await expect(detecter().executer({ exemplaireId: 'ex-hugo', emplacementId: 'rayon-romans' })).rejects.toThrow(
      ErreurValidation,
    );
    expect((await ctx.exemplaires.trouverParId('ex-hugo'))?.derniereDetection).toBeNull();
    expect(ctx.publisher.publies).toEqual([]);
  });
});
