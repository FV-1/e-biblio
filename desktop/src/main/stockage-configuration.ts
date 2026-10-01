import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  echec,
  succes,
  type Configuration,
  type Resultat,
  type ServiceConfiguration,
} from '../commun/service-bibliotheque';

export const URL_PAR_DEFAUT = 'http://localhost:3000';

export interface OptionsStockage {
  /** Fichier JSON dans le dossier userData d'Electron. */
  readonly cheminFichier: string;
  /** Valeur de BIBLIO_API_URL au lancement, si définie. */
  readonly urlEnvironnement: string | undefined;
}

const schemaFichier = z.object({ urlServeur: z.string() });

/**
 * Adapter du port ServiceConfiguration : persiste le réglage de l'URL dans un
 * fichier JSON. Priorité : réglage de l'interface > BIBLIO_API_URL > défaut.
 */
export class StockageConfiguration implements ServiceConfiguration {
  private urlInterface: string | null;
  private readonly urlEnvironnement: string | null;

  constructor(private readonly options: OptionsStockage) {
    this.urlEnvironnement = normaliserUrl(options.urlEnvironnement ?? '');
    this.urlInterface = this.chargerFichier();
  }

  private get urlParDefaut(): string {
    return this.urlEnvironnement ?? URL_PAR_DEFAUT;
  }

  /** Lecture synchrone, pour le client HTTP qui la consulte à chaque requête. */
  urlServeur(): string {
    return this.urlInterface ?? this.urlParDefaut;
  }

  async lireConfiguration(): Promise<Configuration> {
    return this.configuration();
  }

  async modifierUrlServeur(url: string | null): Promise<Resultat<Configuration>> {
    if (url === null) {
      this.urlInterface = null;
    } else {
      const normalisee = normaliserUrl(url);
      if (!normalisee) {
        return echec({
          type: 'requete-invalide',
          message: `« ${url} » n'est pas une URL valide (exemple : http://192.168.1.20:3000)`,
        });
      }
      this.urlInterface = normalisee;
    }
    this.sauvegarder();
    return succes(this.configuration());
  }

  private configuration(): Configuration {
    const source = this.urlInterface ? 'interface' : this.urlEnvironnement ? 'environnement' : 'defaut';
    return { urlServeur: this.urlServeur(), source, urlParDefaut: this.urlParDefaut };
  }

  private chargerFichier(): string | null {
    try {
      const contenu = schemaFichier.parse(JSON.parse(readFileSync(this.options.cheminFichier, 'utf8')));
      return normaliserUrl(contenu.urlServeur);
    } catch {
      return null; // Fichier absent ou illisible : on repart des valeurs par défaut.
    }
  }

  private sauvegarder(): void {
    mkdirSync(dirname(this.options.cheminFichier), { recursive: true });
    const contenu = this.urlInterface ? { urlServeur: this.urlInterface } : {};
    writeFileSync(this.options.cheminFichier, `${JSON.stringify(contenu, null, 2)}\n`, 'utf8');
  }
}

/** Accepte http(s)://hôte[:port] ; ne conserve que l'origine (schéma, hôte, port). */
export function normaliserUrl(saisie: string): string | null {
  const texte = saisie.trim();
  if (!texte) return null;
  try {
    const url = new URL(texte);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
