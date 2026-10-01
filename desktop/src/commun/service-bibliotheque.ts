import type { CriteresLivres, DemandeAjout, Emplacement, Exemplaire, ExemplaireAjoute, Notice, PageLivres } from './api';

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
  listerEmplacements(): Promise<Resultat<Emplacement[]>>;
  /** Aperçu de la notice d'un ISBN, sans rien enregistrer. */
  consulterNotice(isbn: string): Promise<Resultat<Notice>>;
  ajouterExemplaire(demande: DemandeAjout): Promise<Resultat<ExemplaireAjoute>>;
  /** Vue « base de données » : œuvres filtrées, triées et paginées. */
  listerLivres(criteres: CriteresLivres): Promise<Resultat<PageLivres>>;
  listerExemplairesDuLivre(livreId: string): Promise<Resultat<Exemplaire[]>>;
}

/** Réglages du client (implémenté par le stockage de configuration). */
export interface ServiceConfiguration {
  lireConfiguration(): Promise<Configuration>;
  /** `null` supprime le réglage de l'interface et revient à l'URL par défaut. */
  modifierUrlServeur(url: string | null): Promise<Resultat<Configuration>>;
}

/** Une adresse réseau du poste à laquelle le téléphone peut se connecter. */
export interface AdresseAppairage {
  /** Nom de la carte réseau (ex. « Wi-Fi »), pour aider à choisir. */
  readonly carte: string;
  readonly url: string;
  /** QR code de l'URL, en image PNG (data URL). */
  readonly qrCode: string;
}

export interface InfosAppairage {
  /** Adresses possibles, la plus probable en premier. */
  readonly adresses: readonly AdresseAppairage[];
}

/** Appairage d'un téléphone servant de lecteur de codes-barres (implémenté par le main). */
export interface ServiceAppairage {
  demarrerAppairage(): Promise<Resultat<InfosAppairage>>;
  arreterAppairage(): Promise<void>;
  /** Abonnement aux ISBN envoyés par le téléphone ; renvoie la fonction de désabonnement. */
  surIsbnScanne(rappel: (isbn: string) => void): () => void;
}

/**
 * PORT complet du client desktop : tout ce dont l'interface a besoin.
 * Composé de ports plus petits (ségrégation des interfaces), assemblés dans le
 * processus main ; ré-exposé à la page par le preload via IPC ; remplacé par
 * un fake dans les tests des composants React.
 */
export interface ServiceBibliotheque extends ServiceRecherche, ServiceConfiguration, ServiceAppairage {}

/**
 * Partie du port appelable par requête/réponse IPC. L'abonnement aux scans
 * (`surIsbnScanne`) circule dans l'autre sens : main → page, par événement.
 */
export type ServiceInvocable = Omit<ServiceBibliotheque, 'surIsbnScanne'>;

/** Noms des canaux IPC, partagés par le main (qui écoute) et le preload (qui appelle). */
export const CANAUX_IPC = {
  rechercherExemplaires: 'biblio:rechercher-exemplaires',
  verifierConnexion: 'biblio:verifier-connexion',
  listerEmplacements: 'biblio:lister-emplacements',
  consulterNotice: 'biblio:consulter-notice',
  ajouterExemplaire: 'biblio:ajouter-exemplaire',
  listerLivres: 'biblio:lister-livres',
  listerExemplairesDuLivre: 'biblio:lister-exemplaires-du-livre',
  lireConfiguration: 'biblio:lire-configuration',
  modifierUrlServeur: 'biblio:modifier-url-serveur',
  demarrerAppairage: 'biblio:demarrer-appairage',
  arreterAppairage: 'biblio:arreter-appairage',
  /** Événement main → page : un ISBN vient d'être scanné par le téléphone. */
  isbnScanne: 'biblio:isbn-scanne',
} as const;
