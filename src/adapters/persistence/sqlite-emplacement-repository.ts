import { Emplacement } from '../../domain/emplacement.js';
import type { TypeEmplacement } from '../../domain/type-emplacement.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { BaseSqlite } from './connexion.js';

interface LigneEmplacement {
  id: string;
  type: TypeEmplacement;
  nom: string;
  parent_id: string | null;
  x: number | null;
  y: number | null;
}

export class SqliteEmplacementRepository implements EmplacementRepository {
  private readonly requetes;

  constructor(db: BaseSqlite) {
    this.requetes = {
      parId: db.prepare<[string], LigneEmplacement>('SELECT * FROM emplacements WHERE id = ?'),
      tous: db.prepare<[], LigneEmplacement>('SELECT * FROM emplacements ORDER BY rowid'),
      enfants: db.prepare<[string], LigneEmplacement>('SELECT * FROM emplacements WHERE parent_id = ? ORDER BY rowid'),
      upsert: db.prepare<[LigneEmplacement]>(`
        INSERT INTO emplacements (id, type, nom, parent_id, x, y)
        VALUES (@id, @type, @nom, @parent_id, @x, @y)
        ON CONFLICT (id) DO UPDATE SET
          type = excluded.type, nom = excluded.nom, parent_id = excluded.parent_id,
          x = excluded.x, y = excluded.y
      `),
      supprimer: db.prepare<[string]>('DELETE FROM emplacements WHERE id = ?'),
    };
  }

  async trouverParId(id: string): Promise<Emplacement | null> {
    const ligne = this.requetes.parId.get(id);
    return ligne ? versEntite(ligne) : null;
  }

  async trouverTous(): Promise<Emplacement[]> {
    return this.requetes.tous.all().map(versEntite);
  }

  async trouverEnfants(parentId: string): Promise<Emplacement[]> {
    return this.requetes.enfants.all(parentId).map(versEntite);
  }

  async enregistrer(emplacement: Emplacement): Promise<void> {
    const s = emplacement.versSnapshot();
    this.requetes.upsert.run({
      id: s.id,
      type: s.type,
      nom: s.nom,
      parent_id: s.parentId,
      x: s.coordonnees?.x ?? null,
      y: s.coordonnees?.y ?? null,
    });
  }

  async supprimer(id: string): Promise<void> {
    this.requetes.supprimer.run(id);
  }
}

function versEntite(ligne: LigneEmplacement): Emplacement {
  return Emplacement.reconstituer({
    id: ligne.id,
    type: ligne.type,
    nom: ligne.nom,
    parentId: ligne.parent_id,
    coordonnees: ligne.x !== null && ligne.y !== null ? { x: ligne.x, y: ligne.y } : null,
  });
}
