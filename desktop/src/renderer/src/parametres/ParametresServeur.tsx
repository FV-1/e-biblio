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

/** Affiche le serveur utilisé et son état de connexion ; permet de changer son URL. */
export function ParametresServeur() {
  const service = useService();
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [connexion, setConnexion] = useState<EtatConnexion>({ statut: 'verification' });
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const derniereVerification = useRef(0);

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
    <section className="parametres-serveur" aria-label="Serveur">
      {!edition ? (
        <div className="serveur-resume">
          <span className={`voyant voyant-${connexion.statut}`} aria-hidden="true" />
          <div className="serveur-infos">
            <span className="serveur-url">{configuration.urlServeur}</span>
            <span className="serveur-statut" title={connexion.statut === 'injoignable' ? connexion.message : undefined}>
              {connexion.statut === 'verification' && 'Vérification…'}
              {connexion.statut === 'connecte' && 'Connecté'}
              {connexion.statut === 'injoignable' && 'Injoignable'}
              {' · '}
              {LIBELLES_SOURCE[configuration.source]}
            </span>
          </div>
          <button type="button" className="secondaire" onClick={() => void verifier()}>
            Tester
          </button>
          <button type="button" className="secondaire" onClick={ouvrirEdition}>
            Modifier
          </button>
        </div>
      ) : (
        <form className="serveur-edition" onSubmit={soumettre}>
          <label htmlFor="champ-url-serveur">Adresse du serveur</label>
          <div className="serveur-edition-ligne">
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
            <button type="submit">Enregistrer</button>
            <button type="button" className="secondaire" onClick={() => setEdition(false)}>
              Annuler
            </button>
          </div>
          {erreurSaisie && (
            <p id="erreur-url-serveur" className="erreur-champ" role="alert">
              {erreurSaisie}
            </p>
          )}
          {configuration.source === 'interface' && (
            <button type="button" className="lien" onClick={() => void appliquer(null)}>
              Revenir à {configuration.urlParDefaut}
            </button>
          )}
        </form>
      )}
    </section>
  );
}
