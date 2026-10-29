import type { NetworkInterfaceInfo } from 'node:os';
import { echec, succes, type InfosAppairage, type Resultat } from '../../commun/service-bibliotheque';
import { adressesReseau } from './adresses-reseau';
import type { ServeurAppairage } from './serveur-appairage';

export interface OptionsAppairage {
  readonly serveur: Pick<ServeurAppairage, 'demarrer' | 'arreter' | 'protocole'>;
  readonly interfacesReseau: () => NodeJS.Dict<NetworkInterfaceInfo[]>;
  readonly genererQrCode: (texte: string) => Promise<string>;
}

/**
 * Partie « appairage » du service exposé à la page : démarre le mini-serveur
 * et construit, pour chaque adresse réseau du poste, l'URL et son QR code.
 */
export class AppairageTelephone {
  constructor(private readonly options: OptionsAppairage) {}

  async demarrer(): Promise<Resultat<InfosAppairage>> {
    const adresses = adressesReseau(this.options.interfacesReseau());
    if (adresses.length === 0) {
      return echec({
        type: 'requete-invalide',
        message: 'Aucun réseau local détecté : connectez l’ordinateur au même Wi-Fi que le téléphone.',
      });
    }

    let session: { port: number; jeton: string };
    try {
      session = await this.options.serveur.demarrer();
    } catch (erreur) {
      return echec({
        type: 'requete-invalide',
        message: `Impossible d’ouvrir le serveur d’appairage (${erreur instanceof Error ? erreur.message : 'erreur inconnue'}).`,
      });
    }

    return succes({
      adresses: await Promise.all(
        adresses.map(async ({ carte, ip }) => {
          const url = `${this.options.serveur.protocole}://${ip}:${session.port}/s/${session.jeton}/`;
          return { carte, url, qrCode: await this.options.genererQrCode(url) };
        }),
      ),
    });
  }

  arreter(): Promise<void> {
    return this.options.serveur.arreter();
  }
}
