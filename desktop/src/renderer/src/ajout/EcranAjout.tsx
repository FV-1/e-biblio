import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DemandeAjout, ExemplaireAjoute, Livre, Notice } from '../../../commun/api';
import type { ErreurService } from '../../../commun/service-bibliotheque';
import { CheminLocalisation } from '../recherche/CheminLocalisation';
import { useService } from '../service/contexte-service';
import { BandeauTelephone, ModeTelephone } from '../telephone/ModeTelephone';
import type { Appairage } from '../telephone/use-appairage';
import { IconeCodeBarres, IconeCrayon, IconePlus, IconeRecherche, IconeTelephone, IconeValide } from '../ui/icones';
import { ApercuLivre } from './ApercuLivre';
import { TYPE_RANGEMENT } from './arbre-emplacements';
import { lireDerniereEtagere, memoriserDerniereEtagere } from './memoire-locale';
import { ModeIsbn } from './ModeIsbn';
import { ModeManuel, type NoticeSaisie } from './ModeManuel';
import { SelecteurEtagere } from './SelecteurEtagere';
import { useEmplacements } from './use-emplacements';

/** Livre retenu pour l'ajout, quelle que soit la façon dont il a été désigné. */
export type LivreChoisi =
  | { readonly type: 'notice'; readonly notice: Notice }
  | { readonly type: 'saisie'; readonly notice: NoticeSaisie }
  | { readonly type: 'existant'; readonly livre: Livre };

type Mode = 'isbn' | 'telephone' | 'manuel';

type EtatEnvoi =
  | { readonly statut: 'repos' }
  | { readonly statut: 'envoi' }
  | { readonly statut: 'erreur'; readonly erreur: ErreurService }
  | { readonly statut: 'fait'; readonly exemplaire: ExemplaireAjoute };

const CODES_CATALOGUE = new Set(['LIVRE_INCONNU_DU_CATALOGUE', 'CATALOGUE_INDISPONIBLE']);

/** ISBN reçu du téléphone ; le numéro distingue deux scans successifs du même livre. */
export interface Scan {
  readonly isbn: string;
  readonly numero: number;
}

interface Props {
  /** Livre déjà enregistré dont on ajoute un exemplaire (depuis la recherche), ou null. */
  readonly livrePrechoisi: Livre | null;
  readonly onVoirDansRecherche: (terme: string) => void;
  /** Session téléphone, partagée à l'échelle de l'application. */
  readonly appairage: Appairage;
  /** Dernier ISBN scanné par le téléphone. */
  readonly scan?: Scan | null;
}

