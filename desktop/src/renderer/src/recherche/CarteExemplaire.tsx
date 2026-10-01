import type { Exemplaire, Livre } from '../../../commun/api';
import { Couverture } from '../ui/Couverture';
import { IconePlus } from '../ui/icones';
import { BadgeStatut } from './BadgeStatut';
import { CheminLocalisation } from './CheminLocalisation';
import { formaterDate } from './format';

interface Props {
  readonly exemplaire: Exemplaire;
  readonly onAjouterExemplaire?: ((livre: Livre) => void) | undefined;
}

export function CarteExemplaire({ exemplaire, onAjouterExemplaire }: Props) {
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
          {exemplaire.isbn ? `ISBN ${exemplaire.isbn}` : 'Sans ISBN'} · Exemplaire <code>{exemplaire.id}</code>
        </p>

        <section className="carte-section">
          <h3>Emplacement prévu</h3>
          <CheminLocalisation localisation={emplacementTheorique.localisation} />
        </section>

        {derniereDetection && (
          <section className={`carte-section${exemplaire.malRange ? ' section-alerte' : ''}`}>
            <h3>
              {exemplaire.malRange ? 'Vu ailleurs' : 'Vu à sa place'} le {formaterDate(derniereDetection.date)}
            </h3>
            {exemplaire.malRange && <CheminLocalisation localisation={derniereDetection.localisation} />}
          </section>
        )}

        {onAjouterExemplaire && (
          <div className="carte-actions">
            <button type="button" className="bouton-discret" onClick={() => onAjouterExemplaire(livre)}>
              <IconePlus /> Ajouter un exemplaire
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
