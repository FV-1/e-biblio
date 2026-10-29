import { z } from 'zod';
import { TYPES_EMPLACEMENT } from '../../domain/type-emplacement.js';

// Messages de validation en français, cohérents avec ceux du domaine.
z.config(z.locales.fr());

/**
 * Validation des entrées HTTP : forme et types uniquement. Les règles métier
 * (hiérarchie, ISBN, rangement…) restent dans le domaine et ne sont PAS
 * dupliquées ici. Les objets sont stricts : un champ inconnu (faute de frappe)
 * est refusé plutôt qu'ignoré silencieusement.
 */

const identifiant = z.string().trim().min(1).max(200);
const coordonnees = z.strictObject({ x: z.number(), y: z.number() });

export const parametresId = z.object({ id: identifiant });

export const filtreEmplacements = z.object({
  type: z.enum(TYPES_EMPLACEMENT).optional(),
  parentId: identifiant.optional(),
});

export const corpsCreerEmplacement = z.strictObject({
  type: z.enum(TYPES_EMPLACEMENT),
  nom: z.string(),
  parentId: identifiant.nullable().default(null),
  coordonnees: coordonnees.nullable().default(null),
});

export const corpsModifierEmplacement = z
  .strictObject({
    nom: z.string().optional(),
    parentId: identifiant.nullable().optional(),
    coordonnees: coordonnees.nullable().optional(),
  })
  .refine((c) => Object.keys(c).length > 0, { message: 'Au moins un champ à modifier est requis' });

/**
 * Trois modes, exclusifs :
 *   - { isbn }                         → notice en base ou catalogue externe
 *   - { isbn?, titre, auteurs?, … }    → saisie manuelle (ISBN facultatif)
 *   - { livreId }                      → nouvel exemplaire d'un livre déjà enregistré
 */
export const corpsAjouterExemplaire = z
  .strictObject({
    emplacementId: identifiant,
    isbn: z.string().min(1).max(30).optional(),
    livreId: identifiant.optional(),
    titre: z.string().optional(),
    auteurs: z.array(z.string()).max(50).optional(),
    couverture: z.url({ protocol: /^https?$/ }).nullable().optional(),
  })
  .superRefine((c, ctx) => {
    const saisie = c.titre !== undefined || c.auteurs !== undefined || c.couverture !== undefined;
    if (c.livreId !== undefined && (c.isbn !== undefined || saisie)) {
      ctx.addIssue({ code: 'custom', path: ['livreId'], message: '« livreId » ne se combine pas avec un ISBN ou une saisie manuelle' });
    } else if (c.livreId === undefined && c.isbn === undefined && c.titre === undefined) {
      ctx.addIssue({ code: 'custom', path: ['isbn'], message: 'Indiquez un « isbn », un « titre » (saisie manuelle) ou un « livreId »' });
    } else if (saisie && c.titre === undefined) {
      ctx.addIssue({ code: 'custom', path: ['titre'], message: 'Une saisie manuelle doit contenir au moins le « titre »' });
    }
  });

export const parametresIsbn = z.object({ isbn: z.string().trim().min(1).max(30) });

/**
 * GET /exemplaires : recherche (q), exemplaires d'une œuvre (livreId) OU contenu
 * d'une étagère (emplacementId), exactement l'un des trois.
 */
export const requeteExemplaires = z.union(
  [
    // `z.undefined().optional()` : avec zod 4, `z.undefined()` seul rendrait la clé obligatoire.
    z.object({
      q: z.string().trim().min(1, 'Le paramètre « q » est obligatoire').max(200),
      livreId: z.undefined().optional(),
      emplacementId: z.undefined().optional(),
    }),
    z.object({ livreId: identifiant, q: z.undefined().optional(), emplacementId: z.undefined().optional() }),
    z.object({ emplacementId: identifiant, q: z.undefined().optional(), livreId: z.undefined().optional() }),
  ],
  { error: 'Indiquez soit « q » (recherche), soit « livreId » (exemplaires d’une œuvre), soit « emplacementId » (contenu d’une étagère)' },
);

const avecOuSans = z.enum(['avec', 'sans']).transform((v) => v === 'avec');

/** GET /livres : vue « base de données » (recherche, filtres, tri, pagination). */
export const requeteLivres = z.object({
  q: z.string().trim().max(200).optional(),
  isbn: avecOuSans.optional(),
  couverture: avecOuSans.optional(),
  tri: z.enum(['titre', 'auteur', 'exemplaires', 'malRanges']).optional(),
  ordre: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  parPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const corpsDetection = z.strictObject({
  exemplaireId: identifiant,
  emplacementId: identifiant,
});
