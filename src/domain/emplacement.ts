import { Coordonnees } from './coordonnees.js';
import { ErreurValidation } from './erreurs.js';
import { texteObligatoire } from './texte.js';
import { TYPE_RANGEMENT, typeParentAttendu, type TypeEmplacement } from './type-emplacement.js';

/** Représentation plate d'un emplacement, utilisée pour la persistance. */
export interface EmplacementSnapshot {
  readonly id: string;
  readonly type: TypeEmplacement;
  readonly nom: string;
  readonly parentId: string | null;
  readonly coordonnees: { readonly x: number; readonly y: number } | null;
}

export interface NouvelEmplacement {
  readonly id: string;
  readonly type: TypeEmplacement;
  readonly nom: string;
  readonly parent: Emplacement | null;
  readonly coordonnees?: Coordonnees | null;
}

/**
 * Nœud de la hiérarchie physique : étage > salle > rayon > étagère > niveau.
 *
 * Invariant : le parent d'un emplacement est exactement du type qui précède le
 * sien (un étage n'a pas de parent). Cette règle stricte rend aussi tout cycle
 * impossible, puisque chaque niveau de la hiérarchie a un type différent.
 */
export class Emplacement {
  private constructor(
    readonly id: string,
    readonly type: TypeEmplacement,
    private _nom: string,
    private _parentId: string | null,
    private _coordonnees: Coordonnees | null,
  ) {}

  static creer(donnees: NouvelEmplacement): Emplacement {
    const id = texteObligatoire(donnees.id, 'id');
    verifierParent(donnees.type, donnees.parent);
    return new Emplacement(
      id,
      donnees.type,
      texteObligatoire(donnees.nom, 'nom', 100),
      donnees.parent?.id ?? null,
      donnees.coordonnees ?? null,
    );
  }

  /** Recharge un emplacement déjà validé (depuis la persistance). */
  static reconstituer(snapshot: EmplacementSnapshot): Emplacement {
    const coordonnees = snapshot.coordonnees ? Coordonnees.creer(snapshot.coordonnees.x, snapshot.coordonnees.y) : null;
    return new Emplacement(snapshot.id, snapshot.type, snapshot.nom, snapshot.parentId, coordonnees);
  }

  get nom(): string {
    return this._nom;
  }

  get parentId(): string | null {
    return this._parentId;
  }

  get coordonnees(): Coordonnees | null {
    return this._coordonnees;
  }

  renommer(nom: string): void {
    this._nom = texteObligatoire(nom, 'nom', 100);
  }

  definirCoordonnees(coordonnees: Coordonnees | null): void {
    this._coordonnees = coordonnees;
  }

  /** Rattache l'emplacement à un autre parent (ex. déplacer un rayon dans une autre salle). */
  deplacerSous(parent: Emplacement | null): void {
    verifierParent(this.type, parent);
    this._parentId = parent?.id ?? null;
  }

  peutAccueillirExemplaire(): boolean {
    return this.type === TYPE_RANGEMENT;
  }

  versSnapshot(): EmplacementSnapshot {
    return {
      id: this.id,
      type: this.type,
      nom: this._nom,
      parentId: this._parentId,
      coordonnees: this._coordonnees?.versDonnees() ?? null,
    };
  }
}

function verifierParent(type: TypeEmplacement, parent: Emplacement | null): void {
  const attendu = typeParentAttendu(type);
  if (attendu === null && parent !== null) {
    throw new ErreurValidation('HIERARCHIE_INVALIDE', `Un emplacement de type « ${type} » ne peut pas avoir de parent`);
  }
  if (attendu !== null && parent?.type !== attendu) {
    const recu = parent ? `« ${parent.type} »` : 'aucun';
    throw new ErreurValidation(
      'HIERARCHIE_INVALIDE',
      `Un emplacement de type « ${type} » doit avoir un parent de type « ${attendu} » (reçu : ${recu})`,
    );
  }
}
