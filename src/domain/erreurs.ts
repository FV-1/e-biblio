/**
 * Erreurs métier. Elles portent un code stable (exploitable par les clients)
 * et une catégorie sémantique ; c'est l'adapter HTTP qui traduit la catégorie
 * en code de statut. Le domaine ne connaît donc rien de HTTP.
 */
export abstract class ErreurMetier extends Error {
  protected constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Donnée ou opération contraire à une règle métier. */
export class ErreurValidation extends ErreurMetier {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

/** Ressource demandée inexistante. */
export class ErreurIntrouvable extends ErreurMetier {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

/** Opération incompatible avec l'état actuel du système. */
export class ErreurConflit extends ErreurMetier {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
