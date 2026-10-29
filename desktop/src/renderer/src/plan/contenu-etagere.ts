import type { Exemplaire } from '../../../commun/api';

/** Nombre de planches dessinées par étagère (convention d'affichage, cf. ADR-007). */
export const NOMBRE_PLANCHES = 4;

/**
 * Situation d'un exemplaire vue depuis UNE étagère :
 * - `ici` : rangé sur cette étagère, et pas vu ailleurs ;
 * - `intrus` : vu en dernier sur cette étagère, alors qu'il est rangé ailleurs ;
 * - `absent` : rangé sur cette étagère, mais vu en dernier ailleurs.
 */
export type StatutSurEtagere = 'ici' | 'intrus' | 'absent';

export interface LivreSurPlanche {
  readonly exemplaire: Exemplaire;
  readonly statut: StatutSurEtagere;
}

export function statutSurEtagere(exemplaire: Exemplaire, etagereId: string): StatutSurEtagere {
  const rangeIci = exemplaire.emplacementTheorique.emplacementId === etagereId;
  if (!rangeIci) return 'intrus';
  return exemplaire.malRange ? 'absent' : 'ici';
}

/**
 * Répartit le contenu d'une étagère sur ses planches, de haut en bas, dans
 * l'ordre alphabétique des titres (puis des numéros d'exemplaire). Les planches
 * reçoivent autant de livres que possible à une unité près. La vue 3D et la vue
 * « étagère » utilisent la même répartition : un livre est au même endroit dans les deux.
 */
export function repartirSurPlanches(
  exemplaires: readonly Exemplaire[],
  etagereId: string,
  nombrePlanches = NOMBRE_PLANCHES,
): LivreSurPlanche[][] {
  const tries = [...exemplaires].sort(
    (a, b) => a.livre.titre.localeCompare(b.livre.titre, 'fr', { sensitivity: 'base' }) || a.numero - b.numero,
  );
  const planches: LivreSurPlanche[][] = Array.from({ length: nombrePlanches }, () => []);
  const base = Math.floor(tries.length / nombrePlanches);
  const reste = tries.length % nombrePlanches;
  let i = 0;
  planches.forEach((planche, p) => {
    const taille = base + (p < reste ? 1 : 0);
    for (const exemplaire of tries.slice(i, i + taille)) planche.push({ exemplaire, statut: statutSurEtagere(exemplaire, etagereId) });
    i += taille;
  });
  return planches;
}

export interface Bilan {
  readonly total: number;
  readonly ici: number;
  readonly intrus: number;
  readonly absents: number;
}

export function bilanEtagere(exemplaires: readonly Exemplaire[], etagereId: string): Bilan {
  const statuts = exemplaires.map((e) => statutSurEtagere(e, etagereId));
  const compter = (s: StatutSurEtagere) => statuts.filter((x) => x === s).length;
  return { total: exemplaires.length, ici: compter('ici'), intrus: compter('intrus'), absents: compter('absent') };
}

/**
 * Couleur et proportions stables d'un livre, tirées de son identifiant : un même
 * livre a toujours la même tranche, d'une ouverture à l'autre et dans les deux vues.
 */
const TEINTES = ['#7d4e3b', '#2f5d62', '#5b4b8a', '#8a6d3b', '#3f6b45', '#8c3f4f', '#35517a', '#6d6a3a', '#4f6b78', '#7a5a2f'];

export function apparenceLivre(livreId: string): { couleur: string; largeur: number; hauteur: number } {
  let h = 2166136261;
  for (let i = 0; i < livreId.length; i++) h = Math.imul(h ^ livreId.charCodeAt(i), 16777619);
  const n = h >>> 0;
  return {
    couleur: TEINTES[n % TEINTES.length]!,
    largeur: 0.75 + ((n >>> 8) % 50) / 100, // 0,75 à 1,25 : épaisseur relative
    hauteur: 0.72 + ((n >>> 16) % 24) / 100, // 72 % à 95 % de la hauteur de la planche
  };
}
