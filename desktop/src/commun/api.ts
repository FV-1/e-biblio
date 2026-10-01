import { z } from 'zod';

/**
 * Contrat de l'API REST e-biblio, tel que CE client l'attend.
 * Le front n'importe aucun code du serveur : le seul lien entre les deux est
 * ce contrat HTTP, vérifié à l'exécution par le processus main.
 * Objets non stricts : un champ ajouté côté serveur ne casse pas le client.
 */

export const schemaLocalisation = z.object({
  chemin: z.array(z.object({ id: z.string(), type: z.string(), nom: z.string() })),
  libelle: z.string(),
  coordonnees: z.object({ x: z.number(), y: z.number() }).nullable(),
});

export const schemaExemplaire = z.object({
  id: z.string(),
  isbn: z.string(),
  livre: z.object({
    isbn: z.string(),
    titre: z.string(),
    auteurs: z.array(z.string()),
    couverture: z.string().nullable(),
  }),
  emplacementTheorique: z.object({ emplacementId: z.string(), localisation: schemaLocalisation }),
  derniereDetection: z
    .object({ emplacementId: z.string(), localisation: schemaLocalisation, date: z.string() })
    .nullable(),
  malRange: z.boolean(),
});

export const schemaListeExemplaires = z.array(schemaExemplaire);

export const schemaSante = z.object({ statut: z.literal('ok') });

/** Format commun des erreurs renvoyées par le serveur. */
export const schemaErreurApi = z.object({
  erreur: z.object({ code: z.string(), message: z.string() }),
});

export type Localisation = z.infer<typeof schemaLocalisation>;
export type Exemplaire = z.infer<typeof schemaExemplaire>;
