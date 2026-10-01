import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  migrer,
  ouvrirBaseSqlite,
  VERSION_SCHEMA,
  viderBase,
  type BaseSqlite,
} from '../../../src/adapters/persistence/connexion.js';
import { SqliteEmplacementRepository } from '../../../src/adapters/persistence/sqlite-emplacement-repository.js';
import { SqliteExemplaireRepository } from '../../../src/adapters/persistence/sqlite-exemplaire-repository.js';
import { SqliteLivreRepository } from '../../../src/adapters/persistence/sqlite-livre-repository.js';
import { Exemplaire } from '../../../src/domain/exemplaire.js';
import { Isbn } from '../../../src/domain/isbn.js';
import { Livre } from '../../../src/domain/livre.js';
import { peuplerEmplacements } from '../../../src/seed-donnees.js';
import { construireHierarchie } from '../../fixtures/hierarchie.js';

const isbnHugo = Isbn.creer('9780306406157');

describe('Base SQLite', () => {
  let db: BaseSqlite;
  beforeEach(() => {
    db = ouvrirBaseSqlite(':memory:');
  });
  afterEach(() => db.close());

  it('applique toutes les migrations et active les clés étrangères', () => {
    expect(db.pragma('user_version', { simple: true })).toBe(VERSION_SCHEMA);
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
    const livre = Livre.creer({ id: 'livre-absent', isbn: isbnHugo, titre: 'X', auteurs: [] });
    const ex = Exemplaire.creer({ id: 'ex', livre, numero: 1, emplacement: h.etagere1 });
    await expect(new SqliteExemplaireRepository(db).enregistrer(ex)).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuse deux livres différents avec le même ISBN', async () => {
    const repo = new SqliteLivreRepository(db);
    await repo.enregistrer(Livre.creer({ id: 'a', isbn: isbnHugo, titre: 'A', auteurs: [] }));
    await expect(repo.enregistrer(Livre.creer({ id: 'b', isbn: isbnHugo, titre: 'B', auteurs: [] }))).rejects.toThrow(
      /UNIQUE/,
    );
  });

  it('le seed s’insère dans l’ordre des clés étrangères, et viderBase remet à zéro', async () => {
    const repo = new SqliteEmplacementRepository(db);
    await peuplerEmplacements(repo);
    expect(await repo.trouverTous()).toHaveLength(19);

    viderBase(db);
    expect(await repo.trouverTous()).toHaveLength(0);
  });
});

describe('Migration v1 → v2 (ISBN facultatif)', () => {
  it('convertit les livres et exemplaires existants sans perte', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrer(db, 1);
    db.exec(`
      INSERT INTO emplacements (id, type, nom, parent_id) VALUES
        ('e', 'etage', 'Étage', NULL), ('s', 'salle', 'Salle', 'e'),
        ('r', 'rayon', 'Rayon', 's'), ('t1', 'etagere', 'T1', 'r'), ('t2', 'etagere', 'T2', 'r');
      INSERT INTO livres (isbn, titre, auteurs, couverture, texte_recherche)
        VALUES ('9780306406157', 'Les Misérables', '["Victor Hugo"]', NULL, 'les miserables' || char(10) || 'victor hugo');
      INSERT INTO exemplaires (id, isbn, emplacement_id, detection_emplacement_id, detection_date)
        VALUES ('ex-1', '9780306406157', 't1', 't2', '2026-01-01T00:00:00.000Z');
    `);

    migrer(db);

    expect(db.pragma('user_version', { simple: true })).toBe(VERSION_SCHEMA);
    const livre = await new SqliteLivreRepository(db).trouverParIsbn(isbnHugo);
    expect(livre?.versSnapshot()).toEqual({
      id: 'livre-9780306406157',
      isbn: '9780306406157',
      titre: 'Les Misérables',
      auteurs: ['Victor Hugo'],
      couverture: null,
    });
    const exemplaires = new SqliteExemplaireRepository(db);
    expect((await exemplaires.trouverParId('ex-1'))?.versSnapshot()).toEqual({
      id: 'ex-1',
      livreId: 'livre-9780306406157',
      numero: 1, // attribué par la migration v4
      emplacementId: 't1',
      derniereDetection: { emplacementId: 't2', date: new Date('2026-01-01T00:00:00.000Z') },
    });
    expect((await exemplaires.rechercher('hugo')).map((e) => e.id)).toEqual(['ex-1']);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });
});

describe('Migration v2 → v3 (clés de tri)', () => {
  it('remplit les clés de tri des livres existants avec la règle du domaine', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrer(db, 2);
    db.exec(`
      INSERT INTO livres (id, isbn, titre, auteurs, couverture, texte_recherche) VALUES
        ('a', NULL, 'L''Étranger', '["Albert Camus"]', NULL, ''),
        ('b', NULL, 'Sans auteur', '[]', NULL, '');
    `);

    migrer(db);

    expect(db.prepare('SELECT id, titre_tri, auteur_tri FROM livres ORDER BY id').all()).toEqual([
      { id: 'a', titre_tri: "l'etranger", auteur_tri: 'albert camus' },
      { id: 'b', titre_tri: 'sans auteur', auteur_tri: '' },
    ]);
    db.close();
  });
});

describe('Migration v3 → v4 (numéro d’exemplaire)', () => {
  it('numérote les exemplaires existants par œuvre, dans l’ordre de leur id, et interdit les doublons', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrer(db, 3);
    db.exec(`
      INSERT INTO emplacements (id, type, nom, parent_id) VALUES
        ('e', 'etage', 'É', NULL), ('s', 'salle', 'S', 'e'), ('r', 'rayon', 'R', 's'), ('t', 'etagere', 'T', 'r');
      INSERT INTO livres (id, isbn, titre, auteurs, couverture, texte_recherche) VALUES
        ('l1', NULL, 'A', '[]', NULL, 'a'), ('l2', NULL, 'B', '[]', NULL, 'b');
      INSERT INTO exemplaires (id, livre_id, emplacement_id) VALUES
        ('c', 'l1', 't'), ('a', 'l1', 't'), ('b', 'l2', 't'), ('d', 'l1', 't');
    `);

    migrer(db);

    expect(db.prepare('SELECT id, livre_id, numero FROM exemplaires ORDER BY livre_id, numero').all()).toEqual([
      { id: 'a', livre_id: 'l1', numero: 1 },
      { id: 'c', livre_id: 'l1', numero: 2 },
      { id: 'd', livre_id: 'l1', numero: 3 },
      { id: 'b', livre_id: 'l2', numero: 1 },
    ]);
    expect(() => db.exec(`INSERT INTO exemplaires (id, livre_id, numero, emplacement_id) VALUES ('x', 'l1', 2, 't')`)).toThrow(
      /UNIQUE/,
    );
    db.close();
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

    const db1 = ouvrirBaseSqlite(chemin);
    await new SqliteLivreRepository(db1).enregistrer(
      Livre.creer({ id: 'livre-1', isbn: isbnHugo, titre: 'Persisté', auteurs: ['A'] }),
    );
    db1.close();

    const db2 = ouvrirBaseSqlite(chemin);
    expect(db2.pragma('user_version', { simple: true })).toBe(VERSION_SCHEMA);
    expect((await new SqliteLivreRepository(db2).trouverParIsbn(isbnHugo))?.titre).toBe('Persisté');
    db2.close();
  });
});
