import type { Emplacement } from './emplacement.js';
import type { TypeEmplacement } from './type-emplacement.js';

export interface EtapeLocalisation {
  readonly id: string;
  readonly type: TypeEmplacement;
  readonly nom: string;
}

/** Localisation complète d'un emplacement : chemin depuis l'étage + position sur le plan. */
export interface Localisation {
  readonly chemin: readonly EtapeLocalisation[];
  /** Ex. « Étage 1 > Salle A > Rayon Romans > Étagère 2 » */
  readonly libelle: string;
  /** Coordonnées de l'emplacement, ou à défaut celles de son ancêtre le plus proche qui en a. */
  readonly coordonnees: { readonly x: number; readonly y: number } | null;
}

/**
 * Calcule la localisation à partir du chemin ordonné racine → emplacement.
 * Vérifie que le chemin est cohérent (chaque maillon est l'enfant du précédent).
 */
export function calculerLocalisation(chemin: readonly Emplacement[]): Localisation {
  if (chemin.length === 0) throw new Error('Chemin de localisation vide');
  if (chemin[0]!.parentId !== null) throw new Error(`Chemin incomplet : « ${chemin[0]!.id} » n'est pas une racine`);
  chemin.forEach((emplacement, i) => {
    if (i > 0 && emplacement.parentId !== chemin[i - 1]!.id) {
      throw new Error(`Chemin incohérent : « ${emplacement.id} » n'est pas l'enfant de « ${chemin[i - 1]!.id} »`);
    }
  });

  const plusProcheAvecCoordonnees = chemin.findLast((e) => e.coordonnees !== null);

  return {
    chemin: chemin.map((e) => ({ id: e.id, type: e.type, nom: e.nom })),
    libelle: chemin.map((e) => e.nom).join(' > '),
    coordonnees: plusProcheAvecCoordonnees?.coordonnees?.versDonnees() ?? null,
  };
}
