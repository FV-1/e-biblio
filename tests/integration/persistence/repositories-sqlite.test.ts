import { afterEach } from 'vitest';
import { ouvrirBaseSqlite, type BaseSqlite } from '../../../src/adapters/persistence/connexion.js';
import { SqliteEmplacementRepository } from '../../../src/adapters/persistence/sqlite-emplacement-repository.js';
import { SqliteExemplaireRepository } from '../../../src/adapters/persistence/sqlite-exemplaire-repository.js';
import { SqliteLivreRepository } from '../../../src/adapters/persistence/sqlite-livre-repository.js';
import { contratRepositories } from '../../contrats/repositories.contrat.js';

let db: BaseSqlite | undefined;
afterEach(() => db?.close());

contratRepositories('SQLite', () => {
  db = ouvrirBaseSqlite(':memory:');
  return {
    emplacements: new SqliteEmplacementRepository(db),
    livres: new SqliteLivreRepository(db),
    exemplaires: new SqliteExemplaireRepository(db),
  };
});
