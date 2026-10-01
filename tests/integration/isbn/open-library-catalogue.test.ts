import { describe, expect, it } from 'vitest';
import { OpenLibraryCatalogue } from '../../../src/adapters/isbn/open-library-catalogue.js';
import { Isbn } from '../../../src/domain/isbn.js';

/** Aucun appel réseau : fetch est remplacé par une table de réponses simulées. */
type Reponses = Record<string, Response | Error>;

function catalogue(reponses: Reponses) {
  const appels: string[] = [];
  const fetchSimule = (async (url: URL) => {
    appels.push(url.pathname);
    const r = reponses[url.pathname];
    if (r instanceof Error) throw r;
    return r ?? new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return { appels, adapter: new OpenLibraryCatalogue({ urlBase: 'https://ol.test', delaiMaxMs: 1000, fetch: fetchSimule }) };
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

const isbn = Isbn.creer('9782070368228');
const EDITION = '/isbn/9782070368228.json';

describe('OpenLibraryCatalogue', () => {
  it('assemble titre, sous-titre, auteurs résolus et URL de couverture', async () => {
    const { adapter, appels } = catalogue({
      [EDITION]: json({ title: '1984', subtitle: 'roman', authors: [{ key: '/authors/OL1A' }, { key: '/authors/OL2A' }], covers: [967386] }),
      '/authors/OL1A.json': json({ name: 'George Orwell' }),
      '/authors/OL2A.json': json({ name: 'Amélie Audiberti' }),
    });

    expect(await adapter.rechercherParIsbn(isbn)).toEqual({
      statut: 'trouve',
      livre: {
        titre: '1984 : roman',
        auteurs: ['George Orwell', 'Amélie Audiberti'],
        couverture: 'https://covers.openlibrary.org/b/id/967386-L.jpg',
      },
    });
    expect(appels).toEqual([EDITION, '/authors/OL1A.json', '/authors/OL2A.json']);
  });

  it('ignore un auteur introuvable sans faire échouer la recherche', async () => {
    const { adapter } = catalogue({
      [EDITION]: json({ title: '1984', authors: [{ key: '/authors/OL1A' }, { key: '/authors/KO' }] }),
      '/authors/OL1A.json': json({ name: 'George Orwell' }),
      '/authors/KO.json': new Error('réseau'),
    });
    const resultat = await adapter.rechercherParIsbn(isbn);
    expect(resultat).toMatchObject({ statut: 'trouve', livre: { auteurs: ['George Orwell'], couverture: null } });
  });

  it('se rabat sur by_statement quand aucun auteur n’est résolu', async () => {
    const { adapter } = catalogue({ [EDITION]: json({ title: 'Bosanski jezik', by_statement: 'Jasmin Hodžić' }) });
    expect(await adapter.rechercherParIsbn(isbn)).toMatchObject({ livre: { auteurs: ['Jasmin Hodžić'] } });
  });

  it('renvoie « introuvable » sur un 404', async () => {
    const { adapter } = catalogue({});
    expect(await adapter.rechercherParIsbn(isbn)).toEqual({ statut: 'introuvable' });
  });

  it.each<[string, Response | Error, RegExp]>([
    ['erreur réseau', new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') }), /ECONNREFUSED/],
    ['délai dépassé', new DOMException('timeout', 'TimeoutError'), /délai/],
    ['erreur serveur', new Response('', { status: 503 }), /HTTP 503/],
    ['JSON illisible', new Response('<html>', { status: 200 }), /illisible/],
    ['réponse sans titre', json({ authors: [] }), /illisible/],
  ])('renvoie « indisponible » en cas de %s, sans lever d’exception', async (_cas, reponse, raison) => {
    const { adapter } = catalogue({ [EDITION]: reponse });
    const resultat = await adapter.rechercherParIsbn(isbn);
    expect(resultat.statut).toBe('indisponible');
    expect(resultat.statut === 'indisponible' && resultat.raison).toMatch(raison);
  });
});
