import { Couverture } from '../ui/Couverture';

interface Props {
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly isbn: string | null;
  readonly couverture: string | null;
  /** Ex. « Trouvé sur Open Library », « Déjà dans la bibliothèque ». */
  readonly origine: string;
  readonly onChanger?: () => void;
}

/** Carte récapitulative du livre retenu pour l'ajout. */
export function ApercuLivre({ titre, auteurs, isbn, couverture, origine, onChanger }: Props) {
  return (
    <article className="apercu-livre" aria-label={`Livre choisi : ${titre}`}>
      <Couverture url={couverture} titre={titre} />
      <div className="apercu-corps">
        <span className="etiquette-origine">{origine}</span>
        <h3 className="apercu-titre">{titre}</h3>
        <p className="apercu-auteurs">{auteurs.length > 0 ? auteurs.join(', ') : 'Auteur inconnu'}</p>
        <p className="apercu-isbn">{isbn ? `ISBN ${isbn}` : 'Sans ISBN'}</p>
      </div>
      {onChanger && (
        <button type="button" className="bouton-discret" onClick={onChanger}>
          Changer
        </button>
      )}
    </article>
  );
}
