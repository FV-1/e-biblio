import { beforeEach, describe, expect, it } from 'vitest';
import {
  AjouterExemplaire,
  type CommandeAjouterExemplaire,
  type SaisieManuelleLivre,
} from '../../../src/application/exemplaires/ajouter-exemplaire.js';
import { ConsulterNotice } from '../../../src/application/livres/consulter-notice.js';
import { ConsulterExemplaire } from '../../../src/application/exemplaires/consulter-exemplaire.js';
import { ListerExemplairesMalRanges } from '../../../src/application/exemplaires/lister-exemplaires-mal-ranges.js';
import { RechercherExemplaires } from '../../../src/application/exemplaires/rechercher-exemplaires.js';
import { ErreurIntrouvable, ErreurValidation } from '../../../src/domain/erreurs.js';
import { ISBN_HUGO, ISBN_ZOLA, ajouterExemplaireHugo, creerContexte, type Contexte } from './contexte.js';

let ctx: Contexte;
beforeEach(() => {
  ctx = creerContexte();
});

describe('AjouterExemplaire', () => {
  const ajouter = () =>
    new AjouterExemplaire(ctx.exemplaires, ctx.livres, ctx.emplacements, ctx.catalogue, ctx.generateurId);

  const parIsbn = (
    isbn = ISBN_ZOLA.valeur,
    saisieManuelle: SaisieManuelleLivre | null = null,
    emplacementId = 'etagere-r1',
  ): CommandeAjouterExemplaire => ({ emplacementId, livre: { type: 'isbn', isbn, saisieManuelle } });

  const germinal: SaisieManuelleLivre = { titre: 'Germinal', auteurs: ['Zola'], couverture: null };

  describe('par ISBN', () => {
    it('récupère la notice depuis le catalogue externe et l’enregistre', async () => {
      ctx.catalogue.connaitre(ISBN_ZOLA, { titre: 'Germinal', auteurs: ['Émile Zola'], couverture: 'https://c/1.jpg' });

      const { exemplaire, sourceLivre } = await ajouter().executer(parIsbn());

      expect(sourceLivre).toBe('catalogue');
      // gen-1 : id du nouveau livre (résolu en premier), gen-2 : id de l'exemplaire.
      expect(exemplaire).toMatchObject({
        id: 'gen-2',
        livreId: 'gen-1',
        isbn: ISBN_ZOLA.valeur,
        livre: { id: 'gen-1', titre: 'Germinal', auteurs: ['Émile Zola'], couverture: 'https://c/1.jpg' },
        emplacementTheorique: { emplacementId: 'etagere-r1' },
        derniereDetection: null,
        malRange: false,
      });
      expect(exemplaire.emplacementTheorique.localisation.libelle).toBe('Étage 1 > Salle A > Rayon Romans > Étagère R1');
      expect((await ctx.livres.trouverParIsbn(ISBN_ZOLA))?.titre).toBe('Germinal');
      expect(await ctx.exemplaires.trouverParId('gen-2')).not.toBeNull();
    });

    it('accepte un ISBN-10 avec tirets et le normalise', async () => {
      ctx.catalogue.connaitre(ISBN_ZOLA, { titre: 'Germinal', auteurs: [], couverture: null });
      const { exemplaire } = await ajouter().executer(parIsbn('0-8044-2957-X'));
      expect(exemplaire.isbn).toBe('9780804429573');
    });

    it('réutilise le livre déjà connu en base, sans interroger le catalogue', async () => {
      const { sourceLivre, exemplaire } = await ajouter().executer(parIsbn(ISBN_HUGO.valeur));
      expect(sourceLivre).toBe('base');
      expect(exemplaire.livreId).toBe('livre-hugo');
      expect(ctx.catalogue.appels).toEqual([]);
    });

    it('le livre déjà en base prime sur une saisie manuelle (pas de doublon d’ISBN)', async () => {
      const { sourceLivre, exemplaire } = await ajouter().executer(parIsbn(ISBN_HUGO.valeur, germinal));
      expect(sourceLivre).toBe('base');
      expect(exemplaire.livre.titre).toBe('Les Misérables');
    });

    it('utilise la saisie manuelle sans interroger le catalogue', async () => {
      const { sourceLivre, exemplaire } = await ajouter().executer(parIsbn(undefined, germinal));
      expect(sourceLivre).toBe('saisie');
      expect(exemplaire).toMatchObject({ isbn: ISBN_ZOLA.valeur, livre: { titre: 'Germinal' } });
      expect(ctx.catalogue.appels).toEqual([]);
    });

    it('catalogue hors ligne sans saisie : erreur CATALOGUE_INDISPONIBLE, rien n’est persisté', async () => {
      ctx.catalogue.mettreHorsLigne();
      await expect(ajouter().executer(parIsbn())).rejects.toThrow(
        expect.objectContaining({ code: 'CATALOGUE_INDISPONIBLE' }),
      );
      expect(await ctx.livres.trouverParIsbn(ISBN_ZOLA)).toBeNull();
      expect(await ctx.exemplaires.rechercher('9780804429573')).toEqual([]);
    });

    it('catalogue hors ligne puis renvoi avec saisie manuelle : l’ajout aboutit sans bloquer', async () => {
      ctx.catalogue.mettreHorsLigne();
      await expect(ajouter().executer(parIsbn())).rejects.toThrow(ErreurValidation);
      expect((await ajouter().executer(parIsbn(undefined, germinal))).sourceLivre).toBe('saisie');
    });

    it('ISBN inconnu du catalogue : erreur LIVRE_INCONNU_DU_CATALOGUE', async () => {
      await expect(ajouter().executer(parIsbn())).rejects.toThrow(
        expect.objectContaining({ code: 'LIVRE_INCONNU_DU_CATALOGUE' }),
      );
    });

    it('valide ISBN, emplacement et type de rangement AVANT d’appeler le catalogue', async () => {
      await expect(ajouter().executer(parIsbn('123'))).rejects.toThrow(
        expect.objectContaining({ code: 'ISBN_INVALIDE' }),
      );
      await expect(ajouter().executer(parIsbn(undefined, null, 'fantome'))).rejects.toThrow(ErreurIntrouvable);
      await expect(ajouter().executer(parIsbn(undefined, null, 'rayon-romans'))).rejects.toThrow(
        expect.objectContaining({ code: 'EMPLACEMENT_NON_RANGEABLE' }),
      );
      expect(ctx.catalogue.appels).toEqual([]);
    });

    it('refuse une saisie manuelle sans titre', async () => {
      await expect(
        ajouter().executer(parIsbn(undefined, { titre: ' ', auteurs: [], couverture: null })),
      ).rejects.toThrow(expect.objectContaining({ code: 'CHAMP_OBLIGATOIRE' }));
    });
  });

  describe('entièrement manuel, sans ISBN', () => {
    const manuel = (titre = 'Registre paroissial 1789'): CommandeAjouterExemplaire => ({
      emplacementId: 'etagere-r2',
      livre: { type: 'manuel', saisieManuelle: { titre, auteurs: ['Anonyme'], couverture: null } },
    });

    it('crée un livre sans ISBN et son exemplaire, sans interroger le catalogue', async () => {
      const { exemplaire, sourceLivre } = await ajouter().executer(manuel());

      expect(sourceLivre).toBe('saisie');
      expect(exemplaire).toMatchObject({ isbn: null, livre: { isbn: null, titre: 'Registre paroissial 1789' } });
      expect((await ctx.livres.trouverParId(exemplaire.livreId))?.isbn).toBeNull();
      expect(ctx.catalogue.appels).toEqual([]);
    });

    it('rend le livre trouvable par la recherche', async () => {
      await ajouter().executer(manuel());
      const resultats = await new RechercherExemplaires(ctx.exemplaires, ctx.livres, ctx.emplacements).executer('paroissial');
      expect(resultats.map((r) => r.livre.titre)).toEqual(['Registre paroissial 1789']);
    });

    it('refuse une saisie sans titre', async () => {
      await expect(ajouter().executer(manuel('  '))).rejects.toThrow(ErreurValidation);
    });
  });

  describe('numéro d’exemplaire', () => {
    it('numérote 1 le premier exemplaire d’une nouvelle œuvre', async () => {
      ctx.catalogue.connaitre(ISBN_ZOLA, { titre: 'Germinal', auteurs: [], couverture: null });
      expect((await ajouter().executer(parIsbn())).exemplaire.numero).toBe(1);
    });

    it('numérote à la suite les exemplaires d’une œuvre déjà présente, quel que soit le mode d’ajout', async () => {
      await ajouterExemplaireHugo(ctx, 'ex-a'); // n°1
      await ajouterExemplaireHugo(ctx, 'ex-b'); // n°2
      const parIsbnExistant = await ajouter().executer(parIsbn(ISBN_HUGO.valeur));
      const parLivreId = await ajouter().executer({ emplacementId: 'etagere-r2', livre: { type: 'existant', livreId: 'livre-hugo' } });
      expect([parIsbnExistant.exemplaire.numero, parLivreId.exemplaire.numero]).toEqual([3, 4]);
    });
  });

  describe('nouvel exemplaire d’un livre existant', () => {
    it('réutilise le livre, sans catalogue ni nouvelle notice', async () => {
      const premier = await ajouter().executer({
        emplacementId: 'etagere-r1',
        livre: { type: 'manuel', saisieManuelle: { titre: 'Manuscrit', auteurs: [], couverture: null } },
      });
      const second = await ajouter().executer({
        emplacementId: 'etagere-r2',
        livre: { type: 'existant', livreId: premier.exemplaire.livreId },
      });

      expect(second.sourceLivre).toBe('base');
      expect(second.exemplaire.livreId).toBe(premier.exemplaire.livreId);
      expect(second.exemplaire.id).not.toBe(premier.exemplaire.id);
      expect(ctx.catalogue.appels).toEqual([]);
    });

    it('échoue si le livre n’existe pas', async () => {
      await expect(
        ajouter().executer({ emplacementId: 'etagere-r1', livre: { type: 'existant', livreId: 'fantome' } }),
      ).rejects.toThrow(expect.objectContaining({ code: 'LIVRE_INTROUVABLE' }));
    });
  });
});

