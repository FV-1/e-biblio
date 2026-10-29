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
  decoder(
    zxing: typeof ZXing,
    gris: Uint8ClampedArray,
    largeur: number,
    hauteur: number,
    options?: { rapide: boolean; tourne?: boolean },
  ): string | null;
  estIsbn(texte: string): boolean;
  zoneAnalyse(z: {
    largeurVideo: number;
    hauteurVideo: number;
    largeurElement: number;
    hauteurElement: number;
    viseur: { x: number; y: number; largeur: number; hauteur: number };
    marge?: number;
  }): { x: number; y: number; largeur: number; hauteur: number };
  creerConfirmateur(options: { lecturesRequises?: number; fenetreMs?: number; absenceMs?: number }): {
    proposer(texte: string, maintenant: number): 'confirme' | 'attente' | 'deja-envoye' | 'pas-un-isbn';
    oublier(texte: string): void;
  };
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

describe('scanner vidéo de la page mobile', () => {
  it('lit une image vidéo en mode rapide, dans les deux orientations', () => {
    const { rgba, largeur, hauteur } = imageEan13('9782070612758');
    const gris = D.niveauxDeGris(rgba, largeur, hauteur);
    expect(D.decoder(ZXing, gris, largeur, hauteur, { rapide: true })).toBe('9782070612758');
    const tourne = D.rotation90(gris, largeur, hauteur);
    expect(D.decoder(ZXing, tourne, hauteur, largeur, { rapide: true })).toBeNull(); // pas de rotation implicite
    expect(D.decoder(ZXing, tourne, hauteur, largeur, { rapide: true, tourne: true })).not.toBeNull();
  });

  it('ramène le viseur affiché à l’écran en pixels de la vidéo (object-fit: cover)', () => {
    // Vidéo 1280×720 affichée dans un élément 360×640 : agrandie ×0,889, rognée sur les côtés.
    const zone = D.zoneAnalyse({
      largeurVideo: 1280,
      hauteurVideo: 720,
      largeurElement: 360,
      hauteurElement: 640,
      viseur: { x: 40, y: 260, largeur: 280, hauteur: 120 },
    });
    expect(zone.largeur).toBeCloseTo(315, 0);
    expect(zone.hauteur).toBeCloseTo(135, 0);
    expect(zone.x).toBe(483); // (40 + 388,9) / 0,889 = 482,5 : le viseur est au centre de la vidéo
    expect(zone.y).toBeCloseTo(293, 0);
  });

  it('ne sort jamais de l’image, même avec une marge autour du viseur', () => {
    const zone = D.zoneAnalyse({
      largeurVideo: 640,
      hauteurVideo: 480,
      largeurElement: 640,
      hauteurElement: 480,
      viseur: { x: 0, y: 0, largeur: 640, hauteur: 480 },
      marge: 0.2,
    });
    expect(zone).toEqual({ x: 0, y: 0, largeur: 640, hauteur: 480 });
  });

  describe('confirmation des lectures', () => {
    const confirmateur = () => D.creerConfirmateur({ lecturesRequises: 2, fenetreMs: 1500, absenceMs: 2500 });

    it('n’envoie qu’après deux lectures identiques rapprochées', () => {
      const c = confirmateur();
      expect(c.proposer('9782070612758', 0)).toBe('attente');
      expect(c.proposer('9782070612758', 200)).toBe('confirme');
    });

    it('repart de zéro si une autre lecture s’intercale ou si trop de temps passe', () => {
      const c = confirmateur();
      expect(c.proposer('9782070612758', 0)).toBe('attente');
      expect(c.proposer('9780306406157', 100)).toBe('attente');
      expect(c.proposer('9782070612758', 200)).toBe('attente');
      expect(c.proposer('9782070612758', 5000)).toBe('attente');
    });

    it('n’envoie jamais deux fois un livre resté devant l’objectif, même longtemps', () => {
      const c = confirmateur();
      c.proposer('9782070612758', 0);
      c.proposer('9782070612758', 100);
      for (let t = 300; t <= 20_000; t += 200) expect(c.proposer('9782070612758', t)).toBe('deja-envoye');
    });

    it('accepte à nouveau le même ISBN après une absence (deuxième exemplaire du livre)', () => {
      const c = confirmateur();
      c.proposer('9782070612758', 0);
      c.proposer('9782070612758', 100);
      expect(c.proposer('9782070612758', 3000)).toBe('attente'); // retiré 2,9 s, puis présenté à nouveau
      expect(c.proposer('9782070612758', 3200)).toBe('confirme');
    });

    it('signale un code-barres qui n’est pas celui d’un livre', () => {
      expect(confirmateur().proposer('3017620422003', 0)).toBe('pas-un-isbn');
    });

    it('permet de renvoyer un ISBN dont l’envoi a échoué', () => {
      const c = confirmateur();
      c.proposer('9782070612758', 0);
      c.proposer('9782070612758', 100);
      c.oublier('9782070612758');
      c.proposer('9782070612758', 200);
      expect(c.proposer('9782070612758', 300)).toBe('confirme');
    });
  });
});
