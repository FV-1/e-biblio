import type { z } from 'zod';
import {
  schemaErreurApi,
  schemaExemplaireAjoute,
  schemaListeEmplacements,
  schemaListeExemplaires,
  schemaNotice,
  schemaPageLivres,
  schemaSante,
  type CriteresLivres,
  type DemandeAjout,
  type PageLivres,
  type Emplacement,
  type Exemplaire,
  type ExemplaireAjoute,
  type Notice,
} from '../commun/api';
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

  async listerEmplacements(): Promise<Resultat<Emplacement[]>> {
    return this.get('/emplacements', schemaListeEmplacements);
  }

  async consulterNotice(isbn: string): Promise<Resultat<Notice>> {
    return this.get(`/livres/${encodeURIComponent(isbn.trim())}`, schemaNotice);
  }

  async ajouterExemplaire(demande: DemandeAjout): Promise<Resultat<ExemplaireAjoute>> {
    return this.requete('POST', '/exemplaires', schemaExemplaireAjoute, corpsAjout(demande));
  }

  async listerLivres(criteres: CriteresLivres): Promise<Resultat<PageLivres>> {
    const parametres = new URLSearchParams({
      tri: criteres.tri,
      ordre: criteres.ordre,
      page: String(criteres.page),
      parPage: String(criteres.parPage),
    });
    const terme = criteres.terme?.trim();
    if (terme) parametres.set('q', terme);
    if (criteres.isbn) parametres.set('isbn', criteres.isbn);
    if (criteres.couverture) parametres.set('couverture', criteres.couverture);
    return this.get(`/livres?${parametres}`, schemaPageLivres);
  }

  async listerExemplairesDuLivre(livreId: string): Promise<Resultat<Exemplaire[]>> {
    return this.get(`/exemplaires?livreId=${encodeURIComponent(livreId)}`, schemaListeExemplaires);
  }

  async listerExemplairesDeLEmplacement(emplacementId: string): Promise<Resultat<Exemplaire[]>> {
    return this.get(`/exemplaires?emplacementId=${encodeURIComponent(emplacementId)}`, schemaListeExemplaires);
  }

  private get<T>(chemin: string, schema: z.ZodType<T>): Promise<Resultat<T>> {
    return this.requete('GET', chemin, schema);
  }

  private async requete<T>(
    methode: 'GET' | 'POST',
    chemin: string,
    schema: z.ZodType<T>,
    corpsRequete?: unknown,
  ): Promise<Resultat<T>> {
    const base = this.options.urlServeur();

    let reponse: Response;
    try {
      reponse = await this.fetch(new URL(chemin, base), {
        method: methode,
        headers:
          corpsRequete === undefined
            ? { Accept: 'application/json' }
            : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: corpsRequete === undefined ? undefined : JSON.stringify(corpsRequete),
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

/** Traduit la demande du client vers le corps attendu par POST /exemplaires. */
function corpsAjout(demande: DemandeAjout): Record<string, unknown> {
  const { livre } = demande;
  switch (livre.type) {
    case 'isbn':
      return { emplacementId: demande.emplacementId, isbn: livre.isbn };
    case 'existant':
      return { emplacementId: demande.emplacementId, livreId: livre.livreId };
    case 'saisie':
      return {
        emplacementId: demande.emplacementId,
        ...(livre.isbn ? { isbn: livre.isbn } : {}),
        titre: livre.titre,
        auteurs: livre.auteurs,
        couverture: livre.couverture,
      };
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
