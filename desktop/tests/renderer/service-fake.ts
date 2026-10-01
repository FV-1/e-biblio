import type { Exemplaire } from '../../src/commun/api';
import { succes, type Resultat, type ServiceBibliotheque } from '../../src/commun/service-bibliotheque';

/**
 * Faux ServiceBibliotheque : renvoie des réponses préparées et garde la trace
 * des appels. Remplace window.biblio (IPC) dans les tests des composants.
 */
export class ServiceFake implements ServiceBibliotheque {
  readonly recherches: string[] = [];
  reponseRecherche: (terme: string) => Promise<Resultat<Exemplaire[]>> = async () => succes([]);
  reponseConnexion: () => Promise<Resultat<null>> = async () => succes(null);

  rechercherExemplaires(terme: string): Promise<Resultat<Exemplaire[]>> {
    this.recherches.push(terme);
    return this.reponseRecherche(terme);
  }

  verifierConnexion(): Promise<Resultat<null>> {
    return this.reponseConnexion();
  }
}

/** Promesse contrôlable depuis le test (pour observer les états intermédiaires). */
export function promesseManuelle<T>() {
  let resoudre!: (valeur: T) => void;
  const promesse = new Promise<T>((r) => {
    resoudre = r;
  });
  return { promesse, resoudre };
}
