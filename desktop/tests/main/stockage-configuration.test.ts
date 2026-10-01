import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normaliserUrl, StockageConfiguration } from '../../src/main/stockage-configuration';

let dossier: string;
let fichier: string;

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'e-biblio-desktop-'));
  fichier = join(dossier, 'sous-dossier', 'configuration.json');
});
afterEach(() => rmSync(dossier, { recursive: true, force: true }));

const stockage = (urlEnvironnement?: string) => new StockageConfiguration({ cheminFichier: fichier, urlEnvironnement });

describe('StockageConfiguration', () => {
  it('utilise http://localhost:3000 par défaut', async () => {
    expect(await stockage().lireConfiguration()).toEqual({
      urlServeur: 'http://localhost:3000',
      source: 'defaut',
      urlParDefaut: 'http://localhost:3000',
    });
  });

  it('utilise BIBLIO_API_URL si elle est définie et valide', async () => {
    expect(await stockage('http://serveur:4000/').lireConfiguration()).toMatchObject({
      urlServeur: 'http://serveur:4000',
      source: 'environnement',
    });
    expect((await stockage('n’importe quoi').lireConfiguration()).source).toBe('defaut');
  });

  it('le réglage de l’interface prime sur la variable d’environnement, et persiste', async () => {
    const s = stockage('http://serveur:4000');
    const resultat = await s.modifierUrlServeur('  https://biblio.exemple.fr:8443/ ');
    expect(resultat).toEqual({
      ok: true,
      valeur: { urlServeur: 'https://biblio.exemple.fr:8443', source: 'interface', urlParDefaut: 'http://serveur:4000' },
    });
    expect(s.urlServeur()).toBe('https://biblio.exemple.fr:8443');

    // Nouveau lancement : relu depuis le fichier.
    expect(stockage('http://serveur:4000').urlServeur()).toBe('https://biblio.exemple.fr:8443');
    expect(JSON.parse(readFileSync(fichier, 'utf8'))).toEqual({ urlServeur: 'https://biblio.exemple.fr:8443' });
  });

  it('revient à l’URL par défaut avec null', async () => {
    const s = stockage('http://serveur:4000');
    await s.modifierUrlServeur('http://autre:3000');
    expect(await s.modifierUrlServeur(null)).toMatchObject({ ok: true, valeur: { urlServeur: 'http://serveur:4000', source: 'environnement' } });
    expect(stockage('http://serveur:4000').urlServeur()).toBe('http://serveur:4000');
  });

  it('refuse une URL invalide sans modifier le réglage', async () => {
    const s = stockage();
    await s.modifierUrlServeur('http://ok:3000');
    expect(await s.modifierUrlServeur('ftp://serveur')).toMatchObject({ ok: false, erreur: { type: 'requete-invalide' } });
    expect(await s.modifierUrlServeur('pas une url')).toMatchObject({ ok: false });
    expect(s.urlServeur()).toBe('http://ok:3000');
  });

  it('ignore un fichier de configuration corrompu', () => {
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, '{ cassé', 'utf8');
    expect(stockage().urlServeur()).toBe('http://localhost:3000');
  });
});

describe('normaliserUrl', () => {
  it.each([
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://localhost:3000/', 'http://localhost:3000'],
    ['  HTTP://Serveur.Local:3000/api  ', 'http://serveur.local:3000'],
    ['https://biblio.fr', 'https://biblio.fr'],
  ])('%s → %s', (saisie, attendu) => {
    expect(normaliserUrl(saisie)).toBe(attendu);
  });

  it.each(['', '   ', 'localhost:3000', 'ftp://x', 'javascript:alert(1)', 'http://'])('refuse « %s »', (saisie) => {
    expect(normaliserUrl(saisie)).toBeNull();
  });
});
