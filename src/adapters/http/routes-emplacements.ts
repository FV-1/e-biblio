import { Router } from 'express';
import type { ConsulterEmplacement } from '../../application/emplacements/consulter-emplacement.js';
import type { CreerEmplacement } from '../../application/emplacements/creer-emplacement.js';
import type { ListerEmplacements } from '../../application/emplacements/lister-emplacements.js';
import type { ModifierEmplacement } from '../../application/emplacements/modifier-emplacement.js';
import type { SupprimerEmplacement } from '../../application/emplacements/supprimer-emplacement.js';
import {
  corpsCreerEmplacement,
  corpsModifierEmplacement,
  filtreEmplacements,
  parametresId,
} from './schemas.js';

export interface CasUsageEmplacements {
  creer: CreerEmplacement;
  lister: ListerEmplacements;
  consulter: ConsulterEmplacement;
  modifier: ModifierEmplacement;
  supprimer: SupprimerEmplacement;
}

/** Routes fines : valider l'entrée → appeler le cas d'usage → formater la réponse. */
export function routesEmplacements(cas: CasUsageEmplacements): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const filtre = filtreEmplacements.parse(req.query);
    res.json(await cas.lister.executer(filtre));
  });

  router.get('/:id', async (req, res) => {
    const { id } = parametresId.parse(req.params);
    res.json(await cas.consulter.executer(id));
  });

  router.post('/', async (req, res) => {
    const commande = corpsCreerEmplacement.parse(req.body);
    const vue = await cas.creer.executer(commande);
    res.status(201).location(`/emplacements/${encodeURIComponent(vue.id)}`).json(vue);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parametresId.parse(req.params);
    const commande = corpsModifierEmplacement.parse(req.body);
    res.json(await cas.modifier.executer(id, commande));
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parametresId.parse(req.params);
    await cas.supprimer.executer(id);
    res.status(204).end();
  });

  return router;
}
