/** Source du temps courant, injectée pour rendre les cas d'usage déterministes en test. */
export interface Horloge {
  maintenant(): Date;
}
