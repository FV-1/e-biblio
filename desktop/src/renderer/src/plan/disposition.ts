import type { Emplacement } from '../../../commun/api';

/**
 * Dimensions dessinées d'une étagère, en unités du plan. Le serveur ne stocke
 * que des positions (x, y) : la taille est une convention d'affichage.
 */
export const ETAGERE = { largeur: 8, profondeur: 1.5, hauteur: 3.2 } as const;

/** Espace laissé autour des étagères pour dessiner le sol d'une salle. */
const MARGE_SALLE = 4;
/** Écart vertical entre deux étages. */
const HAUTEUR_ETAGE = 8;
/** Taille du sol d'une salle qui n'a encore aucune étagère placée. */
const SALLE_VIDE = 10;

export interface EtagereDessinee {
  readonly id: string;
  readonly nom: string;
  readonly salleId: string | null;
  /** Rang du rayon dans la disposition (0, 1, 2…), pour choisir sa couleur. */
  readonly rangRayon: number;
  /** Centre de l'étagère au sol : x et z reprennent le (x, y) du plan, y est l'altitude de l'étage. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Vrai si l'étagère n'a pas de coordonnées propres et prend celles d'un ancêtre. */
  readonly approchee: boolean;
}

export interface SalleDessinee {
  readonly id: string;
  readonly nom: string;
  readonly xMin: number;
  readonly xMax: number;
  readonly zMin: number;
  readonly zMax: number;
  readonly y: number;
}

export interface Disposition {
  readonly etageres: readonly EtagereDessinee[];
  readonly salles: readonly SalleDessinee[];
  /** Étagères impossibles à placer : ni elles ni leurs ancêtres n'ont de coordonnées. */
  readonly nonPlacees: readonly string[];
  readonly centre: { readonly x: number; readonly y: number; readonly z: number };
  /** Plus grande dimension au sol, pour régler la distance de la caméra. */
  readonly etendue: number;
}

/**
 * Construit la scène à partir des emplacements de l'API. Fonction pure : elle
 * ne dépend pas de Three.js, ce qui la rend testable sans carte graphique.
 * Même règle que le domaine : un emplacement sans coordonnées prend celles de
 * son ancêtre le plus proche qui en a.
 */
export function construireDisposition(emplacements: readonly Emplacement[]): Disposition {
  const parId = new Map(emplacements.map((e) => [e.id, e]));
  const ancetres = (e: Emplacement): Emplacement[] => {
    const resultat: Emplacement[] = [];
    let courant = e.parentId ? parId.get(e.parentId) : undefined;
    while (courant && resultat.length < 10) {
      resultat.push(courant);
      courant = courant.parentId ? parId.get(courant.parentId) : undefined;
    }
    return resultat;
  };
  const ancetreDeType = (e: Emplacement, type: string) => ancetres(e).find((a) => a.type === type) ?? null;

  const etages = emplacements
    .filter((e) => e.type === 'etage')
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const altitude = (e: Emplacement) => {
    const etage = e.type === 'etage' ? e : ancetreDeType(e, 'etage');
    return Math.max(0, etages.findIndex((x) => x.id === etage?.id)) * HAUTEUR_ETAGE;
  };

  const rangsRayons = new Map<string, number>();
  const etageres: EtagereDessinee[] = [];
  const nonPlacees: string[] = [];

  for (const e of emplacements.filter((x) => x.type === 'etagere')) {
    const coordonnees = e.coordonnees ?? ancetres(e).find((a) => a.coordonnees)?.coordonnees ?? null;
    if (!coordonnees) {
      nonPlacees.push(e.id);
      continue;
    }
    const rayon = ancetreDeType(e, 'rayon');
    const cleRayon = rayon?.id ?? '';
    if (!rangsRayons.has(cleRayon)) rangsRayons.set(cleRayon, rangsRayons.size);
    etageres.push({
      id: e.id,
      nom: e.nom,
      salleId: ancetreDeType(e, 'salle')?.id ?? null,
      rangRayon: rangsRayons.get(cleRayon)!,
      x: coordonnees.x,
      y: altitude(e),
      z: coordonnees.y,
      approchee: e.coordonnees === null,
    });
  }

  const salles: SalleDessinee[] = [];
  for (const s of emplacements.filter((x) => x.type === 'salle')) {
    const contenues = etageres.filter((e) => e.salleId === s.id);
    if (contenues.length > 0) {
      salles.push({
        id: s.id,
        nom: s.nom,
        xMin: Math.min(...contenues.map((e) => e.x)) - ETAGERE.largeur / 2 - MARGE_SALLE,
        xMax: Math.max(...contenues.map((e) => e.x)) + ETAGERE.largeur / 2 + MARGE_SALLE,
        zMin: Math.min(...contenues.map((e) => e.z)) - ETAGERE.profondeur / 2 - MARGE_SALLE,
        zMax: Math.max(...contenues.map((e) => e.z)) + ETAGERE.profondeur / 2 + MARGE_SALLE,
        y: altitude(s),
      });
    } else if (s.coordonnees) {
      const { x, y } = s.coordonnees;
      salles.push({ id: s.id, nom: s.nom, xMin: x, xMax: x + SALLE_VIDE, zMin: y, zMax: y + SALLE_VIDE, y: altitude(s) });
    }
  }

  const xs = salles.flatMap((s) => [s.xMin, s.xMax]);
  const zs = salles.flatMap((s) => [s.zMin, s.zMax]);
  const ys = salles.map((s) => s.y);
  const borne = (valeurs: number[], f: (...v: number[]) => number) => (valeurs.length > 0 ? f(...valeurs) : 0);
  const [xMin, xMax, zMin, zMax] = [borne(xs, Math.min), borne(xs, Math.max), borne(zs, Math.min), borne(zs, Math.max)];

  return {
    etageres,
    salles,
    nonPlacees,
    centre: { x: (xMin + xMax) / 2, y: (borne(ys, Math.min) + borne(ys, Math.max)) / 2, z: (zMin + zMax) / 2 },
    etendue: Math.max(xMax - xMin, zMax - zMin, SALLE_VIDE),
  };
}
