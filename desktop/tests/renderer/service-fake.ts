import type { Exemplaire } from '../../src/commun/api';
import {
  echec,
  succes,
  type Configuration,
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
