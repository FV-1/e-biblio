import { useState } from 'react';
import type { Exemplaire } from '../../../commun/api';
import { BadgeStatut } from './BadgeStatut';
import { CheminLocalisation } from './CheminLocalisation';
import { formaterDate } from './format';

export function CarteExemplaire({ exemplaire }: { exemplaire: Exemplaire }) {
  const { livre, emplacementTheorique, derniereDetection } = exemplaire;

  return (
    <article className={`carte${exemplaire.malRange ? ' carte-mal-rangee' : ''}`} aria-label={livre.titre}>
      <Couverture url={livre.couverture} titre={livre.titre} />

      <div className="carte-corps">
        <header className="carte-entete">
          <div>
            <h2 className="carte-titre">{livre.titre}</h2>
            <p className="carte-auteurs">{livre.auteurs.length > 0 ? livre.auteurs.join(', ') : 'Auteur inconnu'}</p>
          </div>
          <BadgeStatut exemplaire={exemplaire} />
        </header>

        <p className="carte-meta">
          ISBN {exemplaire.isbn} · Exemplaire <code>{exemplaire.id}</code>
        </p>

        <section className="carte-section">
          <h3>Emplacement prévu</h3>
          <CheminLocalisation localisation={emplacementTheorique.localisation} />
        </section>

        {derniereDetection && (
          <section className={`carte-section${exemplaire.malRange ? ' section-alerte' : ''}`}>
            <h3>{exemplaire.malRange ? 'Vu ailleurs' : 'Vu à sa place'} le {formaterDate(derniereDetection.date)}</h3>
            {exemplaire.malRange && <CheminLocalisation localisation={derniereDetection.localisation} />}
          </section>
        )}
      </div>
    </article>
  );
}

/** Couverture, remplacée par un aplat si absente ou si l'image ne charge pas (hors ligne…). */
function Couverture({ url, titre }: { url: string | null; titre: string }) {
  const [enErreur, setEnErreur] = useState(false);
  if (!url || enErreur) {
    return (
      <div className="couverture couverture-vide" aria-hidden="true">
        {titre.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img className="couverture" src={url} alt={`Couverture de ${titre}`} onError={() => setEnErreur(true)} />;
}
