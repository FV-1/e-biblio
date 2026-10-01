import { describe, expect, it } from 'vitest';
import { ClientApiHttp } from '../../src/main/client-api-http';
import { exemplaireBienRange, exemplaireMalRange } from '../fixtures/exemplaires';

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