export function EcranAjout({ livrePrechoisi, onVoirDansRecherche, appairage, scan = null }: Props) {
  const service = useService();
  const { etat: etatEmplacements, recharger } = useEmplacements();
  const [mode, setMode] = useState<Mode>('isbn');
  const [isbnPourManuel, setIsbnPourManuel] = useState('');
  const [isbnScanne, setIsbnScanne] = useState<Scan | null>(null);
  const [livre, setLivre] = useState<LivreChoisi | null>(livrePrechoisi ? { type: 'existant', livre: livrePrechoisi } : null);
  const [etagereId, setEtagereId] = useState<string | null>(() => lireDerniereEtagere());
  const [envoi, setEnvoi] = useState<EtatEnvoi>({ statut: 'repos' });

  // Un nouveau scan remplace le livre en cours et lance la recherche de sa notice.
  // Le scan déjà présent au montage (traité par une instance précédente) est ignoré.
  const dernierScanTraite = useRef(scan?.numero ?? 0);
  useEffect(() => {
    if (!scan || scan.numero === dernierScanTraite.current) return;
    dernierScanTraite.current = scan.numero;
    setLivre(null);
    setEnvoi({ statut: 'repos' });
    setIsbnScanne(scan);
    setMode('isbn');
  }, [scan]);

  const emplacements = etatEmplacements.statut === 'pret' ? etatEmplacements.emplacements : [];
  const etagereValide = emplacements.some((e) => e.id === etagereId && e.type === TYPE_RANGEMENT) ? etagereId : null;

  const choisirMode = (nouveau: Mode) => {
    setMode(nouveau);
    setIsbnScanne(null);
    if (nouveau !== 'manuel') setIsbnPourManuel('');
  };

  const ajouter = async () => {
    if (!livre || !etagereValide) return;
    setEnvoi({ statut: 'envoi' });
    let resultat = await service.ajouterExemplaire({ emplacementId: etagereValide, livre: demandeLivre(livre) });

    // Le catalogue a cessé de répondre entre l'aperçu et l'ajout : la notice affichée
    // a été validée par l'utilisateur, on l'enregistre donc telle quelle.
    if (!resultat.ok && livre.type === 'notice' && resultat.erreur.type === 'erreur-api' && CODES_CATALOGUE.has(resultat.erreur.code)) {
      const { isbn, titre, auteurs, couverture } = livre.notice.livre;
      resultat = await service.ajouterExemplaire({
        emplacementId: etagereValide,
        livre: { type: 'saisie', isbn, titre, auteurs, couverture },
      });
    }

    if (resultat.ok) {
      memoriserDerniereEtagere(etagereValide);
      setEnvoi({ statut: 'fait', exemplaire: resultat.valeur });
    } else {
      setEnvoi({ statut: 'erreur', erreur: resultat.erreur });
    }
  };

  const recommencer = (prochainLivre: LivreChoisi | null) => {
    setLivre(prochainLivre);
    setMode(appairage.etat.statut === 'actif' ? 'telephone' : 'isbn');
    setIsbnPourManuel('');
    setIsbnScanne(null);
    setEnvoi({ statut: 'repos' });
  };

  if (envoi.statut === 'fait') {
    const ex = envoi.exemplaire;
    return (
      <section className="succes-ajout" aria-labelledby="titre-succes">
        <BandeauTelephone appairage={appairage} />
        <div className="succes-entete">
          <span className="pastille-succes">
            <IconeValide />
          </span>
          <div>
            <h2 id="titre-succes">Exemplaire ajouté</h2>
            <p className="aide">Il est désormais trouvable dans la recherche.</p>
          </div>
        </div>
        <ApercuLivre
          titre={ex.livre.titre}
          auteurs={ex.livre.auteurs}
          isbn={ex.livre.isbn}
          couverture={ex.livre.couverture}
          origine={LIBELLES_SOURCE[ex.sourceLivre]}
        />
        <h3 className="titre-section">À ranger sur</h3>
        <CheminLocalisation localisation={ex.emplacementTheorique.localisation} />
        <div className="actions">
          <button type="button" onClick={() => recommencer(null)}>
            <IconePlus /> Ajouter un autre livre
          </button>
          <button type="button" className="secondaire" onClick={() => recommencer({ type: 'existant', livre: ex.livre })}>
            Autre exemplaire de ce livre
          </button>
          <button type="button" className="secondaire" onClick={() => onVoirDansRecherche(ex.livre.titre)}>
            <IconeRecherche /> Voir dans la recherche
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="ecran-ajout">
      <section className="panneau" aria-labelledby="etape-livre">
        <h2 id="etape-livre" className="titre-etape">
          <span className="numero-etape">1</span> Le livre
        </h2>

        {(livre || mode !== 'telephone') && (
          <BandeauTelephone appairage={appairage} onAfficherQr={livre ? undefined : () => choisirMode('telephone')} />
        )}

        {livre ? (
          <ApercuLivre {...resumeLivre(livre)} onChanger={() => recommencer(null)} />
        ) : (
          <>
            <div className="segments" role="tablist" aria-label="Comment désigner le livre">
              <BoutonMode actif={mode === 'isbn'} onClick={() => choisirMode('isbn')} icone={<IconeCodeBarres />}>
                Par ISBN
              </BoutonMode>
              <BoutonMode actif={mode === 'telephone'} onClick={() => choisirMode('telephone')} icone={<IconeTelephone />}>
                Avec le téléphone
              </BoutonMode>
              <BoutonMode actif={mode === 'manuel'} onClick={() => choisirMode('manuel')} icone={<IconeCrayon />}>
                Saisie manuelle
              </BoutonMode>
            </div>

            <div role="tabpanel" className="contenu-mode">
              {mode === 'telephone' && <ModeTelephone appairage={appairage} />}
              {mode === 'isbn' && (
                <ModeIsbn
                  key={isbnScanne?.numero ?? 0}
                  {...(isbnScanne ? { isbnInitial: isbnScanne.isbn } : {})}
                  onNoticeTrouvee={(notice) => setLivre({ type: 'notice', notice })}
                  onSaisieManuelle={(isbn) => {
                    setIsbnPourManuel(isbn);
                    setMode('manuel');
                  }}
                />
              )}
              {mode === 'manuel' && (
                <ModeManuel
                  key={isbnPourManuel}
                  isbnInitial={isbnPourManuel}
                  onValider={(notice) => setLivre({ type: 'saisie', notice })}
                />
              )}
            </div>
          </>
        )}
      </section>

      <section className="panneau" aria-labelledby="etape-emplacement">
        <h2 id="etape-emplacement" className="titre-etape">
          <span className="numero-etape">2</span> L’emplacement
        </h2>

        {etatEmplacements.statut === 'chargement' && <p className="message">Chargement des emplacements…</p>}
        {etatEmplacements.statut === 'erreur' && (
          <div className="encart encart-alerte" role="alert">
            <p>Impossible de charger les emplacements : {etatEmplacements.erreur.message}</p>
            <button type="button" className="secondaire" onClick={() => void recharger()}>
              Réessayer
            </button>
          </div>
        )}
        {etatEmplacements.statut === 'pret' && (
          <SelecteurEtagere emplacements={emplacements} etagereInitiale={etagereValide} onChange={setEtagereId} />
        )}

        <div className="pied-panneau">
          <button
            type="button"
            className="principal"
            disabled={!livre || !etagereValide || envoi.statut === 'envoi'}
            onClick={() => void ajouter()}
          >
            <IconePlus /> {envoi.statut === 'envoi' ? 'Ajout en cours…' : 'Ajouter l’exemplaire'}
          </button>
          {(!livre || !etagereValide) && (
            <p className="aide">{!livre ? 'Choisissez d’abord le livre.' : 'Choisissez l’étagère où ranger l’exemplaire.'}</p>
          )}
        </div>

        {envoi.statut === 'erreur' && (
          <div className="encart encart-alerte" role="alert">
            <p>L’exemplaire n’a pas été ajouté : {envoi.erreur.message}</p>
          </div>
        )}
      </section>
    </div>
  );
}

const LIBELLES_SOURCE: Record<ExemplaireAjoute['sourceLivre'], string> = {
  base: 'Livre déjà dans la bibliothèque',
  catalogue: 'Notice Open Library',
  saisie: 'Saisie manuelle',
};

function demandeLivre(livre: LivreChoisi): DemandeAjout['livre'] {
  switch (livre.type) {
    case 'notice':
      return livre.notice.livre.id
        ? { type: 'existant', livreId: livre.notice.livre.id }
        : { type: 'isbn', isbn: livre.notice.livre.isbn };
    case 'saisie':
      return { type: 'saisie', ...livre.notice, auteurs: [...livre.notice.auteurs] };
    case 'existant':
      return { type: 'existant', livreId: livre.livre.id };
  }
}

function resumeLivre(livre: LivreChoisi) {
  switch (livre.type) {
    case 'notice':
      return {
        ...livre.notice.livre,
        origine: livre.notice.source === 'base' ? 'Déjà dans la bibliothèque' : 'Trouvé sur Open Library',
      };
    case 'saisie':
      return { ...livre.notice, origine: 'Saisie manuelle' };
    case 'existant':
      return { ...livre.livre, origine: 'Nouvel exemplaire' };
  }
}

function BoutonMode({ actif, onClick, icone, children }: { actif: boolean; onClick: () => void; icone: ReactNode; children: string }) {
  return (
    <button type="button" role="tab" aria-selected={actif} className={`segment${actif ? ' segment-actif' : ''}`} onClick={onClick}>
      {icone}
      {children}
    </button>
  );
}
