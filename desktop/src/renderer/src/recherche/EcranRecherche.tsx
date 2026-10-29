import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Exemplaire, Livre } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { IconeAlerte, IconeRecherche } from '../ui/icones';
import { CarteExemplaire } from './CarteExemplaire';
import { pluriel } from './format';
import { useRecherche, type EtatRecherche } from './use-recherche';

type Filtre = 'tous' | 'mal-ranges' | 'jamais-detectes' | 'bien-ranges';

const FILTRES: { id: Filtre; libelle: string; garde: (e: Exemplaire) => boolean }[] = [
  { id: 'tous', libelle: 'Tous', garde: () => true },
  { id: 'mal-ranges', libelle: 'Mal rangés', garde: (e) => e.malRange },
  { id: 'jamais-detectes', libelle: 'Jamais détectés', garde: (e) => e.derniereDetection === null },
  { id: 'bien-ranges', libelle: 'Bien rangés', garde: (e) => !e.malRange && e.derniereDetection !== null },
];

interface Props {
  /** Ouvre l'écran d'ajout avec ce livre présélectionné. */
  readonly onAjouterExemplaire?: (livre: Livre) => void;
  /** Ouvre le plan 3D centré sur cet exemplaire. */
  readonly onVoirSurPlan?: (exemplaire: Exemplaire) => void;
  /** Recherche déclenchée de l'extérieur (ex. « Voir dans la recherche » après un ajout). */
  readonly requeteExterne?: { readonly terme: string; readonly numero: number } | null;
  /** Délai (ms) avant la recherche automatique pendant la frappe ; null la désactive. */
  readonly delaiSaisie?: number | null;
  /** Compteur incrémenté pour demander le focus du champ de recherche. */
  readonly demandeFocus?: number;
}

export function EcranRecherche({ onAjouterExemplaire, onVoirSurPlan, requeteExterne = null, delaiSaisie = 300, demandeFocus = 0 }: Props) {
  const { etat, rechercher } = useRecherche();
  const [saisie, setSaisie] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const champ = useRef<HTMLInputElement>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const lancer = (terme: string) => {
    clearTimeout(minuterie.current);
    setFiltre('tous');
    void rechercher(terme);
  };

  const saisir = (valeur: string) => {
    setSaisie(valeur);
    clearTimeout(minuterie.current);
    if (delaiSaisie !== null) minuterie.current = setTimeout(() => lancer(valeur), delaiSaisie);
  };

  const soumettre = (evenement: FormEvent) => {
    evenement.preventDefault();
    lancer(saisie);
  };

  useEffect(() => () => clearTimeout(minuterie.current), []);

  useEffect(() => {
    if (!requeteExterne) return;
    setSaisie(requeteExterne.terme);
    lancer(requeteExterne.terme);
  }, [requeteExterne]);

  // Demande de focus (raccourci Ctrl+K géré par l'application).
  useEffect(() => {
    if (!demandeFocus) return;
    champ.current?.focus();
    champ.current?.select();
  }, [demandeFocus]);

  return (
    <section className="ecran-recherche">
      <form className="barre-recherche" role="search" onSubmit={soumettre}>
        <label htmlFor="champ-recherche" className="visuellement-cache">
          Rechercher un exemplaire
        </label>
        <IconeRecherche className="icone-champ" />
        <input
          ref={champ}
          id="champ-recherche"
          type="search"
          value={saisie}
          onChange={(e) => saisir(e.target.value)}
          placeholder="Titre, auteur ou ISBN"
          maxLength={200}
          autoComplete="off"
          autoFocus
        />
        <kbd className="raccourci" aria-hidden="true">
          Ctrl K
        </kbd>
      </form>

      <Resultats etat={etat} filtre={filtre} onFiltre={setFiltre} onAjouterExemplaire={onAjouterExemplaire} onVoirSurPlan={onVoirSurPlan} />
    </section>
  );
}

function Resultats({
  etat,
  filtre,
  onFiltre,
  onAjouterExemplaire,
  onVoirSurPlan,
}: {
  etat: EtatRecherche;
  filtre: Filtre;
  onFiltre: (f: Filtre) => void;
  onAjouterExemplaire: Props['onAjouterExemplaire'];
  onVoirSurPlan: Props['onVoirSurPlan'];
}) {
  const comptes = useMemo(() => {
    const exemplaires = etat.statut === 'succes' ? etat.exemplaires : [];
    return Object.fromEntries(FILTRES.map((f) => [f.id, exemplaires.filter(f.garde).length])) as Record<Filtre, number>;
  }, [etat]);

  switch (etat.statut) {
    case 'initial':
      return (
        <div className="etat-vide">
          <IconeRecherche width={36} height={36} />
          <p>Saisissez un titre, un auteur ou un ISBN pour localiser un exemplaire.</p>
        </div>
      );

    case 'chargement':
      return (
        <div aria-busy="true">
          <p className="compteur" role="status">
            Recherche de « {etat.terme} » en cours…
          </p>
          <div className="liste-resultats" aria-hidden="true">
            <div className="carte carte-squelette" />
            <div className="carte carte-squelette" />
          </div>
        </div>
      );

    case 'erreur':
      return (
        <div className="encart encart-alerte" role="alert">
          <IconeAlerte />
          <div>
            <strong>{titreErreur(etat.erreur)}</strong>
            <p>{etat.erreur.message}</p>
          </div>
        </div>
      );

    case 'succes': {
      if (etat.exemplaires.length === 0) {
        return (
          <div className="etat-vide">
            <p>Aucun exemplaire ne correspond à « {etat.terme} ».</p>
            <p className="aide">Vérifiez l’orthographe, ou cherchez par auteur ou par ISBN.</p>
          </div>
        );
      }
      const garde = FILTRES.find((f) => f.id === filtre)!.garde;
      const visibles = etat.exemplaires.filter(garde);
      return (
        <>
          <div className="ligne-resultats">
            <p className="compteur" role="status">
              {pluriel(etat.exemplaires.length, 'exemplaire trouvé', 'exemplaires trouvés')} pour « {etat.terme} »
            </p>
            <div className="filtres" role="group" aria-label="Filtrer par statut">
              {FILTRES.filter((f) => f.id === 'tous' || comptes[f.id] > 0).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`puce${filtre === f.id ? ' puce-active' : ''}`}
                  aria-pressed={filtre === f.id}
                  onClick={() => onFiltre(f.id)}
                >
                  {f.libelle} <span className="puce-compte">{comptes[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="liste-resultats">
            {visibles.map((exemplaire) => (
              <CarteExemplaire key={exemplaire.id} exemplaire={exemplaire} onAjouterExemplaire={onAjouterExemplaire} onVoirSurPlan={onVoirSurPlan} />
            ))}
          </div>
        </>
      );
    }
  }
}

function titreErreur(erreur: ErreurService): string {
  switch (erreur.type) {
    case 'serveur-injoignable':
      return 'Serveur injoignable';
    case 'reponse-invalide':
      return 'Réponse inattendue du serveur';
    case 'requete-invalide':
      return 'Recherche invalide';
    case 'erreur-api':
      return `Erreur du serveur (${erreur.code})`;
  }
}
