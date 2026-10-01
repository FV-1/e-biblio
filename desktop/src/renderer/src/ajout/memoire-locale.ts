/**
 * Petites préférences de confort mémorisées dans le navigateur de la fenêtre
 * (localStorage). Toujours protégé : un stockage indisponible ne doit jamais
 * empêcher l'application de fonctionner.
 */
const CLE_DERNIERE_ETAGERE = 'e-biblio.derniere-etagere';

export function lireDerniereEtagere(): string | null {
  try {
    return localStorage.getItem(CLE_DERNIERE_ETAGERE);
  } catch {
    return null;
  }
}

export function memoriserDerniereEtagere(id: string): void {
  try {
    localStorage.setItem(CLE_DERNIERE_ETAGERE, id);
  } catch {
    // Préférence non mémorisée : sans conséquence.
  }
}
