import type { Emplacement } from '../../../commun/api';

/** Seul type d'emplacement sur lequel un exemplaire peut être rangé (règle du serveur). */
export const TYPE_RANGEMENT = 'etagere';

/** Enfants directs d'un emplacement (ou racines si parentId est null), triés par nom. */
export function enfantsDe(emplacements: readonly Emplacement[], parentId: string | null): Emplacement[] {
  return emplacements
    .filter((e) => e.parentId === parentId)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
}

/** Chemin racine → emplacement, ou [] si l'emplacement est inconnu. */
export function cheminVers(emplacements: readonly Emplacement[], id: string): Emplacement[] {
  const parId = new Map(emplacements.map((e) => [e.id, e]));
  const chemin: Emplacement[] = [];
  let courant = parId.get(id);
  while (courant && chemin.length <= emplacements.length) {
    chemin.unshift(courant);
    courant = courant.parentId === null ? undefined : parId.get(courant.parentId);
  }
  return chemin[0]?.parentId === null ? chemin : [];
}

/**
 * Sélection en cascade : à partir des choix déjà faits (racine → feuille),
 * complète automatiquement chaque niveau qui n'a qu'une seule option
 * (ex. un seul étage), jusqu'à atteindre une étagère ou un vrai choix.
 */
export function completerSelection(emplacements: readonly Emplacement[], selection: readonly string[]): string[] {
  const resultat = [...selection];
  for (;;) {
    const dernier = resultat.at(-1);
    const dernierEmplacement = dernier ? emplacements.find((e) => e.id === dernier) : undefined;
    if (dernierEmplacement?.type === TYPE_RANGEMENT) return resultat;
    const options = enfantsDe(emplacements, dernier ?? null);
    if (options.length !== 1) return resultat;
    resultat.push(options[0]!.id);
  }
}
