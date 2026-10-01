import { z } from 'zod';

/**
 * Configuration de l'application, lue depuis les variables d'environnement.
 * Lue uniquement par les points d'entrée (main.ts, seed.ts) : le domaine et
 * les cas d'usage n'y ont jamais accès directement.
 */
const configSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_PATH: z.string().min(1).default('./data/biblio.db'),
  OPEN_LIBRARY_URL: z.url().default('https://openlibrary.org'),
  OPEN_LIBRARY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

export type Config = z.infer<typeof configSchema>;

export function chargerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const resultat = configSchema.safeParse(env);
  if (!resultat.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(resultat.error)}`);
  }
  return resultat.data;
}
