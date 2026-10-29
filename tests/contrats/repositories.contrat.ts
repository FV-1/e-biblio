import { beforeEach, describe, expect, it } from 'vitest';
import { Coordonnees } from '../../src/domain/coordonnees.js';
import { Exemplaire } from '../../src/domain/exemplaire.js';
import { Isbn } from '../../src/domain/isbn.js';
import { Livre } from '../../src/domain/livre.js';
import type { EmplacementRepository } from '../../src/ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../src/ports/exemplaire-repository.js';
import type { CriteresLivres, InventaireLivres } from '../../src/ports/inventaire-livres.js';
import type { LivreRepository } from '../../src/ports/livre-repository.js';
import { construireHierarchie } from '../fixtures/hierarchie.js';

/**
 * Tests de contrat des ports de persistance.
 * La MÊME suite est exécutée contre les fakes en mémoire (tests unitaires) et
 * contre SQLite (tests d'intégration) : elle garantit que les fakes utilisés
 * pour tester les cas d'usage se comportent comme les vrais adapters.
 */
export interface Repositories {
  emplacements: EmplacementRepository;
  livres: LivreRepository;
  exemplaires: ExemplaireRepository;
  inventaire: InventaireLivres;
}

const ISBN_HUGO = Isbn.creer('9780306406157');
const ISBN_ZOLA = Isbn.creer('080442957X');
const ISBN_INCONNU = Isbn.creer('9782070368228');

const hugo = Livre.creer({ id: 'livre-hugo', isbn: ISBN_HUGO, titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: 'https://img/1.jpg' });
const zola = Livre.creer({ id: 'livre-zola', isbn: ISBN_ZOLA, titre: 'Germinal', auteurs: ['Émile Zola', 'Préface_100%'], couverture: null });
const manuscrit = Livre.creer({ id: 'livre-manuscrit', isbn: null, titre: 'Registre paroissial 1789', auteurs: ['Anonyme'] });
const archives = Livre.creer({ id: 'livre-archives', isbn: null, titre: 'Archives municipales', auteurs: [] });

const ids = (liste: readonly { id: string }[]) => liste.map((e) => e.id).sort();

