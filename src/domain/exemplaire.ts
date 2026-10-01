import type { Emplacement } from './emplacement.js';
import { ErreurValidation } from './erreurs.js';
import type { ExemplaireDetecte } from './evenements.js';
import { Isbn } from './isbn.js';
import { texteObligatoire } from './texte.js';

/** Position constatée lors du dernier scan. */
export interface Detection {
  readonly emplacementId: string;
  readonly date: Date;
}

export interface ExemplaireSnapshot {
  readonly id: string;
  readonly isbn: string;
  readonly emplacementId: string;
  readonly derniereDetection: Detection | null;
}

export interface NouvelExemplaire {
  readonly id: string;
  readonly isbn: Isbn;
  readonly emplacement: Emplacement;
}

/**
 * Exemplaire physique d'un livre.
 * - emplacementId : position théorique (où il DEVRAIT être)
 * - derniereDetection : position constatée (où il a été VU en dernier)
 */
export class Exemplaire {
  private constructor(
    readonly id: string,
    readonly isbn: Isbn,
    readonly emplacementId: string,
    private _derniereDetection: Detection | null,
  ) {}

  static creer(donnees: NouvelExemplaire): Exemplaire {
    verifierRangeable(donnees.emplacement);
    return new Exemplaire(texteObligatoire(donnees.id, 'id'), donnees.isbn, donnees.emplacement.id, null);
  }

  static reconstituer(snapshot: ExemplaireSnapshot): Exemplaire {
    return new Exemplaire(
      snapshot.id,
      Isbn.creer(snapshot.isbn),
      snapshot.emplacementId,
      snapshot.derniereDetection ? copierDetection(snapshot.derniereDetection) : null,
    );
  }

  get derniereDetection(): Detection | null {
    return this._derniereDetection ? copierDetection(this._derniereDetection) : null;
  }

  /**
   * Règle métier centrale : un exemplaire est mal rangé si sa dernière position
   * constatée diffère de sa position théorique. Jamais détecté ⇒ pas mal rangé.
   */
  estMalRange(): boolean {
    return this._derniereDetection !== null && this._derniereDetection.emplacementId !== this.emplacementId;
  }

  /** Enregistre un scan et renvoie l'événement correspondant (à publier par l'appelant). */
  enregistrerDetection(emplacement: Emplacement, date: Date): ExemplaireDetecte {
    verifierRangeable(emplacement);
    this._derniereDetection = { emplacementId: emplacement.id, date: new Date(date) };
    return {
      type: 'ExemplaireDetecte',
      exemplaireId: this.id,
      isbn: this.isbn.valeur,
      emplacementDetecteId: emplacement.id,
      emplacementTheoriqueId: this.emplacementId,
      malRange: this.estMalRange(),
      dateDetection: new Date(date),
    };
  }

  versSnapshot(): ExemplaireSnapshot {
    return {
      id: this.id,
      isbn: this.isbn.valeur,
      emplacementId: this.emplacementId,
      derniereDetection: this.derniereDetection,
    };
  }
}

function verifierRangeable(emplacement: Emplacement): void {
  if (!emplacement.peutAccueillirExemplaire()) {
    throw new ErreurValidation(
      'EMPLACEMENT_NON_RANGEABLE',
      `Un exemplaire ne peut être rangé ou détecté que sur une étagère (« ${emplacement.nom} » est de type « ${emplacement.type} »)`,
    );
  }
}

function copierDetection(d: Detection): Detection {
  return { emplacementId: d.emplacementId, date: new Date(d.date) };
}
