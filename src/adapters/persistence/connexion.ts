import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { cleTriAuteur, cleTriTitre, Livre } from '../../domain/livre.js';

export type BaseSqlite = Database.Database;

/**
 * Migrations successives du schéma. L'indice + 1 correspond à `PRAGMA user_version` :
 * on n'applique que celles qui ne l'ont pas encore été. Ne jamais modifier une
 * migration existante, toujours en ajouter une nouvelle. Une migration est du
 * SQL, ou une fonction quand elle a besoin de code (remplissage de données).
 */
const MIGRATIONS: readonly (string | ((db: BaseSqlite) => void))[] = [
  `
  CREATE TABLE emplacements (
    id        TEXT PRIMARY KEY,
    type      TEXT NOT NULL CHECK (type IN ('etage', 'salle', 'rayon', 'etagere', 'niveau')),
    nom       TEXT NOT NULL,
    parent_id TEXT REFERENCES emplacements (id),
    x         REAL,
    y         REAL,
    CHECK ((x IS NULL) = (y IS NULL))
  );
  CREATE INDEX idx_emplacements_parent ON emplacements (parent_id);

  CREATE TABLE livres (
    isbn            TEXT PRIMARY KEY,
    titre           TEXT NOT NULL,
    auteurs         TEXT NOT NULL,          -- tableau JSON
    couverture      TEXT,
    texte_recherche TEXT NOT NULL           -- titre et auteurs normalisés (cf. normaliserPourRecherche)
  );

  CREATE TABLE exemplaires (
    id                       TEXT PRIMARY KEY,
    isbn                     TEXT NOT NULL REFERENCES livres (isbn),
    emplacement_id           TEXT NOT NULL REFERENCES emplacements (id),
    detection_emplacement_id TEXT REFERENCES emplacements (id),
    detection_date           TEXT,          -- ISO 8601
    CHECK ((detection_emplacement_id IS NULL) = (detection_date IS NULL))
  );
  CREATE INDEX idx_exemplaires_isbn ON exemplaires (isbn);
  CREATE INDEX idx_exemplaires_emplacement ON exemplaires (emplacement_id);
  CREATE INDEX idx_exemplaires_detection ON exemplaires (detection_emplacement_id);
  `,
  // v2 : l'ISBN devient facultatif. Les livres ont un identifiant interne (les livres
  // existants reçoivent 'livre-<isbn>') et les exemplaires référencent ce livre.
  `
  CREATE TABLE livres_v2 (
    id              TEXT PRIMARY KEY,
    isbn            TEXT UNIQUE,            -- NULL autorisé (plusieurs livres sans ISBN)
    titre           TEXT NOT NULL,
    auteurs         TEXT NOT NULL,
    couverture      TEXT,
    texte_recherche TEXT NOT NULL
  );
  INSERT INTO livres_v2 (id, isbn, titre, auteurs, couverture, texte_recherche)
    SELECT 'livre-' || isbn, isbn, titre, auteurs, couverture, texte_recherche FROM livres;

  CREATE TABLE exemplaires_v2 (
    id                       TEXT PRIMARY KEY,
    livre_id                 TEXT NOT NULL REFERENCES livres_v2 (id),
    emplacement_id           TEXT NOT NULL REFERENCES emplacements (id),
    detection_emplacement_id TEXT REFERENCES emplacements (id),
    detection_date           TEXT,
    CHECK ((detection_emplacement_id IS NULL) = (detection_date IS NULL))
  );
  INSERT INTO exemplaires_v2 (id, livre_id, emplacement_id, detection_emplacement_id, detection_date)
    SELECT id, 'livre-' || isbn, emplacement_id, detection_emplacement_id, detection_date FROM exemplaires;

  DROP TABLE exemplaires;
  DROP TABLE livres;
  ALTER TABLE livres_v2 RENAME TO livres;
  ALTER TABLE exemplaires_v2 RENAME TO exemplaires;

  CREATE INDEX idx_exemplaires_livre ON exemplaires (livre_id);
  CREATE INDEX idx_exemplaires_emplacement ON exemplaires (emplacement_id);
  CREATE INDEX idx_exemplaires_detection ON exemplaires (detection_emplacement_id);
  `,
  // v3 : clés de tri (titre, premier auteur) normalisées par le domaine, pour la
  // vue « base de données ». Le remplissage des lignes existantes a besoin de la
  // fonction du domaine : cette migration est donc une fonction, pas du SQL pur.
  (db) => {
    db.exec(`
      ALTER TABLE livres ADD COLUMN titre_tri TEXT NOT NULL DEFAULT '';
      ALTER TABLE livres ADD COLUMN auteur_tri TEXT NOT NULL DEFAULT '';
      CREATE INDEX idx_livres_titre_tri ON livres (titre_tri);
      CREATE INDEX idx_livres_auteur_tri ON livres (auteur_tri);
    `);
    const lignes = db.prepare<[], LivreSnapshotSql>('SELECT id, isbn, titre, auteurs, couverture FROM livres').all();
    const maj = db.prepare<[{ id: string; titre_tri: string; auteur_tri: string }]>(
      'UPDATE livres SET titre_tri = @titre_tri, auteur_tri = @auteur_tri WHERE id = @id',
    );
    for (const l of lignes) {
      const livre = Livre.reconstituer({ ...l, auteurs: JSON.parse(l.auteurs) as string[] });
      maj.run({ id: l.id, titre_tri: cleTriTitre(livre), auteur_tri: cleTriAuteur(livre) });
    }
  },
];

interface LivreSnapshotSql {
  id: string;
  isbn: string | null;
  titre: string;
  auteurs: string;
  couverture: string | null;
}

/** Nombre de migrations : version du schéma attendue (exporté pour les tests). */
export const VERSION_SCHEMA = MIGRATIONS.length;

/** Applique les migrations jusqu'à `version` incluse (toutes par défaut). Exporté pour les tests. */
export function migrer(db: BaseSqlite, version = VERSION_SCHEMA): void {
  const versionActuelle = db.pragma('user_version', { simple: true }) as number;
  MIGRATIONS.slice(versionActuelle, version).forEach((migration, i) => {
    db.transaction(() => {
      if (typeof migration === 'string') db.exec(migration);
      else migration(db);
      db.pragma(`user_version = ${versionActuelle + i + 1}`);
    })();
  });
}

/** Ouvre (ou crée) la base, active les clés étrangères et applique les migrations. */
export function ouvrirBaseSqlite(chemin: string): BaseSqlite {
  if (chemin !== ':memory:') mkdirSync(dirname(chemin), { recursive: true });

  const db = new Database(chemin);
  db.pragma('foreign_keys = ON');
  if (chemin !== ':memory:') db.pragma('journal_mode = WAL');
  migrer(db);
  return db;
}

/** Vide toutes les tables (utilisé par le seed). */
export function viderBase(db: BaseSqlite): void {
  db.transaction(() => {
    db.exec('DELETE FROM exemplaires; DELETE FROM livres; DELETE FROM emplacements;');
  })();
}
