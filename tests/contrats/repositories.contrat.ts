import { beforeEach, describe, expect, it } from 'vitest';
import { Coordonnees } from '../../src/domain/coordonnees.js';
import { Exemplaire } from '../../src/domain/exemplaire.js';
import { Isbn } from '../../src/domain/isbn.js';
import { Livre } from '../../src/domain/livre.js';
import type { EmplacementRepository } from '../../src/ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../src/ports/exemplaire-repository.js';
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
}

const ISBN_HUGO = Isbn.creer('9780306406157');
const ISBN_ZOLA = Isbn.creer('080442957X');
const ISBN_INCONNU = Isbn.creer('9782070368228');

const hugo = Livre.creer({ isbn: ISBN_HUGO, titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: 'https://img/1.jpg' });
const zola = Livre.creer({ isbn: ISBN_ZOLA, titre: 'Germinal', auteurs: ['Émile Zola', 'Préface_100%'], couverture: null });

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

      it('renvoie null pour un ISBN inconnu', async () => {
        expect(await repos.livres.trouverParIsbn(ISBN_INCONNU)).toBeNull();
      });

      it('met à jour un livre existant (upsert)', async () => {
        await repos.livres.enregistrer(hugo);
        await repos.livres.enregistrer(Livre.creer({ isbn: ISBN_HUGO, titre: 'Titre corrigé', auteurs: [] }));
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

      beforeEach(async () => {
        await repos.livres.enregistrer(hugo);
        await repos.livres.enregistrer(zola);

        bienRange = Exemplaire.creer({ id: 'ex-bien', isbn: ISBN_HUGO, emplacement: h.etagere1 });
        bienRange.enregistrerDetection(h.etagere1, date);
        malRange = Exemplaire.creer({ id: 'ex-mal', isbn: ISBN_HUGO, emplacement: h.etagere1 });
        malRange.enregistrerDetection(h.etagere2, date);
        jamaisDetecte = Exemplaire.creer({ id: 'ex-jamais', isbn: ISBN_ZOLA, emplacement: h.etagere1 });

        for (const e of [bienRange, malRange, jamaisDetecte]) await repos.exemplaires.enregistrer(e);
      });

      it('restitue un exemplaire à l’identique (avec et sans détection)', async () => {
        expect((await repos.exemplaires.trouverParId('ex-mal'))?.versSnapshot()).toEqual(malRange.versSnapshot());
        expect((await repos.exemplaires.trouverParId('ex-jamais'))?.versSnapshot()).toEqual(jamaisDetecte.versSnapshot());
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
          ['e', ['ex-bien', 'ex-jamais', 'ex-mal']],
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

      it('existeAvecEmplacement tient compte des positions théorique et constatée', async () => {
        expect(await repos.exemplaires.existeAvecEmplacement('etagere-r1')).toBe(true);
        expect(await repos.exemplaires.existeAvecEmplacement('etagere-r2')).toBe(true);
        expect(await repos.exemplaires.existeAvecEmplacement('rayon-romans')).toBe(false);
      });
    });
  });
}
