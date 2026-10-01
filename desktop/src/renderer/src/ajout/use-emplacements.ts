import { useCallback, useEffect, useState } from 'react';
import type { Emplacement } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { useService } from '../service/contexte-service';

export type EtatEmplacements =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'pret'; readonly emplacements: readonly Emplacement[] }
  | { readonly statut: 'erreur'; readonly erreur: ErreurService };

/** Charge la hiérarchie des emplacements ; `recharger` permet de réessayer après une erreur. */
export function useEmplacements() {
  const service = useService();
  const [etat, setEtat] = useState<EtatEmplacements>({ statut: 'chargement' });

  const charger = useCallback(async () => {
    setEtat({ statut: 'chargement' });
    const resultat = await service.listerEmplacements();
    setEtat(resultat.ok ? { statut: 'pret', emplacements: resultat.valeur } : { statut: 'erreur', erreur: resultat.erreur });
  }, [service]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return { etat, recharger: charger };
}
