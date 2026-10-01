import { useEffect, useId, useMemo, useState } from 'react';
import type { Emplacement } from '../../../commun/api';
import { libelleType } from '../recherche/format';
import { cheminVers, completerSelection, enfantsDe, TYPE_RANGEMENT } from './arbre-emplacements';

interface Props {
  readonly emplacements: readonly Emplacement[];
  /** Étagère choisie au départ (ex. la dernière utilisée), ou null. */
  readonly etagereInitiale: string | null;
  readonly onChange: (etagereId: string | null) => void;
}

/**
 * Choix d'une étagère par listes en cascade (étage › salle › rayon › étagère).
 * Les niveaux n'ayant qu'une option sont sélectionnés automatiquement.
 */
export function SelecteurEtagere({ emplacements, etagereInitiale, onChange }: Props) {
  const idBase = useId();
  const [selection, setSelection] = useState<string[]>(() => {
    const initiale = etagereInitiale ? cheminVers(emplacements, etagereInitiale).map((e) => e.id) : [];
    return completerSelection(emplacements, initiale);
  });

  const niveaux = useMemo(() => {
    const liste: { options: Emplacement[]; valeur: string }[] = [];
    let parent: string | null = null;
    for (let i = 0; ; i++) {
      const options = enfantsDe(emplacements, parent);
      if (options.length === 0) break;
      const valeur = selection[i] ?? '';
      liste.push({ options, valeur });
      const choisi = options.find((o) => o.id === valeur);
      if (!choisi || choisi.type === TYPE_RANGEMENT) break;
      parent = choisi.id;
    }
    return liste;
  }, [emplacements, selection]);

  const etagereDe = (sel: readonly string[]) => {
    const feuille = emplacements.find((e) => e.id === sel.at(-1));
    return feuille?.type === TYPE_RANGEMENT ? feuille.id : null;
  };

  // La sélection initiale (dernière étagère, ou complétion automatique) est signalée au parent.
  useEffect(() => {
    onChange(etagereDe(selection));
  }, []);

  const choisir = (niveau: number, id: string) => {
    const nouvelle = completerSelection(emplacements, [...selection.slice(0, niveau), ...(id ? [id] : [])]);
    setSelection(nouvelle);
    onChange(etagereDe(nouvelle));
  };

  if (niveaux.length === 0) {
    return <p className="message">Aucun emplacement n’est défini sur le serveur.</p>;
  }

  return (
    <div className="selecteur-etagere">
      {niveaux.map(({ options, valeur }, i) => {
        const type = options[0]!.type;
        const id = `${idBase}-${i}`;
        return (
          <div key={id} className="champ">
            <label htmlFor={id}>{libelleType(type)}</label>
            <select id={id} value={valeur} onChange={(e) => choisir(i, e.target.value)} disabled={options.length === 1}>
              {options.length > 1 && <option value="">Choisir…</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