export function contratRepositories(nom: string, fabrique: () => Repositories): void {
  describe(`Contrat des repositories — ${nom}`, () => {
    let repos: Repositories;
    let h: ReturnType<typeof construireHierarchie>;

    beforeEach(async () => {
      repos = fabrique();
      h = construireHierarchie();
      for (const e of h.tous) await repos.emplacements.enregistrer(e);
    });

    describe('EmplacementRepository', () => {
      it('restitue un emplacement à l’identique (avec et sans coordonnées)', async () => {
        expect((await repos.emplacements.trouverParId('etagere-r1'))?.versSnapshot()).toEqual(h.etagere1.versSnapshot());
        expect((await repos.emplacements.trouverParId('etagere-r2'))?.versSnapshot()).toEqual(h.etagere2.versSnapshot());
      });

      it('renvoie null pour un id inconnu', async () => {
        expect(await repos.emplacements.trouverParId('inconnu')).toBeNull();
      });

      it('liste tous les emplacements et les enfants d’un parent', async () => {
        expect(ids(await repos.emplacements.trouverTous())).toEqual(ids(h.tous));
        expect(ids(await repos.emplacements.trouverEnfants('rayon-romans'))).toEqual(['etagere-r1', 'etagere-r2']);
        expect(await repos.emplacements.trouverEnfants('niveau-bas')).toEqual([]);
      });

      it('met à jour un emplacement existant (upsert)', async () => {
        h.etagere2.renommer('Étagère renommée');
        h.etagere2.definirCoordonnees(Coordonnees.creer(1.5, -2));
        await repos.emplacements.enregistrer(h.etagere2);

        const relu = await repos.emplacements.trouverParId('etagere-r2');
        expect(relu?.nom).toBe('Étagère renommée');
        expect(relu?.coordonnees?.versDonnees()).toEqual({ x: 1.5, y: -2 });
        expect(await repos.emplacements.trouverTous()).toHaveLength(h.tous.length);
      });

      it('supprime un emplacement', async () => {
        await repos.emplacements.supprimer('niveau-bas');
        expect(await repos.emplacements.trouverParId('niveau-bas')).toBeNull();
      });
    });

    describe('LivreRepository', () => {
      it('restitue un livre à l’identique, retrouvé par ISBN-10 ou ISBN-13', async () => {
        await repos.livres.enregistrer(zola);
        expect((await repos.livres.trouverParIsbn(ISBN_ZOLA))?.versSnapshot()).toEqual(zola.versSnapshot());
        expect((await repos.livres.trouverParIsbn(Isbn.creer('9780804429573')))?.titre).toBe('Germinal');
      });

      it('renvoie null pour un ISBN ou un id inconnu', async () => {
        expect(await repos.livres.trouverParIsbn(ISBN_INCONNU)).toBeNull();
        expect(await repos.livres.trouverParId('inconnu')).toBeNull();
      });

      it('retrouve un livre par son id', async () => {
        await repos.livres.enregistrer(hugo);
        expect((await repos.livres.trouverParId('livre-hugo'))?.versSnapshot()).toEqual(hugo.versSnapshot());
      });

      it('accepte plusieurs livres sans ISBN', async () => {
        await repos.livres.enregistrer(manuscrit);
        await repos.livres.enregistrer(archives);
        expect((await repos.livres.trouverParId('livre-manuscrit'))?.versSnapshot()).toEqual(manuscrit.versSnapshot());
        expect((await repos.livres.trouverParId('livre-archives'))?.isbn).toBeNull();
      });

      it('met à jour un livre existant (upsert)', async () => {
        await repos.livres.enregistrer(hugo);
        await repos.livres.enregistrer(Livre.creer({ id: 'livre-hugo', isbn: ISBN_HUGO, titre: 'Titre corrigé', auteurs: [] }));
        const relu = await repos.livres.trouverParIsbn(ISBN_HUGO);
        expect(relu?.titre).toBe('Titre corrigé');
        expect(relu?.auteurs).toEqual([]);
      });
    });

    describe('ExemplaireRepository', () => {
      const date = new Date('2026-02-03T04:05:06.789Z');
      let bienRange: Exemplaire;
      let malRange: Exemplaire;
      let jamaisDetecte: Exemplaire;
      let sansIsbn: Exemplaire;

      beforeEach(async () => {
        for (const l of [hugo, zola, manuscrit]) await repos.livres.enregistrer(l);

        bienRange = Exemplaire.creer({ id: 'ex-bien', livre: hugo, numero: 1, emplacement: h.etagere1 });
        bienRange.enregistrerDetection(h.etagere1, date);
        malRange = Exemplaire.creer({ id: 'ex-mal', livre: hugo, numero: 2, emplacement: h.etagere1 });
        malRange.enregistrerDetection(h.etagere2, date);
        jamaisDetecte = Exemplaire.creer({ id: 'ex-jamais', livre: zola, numero: 1, emplacement: h.etagere1 });
        sansIsbn = Exemplaire.creer({ id: 'ex-manuscrit', livre: manuscrit, numero: 1, emplacement: h.etagere2 });

        for (const e of [bienRange, malRange, jamaisDetecte, sansIsbn]) await repos.exemplaires.enregistrer(e);
      });

      it('restitue un exemplaire à l’identique (avec et sans détection)', async () => {
        expect((await repos.exemplaires.trouverParId('ex-mal'))?.versSnapshot()).toEqual(malRange.versSnapshot());
        expect((await repos.exemplaires.trouverParId('ex-jamais'))?.versSnapshot()).toEqual(jamaisDetecte.versSnapshot());
        expect((await repos.exemplaires.trouverParId('ex-manuscrit'))?.livreId).toBe('livre-manuscrit');
        expect(await repos.exemplaires.trouverParId('inconnu')).toBeNull();
      });

      it('met à jour la détection (upsert)', async () => {
        const plusTard = new Date(date.getTime() + 60_000);
        jamaisDetecte.enregistrerDetection(h.etagere2, plusTard);
        await repos.exemplaires.enregistrer(jamaisDetecte);
        expect((await repos.exemplaires.trouverParId('ex-jamais'))?.derniereDetection).toEqual({
          emplacementId: 'etagere-r2',
          date: plusTard,
        });
      });

      describe('rechercher (sémantique de Livre.correspond)', () => {
        it.each([
          ['misérables', ['ex-bien', 'ex-mal']],
          ['MISERABLES', ['ex-bien', 'ex-mal']],
          ['emile zola', ['ex-jamais']],
          ['  Victor   HUGO ', ['ex-bien', 'ex-mal']],
          ['978-0-306', ['ex-bien', 'ex-mal']],
          ['97808044', ['ex-jamais']],
          ['0-8044-2957-X', ['ex-jamais']], // ISBN-10 complet converti en ISBN-13
          ['0306406152', ['ex-bien', 'ex-mal']],
          ['e', ['ex-bien', 'ex-jamais', 'ex-mal', 'ex-manuscrit']],
          ['paroissial', ['ex-manuscrit']], // livre sans ISBN, trouvé par son titre
          ['1789', ['ex-manuscrit']],
          ['anonyme', ['ex-manuscrit']],
          ['_100%', ['ex-jamais']], // jokers LIKE pris littéralement
          ['%', ['ex-jamais']],
          ['balzac', []],
          ['   ', []],
          ['hugo\nzola', []],
        ])('« %s » → %j', async (terme, attendus) => {
          expect(ids(await repos.exemplaires.rechercher(terme))).toEqual([...attendus].sort());
        });
      });

      it('trouverMalRanges ne renvoie que les exemplaires détectés ailleurs', async () => {
        expect(ids(await repos.exemplaires.trouverMalRanges())).toEqual(['ex-mal']);
      });

      it('trouverParEmplacement renvoie les exemplaires rangés ou vus en dernier sur l’emplacement', async () => {
        // ex-mal est rangé sur R1 mais a été vu sur R2 : il apparaît sur les deux.
        expect(ids(await repos.exemplaires.trouverParEmplacement('etagere-r1'))).toEqual(['ex-bien', 'ex-jamais', 'ex-mal']);
        expect(ids(await repos.exemplaires.trouverParEmplacement('etagere-r2'))).toEqual(['ex-mal', 'ex-manuscrit']);
        expect(await repos.exemplaires.trouverParEmplacement('rayon-romans')).toEqual([]);
      });

      it('existeAvecEmplacement tient compte des positions théorique et constatée', async () => {
        expect(await repos.exemplaires.existeAvecEmplacement('etagere-r1')).toBe(true);
        expect(await repos.exemplaires.existeAvecEmplacement('etagere-r2')).toBe(true);
        expect(await repos.exemplaires.existeAvecEmplacement('rayon-romans')).toBe(false);
      });

      it('trouverParLivre renvoie les exemplaires d’un livre, triés par numéro (et non par id)', async () => {
        // id « ex-a » avant « ex-bien » dans l'ordre alphabétique, mais numéro 3.
        await repos.exemplaires.enregistrer(Exemplaire.creer({ id: 'ex-a', livre: hugo, numero: 3, emplacement: h.etagere2 }));
        const exemplaires = await repos.exemplaires.trouverParLivre('livre-hugo');
        expect(exemplaires.map((e) => [e.id, e.numero])).toEqual([
          ['ex-bien', 1],
          ['ex-mal', 2],
          ['ex-a', 3],
        ]);
        expect(await repos.exemplaires.trouverParLivre('livre-inconnu')).toEqual([]);
      });

      describe('InventaireLivres (modèle de lecture)', () => {
        beforeEach(async () => {
          await repos.livres.enregistrer(archives); // aucun exemplaire, aucun auteur
        });

        const lister = async (criteres: Partial<CriteresLivres> = {}) => {
          const page = await repos.inventaire.lister({ tri: 'titre', ordre: 'asc', page: 1, parPage: 50, ...criteres });
          return { ...page, titres: page.lignes.map((l) => l.livre.titre) };
        };

        it('liste toutes les œuvres, y compris sans exemplaire, avec leurs compteurs', async () => {
          const { lignes, total } = await lister();
          expect(total).toBe(4);
          expect(lignes.map((l) => [l.livre.titre, l.nombreExemplaires, l.nombreMalRanges])).toEqual([
            ['Archives municipales', 0, 0],
            ['Germinal', 1, 0],
            ['Les Misérables', 2, 1],
            ['Registre paroissial 1789', 1, 0],
          ]);
          expect(lignes[2]?.livre.versSnapshot()).toEqual(hugo.versSnapshot());
        });

        it.each([
          [{ tri: 'titre', ordre: 'desc' }, ['Registre paroissial 1789', 'Les Misérables', 'Germinal', 'Archives municipales']],
          // Tri sur le premier auteur, sans accents (« Émile » avec les E), livres sans auteur en dernier.
          [{ tri: 'auteur', ordre: 'asc' }, ['Registre paroissial 1789', 'Germinal', 'Les Misérables', 'Archives municipales']],
          [{ tri: 'auteur', ordre: 'desc' }, ['Les Misérables', 'Germinal', 'Registre paroissial 1789', 'Archives municipales']],
          [{ tri: 'exemplaires', ordre: 'desc' }, ['Les Misérables', 'Germinal', 'Registre paroissial 1789', 'Archives municipales']],
          [{ tri: 'exemplaires', ordre: 'asc' }, ['Archives municipales', 'Germinal', 'Registre paroissial 1789', 'Les Misérables']],
          [{ tri: 'malRanges', ordre: 'desc' }, ['Les Misérables', 'Archives municipales', 'Germinal', 'Registre paroissial 1789']],
        ] as const)('trie selon %j', async (criteres, attendus) => {
          expect((await lister(criteres)).titres).toEqual(attendus);
        });

        it.each([
          [{ avecIsbn: true }, ['Germinal', 'Les Misérables']],
          [{ avecIsbn: false }, ['Archives municipales', 'Registre paroissial 1789']],
          [{ avecCouverture: true }, ['Les Misérables']],
          [{ avecCouverture: false }, ['Archives municipales', 'Germinal', 'Registre paroissial 1789']],
          [{ terme: 'HUGO' }, ['Les Misérables']],
          [{ terme: '978-0-306' }, ['Les Misérables']],
          [{ terme: 'paroissial' }, ['Registre paroissial 1789']],
          [{ terme: 'e', avecIsbn: false }, ['Archives municipales', 'Registre paroissial 1789']],
          [{ terme: '_100%' }, ['Germinal']],
          [{ terme: 'balzac' }, []],
        ] as const)('filtre selon %j', async (criteres, attendus) => {
          const resultat = await lister(criteres);
          expect(resultat.titres).toEqual(attendus);
          expect(resultat.total).toBe(attendus.length);
        });

        it('pagine en conservant le total', async () => {
          expect(await lister({ parPage: 3, page: 1 })).toMatchObject({ total: 4, titres: ['Archives municipales', 'Germinal', 'Les Misérables'] });
          expect(await lister({ parPage: 3, page: 2 })).toMatchObject({ total: 4, titres: ['Registre paroissial 1789'] });
          expect(await lister({ parPage: 3, page: 3 })).toMatchObject({ total: 4, titres: [] });
        });

        it('compte « mal rangé » exactement comme Exemplaire.estMalRange', async () => {
          jamaisDetecte.enregistrerDetection(h.etagere2, date); // Germinal : rangé sur R1, vu sur R2
          await repos.exemplaires.enregistrer(jamaisDetecte);
          sansIsbn.enregistrerDetection(h.etagere2, date); // Registre : rangé et vu sur R2
          await repos.exemplaires.enregistrer(sansIsbn);

          const { lignes } = await lister();
          expect(lignes.map((l) => [l.livre.titre, l.nombreMalRanges])).toEqual([
            ['Archives municipales', 0],
            ['Germinal', 1],
            ['Les Misérables', 1],
            ['Registre paroissial 1789', 0],
          ]);
        });
      });
    });
  });
}
