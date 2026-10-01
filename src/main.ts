import { chargerConfig } from './config.js';

/**
 * Composition root : seul endroit qui connaît les implémentations concrètes.
 * Instancie les adapters (SQLite, Open Library, EventPublisher, HTTP)
 * et les injecte dans les cas d'usage. Complété aux étapes 3 et 4.
 */
function main(): void {
  const config = chargerConfig();
  console.log(`[e-biblio] configuration chargée : ${config.HOST}:${config.PORT}, base ${config.DB_PATH}`);
}

main();
