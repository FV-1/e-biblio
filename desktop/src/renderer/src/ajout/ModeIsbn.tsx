import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Notice } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { useService } from '../service/contexte-service';
import { IconeRecherche } from '../ui/icones';
import { formeIsbnValide, nettoyerIsbn } from './isbn';

interface Props {
  /** ISBN pré-rempli (ex. reçu du téléphone) ; s'il est fourni, la notice est cherchée aussitôt. */
  readonly isbnInitial?: string;
  readonly onNoticeTrouvee: (notice: Notice) => void;
  /** Bascule vers la saisie manuelle en conservant l'ISBN tapé. */
  readonly onSaisieManuelle: (isbn: string) => void;
}

/** Codes pour lesquels la saisie manuelle est la suite logique. */
const CODES_SAISIE_MANUELLE = new Set(['LIVRE_INCONNU_DU_CATALOGUE', 'CATALOGUE_INDISPONIBLE']);

export function ModeIsbn({ isbnInitial = '', onNoticeTrouvee, onSaisieManuelle }: Props) {
  const service = useService();
  const [saisie, setSaisie] = useState(isbnInitial);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<ErreurService | null>(null);
  const derniereDemande = useRef(0);

  const chercher = async (valeur: string) => {
    if (!formeIsbnValide(valeur)) {
      setErreur({ type: 'requete-invalide', message: 'Un ISBN compte 10 ou 13 caractères (chiffres, X final pour un ISBN-10).' });
      return;
    }
    const numero = ++derniereDemande.current;
    setChargement(true);
    setErreur(null);
    const resultat = await service.consulterNotice(nettoyerIsbn(valeur));
    if (numero !== derniereDemande.current) return;
    setChargement(false);
    if (resultat.ok) onNoticeTrouvee(resultat.valeur);
    else setErreur(resultat.erreur);
  };

  // Uniquement au montage : un nouvel ISBN externe remonte le composant (prop `key`).
  useEffect(() => {
    if (isbnInitial) void chercher(isbnInitial);
  }, []);

  const soumettre = (evenement: FormEvent) => {
    evenement.preventDefault();
    void chercher(saisie);
  };

  const saisieManuelleProposee = erreur?.type === 'erreur-api' && CODES_SAISIE_MANUELLE.has(erreur.code);

  return (
    <form className="mode-isbn" onSubmit={soumettre} noValidate>
      <label htmlFor="champ-isbn">ISBN du livre</label>
      <p className="aide" id="aide-isbn">
        10 ou 13 chiffres, au dos du livre au-dessus du code-barres. Les tirets sont acceptés.
      </p>
      <div className="ligne-champ">
        <input
          id="champ-isbn"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setErreur(null);
          }}
          placeholder="978-2-07-036822-8"
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={erreur ? 'aide-isbn erreur-isbn' : 'aide-isbn'}
          aria-invalid={erreur?.type === 'requete-invalide'}
          autoFocus
        />
        <button type="submit" disabled={chargement || saisie.trim() === ''}>
          <IconeRecherche />
          {chargement ? 'Recherche…' : 'Chercher la notice'}
        </button>
      </div>

      {erreur && (
        <div id="erreur-isbn" className="encart encart-alerte" role="alert">
          <p>{erreur.message}</p>
          {saisieManuelleProposee && (
            <button type="button" className="secondaire" onClick={() => onSaisieManuelle(nettoyerIsbn(saisie))}>
              Saisir la notice à la main
            </button>
          )}
        </div>
      )}
    </form>
  );
}
