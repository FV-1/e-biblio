import { Fragment, useEffect, useRef, useState } from 'react';
import type { CriteresLivres, LigneLivre, Livre, TriLivres } from '../../../commun/api';
import { pluriel } from '../recherche/format';
import { Couverture } from '../ui/Couverture';
import { IconeActualiser, IconeChevron, IconeRecherche } from '../ui/icones';
import { DetailOeuvre } from './DetailOeuvre';
import { useInventaire } from './use-inventaire';

interface Props {
  readonly onAjouterExemplaire?: (livre: Livre) => void;
  /** Vrai quand l'onglet est affiché : les données sont rafraîchies à chaque retour sur l'onglet. */
  readonly actif?: boolean;
  /** Délai (ms) avant d'appliquer la recherche pendant la frappe. */
  readonly delaiSaisie?: number;
}

const TAILLES_PAGE = [25, 50, 100];

export function EcranBase({ onAjouterExemplaire, actif = true, delaiSaisie = 300 }: Props) {
  const { criteres, etat, filtrer, trier, allerPage, reinitialiser, recharger } = useInventaire();
  const [saisie, setSaisie] = useState('');
  const [deplies, setDeplies] = useState<ReadonlySet<string>>(new Set());
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Retour sur l'onglet : les données ont pu changer (ajout d'un livre, scan…).
  const premierAffichage = useRef(true);
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false;
      return;
    }
    if (actif) recharger();
  }, [actif]);

  // Changer de page ou de critères replie les lignes.
  useEffect(() => setDeplies(new Set()), [criteres]);

  useEffect(() => () => clearTimeout(minuterie.current), []);

  const saisir = (valeur: string) => {
    setSaisie(valeur);
    clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => filtrer({ terme: valeur.trim() }), delaiSaisie);
  };

  const basculer = (id: string) =>
    setDeplies((d) => {
      const suivant = new Set(d);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  const filtresActifs = Boolean(criteres.terme || criteres.isbn || criteres.couverture);
  const { page } = etat;

  return (
    <section className="ecran-base">
      <div className="barre-outils">
        <div className="champ-recherche-base">
          <label htmlFor="recherche-base" className="visuellement-cache">
            Rechercher une œuvre
          </label>
          <IconeRecherche className="icone-champ" />
          <input
            id="recherche-base"
            type="search"
            value={saisie}
            onChange={(e) => saisir(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                clearTimeout(minuterie.current);
                filtrer({ terme: saisie.trim() });
              }
            }}
            placeholder="Filtrer par titre, auteur ou ISBN"
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <Filtre
          id="filtre-isbn"
          libelle="ISBN"
          valeur={criteres.isbn ?? ''}
          options={[
            ['', 'Tous'],
            ['avec', 'Avec ISBN'],
            ['sans', 'Sans ISBN'],
          ]}
          onChange={(v) => filtrer({ isbn: (v || undefined) as CriteresLivres['isbn'] })}
        />
        <Filtre
          id="filtre-couverture"
          libelle="Couverture"
          valeur={criteres.couverture ?? ''}
          options={[
            ['', 'Toutes'],
            ['avec', 'Avec couverture'],
            ['sans', 'Sans couverture'],
          ]}
          onChange={(v) => filtrer({ couverture: (v || undefined) as CriteresLivres['couverture'] })}
        />

        <button type="button" className="secondaire bouton-icone" onClick={recharger} aria-label="Actualiser" title="Actualiser">
          <IconeActualiser />
        </button>
      </div>

      <div className="ligne-resultats">
        <p className="compteur" role="status">
          {page ? `${pluriel(page.total, 'œuvre')}${filtresActifs ? ' correspondant aux filtres' : ' dans la bibliothèque'}` : 'Chargement…'}
        </p>
        {filtresActifs && (
          <button
            type="button"
            className="lien"
            onClick={() => {
              setSaisie('');
              clearTimeout(minuterie.current);
              reinitialiser();
            }}
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {etat.erreur && (
        <div className="encart encart-alerte" role="alert">
          <p>Impossible de charger les œuvres : {etat.erreur.message}</p>
          <button type="button" className="secondaire" onClick={recharger}>
            Réessayer
          </button>
        </div>
      )}

      {page && (
        <div className={`tableau-conteneur${etat.chargement ? ' tableau-en-chargement' : ''}`} aria-busy={etat.chargement}>
          <table className="tableau">
            <thead>
              <tr>
                <th className="col-deplier">
                  <span className="visuellement-cache">Déplier</span>
                </th>
                <th className="col-couverture">
                  <span className="visuellement-cache">Couverture</span>
                </th>
                <EnteteTriable libelle="Titre" tri="titre" criteres={criteres} onTrier={trier} />
                <EnteteTriable libelle="Auteurs" tri="auteur" criteres={criteres} onTrier={trier} />
                <th>ISBN</th>
                <EnteteTriable libelle="Exemplaires" tri="exemplaires" criteres={criteres} onTrier={trier} numerique />
                <EnteteTriable libelle="Mal rangés" tri="malRanges" criteres={criteres} onTrier={trier} numerique />
              </tr>
            </thead>
            <tbody>
              {page.livres.length === 0 && (
                <tr>
                  <td colSpan={7} className="cellule-vide">
                    {filtresActifs ? 'Aucune œuvre ne correspond à ces filtres.' : 'La bibliothèque ne contient encore aucune œuvre.'}
                  </td>
                </tr>
              )}
              {page.livres.map((oeuvre) => (
                <LigneOeuvre
                  key={oeuvre.id}
                  oeuvre={oeuvre}
                  deplie={deplies.has(oeuvre.id)}
                  onBasculer={() => basculer(oeuvre.id)}
                  onAjouterExemplaire={onAjouterExemplaire}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page && page.total > 0 && (
        <Pagination
          page={page.page}
          pages={page.pages}
          total={page.total}
          parPage={criteres.parPage}
          onPage={allerPage}
          onParPage={(parPage) => filtrer({ parPage })}
        />
      )}
    </section>
  );
}

function LigneOeuvre({
  oeuvre,
  deplie,
  onBasculer,
  onAjouterExemplaire,
}: {
  oeuvre: LigneLivre;
  deplie: boolean;
  onBasculer: () => void;
  onAjouterExemplaire: Props['onAjouterExemplaire'];
}) {
  const idDetail = `detail-${oeuvre.id}`;
  return (
    <Fragment>
      <tr className={`ligne-oeuvre${deplie ? ' ligne-depliee' : ''}`} onClick={onBasculer}>
        <td className="col-deplier">
          <button
            type="button"
            className="bouton-deplier"
            aria-expanded={deplie}
            aria-controls={deplie ? idDetail : undefined}
            aria-label={`${deplie ? 'Replier' : 'Déplier'} les exemplaires de ${oeuvre.titre}`}
            onClick={(e) => {
              e.stopPropagation();
              onBasculer();
            }}
          >
            <IconeChevron />
          </button>
        </td>
        <td className="col-couverture">
          <Couverture url={oeuvre.couverture} titre={oeuvre.titre} taille="mini" />
        </td>
        <td className="col-titre">{oeuvre.titre}</td>
        <td className="col-auteurs">{oeuvre.auteurs.length > 0 ? oeuvre.auteurs.join(', ') : <span className="texte-doux">—</span>}</td>
        <td className="col-isbn">{oeuvre.isbn ?? <span className="texte-doux">Sans ISBN</span>}</td>
        <td className="numerique">{oeuvre.nombreExemplaires}</td>
        <td className="numerique">
          {oeuvre.nombreMalRanges > 0 ? <span className="badge badge-alerte">{oeuvre.nombreMalRanges}</span> : <span className="texte-doux">0</span>}
        </td>
      </tr>
      {deplie && (
        <tr className="ligne-detail" id={idDetail}>
          <td colSpan={7}>
            <DetailOeuvre oeuvre={oeuvre} onAjouterExemplaire={onAjouterExemplaire} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function EnteteTriable({
  libelle,
  tri,
  criteres,
  onTrier,
  numerique = false,
}: {
  libelle: string;
  tri: TriLivres;
  criteres: CriteresLivres;
  onTrier: (tri: TriLivres) => void;
  numerique?: boolean;
}) {
  const actif = criteres.tri === tri;
  const sens = actif ? (criteres.ordre === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th aria-sort={sens} className={numerique ? 'numerique' : undefined}>
      <button type="button" className={`bouton-tri${actif ? ' tri-actif' : ''}`} onClick={() => onTrier(tri)}>
        {libelle}
        <span className="fleche-tri" aria-hidden="true">
          {actif ? (criteres.ordre === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Filtre({
  id,
  libelle,
  valeur,
  options,
  onChange,
}: {
  id: string;
  libelle: string;
  valeur: string;
  options: [string, string][];
  onChange: (valeur: string) => void;
}) {
  return (
    <div className="filtre">
      <label htmlFor={id}>{libelle}</label>
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, texte]) => (
          <option key={v} value={v}>
            {texte}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pagination({
  page,
  pages,
  total,
  parPage,
  onPage,
  onParPage,
}: {
  page: number;
  pages: number;
  total: number;
  parPage: number;
  onPage: (page: number) => void;
  onParPage: (parPage: number) => void;
}) {
  const debut = (page - 1) * parPage + 1;
  const fin = Math.min(page * parPage, total);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="aide">
        {debut}–{fin} sur {total}
      </span>
      <div className="pagination-pages">
        <button type="button" className="secondaire" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </button>
        {numerosAffiches(page, pages).map((n, i) =>
          n === null ? (
            <span key={`ellipse-${i}`} className="texte-doux" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`puce${n === page ? ' puce-active' : ''}`}
              aria-current={n === page ? 'page' : undefined}
              aria-label={`Page ${n}`}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="secondaire" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </button>
      </div>
      <div className="filtre">
        <label htmlFor="par-page">Par page</label>
        <select id="par-page" value={parPage} onChange={(e) => onParPage(Number(e.target.value))}>
          {TAILLES_PAGE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}

/** Numéros de page à afficher : première, dernière, et voisines de la page courante (null = « … »). */
export function numerosAffiches(page: number, pages: number): (number | null)[] {
  const voulus = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const tries = [...voulus].sort((a, b) => a - b);
  return tries.flatMap((n, i) => (i > 0 && n - tries[i - 1]! > 1 ? [null, n] : [n]));
}
