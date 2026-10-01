import { useEffect, useState, type MouseEvent } from 'react';
import { IconeCopier, IconeValide } from './icones';

/**
 * « Exemplaire n°2 » pour l'humain ; l'identifiant technique (UUID) reste
 * accessible en info-bulle et peut être copié (scan, étiquette, support).
 */
export function IdentifiantExemplaire({ id, numero }: { id: string; numero: number }) {
  const [etat, setEtat] = useState<'repos' | 'copie' | 'echec'>('repos');

  useEffect(() => {
    if (etat === 'repos') return undefined;
    const minuterie = setTimeout(() => setEtat('repos'), 2000);
    return () => clearTimeout(minuterie);
  }, [etat]);

  const copier = async (evenement: MouseEvent) => {
    evenement.stopPropagation(); // ne pas replier la ligne du tableau
    try {
      await navigator.clipboard.writeText(id);
      setEtat('copie');
    } catch {
      setEtat('echec');
    }
  };

  return (
    <span className="identifiant-exemplaire">
      <span className="numero-exemplaire" title={`Identifiant : ${id}`}>
        Exemplaire n°{numero}
      </span>
      <button
        type="button"
        className="bouton-copier"
        onClick={(e) => void copier(e)}
        aria-label={`Copier l’identifiant de l’exemplaire n°${numero}`}
        title={etat === 'copie' ? 'Copié !' : `Copier l’identifiant (${id})`}
      >
        {etat === 'copie' ? <IconeValide width={14} height={14} /> : <IconeCopier width={14} height={14} />}
      </button>
      <span className="visuellement-cache" role="status">
        {etat === 'copie' ? 'Identifiant copié' : etat === 'echec' ? 'Copie impossible' : ''}
      </span>
    </span>
  );
}
