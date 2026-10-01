import { z } from 'zod';

/**
 * Contrat de l'API REST e-biblio, tel que CE client l'attend.
 * Le front n'importe aucun code du serveur : le seul lien entre les deux est
 * ce contrat HTTP, vérifié à l'exécution par le processus main.
 * Objets non stricts : un champ ajouté côté serveur ne casse pas le client.
 */

const schemaCoordonnees = z.object({ x: z.number(), y: z.number() }).nullable();

export const schemaLocalisation = z.object({
  chemin: z.array(z.object({ id: z.string(), type: z.string(), nom: z.string() })),
  libelle: z.string(),
  coordonnees: schemaCoordonnees,
});

export const schemaLivre = z.object({
  id: z.string(),
  isbn: z.string().nullable(),
  titre: z.string(),
  auteurs: z.array(z.string()),
  couverture: z.string().nullable(),
});

export const schemaExemplaire = z.object({
  id: z.string(),
  livreId: z.string(),
  isbn: z.string().nullable(),
  livre: schemaLivre,
  emplacementTheorique: z.object({ emplacementId: z.string(), localisation: schemaLocalisation }),
  derniereDetection: z
    .object({ emplacementId: z.string(), localisation: schemaLocalisation, date: z.string() })
    .nullable(),
  malRange: z.boolean(),
});

export const schemaListeExemplaires = z.array(schemaExemplaire);

export const schemaExemplaireAjoute = schemaExemplaire.extend({
  sourceLivre: z.enum(['base', 'catalogue', 'saisie']),
});

export const schemaEmplacement = z.object({
  id: z.string(),
  type: z.string(),
  nom: z.string(),
  parentId: z.string().nullable(),
  coordonnees: schemaCoordonnees,
});

export const schemaListeEmplacements = z.array(schemaEmplacement);

/** Aperçu d'une notice (GET /livres/:isbn) : id null si le livre n'est pas encore enregistré. */
export const schemaNotice = z.object({
  source: z.enum(['base', 'catalogue']),
  livre: schemaLivre.extend({ id: z.string().nullable(), isbn: z.string() }),
});

export const schemaSante = z.object({ statut: z.literal('ok') });

/** Format commun des erreurs renvoyées par le serveur. */
export const schemaErreurApi = z.object({
  erreur: z.object({ code: z.string(), message: z.string() }),
});

/**
 * Demande d'ajout d'un exemplaire, validée à l'entrée du processus main
 * (elle vient de la page, considérée comme non fiable).
 */
export const schemaDemandeAjout = z.object({
  emplacementId: z.string().min(1).max(200),
  livre: z.discriminatedUnion('type', [
    z.object({ type: z.literal('isbn'), isbn: z.string().min(1).max(30) }),
    z.object({
      type: z.literal('saisie'),
      isbn: z.string().min(1).max(30).nullable(),
      titre: z.string().min(1).max(500),
      auteurs: z.array(z.string().max(200)).max(50),
      couverture: z.string().max(2000).nullable(),
    }),
    z.object({ type: z.literal('existant'), livreId: z.string().min(1).max(200) }),
  ]),
});

export type Localisation = z.infer<typeof schemaLocalisation>;
export type Livre = z.infer<typeof schemaLivre>;
export type Exemplaire = z.infer<typeof schemaExemplaire>;
export type ExemplaireAjoute = z.infer<typeof schemaExemplaireAjoute>;
export type Emplacement = z.infer<typeof schemaEmplacement>;
export type Notice = z.infer<typeof schemaNotice>;
export type DemandeAjout = z.infer<typeof schemaDemandeAjout>;
