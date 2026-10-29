import type {
  CriteresLivres,
  DemandeAjout,
  Emplacement,
  Exemplaire,
  ExemplaireAjoute,
  Notice,
  PageLivres,
} from '../../src/commun/api';
import {
  echec,
  succes,
  type Configuration,
  type InfosAppairage,
  type Resultat,
  type ServiceBibliotheque,
} from '../../src/commun/service-bibliotheque';

/**
 * Faux ServiceBibliotheque : renvoie des réponses préparées et garde la trace
 * des appels. Remplace window.biblio (IPC) dans les tests des composants.
 */
export class ServiceFake implements ServiceBibliotheque {
  readonly recherches: string[] = [];
  readonly modificationsUrl: (string | null)[] = [];
  verificationsConnexion = 0;

  reponseRecherche: (terme: string) => Promise<Resultat<Exemplaire[]>> = async () => succes([]);
  reponseConnexion: () => Promise<Resultat<null>> = async () => succes(null);
  configuration: Configuration = {
    urlServeur: 'http://localhost:3000',
    source: 'defaut',
    urlParDefaut: 'http://localhost:3000',
  };

  readonly noticesDemandees: string[] = [];
  readonly ajouts: DemandeAjout[] = [];
  reponseEmplacements: () => Promise<Resultat<Emplacement[]>> = async () => succes([]);
  reponseNotice: (isbn: string) => Promise<Resultat<Notice>> = async () =>
    echec({ type: 'erreur-api', code: 'LIVRE_INCONNU_DU_CATALOGUE', message: 'ISBN inconnu du catalogue' });
  reponseAjout: (demande: DemandeAjout) => Promise<Resultat<ExemplaireAjoute>> = async () =>
    echec({ type: 'serveur-injoignable', message: 'non configuré' });

  // --- Vue « base de données » ---
  readonly listesDemandees: CriteresLivres[] = [];
  readonly exemplairesDemandes: string[] = [];
  reponseLivres: (criteres: CriteresLivres) => Promise<Resultat<PageLivres>> = async (c) =>
    succes({ livres: [], total: 0, page: c.page, parPage: c.parPage, pages: 1 });
  reponseExemplairesDuLivre: (livreId: string) => Promise<Resultat<Exemplaire[]>> = async () => succes([]);
  readonly etageresDemandees: string[] = [];
  reponseExemplairesDeLEmplacement: (emplacementId: string) => Promise<Resultat<Exemplaire[]>> = async () => succes([]);

  listerExemplairesDeLEmplacement(emplacementId: string): Promise<Resultat<Exemplaire[]>> {
    this.etageresDemandees.push(emplacementId);
    return this.reponseExemplairesDeLEmplacement(emplacementId);
  }

  listerLivres(criteres: CriteresLivres): Promise<Resultat<PageLivres>> {
    this.listesDemandees.push(criteres);
    return this.reponseLivres(criteres);
  }

  listerExemplairesDuLivre(livreId: string): Promise<Resultat<Exemplaire[]>> {
    this.exemplairesDemandes.push(livreId);
    return this.reponseExemplairesDuLivre(livreId);
  }

  listerEmplacements(): Promise<Resultat<Emplacement[]>> {
    return this.reponseEmplacements();
  }

  consulterNotice(isbn: string): Promise<Resultat<Notice>> {
    this.noticesDemandees.push(isbn);
    return this.reponseNotice(isbn);
  }

  ajouterExemplaire(demande: DemandeAjout): Promise<Resultat<ExemplaireAjoute>> {
    this.ajouts.push(demande);
    return this.reponseAjout(demande);
  }

  // --- Appairage du téléphone ---
  appairagesDemarres = 0;
  appairagesArretes = 0;
  reponseAppairage: () => Promise<Resultat<InfosAppairage>> = async () =>
    succes({
      adresses: [
        { carte: 'Wi-Fi', url: 'http://192.168.1.10:47800/s/jeton/', qrCode: 'data:image/png;base64,QR1' },
        { carte: 'Ethernet', url: 'http://10.0.0.5:47800/s/jeton/', qrCode: 'data:image/png;base64,QR2' },
      ],
    });
  private readonly abonnesScan = new Set<(isbn: string) => void>();

  demarrerAppairage(): Promise<Resultat<InfosAppairage>> {
    this.appairagesDemarres += 1;
    return this.reponseAppairage();
  }

  async arreterAppairage(): Promise<void> {
    this.appairagesArretes += 1;
  }

  surIsbnScanne(rappel: (isbn: string) => void): () => void {
    this.abonnesScan.add(rappel);
    return () => this.abonnesScan.delete(rappel);
  }

  /** Simule un ISBN envoyé par le téléphone (événement main → page). */
  simulerScan(isbn: string): void {
    this.abonnesScan.forEach((rappel) => rappel(isbn));
  }

  get nombreAbonnesScan(): number {
    return this.abonnesScan.size;
  }

  rechercherExemplaires(terme: string): Promise<Resultat<Exemplaire[]>> {
    this.recherches.push(terme);
    return this.reponseRecherche(terme);
  }

  verifierConnexion(): Promise<Resultat<null>> {
    this.verificationsConnexion += 1;
    return this.reponseConnexion();
  }

  async lireConfiguration(): Promise<Configuration> {
    return this.configuration;
  }

  /** Imite le stockage réel : n'accepte que les URL http(s). */
  async modifierUrlServeur(url: string | null): Promise<Resultat<Configuration>> {
    this.modificationsUrl.push(url);
    if (url !== null && !/^https?:\/\/\S+$/.test(url.trim())) {
      return echec({ type: 'requete-invalide', message: `« ${url} » n'est pas une URL valide` });
    }
    this.configuration =
      url === null
        ? { ...this.configuration, urlServeur: this.configuration.urlParDefaut, source: 'defaut' }
        : { ...this.configuration, urlServeur: url.trim(), source: 'interface' };
    return succes(this.configuration);
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
