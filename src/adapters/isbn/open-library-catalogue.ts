import { z } from 'zod';
import type { Isbn } from '../../domain/isbn.js';
import type { CatalogueExterne, ResultatCatalogue } from '../../ports/catalogue-externe.js';

export interface OptionsOpenLibrary {
  /** Ex. https://openlibrary.org (configurable pour les tests ou un miroir). */
  readonly urlBase: string;
  readonly delaiMaxMs: number;
  /** Injectable pour tester l'adapter sans réseau. */
  readonly fetch?: typeof globalThis.fetch;
}

/** Sous-ensemble de la réponse /isbn/{isbn}.json dont on a besoin ; le reste est ignoré. */
const schemaEdition = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  authors: z.array(z.object({ key: z.string() })).optional(),
  by_statement: z.string().optional(),
  covers: z.array(z.number()).optional(),
});

const schemaAuteur = z.object({ name: z.string().min(1) });

const URL_COUVERTURES = 'https://covers.openlibrary.org/b/id';

/**
 * Adapter du port CatalogueExterne pour l'API Open Library.
 * Toute défaillance technique (réseau, délai dépassé, 5xx, réponse illisible)
 * est convertie en statut « indisponible » : elle ne remonte jamais en exception.
 */
export class OpenLibraryCatalogue implements CatalogueExterne {
  private readonly fetch: typeof globalThis.fetch;

  constructor(private readonly options: OptionsOpenLibrary) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async rechercherParIsbn(isbn: Isbn): Promise<ResultatCatalogue> {
    // Un seul délai pour toute la recherche (édition puis auteurs) : la réponse
    // part toujours avant delaiMaxMs, quel que soit le nombre d'appels.
    const echeance = AbortSignal.timeout(this.options.delaiMaxMs);
    let reponse: Response;
    try {
      reponse = await this.get(`/isbn/${isbn.valeur}.json`, echeance);
    } catch (erreur) {
      return { statut: 'indisponible', raison: decrire(erreur) };
    }

    if (reponse.status === 404) return { statut: 'introuvable' };
    if (!reponse.ok) return { statut: 'indisponible', raison: `Open Library a répondu HTTP ${reponse.status}` };

    let edition: z.infer<typeof schemaEdition>;
    try {
      edition = schemaEdition.parse(await reponse.json());
    } catch {
      return { statut: 'indisponible', raison: 'réponse Open Library illisible' };
    }

    return {
      statut: 'trouve',
      livre: {
        titre: edition.subtitle ? `${edition.title} : ${edition.subtitle}` : edition.title,
        auteurs: await this.resoudreAuteurs(edition, echeance),
        couverture: edition.covers?.[0] && edition.covers[0] > 0 ? `${URL_COUVERTURES}/${edition.covers[0]}-L.jpg` : null,
      },
    };
  }

  /**
   * L'édition ne contient que des références (/authors/OL…A) : un appel par auteur,
   * en parallèle. Un auteur introuvable, ou hors délai, est ignoré plutôt que de faire échouer l'ajout.
   */
  private async resoudreAuteurs(edition: z.infer<typeof schemaEdition>, echeance: AbortSignal): Promise<string[]> {
    const cles = edition.authors?.map((a) => a.key) ?? [];
    const resultats = await Promise.allSettled(
      cles.map(async (cle) => {
        const reponse = await this.get(`${cle}.json`, echeance);
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        return schemaAuteur.parse(await reponse.json()).name;
      }),
    );
    const noms = resultats.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (noms.length === 0 && edition.by_statement) return [edition.by_statement];
    return noms;
  }

  private get(chemin: string, echeance: AbortSignal): Promise<Response> {
    return this.fetch(new URL(chemin, this.options.urlBase), {
      headers: { Accept: 'application/json', 'User-Agent': 'e-biblio-mvp/0.1 (projet pedagogique)' },
      redirect: 'follow',
      signal: echeance,
    });
  }
}

function decrire(erreur: unknown): string {
  if (erreur instanceof DOMException && erreur.name === 'TimeoutError') return 'délai de réponse dépassé';
  if (erreur instanceof Error) return `erreur réseau (${erreur.cause instanceof Error ? erreur.cause.message : erreur.message})`;
  return 'erreur réseau';
}
