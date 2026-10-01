import type { Emplacement } from './emplacement.js';
import { ErreurValidation } from './erreurs.js';
import type { ExemplaireDetecte } from './evenements.js';
import type { Livre } from './livre.js';
import { texteObligatoire } from './texte.js';

/** Position constatée lors du dernier scan. */
export interface Detection {
  readonly emplacementId: string;
  readonly date: Date;
}

export interface ExemplaireSnapshot {
  readonly id: string;
  readonly livreId: string;
  readonly numero: number;
  readonly emplacementId: string;
  readonly derniereDetection: Detection | null;
}

export interface NouvelExemplaire {
  readonly id: string;
  readonly livre: Livre;
  /** Numéro de l'exemplaire pour son œuvre (cf. Exemplaire.prochainNumero). */
  readonly numero: number;
  readonly emplacement: Emplacement;
}

/**
 * Exemplaire physique d'un livre.
 * - id : identifiant technique unique (UUID), pour les scans et étiquettes
 * - numero : numéro lisible pour un humain (« exemplaire n°2 » de cette œuvre),
 *   attribué à la création et jamais modifié ensuite
 * - emplacementId : position théorique (où il DEVRAIT être)
 * - derniereDetection : position constatée (où il a été VU en dernier)
 */
export class Exemplaire {
  private constructor(
    readonly id: string,
    readonly livreId: string,
    readonly numero: number,
    readonly emplacementId: string,
    private _derniereDetection: Detection | null,
  ) {}

  static creer(donnees: NouvelExemplaire): Exemplaire {
    verifierRangeable(donnees.emplacement);
    if (!Number.isInteger(donnees.numero) || donnees.numero < 1) {
      throw new ErreurValidation('NUMERO_INVALIDE', 'Le numéro d’exemplaire doit être un entier positif');
    }
    return new Exemplaire(texteObligatoire(donnees.id, 'id'), donnees.livre.id, donnees.numero, donnees.emplacement.id, null);
  }

  /**
   * Numéro du prochain exemplaire d'une œuvre : le plus grand numéro existant + 1.
   * Un numéro n'est jamais réutilisé, même si des numéros manquent : une étiquette
   * « ex. 2 » désigne toujours le même livre.
   */
  static prochainNumero(exemplairesDeLOeuvre: readonly Exemplaire[]): number {
    return exemplairesDeLOeuvre.reduce((max, e) => Math.max(max, e.numero), 0) + 1;
  }

  /** Règle de rangement, exposée pour pouvoir la vérifier avant de construire l'exemplaire. */
  static verifierRangeable(emplacement: Emplacement): void {
    verifierRangeable(emplacement);
  }

  static reconstituer(snapshot: ExemplaireSnapshot): Exemplaire {
    return new Exemplaire(
      snapshot.id,
      snapshot.livreId,
      snapshot.numero,
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
      livreId: this.livreId,
      emplacementDetecteId: emplacement.id,
      emplacementTheoriqueId: this.emplacementId,
      malRange: this.estMalRange(),
      dateDetection: new Date(date),
    };
  }

  versSnapshot(): ExemplaireSnapshot {
    return {
      id: this.id,
      livreId: this.livreId,
      numero: this.numero,
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
