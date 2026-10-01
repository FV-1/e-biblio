import express, { type Express } from 'express';
import { gestionnaireErreurs, routeInconnue } from './gestion-erreurs.js';
import { routesDetections, type CasUsageDetections } from './routes-detections.js';
import { routesEmplacements, type CasUsageEmplacements } from './routes-emplacements.js';
import { routesExemplaires, type CasUsageExemplaires } from './routes-exemplaires.js';
import { routesLivres, type CasUsageLivres } from './routes-livres.js';

/** Ce dont l'adapter HTTP a besoin : uniquement des cas d'usage, jamais de repository. */
export interface CasUsageHttp {
  emplacements: CasUsageEmplacements;
  exemplaires: CasUsageExemplaires;
  livres: CasUsageLivres;
  detections: CasUsageDetections;
}

export function creerApplicationHttp(cas: CasUsageHttp): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('json spaces', 2);
  app.use(express.json({ limit: '100kb' }));

  app.get('/sante', (_req, res) => {
    res.json({ statut: 'ok' });
  });
  app.use('/emplacements', routesEmplacements(cas.emplacements));
  app.use('/exemplaires', routesExemplaires(cas.exemplaires));
  app.use('/livres', routesLivres(cas.livres));
  app.use('/detections', routesDetections(cas.detections));

  app.use(routeInconnue);
  app.use(gestionnaireErreurs());
  return app;
}
