import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ZXing from '@zxing/library';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Le décodeur de la page mobile est un script navigateur autonome. On l'exécute
 * ici tel quel, avec la vraie bibliothèque ZXing, sur un code-barres EAN-13
 * dessiné par le test : on vérifie ainsi la lecture sans téléphone.
 */
interface Decodeur {
  niveauxDeGris(rgba: Uint8ClampedArray, largeur: number, hauteur: number): Uint8ClampedArray;
  rotation90(gris: Uint8ClampedArray, largeur: number, hauteur: number): Uint8ClampedArray;
  decoder(zxing: typeof ZXing, gris: Uint8ClampedArray, largeur: number, hauteur: number): string | null;
  estIsbn(texte: string): boolean;
}

let D: Decodeur;

beforeAll(() => {
  const source = readFileSync(join(__dirname, '../../src/main/appairage/mobile/decodeur.js'), 'utf8');
  const global: { EBiblioDecodeur?: Decodeur } = {};
  new Function('globalThis', source)(global);
  D = global.EBiblioDecodeur!;
});

// --- Dessin d'un EAN-13 (norme GS1) ---
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITES = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLG', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function modulesEan13(code: string): string {
  const c = [...code].map(Number);
  const parite = PARITES[c[0]!]!;
  const gauche = c.slice(1, 7).map((d, i) => (parite[i] === 'L' ? L : G)[d]).join('');
  const droite = c.slice(7).map((d) => R[d]).join('');
  const marge = '0'.repeat(11);
  return `${marge}101${gauche}01010${droite}101${marge}`;
}

/** Image RGBA : `module` pixels par barre, avec un léger bruit pour rester réaliste. */
function imageEan13(code: string, module = 3, hauteur = 80) {
  const modules = modulesEan13(code);
  const largeur = modules.length * module;
  const rgba = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const noir = modules[Math.floor(x / module)] === '1';
      const v = noir ? 20 + ((x * 7 + y * 13) % 25) : 235 - ((x * 11 + y * 5) % 25);
      const p = (y * largeur + x) * 4;
      rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
      rgba[p + 3] = 255;
    }
  }
  return { rgba, largeur, hauteur };
}

describe('décodeur de la page mobile', () => {
  it.each(['9782070612758', '9780306406157', '9791032000953'])('lit le code-barres EAN-13 %s', (code) => {
    const { rgba, largeur, hauteur } = imageEan13(code);
    expect(D.decoder(ZXing, D.niveauxDeGris(rgba, largeur, hauteur), largeur, hauteur)).toBe(code);
  });

  it('lit un code-barres photographié de travers (quart de tour)', () => {
    const { rgba, largeur, hauteur } = imageEan13('9782070612758');
    const tourne = D.rotation90(D.niveauxDeGris(rgba, largeur, hauteur), largeur, hauteur);
    expect(D.decoder(ZXing, tourne, hauteur, largeur)).toBe('9782070612758');
  });

  it('renvoie null sur une image sans code-barres', () => {
    const largeur = 200;
    const hauteur = 100;
    const gris = new Uint8ClampedArray(largeur * hauteur).fill(200);
    expect(D.decoder(ZXing, gris, largeur, hauteur)).toBeNull();
  });

  it.each([
    ['9782070612758', true],
    ['978-2-07-061275-8', true],
    ['080442957x', true],
    ['3017620422003', false], // EAN d'un produit alimentaire
    ['12345', false],
  ])('estIsbn(%s) = %s', (texte, attendu) => {
    expect(D.estIsbn(texte)).toBe(attendu);
  });
});
