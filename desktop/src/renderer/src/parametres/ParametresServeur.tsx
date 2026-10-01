import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Configuration, SourceUrl } from '../../../commun/service-bibliotheque';
import { useService } from '../service/contexte-service';

type EtatConnexion =
  | { readonly statut: 'verification' }
  | { readonly statut: 'connecte' }
  | { readonly statut: 'injoignable'; readonly message: string };

const LIBELLES_SOURCE: Record<SourceUrl, string> = {
  interface: 'réglée dans l’application',
  environnement: 'variable BIBLIO_API_URL',
  defaut: 'valeur par défaut',
};

const LIBELLES_CONNEXION: Record<EtatConnexion['statut'], string> = {
  verification: 'Vérification…',
  connecte: 'Connecté',
  injoignable: 'Injoignable',
};

function hote(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Pastille compacte dans la barre du haut (voyant + hôte du serveur), qui ouvre
 * un panneau : état de la connexion, test, modification de l'URL.
 */
export function ParametresServeur() {
  const service = useService();
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [connexion, setConnexion] = useState<EtatConnexion>({ statut: 'verification' });
  const [ouvert, setOuvert] = useState(false);
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const derniereVerification = useRef(0);
  const conteneur = useRef<HTMLDivElement>(null);

  const verifier = useCallback(async () => {
    const numero = ++derniereVerification.current;
    setConnexion({ statut: 'verification' });
    const resultat = await service.verifierConnexion();
    if (numero !== derniereVerification.current) return;
    setConnexion(resultat.ok ? { statut: 'connecte' } : { statut: 'injoignable', message: resultat.erreur.message });
  }, [service]);

  useEffect(() => {
    let actif = true;
    void service.lireConfiguration().then((c) => {
      if (actif) setConfiguration(c);
    });
    void verifier();
    return () => {
      actif = false;
    };
  }, [service, verifier]);

  // Fermeture du panneau : touche Échap ou clic en dehors.
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    const surClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) fermer();
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [ouvert]);

  const fermer = () => {
    setOuvert(false);
    setEdition(false);
  };

  const appliquer = async (url: string | null) => {
    const resultat = await service.modifierUrlServeur(url);
    if (!resultat.ok) {
      setErreurSaisie(resultat.erreur.message);
      return;
    }
    setConfiguration(resultat.valeur);
    setEdition(false);
    setErreurSaisie(null);
    void verifier();
  };

  const soumettre = (evenement: FormEvent) => {
    evenement.preventDefault();
    void appliquer(saisie);
  };

  const ouvrirEdition = () => {
    setSaisie(configuration?.urlServeur ?? '');
    setErreurSaisie(null);
    setEdition(true);
  };

  if (!configuration) return null;

  return (
    <div className="serveur" ref={conteneur}>
      <button
        type="button"
        className={`serveur-pastille serveur-${connexion.statut}`}
        aria-expanded={ouvert}
        aria-controls="panneau-serveur"
        aria-label={`Serveur ${configuration.urlServeur} : ${LIBELLES_CONNEXION[connexion.statut]}`}
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
      >
        <span className={`voyant voyant-${connexion.statut}`} aria-hidden="true" />
        <span className="serveur-hote">{hote(configuration.urlServeur)}</span>
      </button>

      {ouvert && (
        <div id="panneau-serveur" className="serveur-panneau" role="dialog" aria-label="Connexion au serveur">
          {!edition ? (
            <>
              <p className="serveur-url">{configuration.urlServeur}</p>
              <p className="serveur-statut" title={connexion.statut === 'injoignable' ? connexion.message : undefined}>
                {LIBELLES_CONNEXION[connexion.statut]} · {LIBELLES_SOURCE[configuration.source]}
              </p>
              {connexion.statut === 'injoignable' && <p className="erreur-champ">{connexion.message}</p>}
              <div className="actions">
                <button type="button" className="secondaire" onClick={() => void verifier()}>
                  Tester
                </button>
                <button type="button" className="secondaire" onClick={ouvrirEdition}>
                  Modifier
                </button>
              </div>
            </>
          ) : (
            <form className="serveur-edition" onSubmit={soumettre}>
              <label htmlFor="champ-url-serveur">Adresse du serveur</label>
              <input
                id="champ-url-serveur"
                type="text"
                inputMode="url"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="http://192.168.1.20:3000"
                aria-invalid={erreurSaisie !== null}
                aria-describedby={erreurSaisie ? 'erreur-url-serveur' : undefined}
                autoFocus
              />
              {erreurSaisie && (
                <p id="erreur-url-serveur" className="erreur-champ" role="alert">
                  {erreurSaisie}
                </p>
              )}
              <div className="actions">
                <button type="submit">Enregistrer</button>
                <button type="button" className="secondaire" onClick={() => setEdition(false)}>
                  Annuler
                </button>
              </div>
              {configuration.source === 'interface' && (
                <button type="button" className="lien" onClick={() => void appliquer(null)}>
                  Revenir à {configuration.urlParDefaut}
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
