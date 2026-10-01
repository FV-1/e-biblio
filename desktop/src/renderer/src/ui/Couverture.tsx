import { useState } from 'react';

/** Couverture, remplacée par un aplat avec l'initiale si absente ou si l'image ne charge pas (hors ligne…). */
export function Couverture({ url, titre, taille = 'normale' }: { url: string | null; titre: string; taille?: 'normale' | 'petite' }) {
  const [enErreur, setEnErreur] = useState(false);
  const classe = `couverture couverture-${taille}`;
  if (!url || enErreur) {
    return (
      <div className={`${classe} couverture-vide`} aria-hidden="true">
        {titre.trim().charAt(0).toUpperCase() || '?'}
      </div>
    );
  }
  return <img className={classe} src={url} alt={`Couverture de ${titre}`} onError={() => setEnErreur(true)} />;
}
