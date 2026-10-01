import { describe, expect, it } from 'vitest';
import type { DemandeAjout } from '../../src/commun/api';
import { ClientApiHttp } from '../../src/main/client-api-http';
import { emplacements, exemplaireBienRange, exemplaireMalRange } from '../fixtures/exemplaires';

/** fetch simulé : aucune requête réseau réelle. */
function client(repondre: (url: URL) => Response | Error, urlServeur = 'http://serveur.test:3000') {
  const appels: string[] = [];
  const fetchSimule = (async (url: URL) => {
    appels.push(url.href);
    const r = repondre(url);
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { appels, client: new ClientApiHttp({ urlServeur: () => urlServeur, delaiMaxMs: 1000, fetch: fetchSimule }) };
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

describe('ClientApiHttp.rechercherExemplaires', () => {
  it('appelle GET /exemplaires?q= avec le terme encodé et renvoie les exemplaires validés', async () => {
    const { client: c, appels } = client(() => json([exemplaireBienRange, exemplaireMalRange]));

    const resultat = await c.rechercherExemplaires('  victor hugo & co ');

    expect(appels).toEqual(['http://serveur.test:3000/exemplaires?q=victor%20hugo%20%26%20co']);
    expect(resultat).toEqual({ ok: true, valeur: [exemplaireBienRange, exemplaireMalRange] });
  });

  it('ne contacte pas le serveur pour un terme vide', async () => {
    const { client: c, appels } = client(() => json([]));
    expect(await c.rechercherExemplaires('   ')).toEqual({ ok: true, valeur: [] });
    expect(appels).toEqual([]);
  });

  it('tolère les champs supplémentaires ajoutés par le serveur', async () => {
    const { client: c } = client(() => json([{ ...exemplaireBienRange, nouveauChamp: 42 }]));
    const resultat = await c.rechercherExemplaires('1984');
    expect(resultat.ok && resultat.valeur[0]?.livre.titre).toBe('1984');
  });

  it('transmet le code et le message d’une erreur de l’API', async () => {
    const { client: c } = client(() => json({ erreur: { code: 'REQUETE_INVALIDE', message: 'q manquant' } }, 400));
    expect(await c.rechercherExemplaires('x')).toEqual({
      ok: false,
      erreur: { type: 'erreur-api', code: 'REQUETE_INVALIDE', message: 'q manquant' },
    });
  });

  it('gère une erreur HTTP sans corps au format attendu', async () => {
    const { client: c } = client(() => json({ autre: 'chose' }, 502));
    const resultat = await c.rechercherExemplaires('x');
    expect(resultat).toMatchObject({ ok: false, erreur: { type: 'erreur-api', code: 'HTTP_502' } });
  });

  it('signale un serveur injoignable avec l’URL et la cause', async () => {
    const refus = new TypeError('fetch failed', { cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }) });
    const { client: c } = client(() => refus, 'http://localhost:3999');
    const resultat = await c.rechercherExemplaires('x');
    expect(resultat).toMatchObject({ ok: false, erreur: { type: 'serveur-injoignable' } });
    expect(!resultat.ok && resultat.erreur.message).toMatch(/localhost:3999.*ECONNREFUSED/);
  });

  it('signale un délai dépassé', async () => {
    const { client: c } = client(() => new DOMException('timeout', 'TimeoutError'));
    const resultat = await c.rechercherExemplaires('x');
    expect(!resultat.ok && resultat.erreur.message).toMatch(/délai dépassé/);
  });

  it.each([
    ['un corps non JSON', () => new Response('<html>', { status: 200 })],
    ['un format inattendu', () => json([{ id: 'ex', titre: 'sans livre' }])],
  ])('rejette %s (reponse-invalide)', async (_cas, reponse) => {
    const { client: c } = client(reponse);
    expect(await c.rechercherExemplaires('x')).toMatchObject({ ok: false, erreur: { type: 'reponse-invalide' } });
  });

  it('lit l’URL du serveur à chaque requête (changement pris en compte sans redémarrage)', async () => {
    let url = 'http://a.test';
    const appels: string[] = [];
    const c = new ClientApiHttp({
      urlServeur: () => url,
      delaiMaxMs: 1000,
      fetch: (async (u: URL) => {
        appels.push(u.host);
        return json([]);
      }) as unknown as typeof fetch,
    });
    await c.rechercherExemplaires('x');
    url = 'http://b.test:8080';
    await c.rechercherExemplaires('x');
    expect(appels).toEqual(['a.test', 'b.test:8080']);
  });
});

describe('ClientApiHttp : emplacements, notices et ajout', () => {
  /** fetch simulé qui enregistre méthode, URL et corps. */
  function clientEspion(reponse: Response) {
    const requetes: { methode: string; url: string; corps: unknown }[] = [];
    const c = new ClientApiHttp({
      urlServeur: () => 'http://serveur.test',
      delaiMaxMs: 1000,
      fetch: (async (url: URL, init: RequestInit) => {
        requetes.push({ methode: init.method ?? 'GET', url: url.pathname, corps: init.body ? JSON.parse(String(init.body)) : undefined });
        return reponse;
      }) as unknown as typeof fetch,
    });
    return { c, requetes };
  }

  it('liste les emplacements', async () => {
    const { c, requetes } = clientEspion(json(emplacements));
    expect(await c.listerEmplacements()).toEqual({ ok: true, valeur: emplacements });
    expect(requetes).toEqual([{ methode: 'GET', url: '/emplacements', corps: undefined }]);
  });

  it('consulte la notice d’un ISBN (encodé dans l’URL)', async () => {
    const notice = { source: 'catalogue', livre: { id: null, isbn: '9782070368228', titre: '1984', auteurs: [], couverture: null } };
    const { c, requetes } = clientEspion(json(notice));
    expect(await c.consulterNotice(' 978-2-07 ')).toEqual({ ok: true, valeur: notice });
    expect(requetes[0]?.url).toBe('/livres/978-2-07');
  });

  const cas: [DemandeAjout['livre'], Record<string, unknown>][] = [
    [{ type: 'isbn', isbn: '9782070368228' }, { emplacementId: 'e1', isbn: '9782070368228' }],
    [{ type: 'existant', livreId: 'livre-1' }, { emplacementId: 'e1', livreId: 'livre-1' }],
    [
      { type: 'saisie', isbn: null, titre: 'Registre', auteurs: ['Anonyme'], couverture: null },
      { emplacementId: 'e1', titre: 'Registre', auteurs: ['Anonyme'], couverture: null },
    ],
    [
      { type: 'saisie', isbn: '9780306406157', titre: 'Les Misérables', auteurs: [], couverture: null },
      { emplacementId: 'e1', isbn: '9780306406157', titre: 'Les Misérables', auteurs: [], couverture: null },
    ],
  ];

  it.each(cas)('traduit la demande %j en POST /exemplaires', async (livre, corpsAttendu) => {
    const { c, requetes } = clientEspion(json({ ...exemplaireBienRange, sourceLivre: 'catalogue' }, 201));
    const resultat = await c.ajouterExemplaire({ emplacementId: 'e1', livre });
    expect(resultat).toMatchObject({ ok: true, valeur: { id: 'ex-1', sourceLivre: 'catalogue' } });
    expect(requetes).toEqual([{ methode: 'POST', url: '/exemplaires', corps: corpsAttendu }]);
  });

  it('liste les œuvres en traduisant les critères en paramètres d’URL', async () => {
    const page = { livres: [{ ...exemplaireBienRange.livre, nombreExemplaires: 2, nombreMalRanges: 0 }], total: 1, page: 2, parPage: 10, pages: 1 };
    const requetes: string[] = [];
    const c = new ClientApiHttp({
      urlServeur: () => 'http://serveur.test',
      delaiMaxMs: 1000,
      fetch: (async (url: URL) => {
        requetes.push(`${url.pathname}${url.search}`);
        return json(page);
      }) as unknown as typeof fetch,
    });

    expect(await c.listerLivres({ terme: ' zola & co ', isbn: 'sans', tri: 'auteur', ordre: 'desc', page: 2, parPage: 10 })).toEqual({
      ok: true,
      valeur: page,
    });
    await c.listerLivres({ terme: '  ', tri: 'titre', ordre: 'asc', page: 1, parPage: 25 });
    expect(requetes).toEqual([
      '/livres?tri=auteur&ordre=desc&page=2&parPage=10&q=zola+%26+co&isbn=sans',
      '/livres?tri=titre&ordre=asc&page=1&parPage=25',
    ]);
  });

  it('liste les exemplaires d’une œuvre', async () => {
    const { c, requetes } = clientEspion(json([exemplaireBienRange]));
    expect(await c.listerExemplairesDuLivre('livre/1984')).toEqual({ ok: true, valeur: [exemplaireBienRange] });
    expect(requetes[0]?.url).toBe('/exemplaires');
  });

  it('transmet l’erreur métier d’un ajout refusé', async () => {
    const { c } = clientEspion(json({ erreur: { code: 'CATALOGUE_INDISPONIBLE', message: 'hors ligne' } }, 422));
    expect(await c.ajouterExemplaire({ emplacementId: 'e1', livre: { type: 'isbn', isbn: '9782070368228' } })).toEqual({
      ok: false,
      erreur: { type: 'erreur-api', code: 'CATALOGUE_INDISPONIBLE', message: 'hors ligne' },
    });
  });
});

describe('ClientApiHttp.verifierConnexion', () => {
  it('réussit si /sante répond { statut: "ok" }', async () => {
    const { client: c, appels } = client(() => json({ statut: 'ok' }));
    expect(await c.verifierConnexion()).toEqual({ ok: true, valeur: null });
    expect(appels).toEqual(['http://serveur.test:3000/sante']);
  });

  it('échoue si le serveur est injoignable', async () => {
    const { client: c } = client(() => new TypeError('fetch failed'));
    expect(await c.verifierConnexion()).toMatchObject({ ok: false, erreur: { type: 'serveur-injoignable' } });
  });
});
