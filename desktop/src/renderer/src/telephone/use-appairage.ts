import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErreurService, InfosAppairage } from '../../../commun/service-bibliotheque';
import { useService } from '../service/contexte-service';

export type EtatAppairage =
  | { readonly statut: 'inactif' }
  | { readonly statut: 'demarrage' }
  | { readonly statut: 'actif'; readonly infos: InfosAppairage }
  | { readonly statut: 'erreur'; readonly erreur: ErreurService };

export interface Appairage {
  readonly etat: EtatAppairage;
  readonly demarrer: () => Promise<void>;
  readonly arreter: () => Promise<void>;
}

/**
 * Session d'appairage avec un téléphone, à l'échelle de l'application :
 * tant qu'elle est active, chaque ISBN scanné est transmis à `onIsbn`.
 * Elle est fermée explicitement, ou quand l'application se ferme.
 */
export function useAppairage(onIsbn: (isbn: string) => void): Appairage {
  const service = useService();
  const [etat, setEtat] = useState<EtatAppairage>({ statut: 'inactif' });
  const rappel = useRef(onIsbn);
  const actif = useRef(false);

  useEffect(() => {
    rappel.current = onIsbn;
  });

  const demarrer = useCallback(async () => {
    setEtat({ statut: 'demarrage' });
    const resultat = await service.demarrerAppairage();
    actif.current = resultat.ok;
    setEtat(resultat.ok ? { statut: 'actif', infos: resultat.valeur } : { statut: 'erreur', erreur: resultat.erreur });
  }, [service]);

  const arreter = useCallback(async () => {
    actif.current = false;
    setEtat({ statut: 'inactif' });
    await service.arreterAppairage();
  }, [service]);

  // Écoute des scans uniquement pendant une session active.
  useEffect(() => {
    if (etat.statut !== 'actif') return undefined;
    return service.surIsbnScanne((isbn) => rappel.current(isbn));
  }, [etat.statut, service]);

  // Fermeture de la session si le composant disparaît.
  useEffect(
    () => () => {
      if (actif.current) void service.arreterAppairage();
    },
    [service],
  );

  return { etat, demarrer, arreter };
}
