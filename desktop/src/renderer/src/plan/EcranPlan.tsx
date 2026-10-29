import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Emplacement, Exemplaire } from '../../../commun/api';
import { BadgeStatut } from '../recherche/BadgeStatut';
import { CheminLocalisation } from '../recherche/CheminLocalisation';
import { formaterDate } from '../recherche/format';
import { useService } from '../service/contexte-service';
import { IconeActualiser, IconeRecherche } from '../ui/icones';
import { construireDisposition } from './disposition';
import { ScenePlan, type CommandeCamera } from './ScenePlan';
import { VueEtagere } from './VueEtagere';

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
  const [contenus, setContenus] = useState<ReadonlyMap<string, readonly Exemplaire[]>>(new Map());
  const [selection, setSelection] = useState<Exemplaire | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [commande, setCommande] = useState<CommandeCamera | null>(null);
  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<Exemplaire[] | null>(null);
  const [annonce, setAnnonce] = useState('');
  const numeroCommande = useRef(0);

  const emplacements = etat.statut === 'pret' ? etat.emplacements : [];
  const parId = useMemo(() => new Map(emplacements.map((e) => [e.id, e])), [emplacements]);
  const idsEtageres = useMemo(() => emplacements.filter((e) => e.type === 'etagere').map((e) => e.id), [emplacements]);
  const disposition = useMemo(() => (etat.statut === 'pret' ? construireDisposition(etat.emplacements) : null), [etat]);

  const commander = (c: { type: 'ensemble' | 'dessus' | 'selection' | 'zoom-avant' | 'zoom-arriere' } | { type: 'salle'; salleId: string }) =>
    setCommande({ ...c, numero: ++numeroCommande.current } as CommandeCamera);

  const charger = async () => {
    setEtat({ statut: 'chargement' });
    const r = await service.listerEmplacements();
    setEtat(r.ok ? { statut: 'pret', emplacements: r.valeur } : { statut: 'erreur', message: r.erreur.message });
  };

  const rafraichirEtageres = async (ids: readonly string[]) => {
    const reponses = await Promise.all(ids.map(async (id) => [id, await service.listerExemplairesDeLEmplacement(id)] as const));
    setContenus((avant) => {
      const apres = new Map(avant);
      for (const [id, r] of reponses) if (r.ok) apres.set(id, r.valeur);
      return apres;
    });
  };

  // Les emplacements sont chargés à la première ouverture de l'onglet, le contenu des étagères à chaque ouverture.
  useEffect(() => {
    if (actif && etat.statut !== 'pret') void charger();
  }, [actif]);
  useEffect(() => {
    if (actif && idsEtageres.length > 0) void rafraichirEtageres(idsEtageres);
  }, [actif, idsEtageres]);

  useEffect(() => {
    if (cible) {
      setSelection(cible.exemplaire);
      setOuverte(null);
    }
  }, [cible?.numero]);

  // Suivi de l'exemplaire sélectionné : sa position se met à jour après un scan.
  useEffect(() => {
    if (!actif || !selection) return;
    const minuterie = setInterval(async () => {
      const r = await service.listerExemplairesDuLivre(selection.livreId);
      const frais = r.ok ? r.valeur.find((e) => e.id === selection.id) : undefined;
      if (frais && clePosition(frais) !== clePosition(selection)) {
        setSelection(frais);
        setAnnonce(frais.malRange ? `${frais.livre.titre} a été vu ailleurs.` : `${frais.livre.titre} a été vu à sa place.`);
        const touchees = [frais.emplacementTheorique.emplacementId, selection.derniereDetection?.emplacementId, frais.derniereDetection?.emplacementId];
        void rafraichirEtageres([...new Set(touchees.filter((id): id is string => id !== undefined))]);
      }
    }, INTERVALLE_SUIVI_MS);
    return () => clearInterval(minuterie);
  }, [actif, selection]);

  // Échap ferme la vue « étagère ».
  useEffect(() => {
    if (!actif || !ouverte) return;
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && setOuverte(null);
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [actif, ouverte]);

  const malRanges = useMemo(() => {
    const uniques = new Map<string, Exemplaire>();
    for (const liste of contenus.values()) for (const e of liste) if (e.malRange) uniques.set(e.id, e);
    return [...uniques.values()].sort((a, b) => a.livre.titre.localeCompare(b.livre.titre, 'fr'));
  }, [contenus]);

  const nomEtagere = (id: string) => parId.get(id)?.nom ?? id;
  const cheminEtagere = (id: string) => {
    const noms: string[] = [];
    let e = parId.get(parId.get(id)?.parentId ?? '');
    while (e) {
      noms.unshift(e.nom);
      e = parId.get(e.parentId ?? '');
    }
    return noms.join(' › ');
  };

  const suivre = (e: Exemplaire) => {
    setSelection(e);
    setOuverte(null);
  };

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
          <ListeExemplaires titre="Résultats" exemplaires={resultats} selection={selection} vide="Aucun exemplaire trouvé." onChoisir={suivre} />
        )}

        {selection ? <FicheSelection exemplaire={selection} /> : <p className="aide">Cherchez un livre, ou cliquez sur une étagère du plan pour voir ses livres.</p>}

        {malRanges.length > 0 && (
          <details className="plan-mal-ranges">
            <summary>
              Mal rangés <span className="puce-compte">{malRanges.length}</span>
            </summary>
            <ListeExemplaires titre="Mal rangés" exemplaires={malRanges} selection={selection} vide="" onChoisir={suivre} />
          </details>
        )}

        <ul className="plan-legende" aria-label="Légende">
          <li>
            <span className="pastille pastille-prevue" aria-hidden="true" /> Place prévue
          </li>
          <li>
            <span className="pastille pastille-vue" aria-hidden="true" /> Vu ailleurs (mal rangé)
          </li>
        </ul>
        <p className="visuellement-cache" role="status">
          {annonce}
        </p>
      </aside>

      <div className="plan-zone">
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
          <>
            <ScenePlan
              disposition={disposition}
              contenus={contenus}
              prevue={selection?.emplacementTheorique.emplacementId ?? null}
              vue={selection?.malRange ? (selection.derniereDetection?.emplacementId ?? null) : null}
              suivi={selection?.id ?? null}
              ouverte={ouverte}
              commande={commande}
              actif={actif}
              onOuvrirEtagere={setOuverte}
            />

            <div className="plan-outils" role="toolbar" aria-label="Navigation dans le plan">
              <button type="button" onClick={() => commander({ type: 'ensemble' })}>
                Vue d’ensemble
              </button>
              <button type="button" onClick={() => commander({ type: 'dessus' })}>
                Vue de dessus
              </button>
              <button type="button" onClick={() => commander({ type: 'selection' })} disabled={!selection}>
                Centrer sur le livre
              </button>
              <span className="plan-outils-groupe">
                <button type="button" onClick={() => commander({ type: 'zoom-arriere' })} aria-label="Zoom arrière">
                  −
                </button>
                <button type="button" onClick={() => commander({ type: 'zoom-avant' })} aria-label="Zoom avant">
                  +
                </button>
              </span>
              {disposition.salles.map((s) => (
                <button key={s.id} type="button" className="plan-outil-salle" onClick={() => commander({ type: 'salle', salleId: s.id })}>
                  {s.nom}
                </button>
              ))}
              <button type="button" onClick={() => void rafraichirEtageres(idsEtageres)} aria-label="Actualiser le contenu des étagères" title="Actualiser">
                <IconeActualiser />
              </button>
            </div>

            <p className="plan-aide-navigation" aria-hidden="true">
              Glisser : tourner · Clic droit : déplacer · Molette : zoomer · Clic sur une étagère : voir ses livres
            </p>

            {ouverte && (
              <VueEtagere
                etagere={{ id: ouverte, nom: nomEtagere(ouverte), chemin: cheminEtagere(ouverte) }}
                contenu={contenus.get(ouverte) ?? null}
                suivi={selection?.id ?? null}
                nomEtagere={nomEtagere}
                onSuivre={suivre}
                onFermer={() => setOuverte(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ListeExemplaires({
  titre,
  exemplaires,
  selection,
  vide,
  onChoisir,
}: {
  titre: string;
  exemplaires: readonly Exemplaire[];
  selection: Exemplaire | null;
  vide: string;
  onChoisir: (e: Exemplaire) => void;
}) {
  return (
    <ul className="plan-resultats" aria-label={titre}>
      {exemplaires.length === 0 && <li className="aide">{vide}</li>}
      {exemplaires.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            className={`plan-resultat${selection?.id === e.id ? ' plan-resultat-actif' : ''}`}
            aria-pressed={selection?.id === e.id}
            onClick={() => onChoisir(e)}
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
function clePosition(e: Exemplaire): string {
  return `${e.emplacementTheorique.emplacementId}|${e.derniereDetection?.emplacementId ?? ''}|${e.derniereDetection?.date ?? ''}`;
}
