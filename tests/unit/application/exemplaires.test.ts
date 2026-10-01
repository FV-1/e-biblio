import { beforeEach, describe, expect, it } from 'vitest';
import { AjouterExemplaire, type CommandeAjouterExemplaire } from '../../../src/application/exemplaires/ajouter-exemplaire.js';
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

  const commande = (surcharges: Partial<CommandeAjouterExemplaire> = {}): CommandeAjouterExemplaire => ({
    isbn: ISBN_ZOLA.valeur,
    emplacementId: 'etagere-r1',
    saisieManuelle: null,
    ...surcharges,
  });

  it('récupère la notice depuis le catalogue externe et l’enregistre', async () => {
    ctx.catalogue.connaitre(ISBN_ZOLA, { titre: 'Germinal', auteurs: ['Émile Zola'], couverture: 'https://c/1.jpg' });

    const { exemplaire, sourceLivre } = await ajouter().executer(commande());

    expect(sourceLivre).toBe('catalogue');
    expect(exemplaire).toMatchObject({
      id: 'gen-1',
      isbn: ISBN_ZOLA.valeur,
      livre: { titre: 'Germinal', auteurs: ['Émile Zola'], couverture: 'https://c/1.jpg' },
      emplacementTheorique: { emplacementId: 'etagere-r1' },
      derniereDetection: null,
      malRange: false,
    });
    expect(exemplaire.emplacementTheorique.localisation.libelle).toBe('Étage 1 > Salle A > Rayon Romans > Étagère R1');
    expect((await ctx.livres.trouverParIsbn(ISBN_ZOLA))?.titre).toBe('Germinal');
    expect(await ctx.exemplaires.trouverParId('gen-1')).not.toBeNull();
  });

  it('accepte un ISBN-10 avec tirets et le normalise', async () => {
    ctx.catalogue.connaitre(ISBN_ZOLA, { titre: 'Germinal', auteurs: [], couverture: null });
    const { exemplaire } = await ajouter().executer(commande({ isbn: '0-8044-2957-X' }));
    expect(exemplaire.isbn).toBe('9780804429573');
  });

  it('n’interroge pas le catalogue si le livre est déjà connu en base', async () => {
    const { sourceLivre, exemplaire } = await ajouter().executer(commande({ isbn: ISBN_HUGO.valeur }));
    expect(sourceLivre).toBe('base');
    expect(exemplaire.livre.titre).toBe('Les Misérables');
    expect(ctx.catalogue.appels).toEqual([]);
  });

  it('utilise la saisie manuelle sans interroger le catalogue', async () => {
    const { sourceLivre, exemplaire } = await ajouter().executer(
      commande({ saisieManuelle: { titre: 'Germinal', auteurs: ['Zola'], couverture: null } }),
    );
    expect(sourceLivre).toBe('saisie');
    expect(exemplaire.livre.titre).toBe('Germinal');
    expect(ctx.catalogue.appels).toEqual([]);
  });

  it('catalogue hors ligne sans saisie : erreur CATALOGUE_INDISPONIBLE, rien n’est persisté', async () => {
    ctx.catalogue.mettreHorsLigne();
    await expect(ajouter().executer(commande())).rejects.toThrow(
      expect.objectContaining({ code: 'CATALOGUE_INDISPONIBLE' }),
    );
    expect(await ctx.livres.trouverParIsbn(ISBN_ZOLA)).toBeNull();
    expect(await ctx.exemplaires.rechercher('9780804429573')).toEqual([]);
  });

  it('catalogue hors ligne puis renvoi avec saisie manuelle : l’ajout aboutit sans bloquer', async () => {
    ctx.catalogue.mettreHorsLigne();
    await expect(ajouter().executer(commande())).rejects.toThrow(ErreurValidation);

    const { sourceLivre } = await ajouter().executer(
      commande({ saisieManuelle: { titre: 'Germinal', auteurs: ['Zola'], couverture: null } }),
    );
    expect(sourceLivre).toBe('saisie');
  });

  it('ISBN inconnu du catalogue : erreur LIVRE_INCONNU_DU_CATALOGUE', async () => {
    await expect(ajouter().executer(commande())).rejects.toThrow(
      expect.objectContaining({ code: 'LIVRE_INCONNU_DU_CATALOGUE' }),
    );
  });

  it('valide ISBN, emplacement et type de rangement AVANT d’appeler le catalogue', async () => {
    await expect(ajouter().executer(commande({ isbn: '123' }))).rejects.toThrow(
      expect.objectContaining({ code: 'ISBN_INVALIDE' }),
    );
    await expect(ajouter().executer(commande({ emplacementId: 'fantome' }))).rejects.toThrow(ErreurIntrouvable);
    await expect(ajouter().executer(commande({ emplacementId: 'rayon-romans' }))).rejects.toThrow(
      expect.objectContaining({ code: 'EMPLACEMENT_NON_RANGEABLE' }),
    );
    expect(ctx.catalogue.appels).toEqual([]);
  });

  it('refuse une saisie manuelle sans titre', async () => {
    await expect(
      ajouter().executer(commande({ saisieManuelle: { titre: ' ', auteurs: [], couverture: null } })),
    ).rejects.toThrow(expect.objectContaining({ code: 'CHAMP_OBLIGATOIRE' }));
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
