import { useCallback, useRef, useState } from 'react';
import type { Exemplaire } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { useService } from '../service/contexte-service';

export type EtatRecherche =
  | { readonly statut: 'initial' }
  | { readonly statut: 'chargement'; readonly terme: string }
  | { readonly statut: 'succes'; readonly terme: string; readonly exemplaires: readonly Exemplaire[] }
  | { readonly statut: 'erreur'; readonly terme: string; readonly erreur: ErreurService };

/**
 * Logique de l'écran de recherche, séparée de l'affichage.
 * Seule la réponse à la DERNIÈRE recherche lancée est prise en compte :
 * une réponse lente à une recherche précédente ne peut pas écraser la plus récente.
 */
export function useRecherche() {
  const service = useService();
  const [etat, setEtat] = useState<EtatRecherche>({ statut: 'initial' });
  const derniereRecherche = useRef(0);

  const rechercher = useCallback(
    async (saisie: string) => {
      const terme = saisie.trim();
      const numero = ++derniereRecherche.current;
      if (terme.length === 0) {
        setEtat({ statut: 'initial' });
        return;
      }

      setEtat({ statut: 'chargement', terme });
      let nouvelEtat: EtatRecherche;
      try {
        const resultat = await service.rechercherExemplaires(terme);
        nouvelEtat = resultat.ok
          ? { statut: 'succes', terme, exemplaires: resultat.valeur }
          : { statut: 'erreur', terme, erreur: resultat.erreur };
      } catch {
        // Ne devrait pas arriver (le service renvoie ses erreurs en valeurs), mais l'IPC peut échouer.
        nouvelEtat = {
          statut: 'erreur',
          terme,
          erreur: { type: 'reponse-invalide', message: 'Erreur inattendue de communication avec le processus principal' },
        };
      }
      if (numero === derniereRecherche.current) setEtat(nouvelEtat);
    },
    [service],
  );

  return { etat, rechercher };
}
