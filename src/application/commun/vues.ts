import type { Emplacement } from '../../domain/emplacement.js';
import type { Livre } from '../../domain/livre.js';
import type { Localisation } from '../../domain/localisation.js';
import type { TypeEmplacement } from '../../domain/type-emplacement.js';

/**
 * Vues renvoyées par les cas d'usage : données simples, sérialisables, sans
 * comportement. Les adapters d'entrée (HTTP aujourd'hui, WebSocket demain)
 * n'ont jamais à manipuler les entités du domaine.
 */

export interface VueEmplacement {
  readonly id: string;
  readonly type: TypeEmplacement;
  readonly nom: string;
  readonly parentId: string | null;
  readonly coordonnees: { readonly x: number; readonly y: number } | null;
}

export interface VueDetailEmplacement extends VueEmplacement {
  readonly localisation: Localisation;
  readonly enfants: readonly VueEmplacement[];
}

export interface VueLivre {
  readonly id: string;
  readonly isbn: string | null;
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

export interface VuePosition {
  readonly emplacementId: string;
  readonly localisation: Localisation;
}

export interface VueExemplaire {
  readonly id: string;
  readonly livreId: string;
  /** Numéro lisible de l'exemplaire pour son œuvre (1, 2, 3…). */
  readonly numero: number;
  readonly isbn: string | null;
  readonly livre: VueLivre;
  /** Position théorique : où l'exemplaire doit être rangé. */
  readonly emplacementTheorique: VuePosition;
  /** Position constatée lors du dernier scan. */
  readonly derniereDetection: (VuePosition & { readonly date: Date }) | null;
  readonly malRange: boolean;
}

export function vueEmplacement(emplacement: Emplacement): VueEmplacement {
  const s = emplacement.versSnapshot();
  return { id: s.id, type: s.type, nom: s.nom, parentId: s.parentId, coordonnees: s.coordonnees };
}

export function vueLivre(livre: Livre): VueLivre {
  const s = livre.versSnapshot();
  return { id: s.id, isbn: s.isbn, titre: s.titre, auteurs: s.auteurs, couverture: s.couverture };
}
