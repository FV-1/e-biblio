import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ErreurConflit, ErreurIntrouvable, ErreurMetier, ErreurValidation } from '../../domain/erreurs.js';

/**
 * Format unique de toutes les réponses d'erreur :
 *   { "erreur": { "code": "...", "message": "...", "details"?: [...] } }
 */
interface CorpsErreur {
  erreur: { code: string; message: string; details?: unknown };
}

function corps(code: string, message: string, details?: unknown): CorpsErreur {
  return { erreur: details === undefined ? { code, message } : { code, message, details } };
}

/** Traduction catégorie métier → statut HTTP : seul endroit où HTTP rencontre les erreurs du domaine. */
function statutMetier(erreur: ErreurMetier): number {
  if (erreur instanceof ErreurIntrouvable) return 404;
  if (erreur instanceof ErreurConflit) return 409;
  if (erreur instanceof ErreurValidation) return 422;
  return 400;
}

export const routeInconnue: RequestHandler = (req, res) => {
  res.status(404).json(corps('ROUTE_INCONNUE', `Aucune route ${req.method} ${req.path}`));
};

/** Middleware d'erreurs centralisé : les routes se contentent de laisser remonter les exceptions. */
export function gestionnaireErreurs(journaliser: (...args: unknown[]) => void = console.error): ErrorRequestHandler {
  return (erreur: unknown, req, res, _next) => {
    if (erreur instanceof ZodError) {
      const details = erreur.issues.map((i) => ({ champ: i.path.join('.') || null, message: i.message }));
      res.status(400).json(corps('REQUETE_INVALIDE', 'La requête ne respecte pas le format attendu', details));
      return;
    }

    if (erreur instanceof ErreurMetier) {
      res.status(statutMetier(erreur)).json(corps(erreur.code, erreur.message));
      return;
    }

    // Erreurs levées par express.json() (corps illisible ou trop volumineux).
    if (typeof erreur === 'object' && erreur !== null && 'type' in erreur) {
      if (erreur.type === 'entity.parse.failed') {
        res.status(400).json(corps('JSON_INVALIDE', 'Le corps de la requête n’est pas un JSON valide'));
        return;
      }
      if (erreur.type === 'entity.too.large') {
        res.status(413).json(corps('CORPS_TROP_VOLUMINEUX', 'Le corps de la requête est trop volumineux'));
        return;
      }
    }

    journaliser(`[http] erreur inattendue sur ${req.method} ${req.originalUrl}`, erreur);
    res.status(500).json(corps('ERREUR_INTERNE', 'Une erreur interne est survenue'));
  };
}
