import type { z } from 'zod';
import { schemaErreurApi, schemaListeExemplaires, schemaSante, type Exemplaire } from '../commun/api';
import { echec, succes, type Resultat, type ServiceRecherche } from '../commun/service-bibliotheque';

export interface OptionsClientApi {
  /** Lue à chaque requête : un changement d'URL s'applique sans redémarrer. */
  readonly urlServeur: () => string;
  readonly delaiMaxMs: number;
  /** Injectable pour tester le client sans réseau. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Adapter HTTP du port ServiceRecherche, exécuté dans le processus main.
 * Chaque réponse est validée contre le contrat (schémas zod) : la page ne
 * reçoit jamais de données d'une forme inattendue.
 */
export class ClientApiHttp implements ServiceRecherche {
  private readonly fetch: typeof globalThis.fetch;

  constructor(private readonly options: OptionsClientApi) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async rechercherExemplaires(terme: string): Promise<Resultat<Exemplaire[]>> {
    const t = terme.trim();
    if (t.length === 0) return succes([]);
    return this.get(`/exemplaires?q=${encodeURIComponent(t)}`, schemaListeExemplaires);
  }

  async verifierConnexion(): Promise<Resultat<null>> {
    const resultat = await this.get('/sante', schemaSante);
    return resultat.ok ? succes(null) : resultat;
  }

  private async get<T>(chemin: string, schema: z.ZodType<T>): Promise<Resultat<T>> {
    const base = this.options.urlServeur();

    let reponse: Response;
    try {
      reponse = await this.fetch(new URL(chemin, base), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.delaiMaxMs),
      });
    } catch (erreur) {
      return echec({
        type: 'serveur-injoignable',
        message: `Impossible de joindre le serveur ${base} (${decrire(erreur)}). Vérifiez qu'il est démarré et que l'URL est correcte.`,
      });
    }

    let corps: unknown;
    try {
      corps = await reponse.json();
    } catch {
      return echec({ type: 'reponse-invalide', message: `Réponse illisible du serveur (HTTP ${reponse.status})` });
    }

    if (!reponse.ok) {
      const erreurApi = schemaErreurApi.safeParse(corps);
      return echec(
        erreurApi.success
          ? { type: 'erreur-api', ...erreurApi.data.erreur }
          : { type: 'erreur-api', code: `HTTP_${reponse.status}`, message: `Le serveur a répondu HTTP ${reponse.status}` },
      );
    }

    const donnees = schema.safeParse(corps);
    return donnees.success
      ? succes(donnees.data)
      : echec({ type: 'reponse-invalide', message: 'La réponse du serveur ne respecte pas le format attendu' });
  }
}

function decrire(erreur: unknown): string {
  if (erreur instanceof DOMException && erreur.name === 'TimeoutError') return 'délai dépassé';
  if (erreur instanceof Error) {
    const cause = erreur.cause instanceof Error ? erreur.cause : null;
    const code = cause && 'code' in cause ? String(cause.code) : null;
    return code ?? cause?.message ?? erreur.message;
  }
  return 'erreur réseau';
}
