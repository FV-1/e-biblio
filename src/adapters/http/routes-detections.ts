import { Router } from 'express';
import type { EnregistrerDetection } from '../../application/detections/enregistrer-detection.js';
import { corpsDetection } from './schemas.js';

export interface CasUsageDetections {
  enregistrer: EnregistrerDetection;
}

export function routesDetections(cas: CasUsageDetections): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const commande = corpsDetection.parse(req.body);
    res.status(201).json(await cas.enregistrer.executer(commande));
  });

  return router;
}
