import { ouvrirBaseSqlite, viderBase } from './adapters/persistence/connexion.js';
import { SqliteEmplacementRepository } from './adapters/persistence/sqlite-emplacement-repository.js';
import { SqliteExemplaireRepository } from './adapters/persistence/sqlite-exemplaire-repository.js';
import { SqliteLivreRepository } from './adapters/persistence/sqlite-livre-repository.js';
import { HorlogeSysteme } from './adapters/systeme/horloge-systeme.js';
import { chargerConfig } from './config.js';
import { peuplerDemo } from './seed-demo-donnees.js';
import { peuplerEmplacements } from './seed-donnees.js';

/**
 * Point d'entrée `npm run seed` : RÉINITIALISE la base (toutes les données sont
 * supprimées) puis crée la hiérarchie d'emplacements de démonstration.
 * Avec `--demo` (`npm run seed:demo`), ajoute aussi le fonds de démonstration :
 * livres et exemplaires, dont certains détectés et mal rangés.
 */
async function seed(): Promise<void> {
  const config = chargerConfig();
  const avecDemo = process.argv.includes('--demo');
  const db = ouvrirBaseSqlite(config.DB_PATH);
  try {
    viderBase(db);
    const emplacements = await peuplerEmplacements(new SqliteEmplacementRepository(db));

    const parType = Object.groupBy(emplacements, (e) => e.type);
    let resume = Object.entries(parType)
      .map(([type, liste]) => `${liste?.length ?? 0} ${type}`)
      .join(', ');

    if (avecDemo) {
      const { livres, exemplaires } = await peuplerDemo(
        new SqliteLivreRepository(db),
        new SqliteExemplaireRepository(db),
        emplacements,
        new HorlogeSysteme().maintenant(),
      );
      const malRanges = exemplaires.filter((e) => e.estMalRange()).length;
      resume += `, ${livres.length} livres, ${exemplaires.length} exemplaires (dont ${malRanges} mal rangés)`;
    }
    console.log(`[seed] base ${config.DB_PATH} réinitialisée : ${resume}`);
  } finally {
    db.close();
  }
}

seed().catch((erreur: unknown) => {
  console.error('[seed] échec :', erreur);
  process.exitCode = 1;
});
