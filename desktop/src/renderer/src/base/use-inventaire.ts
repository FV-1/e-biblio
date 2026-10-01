import { useCallback, useEffect, useRef, useState } from 'react';
import type { CriteresLivres, PageLivres, TriLivres } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { useService } from '../service/contexte-service';

export const CRITERES_INITIAUX: CriteresLivres = { tri: 'titre', ordre: 'asc', page: 1, parPage: 25 };

/** Sens par défaut quand on choisit une colonne : alphabétique croissant, compteurs décroissants. */
const ORDRE_PAR_DEFAUT: Record<TriLivres, CriteresLivres['ordre']> = {
  titre: 'asc',
  auteur: 'asc',
  exemplaires: 'desc',
  malRanges: 'desc',
};

export interface EtatInventaire {
  /** Dernière page reçue ; conservée (grisée) pendant le chargement de la suivante. */
  readonly page: PageLivres | null;
  readonly chargement: boolean;
  readonly erreur: ErreurService | null;
}

/**
 * Critères et chargement de la vue « base de données ».
 * Toute modification d'un filtre ramène à la page 1 ; seule la réponse à la
 * DERNIÈRE demande est affichée.
 */
export function useInventaire() {
  const service = useService();
  const [criteres, setCriteres] = useState<CriteresLivres>(CRITERES_INITIAUX);
  const [etat, setEtat] = useState<EtatInventaire>({ page: null, chargement: true, erreur: null });
  const derniereDemande = useRef(0);

  const charger = useCallback(
    async (c: CriteresLivres) => {
      const numero = ++derniereDemande.current;
      setEtat((e) => ({ ...e, chargement: true, erreur: null }));
      let resultat;
      try {
        resultat = await service.listerLivres(c);
      } catch {
        resultat = { ok: false as const, erreur: { type: 'reponse-invalide' as const, message: 'Erreur inattendue de communication' } };
      }
      if (numero !== derniereDemande.current) return;
      setEtat((e) =>
        resultat.ok ? { page: resultat.valeur, chargement: false, erreur: null } : { ...e, chargement: false, erreur: resultat.erreur },
      );
    },
    [service],
  );

  useEffect(() => {
    void charger(criteres);
  }, [criteres, charger]);

  /** Modifie un ou plusieurs filtres et revient à la première page. */
  const filtrer = useCallback((modif: Partial<Pick<CriteresLivres, 'terme' | 'isbn' | 'couverture' | 'parPage'>>) => {
    setCriteres((c) => {
      const suivant: CriteresLivres = { ...c, ...modif, page: 1 };
      // Un filtre remis à « tous » disparaît des critères.
      for (const cle of ['terme', 'isbn', 'couverture'] as const) {
        if (suivant[cle] === undefined || suivant[cle] === '') delete suivant[cle];
      }
      return suivant;
    });
  }, []);

  /** Tri sur une colonne : un second clic inverse le sens. */
  const trier = useCallback((tri: TriLivres) => {
    setCriteres((c) =>
      c.tri === tri
        ? { ...c, ordre: c.ordre === 'asc' ? 'desc' : 'asc', page: 1 }
        : { ...c, tri, ordre: ORDRE_PAR_DEFAUT[tri], page: 1 },
    );
  }, []);

  const allerPage = useCallback((page: number) => setCriteres((c) => ({ ...c, page })), []);

  const reinitialiser = useCallback(() => setCriteres((c) => ({ ...CRITERES_INITIAUX, tri: c.tri, ordre: c.ordre, parPage: c.parPage })), []);

  const recharger = useCallback(() => void charger(criteres), [charger, criteres]);

  return { criteres, etat, filtrer, trier, allerPage, reinitialiser, recharger };
}
