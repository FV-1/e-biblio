import { useState, type FormEvent } from 'react';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { CarteExemplaire } from './CarteExemplaire';
import { pluriel } from './format';
import { useRecherche, type EtatRecherche } from './use-recherche';

export function EcranRecherche() {
  const { etat, rechercher } = useRecherche();
  const [saisie, setSaisie] = useState('');

  const soumettre = (evenement: FormEvent) => {
    evenement.preventDefault();
    void rechercher(saisie);
  };

  return (
    <section className="ecran-recherche">
      <form className="barre-recherche" role="search" onSubmit={soumettre}>
        <label htmlFor="champ-recherche" className="visuellement-cache">
          Rechercher un exemplaire
        </label>
        <input
          id="champ-recherche"
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Titre, auteur ou ISBN"
          maxLength={200}
          autoFocus
        />
        <button type="submit" disabled={etat.statut === 'chargement'}>
          Rechercher
        </button>
      </form>

      <Resultats etat={etat} />
    </section>
  );
}

function Resultats({ etat }: { etat: EtatRecherche }) {
  switch (etat.statut) {
    case 'initial':
      return <p className="message">Saisissez un titre, un auteur ou un ISBN pour localiser un exemplaire.</p>;

    case 'chargement':
      return (
        <p className="message" role="status">
          Recherche de « {etat.terme} » en cours…
        </p>
      );

    case 'erreur':
      return (
        <div className="message message-erreur" role="alert">
          <strong>{titreErreur(etat.erreur)}</strong>
          <p>{etat.erreur.message}</p>
        </div>
      );

    case 'succes':
      if (etat.exemplaires.length === 0) {
        return <p className="message">Aucun exemplaire ne correspond à « {etat.terme} ».</p>;
      }
      return (
        <>
          <p className="compteur" role="status">
            {pluriel(etat.exemplaires.length, 'exemplaire trouvé', 'exemplaires trouvés')} pour « {etat.terme} »
          </p>
          <div className="liste-resultats">
            {etat.exemplaires.map((exemplaire) => (
              <CarteExemplaire key={exemplaire.id} exemplaire={exemplaire} />
            ))}
          </div>
        </>
      );
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
