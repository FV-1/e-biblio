import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ouvrirBaseSqlite, viderBase, type BaseSqlite } from '../../../src/adapters/persistence/connexion.js';
import { SqliteEmplacementRepository } from '../../../src/adapters/persistence/sqlite-emplacement-repository.js';
import { SqliteExemplaireRepository } from '../../../src/adapters/persistence/sqlite-exemplaire-repository.js';
import { SqliteLivreRepository } from '../../../src/adapters/persistence/sqlite-livre-repository.js';
import { Exemplaire } from '../../../src/domain/exemplaire.js';
import { Isbn } from '../../../src/domain/isbn.js';
import { Livre } from '../../../src/domain/livre.js';
import { peuplerEmplacements } from '../../../src/seed-donnees.js';
import { construireHierarchie } from '../../fixtures/hierarchie.js';

describe('Base SQLite', () => {
  let db: BaseSqlite;
  beforeEach(() => {
    db = ouvrirBaseSqlite(':memory:');
  });
  afterEach(() => db.close());

  it('applique les migrations et active les clés étrangères', () => {
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('refuse un emplacement dont le parent n’existe pas (intégrité référentielle)', async () => {
    const { salle } = construireHierarchie(); // parent etage-1 jamais enregistré
    await expect(new SqliteEmplacementRepository(db).enregistrer(salle)).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuse la suppression d’un emplacement qui a des enfants', async () => {
    const repo = new SqliteEmplacementRepository(db);
    const h = construireHierarchie();
    for (const e of h.tous) await repo.enregistrer(e);
    await expect(repo.supprimer('rayon-romans')).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuse un exemplaire dont le livre n’est pas enregistré', async () => {
    const h = construireHierarchie();
    const repo = new SqliteEmplacementRepository(db);
    for (const e of h.tous) await repo.enregistrer(e);
    const ex = Exemplaire.creer({ id: 'ex', isbn: Isbn.creer('9780306406157'), emplacement: h.etagere1 });
    await expect(new SqliteExemplaireRepository(db).enregistrer(ex)).rejects.toThrow(/FOREIGN KEY/);
  });

  it('le seed s’insère dans l’ordre des clés étrangères, et viderBase remet à zéro', async () => {
    const repo = new SqliteEmplacementRepository(db);
    await peuplerEmplacements(repo);
    expect(await repo.trouverTous()).toHaveLength(19);

    viderBase(db);
    expect(await repo.trouverTous()).toHaveLength(0);
  });
});

describe('Base SQLite sur fichier', () => {
  let dossier: string;
  beforeEach(() => {
    dossier = mkdtempSync(join(tmpdir(), 'e-biblio-'));
  });
  afterEach(() => rmSync(dossier, { recursive: true, force: true }));

  it('crée le dossier, persiste les données et ne rejoue pas les migrations à la réouverture', async () => {
    const chemin = join(dossier, 'sous-dossier', 'test.db');
    const isbn = Isbn.creer('9780306406157');

    const db1 = ouvrirBaseSqlite(chemin);
    await new SqliteLivreRepository(db1).enregistrer(Livre.creer({ isbn, titre: 'Persisté', auteurs: ['A'] }));
    db1.close();

    const db2 = ouvrirBaseSqlite(chemin);
    expect(db2.pragma('user_version', { simple: true })).toBe(1);
    expect((await new SqliteLivreRepository(db2).trouverParIsbn(isbn))?.titre).toBe('Persisté');
    db2.close();
  });
});