describe('ConsulterNotice', () => {
  const consulter = () => new ConsulterNotice(ctx.livres, ctx.catalogue);

  it('renvoie la notice du livre déjà en base (avec son id), sans appel externe', async () => {
    expect(await consulter().executer('0-306-40615-2')).toEqual({
      source: 'base',
      livre: { id: 'livre-hugo', isbn: '9780306406157', titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: null },
    });
    expect(ctx.catalogue.appels).toEqual([]);
  });

  it('renvoie la notice du catalogue sans rien enregistrer', async () => {
    ctx.catalogue.connaitre(ISBN_ZOLA, { titre: 'Germinal', auteurs: ['Émile Zola'], couverture: null });
    expect(await consulter().executer(ISBN_ZOLA.valeur)).toEqual({
      source: 'catalogue',
      livre: { id: null, isbn: ISBN_ZOLA.valeur, titre: 'Germinal', auteurs: ['Émile Zola'], couverture: null },
    });
    expect(await ctx.livres.trouverParIsbn(ISBN_ZOLA)).toBeNull();
  });

  it.each([
    ['123', 'ISBN_INVALIDE'],
    [ISBN_ZOLA.valeur, 'LIVRE_INCONNU_DU_CATALOGUE'],
  ])('échoue explicitement pour %s (%s)', async (isbn, code) => {
    await expect(consulter().executer(isbn)).rejects.toThrow(expect.objectContaining({ code }));
  });

  it('signale un catalogue indisponible', async () => {
    ctx.catalogue.mettreHorsLigne();
    await expect(consulter().executer(ISBN_ZOLA.valeur)).rejects.toThrow(
      expect.objectContaining({ code: 'CATALOGUE_INDISPONIBLE' }),
    );
  });
});

