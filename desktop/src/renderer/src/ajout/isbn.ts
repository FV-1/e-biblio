/**
 * Contrôle de FORME d'un ISBN côté interface, pour un retour immédiat pendant la
 * saisie. La validation qui fait foi (clé de contrôle comprise) reste celle du serveur.
 */
export function nettoyerIsbn(saisie: string): string {
  return saisie.replace(/[\s-]/g, '').toUpperCase();
}

export function formeIsbnValide(saisie: string): boolean {
  const isbn = nettoyerIsbn(saisie);
  return /^\d{9}[\dX]$/.test(isbn) || /^97[89]\d{10}$/.test(isbn);
}
