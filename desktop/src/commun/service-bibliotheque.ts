import type { Exemplaire } from './api';

/**
 * Erreurs possibles, toujours renvoyées comme des valeurs (jamais levées) :
 * les exceptions traversent mal la frontière IPC d'Electron, et la page doit
 * de toute façon afficher un message adapté à chaque cas.
 */
export type ErreurService =
  | { readonly type: 'serveur-injoignable'; readonly message: string }
  | { readonly type: 'reponse-invalide'; readonly message: string }
  | { readonly type: 'requete-invalide'; readonly message: string }
  | { readonly type: 'erreur-api'; readonly code: string; readonly message: string };

export type Resultat<T> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly erreur: ErreurService };

export const succes = <T>(valeur: T): Resultat<T> => ({ ok: true, valeur });
export const echec = <T>(erreur: ErreurService): Resultat<T> => ({ ok: false, erreur });

/**
 * PORT du client desktop : tout ce dont l'interface a besoin.
 * - Implémenté dans le processus main par le client HTTP (ClientApiHttp).
 * - Ré-exposé à la page par le preload, qui relaie chaque appel via IPC.
 * - Remplacé par un fake dans les tests des composants React.
 */
export interface ServiceBibliotheque {
  rechercherExemplaires(terme: string): Promise<Resultat<Exemplaire[]>>;
  verifierConnexion(): Promise<Resultat<null>>;
}

/** Noms des canaux IPC, partagés par le main (qui écoute) et le preload (qui appelle). */
export const CANAUX_IPC = {
  rechercherExemplaires: 'biblio:rechercher-exemplaires',
  verifierConnexion: 'biblio:verifier-connexion',
} as const;
