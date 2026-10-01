import { ErreurValidation } from './erreurs.js';

/** Retire les espaces superflus et exige un texte non vide, de longueur bornée. */
export function texteObligatoire(valeur: string, champ: string, longueurMax = 200): string {
  const nettoye = valeur.trim().replace(/\s+/g, ' ');
  if (nettoye.length === 0) {
    throw new ErreurValidation('CHAMP_OBLIGATOIRE', `Le champ « ${champ} » est obligatoire`);
  }
  if (nettoye.length > longueurMax) {
    throw new ErreurValidation('CHAMP_TROP_LONG', `Le champ « ${champ} » dépasse ${longueurMax} caractères`);
  }
  return nettoye;
}

/**
 * Forme canonique utilisée pour la recherche : minuscules, sans accents,
 * espaces normalisés. « Émile Zola » et « emile zola » sont équivalents.
 * Exportée pour que les adapters de persistance appliquent exactement la même règle.
 */
export function normaliserPourRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
