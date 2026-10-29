import { useEffect, useState } from 'react';
import type { Exemplaire } from '../../../commun/api';
import { formaterDate, pluriel } from '../recherche/format';
import { IconeFermer, IconePlan } from '../ui/icones';
import { apparenceLivre, bilanEtagere, repartirSurPlanches, statutSurEtagere, type StatutSurEtagere } from './contenu-etagere';

interface Props {
  readonly etagere: { readonly id: string; readonly nom: string; readonly chemin: string };
  /** `null` pendant le chargement. */
  readonly contenu: readonly Exemplaire[] | null;
  /** Exemplaire suivi sur le plan, mis en évidence s'il est sur cette étagère. */
  readonly suivi: string | null;
  /** Nom d'une étagère à partir de son identifiant (« prévu sur… », « vu sur… »). */
  readonly nomEtagere: (id: string) => string;
  readonly onSuivre: (exemplaire: Exemplaire) => void;
  readonly onFermer: () => void;
}

/**
 * Vue « étagère » : le meuble vu de face, planche par planche, avec la tranche
 * de chaque livre. Même répartition que la vue 3D (repartirSurPlanches).
 */
export function VueEtagere({ etagere, contenu, suivi, nomEtagere, onSuivre, onFermer }: Props) {
  const [choisi, setChoisi] = useState<string | null>(suivi);
  useEffect(() => setChoisi(suivi), [etagere.id, suivi]);

  const planches = contenu ? repartirSurPlanches(contenu, etagere.id) : [];
  const bilan = contenu ? bilanEtagere(contenu, etagere.id) : null;
  const exemplaireChoisi = contenu?.find((e) => e.id === choisi) ?? null;

  return (
    <section className="vue-etagere" aria-label={`Étagère ${etagere.nom}`}>
      <header className="vue-etagere-entete">
        <div>
          <h2>{etagere.nom}</h2>
          <p className="aide">{etagere.chemin}</p>
        </div>
        <button type="button" className="bouton-icone" onClick={onFermer} aria-label="Fermer la vue étagère" title="Fermer (Échap)">
          <IconeFermer />
        </button>
      </header>

      {bilan === null ? (
        <p className="aide" role="status">
          Chargement du contenu…
        </p>
      ) : (
        <p className="vue-etagere-bilan">
          <span>{pluriel(bilan.total, 'exemplaire')}</span>
          {bilan.intrus > 0 && <span className="puce-statut puce-intrus">{pluriel(bilan.intrus, 'intrus', 'intrus')}</span>}
          {bilan.absents > 0 && <span className="puce-statut puce-absent">{pluriel(bilan.absents, 'absent')}</span>}
        </p>
      )}

      {contenu !== null && contenu.length === 0 && <p className="aide">Aucun exemplaire n’est rangé ni n’a été vu sur cette étagère.</p>}

      {contenu !== null && contenu.length > 0 && (
        <div className="meuble">
          {planches.map((planche, p) => (
            <ul key={p} className="planche" aria-label={`Planche ${p + 1}${p === 0 ? ' (en haut)' : ''}`}>
              {planche.map(({ exemplaire, statut }) => {
                const apparence = apparenceLivre(exemplaire.livreId);
                return (
                  <li key={exemplaire.id} style={{ height: `${Math.round(apparence.hauteur * 100)}%` }}>
                    <button
                      type="button"
                      className={`tranche tranche-${statut}${exemplaire.id === suivi ? ' tranche-suivie' : ''}${exemplaire.id === choisi ? ' tranche-choisie' : ''}`}
                      style={{ width: `${Math.round(apparence.largeur * 34)}px`, ...(statut === 'absent' ? {} : { background: apparence.couleur }) }}
                      aria-pressed={exemplaire.id === choisi}
                      aria-label={`${exemplaire.livre.titre}, exemplaire n°${exemplaire.numero} : ${phraseStatut(exemplaire, statut, nomEtagere)}`}
                      title={exemplaire.livre.titre}
                      onClick={() => setChoisi(exemplaire.id)}
                    >
                      <span>{exemplaire.livre.titre}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}

      {exemplaireChoisi && (
        <div className="vue-etagere-fiche">
          <h3>{exemplaireChoisi.livre.titre}</h3>
          <p className="aide">
            {exemplaireChoisi.livre.auteurs.join(', ') || 'Auteur inconnu'} · Exemplaire n°{exemplaireChoisi.numero}
          </p>
          <p className={`statut-ligne statut-${statutSurEtagere(exemplaireChoisi, etagere.id)}`}>
            {phraseStatut(exemplaireChoisi, statutSurEtagere(exemplaireChoisi, etagere.id), nomEtagere)}
          </p>
          <button type="button" className="secondaire" onClick={() => onSuivre(exemplaireChoisi)}>
            <IconePlan /> Suivre sur le plan
          </button>
        </div>
      )}

      <ul className="vue-etagere-legende" aria-label="Légende">
        <li>
          <span className="echantillon echantillon-ici" aria-hidden="true" /> À sa place
        </li>
        <li>
          <span className="echantillon echantillon-intrus" aria-hidden="true" /> Intrus : rangé ailleurs
        </li>
        <li>
          <span className="echantillon echantillon-absent" aria-hidden="true" /> Absent : vu ailleurs
        </li>
      </ul>
    </section>
  );
}

function phraseStatut(e: Exemplaire, statut: StatutSurEtagere, nomEtagere: (id: string) => string): string {
  switch (statut) {
    case 'intrus':
      return `intrus, à ranger sur ${nomEtagere(e.emplacementTheorique.emplacementId)}`;
    case 'absent':
      return `absent, vu sur ${nomEtagere(e.derniereDetection!.emplacementId)} le ${formaterDate(e.derniereDetection!.date)}`;
    case 'ici':
      return e.derniereDetection ? `à sa place, vu le ${formaterDate(e.derniereDetection.date)}` : 'à sa place, jamais scanné';
  }
}
