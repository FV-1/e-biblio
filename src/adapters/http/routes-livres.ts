import { Router } from 'express';
import type { ConsulterNotice } from '../../application/livres/consulter-notice.js';
import type { ListerLivres } from '../../application/livres/lister-livres.js';
import { parametresIsbn, requeteLivres } from './schemas.js';

export interface CasUsageLivres {
  consulterNotice: ConsulterNotice;
  lister: ListerLivres;
}

export function routesLivres(cas: CasUsageLivres): Router {
  const router = Router();

  // Vue « base de données » : toutes les œuvres, filtrées, triées et paginées.
  router.get('/', async (req, res) => {
    const r = requeteLivres.parse(req.query);
    res.json(
      await cas.lister.executer({
        ...(r.q ? { terme: r.q } : {}),
        ...(r.isbn !== undefined ? { avecIsbn: r.isbn } : {}),
        ...(r.couverture !== undefined ? { avecCouverture: r.couverture } : {}),
        ...(r.tri ? { tri: r.tri } : {}),
        ...(r.ordre ? { ordre: r.ordre } : {}),
        ...(r.page ? { page: r.page } : {}),
        ...(r.parPage ? { parPage: r.parPage } : {}),
      }),
    );
  });

  // Aperçu de la notice d'un ISBN (base ou catalogue), sans rien enregistrer.
  router.get('/:isbn', async (req, res) => {
    const { isbn } = parametresIsbn.parse(req.params);
    res.json(await cas.consulterNotice.executer(isbn));
  });

  return router;
}
