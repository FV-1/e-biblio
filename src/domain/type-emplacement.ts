/**
 * Types d'emplacement, du plus large au plus fin.
 * L'ordre du tableau EST la règle de hiérarchie : le parent d'un type est
 * toujours le type qui le précède immédiatement.
 */
export const TYPES_EMPLACEMENT = ['etage', 'salle', 'rayon', 'etagere', 'niveau'] as const;

export type TypeEmplacement = (typeof TYPES_EMPLACEMENT)[number];

export function estTypeEmplacement(valeur: string): valeur is TypeEmplacement {
  return (TYPES_EMPLACEMENT as readonly string[]).includes(valeur);
}

/** Type de parent exigé pour un type donné, ou null pour la racine (étage). */
export function typeParentAttendu(type: TypeEmplacement): TypeEmplacement | null {
  const rang = TYPES_EMPLACEMENT.indexOf(type);
  return rang === 0 ? null : TYPES_EMPLACEMENT[rang - 1]!;
}

/** Seuls les emplacements de ce type peuvent accueillir un exemplaire. */
export const TYPE_RANGEMENT: TypeEmplacement = 'etagere';
