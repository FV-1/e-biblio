import { ouvrirBaseSqlite, viderBase } from './adapters/persistence/connexion.js';
import { SqliteEmplacementRepository } from './adapters/persistence/sqlite-emplacement-repository.js';
import { chargerConfig } from './config.js';
import { peuplerEmplacements } from './seed-donnees.js';

/**
 * Point d'entrée `npm run seed` : RÉINITIALISE la base (toutes les données sont
 * supprimées) puis crée la hiérarchie d'emplacements de démonstration.
 */
async function seed(): Promise<void> {
  const config = chargerConfig();
  const db = ouvrirBaseSqlite(config.DB_PATH);
  try {
    viderBase(db);
    const emplacements = await peuplerEmplacements(new SqliteEmplacementRepository(db));

    const parType = Object.groupBy(emplacements, (e) => e.type);
    const resume = Object.entries(parType)
      .map(([type, liste]) => `${liste?.length ?? 0} ${type}`)
      .join(', ');
    console.log(`[seed] base ${config.DB_PATH} réinitialisée : ${resume}`);
  } finally {
    db.close();
  }
}

seed().catch((erreur: unknown) => {
  console.error('[seed] échec :', erreur);
  process.exitCode = 1;
});
