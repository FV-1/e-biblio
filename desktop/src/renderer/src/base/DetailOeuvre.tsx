import { useEffect, useState } from 'react';
import type { Exemplaire, LigneLivre, Livre } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { BadgeStatut } from '../recherche/BadgeStatut';
import { CheminLocalisation } from '../recherche/CheminLocalisation';
import { formaterDate, pluriel } from '../recherche/format';
import { useService } from '../service/contexte-service';
import { IconePlus } from '../ui/icones';
import { IdentifiantExemplaire } from '../ui/IdentifiantExemplaire';

type Etat =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'pret'; readonly exemplaires: readonly Exemplaire[] }
  | { readonly statut: 'erreur'; readonly erreur: ErreurService };

interface Props {
  readonly oeuvre: LigneLivre;
  readonly onAjouterExemplaire?: ((livre: Livre) => void) | undefined;
}

/** Contenu d'une ligne dépliée : les exemplaires de l'œuvre et leur localisation. */
export function DetailOeuvre({ oeuvre, onAjouterExemplaire }: Props) {
  const service = useService();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    let actif = true;
    setEtat({ statut: 'chargement' });
    void service.listerExemplairesDuLivre(oeuvre.id).then((resultat) => {
      if (!actif) return;
      setEtat(resultat.ok ? { statut: 'pret', exemplaires: resultat.valeur } : { statut: 'erreur', erreur: resultat.erreur });
    });
    return () => {
      actif = false;
    };
  }, [service, oeuvre.id, tentative]);

  const livre: Livre = { id: oeuvre.id, isbn: oeuvre.isbn, titre: oeuvre.titre, auteurs: oeuvre.auteurs, couverture: oeuvre.couverture };

  return (
    <div className="detail-oeuvre">
      {etat.statut === 'chargement' && <p className="message">Chargement des exemplaires…</p>}

      {etat.statut === 'erreur' && (
        <div className="encart encart-alerte" role="alert">
          <p>Impossible de charger les exemplaires : {etat.erreur.message}</p>
          <button type="button" className="secondaire" onClick={() => setTentative((n) => n + 1)}>
            Réessayer
          </button>
        </div>
      )}

      {etat.statut === 'pret' &&
        (etat.exemplaires.length === 0 ? (
          <p className="message">Aucun exemplaire : cette œuvre n’est rangée nulle part.</p>
        ) : (
          <ul className="liste-exemplaires" aria-label={`Exemplaires de ${oeuvre.titre}`}>
            {etat.exemplaires.map((ex) => (
              <li key={ex.id} className={`exemplaire${ex.malRange ? ' exemplaire-mal-range' : ''}`}>
                <div className="exemplaire-entete">
                  <IdentifiantExemplaire id={ex.id} numero={ex.numero} />
                  <BadgeStatut exemplaire={ex} />
                </div>
                <CheminLocalisation localisation={ex.emplacementTheorique.localisation} />
                {ex.derniereDetection && ex.malRange && (
                  <div className="exemplaire-vu-ailleurs">
                    <span>Vu ailleurs le {formaterDate(ex.derniereDetection.date)} :</span>
                    <CheminLocalisation localisation={ex.derniereDetection.localisation} />
                  </div>
                )}
                {ex.derniereDetection && !ex.malRange && (
                  <p className="aide">Vu à sa place le {formaterDate(ex.derniereDetection.date)}</p>
                )}
              </li>
            ))}
          </ul>
        ))}

      <div className="detail-pied">
        {etat.statut === 'pret' && (
          <span className="aide">{pluriel(etat.exemplaires.length, 'exemplaire')}</span>
        )}
        {onAjouterExemplaire && (
          <button type="button" className="bouton-discret" onClick={() => onAjouterExemplaire(livre)}>
            <IconePlus /> Ajouter un exemplaire
          </button>
        )}
      </div>
    </div>
  );
}
