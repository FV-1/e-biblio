import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Emplacement, Exemplaire } from '../../../commun/api';
import { BadgeStatut } from '../recherche/BadgeStatut';
import { CheminLocalisation } from '../recherche/CheminLocalisation';
import { formaterDate } from '../recherche/format';
import { useService } from '../service/contexte-service';
import { IconeRecherche } from '../ui/icones';
import { construireDisposition } from './disposition';
import { ScenePlan } from './ScenePlan';

/** Intervalle de rafraîchissement de l'exemplaire suivi, en attendant un vrai flux temps réel (SSE). */
export const INTERVALLE_SUIVI_MS = 3000;

interface Props {
  /** Faux quand l'onglet est caché : pas de chargement, pas d'animation, pas de rafraîchissement. */
  readonly actif: boolean;
  /** Exemplaire envoyé depuis la recherche (« Voir sur le plan ») ; `numero` change à chaque demande. */
  readonly cible?: { readonly exemplaire: Exemplaire; readonly numero: number } | null;
}

type EtatEmplacements =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'erreur'; readonly message: string }
  | { readonly statut: 'pret'; readonly emplacements: readonly Emplacement[] };

export function EcranPlan({ actif, cible = null }: Props) {
  const service = useService();
  const [etat, setEtat] = useState<EtatEmplacements>({ statut: 'chargement' });
  const [selection, setSelection] = useState<Exemplaire | null>(null);
  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<Exemplaire[] | null>(null);
  const [annonce, setAnnonce] = useState('');

  const charger = async () => {
    setEtat({ statut: 'chargement' });
    const r = await service.listerEmplacements();
    setEtat(r.ok ? { statut: 'pret', emplacements: r.valeur } : { statut: 'erreur', message: r.erreur.message });
  };

  // Les emplacements ne sont chargés qu'à la première ouverture de l'onglet.
  useEffect(() => {
    if (actif && etat.statut !== 'pret') void charger();
  }, [actif]);

  useEffect(() => {
    if (cible) setSelection(cible.exemplaire);
  }, [cible?.numero]);

  // Suivi de l'exemplaire sélectionné : sa position se met à jour après un scan.
  useEffect(() => {
    if (!actif || !selection) return;
    const minuterie = setInterval(async () => {
      const r = await service.listerExemplairesDuLivre(selection.livreId);
      const frais = r.ok ? r.valeur.find((e) => e.id === selection.id) : undefined;
      if (frais && cleePosition(frais) !== cleePosition(selection)) {
        setSelection(frais);
        setAnnonce(frais.malRange ? `${frais.livre.titre} a été vu ailleurs.` : `${frais.livre.titre} a été vu à sa place.`);
      }
    }, INTERVALLE_SUIVI_MS);
    return () => clearInterval(minuterie);
  }, [actif, selection]);

  const disposition = useMemo(() => (etat.statut === 'pret' ? construireDisposition(etat.emplacements) : null), [etat]);

  const chercher = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (terme.trim() === '') return;
    const r = await service.rechercherExemplaires(terme.trim());
    setResultats(r.ok ? r.valeur : []);
  };

  return (
    <div className="plan">
      <aside className="plan-panneau" aria-label="Choisir un exemplaire">
        <form className="plan-recherche" onSubmit={chercher} role="search">
          <label htmlFor="plan-terme">Livre à localiser</label>
          <div className="ligne-champ">
            <input id="plan-terme" type="search" value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Titre, auteur ou ISBN" />
            <button type="submit" aria-label="Chercher">
              <IconeRecherche />
            </button>
          </div>
        </form>

        {resultats !== null && (
          <ul className="plan-resultats" aria-label="Résultats">
            {resultats.length === 0 && <li className="aide">Aucun exemplaire trouvé.</li>}
            {resultats.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={`plan-resultat${selection?.id === e.id ? ' plan-resultat-actif' : ''}`}
                  aria-pressed={selection?.id === e.id}
                  onClick={() => setSelection(e)}
                >
                  <span className="plan-resultat-titre">{e.livre.titre}</span>
                  <span className="aide">
                    Exemplaire n°{e.numero}
                    {e.malRange ? ' · mal rangé' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selection ? <FicheSelection exemplaire={selection} /> : <p className="aide">Cherchez un livre pour le voir sur le plan.</p>}

        <ul className="plan-legende" aria-label="Légende">
          <li>
            <span className="pastille pastille-prevue" aria-hidden="true" /> Place prévue
          </li>
          <li>
            <span className="pastille pastille-vue" aria-hidden="true" /> Vu ailleurs (mal rangé)
          </li>
        </ul>
        <p className="aide">Position suivie toutes les {INTERVALLE_SUIVI_MS / 1000} s. Glisser pour tourner, molette pour zoomer.</p>
        <p className="visuellement-cache" role="status">
          {annonce}
        </p>
      </aside>

      {etat.statut === 'chargement' && <div className="plan-scene plan-scene-attente">Chargement du plan…</div>}
      {etat.statut === 'erreur' && (
        <div className="plan-scene plan-scene-attente" role="alert">
          <p>Impossible de charger le plan : {etat.message}</p>
          <button type="button" onClick={() => void charger()}>
            Réessayer
          </button>
        </div>
      )}
      {disposition && (
        <ScenePlan
          disposition={disposition}
          prevue={selection?.emplacementTheorique.emplacementId ?? null}
          vue={selection?.malRange ? (selection.derniereDetection?.emplacementId ?? null) : null}
          actif={actif}
        />
      )}
    </div>
  );
}

function FicheSelection({ exemplaire }: { exemplaire: Exemplaire }) {
  const { livre, emplacementTheorique, derniereDetection } = exemplaire;
  return (
    <section className="plan-fiche" aria-label="Exemplaire sélectionné">
      <header className="carte-entete">
        <div>
          <h2 className="carte-titre">{livre.titre}</h2>
          <p className="carte-auteurs">Exemplaire n°{exemplaire.numero}</p>
        </div>
        <BadgeStatut exemplaire={exemplaire} />
      </header>
      <h3>Place prévue</h3>
      <CheminLocalisation localisation={emplacementTheorique.localisation} />
      {derniereDetection && exemplaire.malRange && (
        <>
          <h3>Vu ailleurs le {formaterDate(derniereDetection.date)}</h3>
          <CheminLocalisation localisation={derniereDetection.localisation} />
        </>
      )}
    </section>
  );
}

/** Ce qui change sur le plan quand l'exemplaire est scanné. */
function cleePosition(e: Exemplaire): string {
  return `${e.emplacementTheorique.emplacementId}|${e.derniereDetection?.emplacementId ?? ''}|${e.derniereDetection?.date ?? ''}`;
}