describe('RechercherExemplaires', () => {
  const rechercher = () => new RechercherExemplaires(ctx.exemplaires, ctx.livres, ctx.emplacements);

  it('trouve un exemplaire par titre, auteur ou ISBN avec sa localisation complète', async () => {
    await ajouterExemplaireHugo(ctx);

    for (const terme of ['misérables', 'HUGO', '978-0-306-40615-7']) {
      const resultats = await rechercher().executer(terme);
      expect(resultats.map((r) => r.id)).toEqual(['ex-hugo']);
    }

    const [vue] = await rechercher().executer('hugo');
    expect(vue?.emplacementTheorique.localisation).toEqual({
      chemin: [
        { id: 'etage-1', type: 'etage', nom: 'Étage 1' },
        { id: 'salle-a', type: 'salle', nom: 'Salle A' },
        { id: 'rayon-romans', type: 'rayon', nom: 'Rayon Romans' },
        { id: 'etagere-r1', type: 'etagere', nom: 'Étagère R1' },
      ],
      libelle: 'Étage 1 > Salle A > Rayon Romans > Étagère R1',
      coordonnees: { x: 10, y: 20 },
    });
  });

  it('renvoie une liste vide pour un terme vide ou sans résultat', async () => {
    await ajouterExemplaireHugo(ctx);
    expect(await rechercher().executer('   ')).toEqual([]);
    expect(await rechercher().executer('balzac')).toEqual([]);
  });

  it('inclut la localisation de la dernière détection', async () => {
    const ex = await ajouterExemplaireHugo(ctx);
    ex.enregistrerDetection(ctx.hierarchie.etagere2, ctx.horloge.maintenant());
    await ctx.exemplaires.enregistrer(ex);

    const [vue] = await rechercher().executer('hugo');
    expect(vue?.derniereDetection).toMatchObject({
      emplacementId: 'etagere-r2',
      date: ctx.horloge.maintenant(),
      localisation: { libelle: 'Étage 1 > Salle A > Rayon Romans > Étagère R2', coordonnees: { x: 5, y: 5 } },
    });
    expect(vue?.malRange).toBe(true);
  });
});

