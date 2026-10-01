import type { Localisation } from '../../../commun/api';
import { libelleType } from './format';

/** Fil d'Ariane étage > salle > rayon > étagère, suivi de la position sur le plan. */
export function CheminLocalisation({ localisation }: { localisation: Localisation }) {
  const { coordonnees } = localisation;
  return (
    <div className="localisation">
      <ol className="chemin" aria-label={`Chemin : ${localisation.libelle}`}>
        {localisation.chemin.map((etape) => (
          <li key={etape.id} className="chemin-etape">
            <span className="chemin-type">{libelleType(etape.type)}</span>
            <span className="chemin-nom">{etape.nom}</span>
          </li>
        ))}
      </ol>
      <p className="coordonnees">
        {coordonnees
          ? `Position sur le plan : x ${coordonnees.x} · y ${coordonnees.y}`
          : 'Position sur le plan non renseignée'}
      </p>
    </div>
  );
}
