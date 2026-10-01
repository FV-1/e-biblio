/** Fabrique d'identifiants uniques, injectée pour rendre les cas d'usage déterministes en test. */
export interface GenerateurId {
  generer(): string;
}
