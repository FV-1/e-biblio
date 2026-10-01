import { useEffect, useState } from 'react';
import { IconeTelephone } from '../ui/icones';
import type { Appairage } from './use-appairage';

/**
 * Affiche le QR code à scanner avec le téléphone et les consignes.
 * Démarre la session d'appairage à l'affichage si elle n'est pas déjà active.
 */
export function ModeTelephone({ appairage }: { appairage: Appairage }) {
  const { etat, demarrer, arreter } = appairage;
  const [indexAdresse, setIndexAdresse] = useState(0);

  useEffect(() => {
    if (etat.statut === 'inactif') void demarrer();
    // Seulement à l'affichage du mode : un arrêt volontaire ne doit pas relancer la session.
  }, []);

  if (etat.statut === 'demarrage') {
    return <p className="message">Préparation du QR code…</p>;
  }

  if (etat.statut === 'inactif') {
    return (
      <div className="mode-telephone-inactif">
        <p className="message">Utilisez votre téléphone comme lecteur de codes-barres, sans rien installer.</p>
        <button type="button" onClick={() => void demarrer()}>
          <IconeTelephone /> Connecter un téléphone
        </button>
      </div>
    );
  }

  if (etat.statut === 'erreur') {
    return (
      <div className="encart encart-alerte" role="alert">
        <p>{etat.erreur.message}</p>
        <button type="button" className="secondaire" onClick={() => void demarrer()}>
          Réessayer
        </button>
      </div>
    );
  }

  const { adresses } = etat.infos;
  const adresse = adresses[Math.min(indexAdresse, adresses.length - 1)]!;

  return (
    <div className="mode-telephone">
      <div className="qr-cadre">
        <img className="qr-code" src={adresse.qrCode} alt="QR code à scanner avec le téléphone" />
      </div>

      <div className="consignes">
        <ol>
          <li>Connectez le téléphone au <strong>même réseau Wi-Fi</strong> que cet ordinateur.</li>
          <li>Scannez ce QR code avec l’appareil photo du téléphone.</li>
          <li>Photographiez le code-barres du livre : sa notice s’affiche ici.</li>
        </ol>

        <p className="attente" role="status">
          <span className="point-pulse" aria-hidden="true" /> En attente d’un scan…
        </p>

        <p className="aide">
          Adresse : <code>{adresse.url}</code>
        </p>

        {adresses.length > 1 && (
          <div className="champ">
            <label htmlFor="adresse-appairage">Le téléphone n’arrive pas à se connecter ? Essayez une autre carte réseau :</label>
            <select id="adresse-appairage" value={indexAdresse} onChange={(e) => setIndexAdresse(Number(e.target.value))}>
              {adresses.map((a, i) => (
                <option key={a.url} value={i}>
                  {a.carte} — {new URL(a.url).hostname}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="aide">
          Au premier lancement, Windows peut demander d’autoriser e-biblio sur le réseau : acceptez pour les réseaux privés.
        </p>

        <button type="button" className="secondaire" onClick={() => void arreter()}>
          <IconeTelephone /> Déconnecter le téléphone
        </button>
      </div>
    </div>
  );
}

/** Rappel discret, sur l'écran d'ajout, qu'un téléphone est connecté. */
export function BandeauTelephone({ appairage, onAfficherQr }: { appairage: Appairage; onAfficherQr?: () => void }) {
  if (appairage.etat.statut !== 'actif') return null;
  return (
    <div className="bandeau-telephone" role="status">
      <IconeTelephone />
      <span>Téléphone connecté : scannez un livre pour l’ajouter.</span>
      {onAfficherQr && (
        <button type="button" className="bouton-discret" onClick={onAfficherQr}>
          QR code
        </button>
      )}
      <button type="button" className="bouton-discret" onClick={() => void appairage.arreter()}>
        Déconnecter
      </button>
    </div>
  );
}
