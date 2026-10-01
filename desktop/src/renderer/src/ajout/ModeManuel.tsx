import { useState, type FormEvent, type ReactElement } from 'react';
import { Couverture } from '../ui/Couverture';
import { formeIsbnValide, nettoyerIsbn } from './isbn';

export interface NoticeSaisie {
  readonly isbn: string | null;
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

interface Props {
  readonly isbnInitial?: string;
  readonly onValider: (notice: NoticeSaisie) => void;
}

function urlImageValide(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Notice saisie entièrement à la main ; l'ISBN est facultatif. */
export function ModeManuel({ isbnInitial = '', onValider }: Props) {
  const [isbn, setIsbn] = useState(isbnInitial);
  const [titre, setTitre] = useState('');
  const [auteurs, setAuteurs] = useState('');
  const [couverture, setCouverture] = useState('');
  const [tentative, setTentative] = useState(false);

  const erreurs = {
    isbn: isbn.trim() !== '' && !formeIsbnValide(isbn) ? 'Format d’ISBN invalide (10 ou 13 caractères), ou laissez vide.' : null,
    titre: titre.trim() === '' ? 'Le titre est obligatoire.' : null,
    couverture: couverture.trim() !== '' && !urlImageValide(couverture.trim()) ? 'Adresse d’image invalide (http ou https).' : null,
  };
  const valide = !erreurs.isbn && !erreurs.titre && !erreurs.couverture;

  const soumettre = (evenement: FormEvent) => {
    evenement.preventDefault();
    setTentative(true);
    if (!valide) return;
    onValider({
      isbn: isbn.trim() ? nettoyerIsbn(isbn) : null,
      titre: titre.trim(),
      auteurs: auteurs.split('\n').map((a) => a.trim()).filter(Boolean),
      couverture: couverture.trim() || null,
    });
  };

  const erreurVisible = (champ: keyof typeof erreurs) => (tentative ? erreurs[champ] : null);

  return (
    <form className="mode-manuel" onSubmit={soumettre} noValidate>
      <div className="grille-formulaire">
        <Champ id="manuel-titre" libelle="Titre" obligatoire erreur={erreurVisible('titre')}>
          <input id="manuel-titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={500} autoFocus={!isbnInitial} />
        </Champ>

        <Champ id="manuel-auteurs" libelle="Auteurs" aide="Un auteur par ligne">
          <textarea id="manuel-auteurs" value={auteurs} onChange={(e) => setAuteurs(e.target.value)} rows={2} />
        </Champ>

        <Champ id="manuel-isbn" libelle="ISBN" aide="Facultatif (ouvrages anciens, documents internes…)" erreur={erreurVisible('isbn')}>
          <input id="manuel-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} inputMode="numeric" autoComplete="off" />
        </Champ>

        <Champ id="manuel-couverture" libelle="Image de couverture" aide="Facultatif : adresse web d’une image" erreur={erreurVisible('couverture')}>
          <input id="manuel-couverture" value={couverture} onChange={(e) => setCouverture(e.target.value)} placeholder="https://…" type="url" />
        </Champ>
      </div>

      {couverture.trim() && !erreurs.couverture && (
        <div className="apercu-couverture">
          <Couverture url={couverture.trim()} titre={titre || 'Couverture'} taille="petite" />
          <span className="aide">Aperçu de la couverture</span>
        </div>
      )}

      <button type="submit">Utiliser cette notice</button>
    </form>
  );
}

function Champ({
  id,
  libelle,
  aide,
  erreur,
  obligatoire,
  children,
}: {
  id: string;
  libelle: string;
  aide?: string;
  erreur?: string | null;
  obligatoire?: boolean;
  children: ReactElement;
}) {
  return (
    <div className={`champ${erreur ? ' champ-en-erreur' : ''}`}>
      <label htmlFor={id}>
        {libelle}
        {obligatoire && <span className="obligatoire" aria-hidden="true"> *</span>}
      </label>
      {children}
      {aide && !erreur && <span className="aide">{aide}</span>}
      {erreur && (
        <span className="erreur-champ" role="alert">
          {erreur}
        </span>
      )}
    </div>
  );
}
