import { Router } from 'express';
import type { AjouterExemplaire, LivreAAjouter } from '../../application/exemplaires/ajouter-exemplaire.js';
import type { ConsulterExemplaire } from '../../application/exemplaires/consulter-exemplaire.js';
import type { ListerExemplairesMalRanges } from '../../application/exemplaires/lister-exemplaires-mal-ranges.js';
import type { RechercherExemplaires } from '../../application/exemplaires/rechercher-exemplaires.js';
import type { ListerExemplairesDuLivre } from '../../application/exemplaires/lister-exemplaires-du-livre.js';
import { corpsAjouterExemplaire, parametresId, requeteExemplaires } from './schemas.js';

export interface CasUsageExemplaires {
  ajouter: AjouterExemplaire;
  rechercher: RechercherExemplaires;
  listerDuLivre: ListerExemplairesDuLivre;
  consulter: ConsulterExemplaire;
  listerMalRanges: ListerExemplairesMalRanges;
}

export function routesExemplaires(cas: CasUsageExemplaires): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const requete = requeteExemplaires.parse(req.query);
    res.json(
      requete.livreId !== undefined
        ? await cas.listerDuLivre.executer(requete.livreId)
        : await cas.rechercher.executer(requete.q),
    );
  });

  // Déclarée avant /:id, sinon « mal-ranges » serait pris pour un identifiant.
  router.get('/mal-ranges', async (_req, res) => {
    res.json(await cas.listerMalRanges.executer());
  });

  router.get('/:id', async (req, res) => {
    const { id } = parametresId.parse(req.params);
    res.json(await cas.consulter.executer(id));
  });

  router.post('/', async (req, res) => {
    const corps = corpsAjouterExemplaire.parse(req.body);
    const saisieManuelle =
      corps.titre === undefined
        ? null
        : { titre: corps.titre, auteurs: corps.auteurs ?? [], couverture: corps.couverture ?? null };

    const livre: LivreAAjouter =
      corps.livreId !== undefined
        ? { type: 'existant', livreId: corps.livreId }
        : corps.isbn !== undefined
          ? { type: 'isbn', isbn: corps.isbn, saisieManuelle }
          : { type: 'manuel', saisieManuelle: saisieManuelle! };

    const resultat = await cas.ajouter.executer({ emplacementId: corps.emplacementId, livre });
    res
      .status(201)
      .location(`/exemplaires/${encodeURIComponent(resultat.exemplaire.id)}`)
      .json({ ...resultat.exemplaire, sourceLivre: resultat.sourceLivre });
  });

  return router;
}
