import { Router } from 'express';
import type { ConsulterNotice } from '../../application/livres/consulter-notice.js';
import { parametresIsbn } from './schemas.js';

export interface CasUsageLivres {
  consulterNotice: ConsulterNotice;
}

export function routesLivres(cas: CasUsageLivres): Router {
  const router = Router();

  // Aperçu de la notice d'un ISBN (base ou catalogue), sans rien enregistrer.
  router.get('/:isbn', async (req, res) => {
    const { isbn } = parametresIsbn.parse(req.params);
    res.json(await cas.consulterNotice.executer(isbn));
  });

  return router;
}