describe('ConsulterExemplaire', () => {
  it('renvoie le détail d’un exemplaire ou une erreur 404 métier', async () => {
    await ajouterExemplaireHugo(ctx);
    const consulter = new ConsulterExemplaire(ctx.exemplaires, ctx.livres, ctx.emplacements);
    expect((await consulter.executer('ex-hugo')).livre.titre).toBe('Les Misérables');
    await expect(consulter.executer('fantome')).rejects.toThrow(
      expect.objectContaining({ code: 'EXEMPLAIRE_INTROUVABLE' }),
    );
  });
});

describe('ListerExemplairesMalRanges', () => {
  it('ne liste que les exemplaires détectés ailleurs que leur position théorique', async () => {
    const bien = await ajouterExemplaireHugo(ctx, 'ex-bien');
    const mal = await ajouterExemplaireHugo(ctx, 'ex-mal');
    await ajouterExemplaireHugo(ctx, 'ex-jamais-detecte');
    bien.enregistrerDetection(ctx.hierarchie.etagere1, ctx.horloge.maintenant());
    mal.enregistrerDetection(ctx.hierarchie.etagere2, ctx.horloge.maintenant());
    await ctx.exemplaires.enregistrer(bien);
    await ctx.exemplaires.enregistrer(mal);

    const resultats = await new ListerExemplairesMalRanges(ctx.exemplaires, ctx.livres, ctx.emplacements).executer();

    expect(resultats.map((r) => r.id)).toEqual(['ex-mal']);
    expect(resultats[0]).toMatchObject({
      malRange: true,
      emplacementTheorique: { emplacementId: 'etagere-r1' },
      derniereDetection: { emplacementId: 'etagere-r2' },
    });
  });
});
