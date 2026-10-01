import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServeurAppairage } from '../../src/main/appairage/serveur-appairage';

/** Vrai serveur HTTP sur 127.0.0.1 (port libre) : aucune sortie sur le réseau. */
let serveur: ServeurAppairage;
let recus: string[];
let base: string;

const ressources = {
  html: '<!doctype html><title>scan</title>',
  css: 'body{}',
  pageJs: '/* page */',
  decodeurJs: '/* decodeur */',
  zxingJs: '/* zxing */',
};

beforeEach(async () => {
  recus = [];
  serveur = new ServeurAppairage({
    ressources,
    hote: '127.0.0.1',
    portPrefere: 0,
    genererJeton: () => 'jeton-secret',
    onIsbn: (isbn) => recus.push(isbn),
  });
  const { port } = await serveur.demarrer();
  base = `http://127.0.0.1:${port}`;
});

afterEach(() => serveur.arreter());

const envoyerIsbn = (corps: string, jeton = 'jeton-secret') =>
  fetch(`${base}/s/${jeton}/isbn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps });

describe('ServeurAppairage', () => {
  it('sert la page mobile et ses ressources avec le bon jeton', async () => {
    const page = await fetch(`${base}/s/jeton-secret/`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(await page.text()).toBe(ressources.html);

    for (const [fichier, contenu, type] of [
      ['page.css', ressources.css, 'text/css'],
      ['page.js', ressources.pageJs, 'text/javascript'],
      ['decodeur.js', ressources.decodeurJs, 'text/javascript'],
      ['zxing.js', ressources.zxingJs, 'text/javascript'],
    ] as const) {
      const r = await fetch(`${base}/s/jeton-secret/${fichier}`);
      expect(r.headers.get('content-type')).toContain(type);
      expect(await r.text()).toBe(contenu);
    }
  });

  it('redirige l’URL sans « / » final (ressources relatives de la page)', async () => {
    const r = await fetch(`${base}/s/jeton-secret`, { redirect: 'manual' });
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('/s/jeton-secret/');
  });

  it.each(['/s/mauvais-jeton/', '/', '/s/', '/s/jeton-secret/inconnu.js', '/s/jeton-secret/page.js/plus'])(
    'ne révèle rien sans le bon jeton ou pour une ressource inconnue (%s)',
    async (chemin) => {
      expect((await fetch(base + chemin)).status).toBe(404);
    },
  );

  it('transmet un ISBN valide, nettoyé (tirets, espaces, x minuscule)', async () => {
    expect((await envoyerIsbn(JSON.stringify({ isbn: '978-2-07-061275-8' }))).status).toBe(204);
    expect((await envoyerIsbn(JSON.stringify({ isbn: ' 0-8044-2957-x ' }))).status).toBe(204);
    expect(recus).toEqual(['9782070612758', '080442957X']);
  });

  it.each([
    ['un ISBN invalide', JSON.stringify({ isbn: '12345' })],
    ['un EAN qui n’est pas un livre', JSON.stringify({ isbn: '3017620422003' })],
    ['un JSON illisible', '{ cassé'],
    ['un corps sans isbn', JSON.stringify({ autre: 1 })],
  ])('refuse %s (400) sans rien transmettre', async (_cas, corps) => {
    expect((await envoyerIsbn(corps)).status).toBe(400);
    expect(recus).toEqual([]);
  });

  it('refuse un envoi avec un mauvais jeton (404)', async () => {
    expect((await envoyerIsbn(JSON.stringify({ isbn: '9782070612758' }), 'pirate')).status).toBe(404);
    expect(recus).toEqual([]);
  });

  it('refuse un corps trop volumineux (413)', async () => {
    const reponse = await envoyerIsbn(JSON.stringify({ isbn: 'x'.repeat(5000) })).catch(() => null);
    // Selon le moment où la connexion est coupée, on reçoit 413 ou une erreur réseau.
    if (reponse) expect(reponse.status).toBe(413);
    expect(recus).toEqual([]);
  });

  it('démarrer deux fois réutilise la même session', async () => {
    const premiere = await serveur.demarrer();
    const seconde = await serveur.demarrer();
    expect(seconde).toEqual(premiere);
  });

  it('après arrêt, le serveur ne répond plus et une nouvelle session a un nouveau jeton', async () => {
    let n = 0;
    const s = new ServeurAppairage({ ressources, hote: '127.0.0.1', genererJeton: () => `j${++n}`, onIsbn: () => undefined });
    const { port, jeton } = await s.demarrer();
    await s.arreter();
    await expect(fetch(`http://127.0.0.1:${port}/s/${jeton}/`)).rejects.toThrow();
    expect((await s.demarrer()).jeton).toBe('j2');
    await s.arreter();
  });

  it('choisit un autre port si le port préféré est occupé', async () => {
    const occupe = Number(new URL(base).port);
    const s = new ServeurAppairage({ ressources, hote: '127.0.0.1', portPrefere: occupe, onIsbn: () => undefined });
    const { port } = await s.demarrer();
    expect(port).not.toBe(occupe);
    await s.arreter();
  });
});
