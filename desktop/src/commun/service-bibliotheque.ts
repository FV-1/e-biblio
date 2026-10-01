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

/** D'où vient l'URL utilisée : réglage de l'interface > variable BIBLIO_API_URL > valeur par défaut. */
export type SourceUrl = 'interface' | 'environnement' | 'defaut';

export interface Configuration {
  readonly urlServeur: string;
  readonly source: SourceUrl;
  /** URL qui serait utilisée sans réglage dans l'interface (variable d'environnement ou défaut). */
  readonly urlParDefaut: string;
}

/** Accès aux données de la bibliothèque (implémenté par le client HTTP). */
export interface ServiceRecherche {
  rechercherExemplaires(terme: string): Promise<Resultat<Exemplaire[]>>;
  verifierConnexion(): Promise<Resultat<null>>;
}

/** Réglages du client (implémenté par le stockage de configuration). */
export interface ServiceConfiguration {
  lireConfiguration(): Promise<Configuration>;
  /** `null` supprime le réglage de l'interface et revient à l'URL par défaut. */
  modifierUrlServeur(url: string | null): Promise<Resultat<Configuration>>;
}

/**
 * PORT complet du client desktop : tout ce dont l'interface a besoin.
 * Composé de deux ports plus petits (ségrégation des interfaces), assemblés
 * dans le processus main ; ré-exposé à la page par le preload via IPC ;
 * remplacé par un fake dans les tests des composants React.
 */
export interface ServiceBibliotheque extends ServiceRecherche, ServiceConfiguration {}

/** Noms des canaux IPC, partagés par le main (qui écoute) et le preload (qui appelle). */
export const CANAUX_IPC = {
  rechercherExemplaires: 'biblio:rechercher-exemplaires',
  verifierConnexion: 'biblio:verifier-connexion',
  lireConfiguration: 'biblio:lire-configuration',
  modifierUrlServeur: 'biblio:modifier-url-serveur',
} as const;
