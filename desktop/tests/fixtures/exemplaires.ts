import type { Exemplaire, Localisation } from '../../src/commun/api';

/** Données conformes au contrat de l'API, partagées par les tests main et renderer. */

export function localisation(etagere: string, nom: string, coordonnees: Localisation['coordonnees']): Localisation {
  const chemin = [
    { id: 'etage-1', type: 'etage', nom: 'Étage 1' },
    { id: 'salle-1', type: 'salle', nom: 'Salle A' },
    { id: 'rayon-1-1', type: 'rayon', nom: 'Rayon Romans' },
    { id: etagere, type: 'etagere', nom },
  ];
  return { chemin, libelle: chemin.map((e) => e.nom).join(' > '), coordonnees };
}

export const exemplaireBienRange: Exemplaire = {
  id: 'ex-1',
  isbn: '9782070368228',
  livre: {
    isbn: '9782070368228',
    titre: '1984',
    auteurs: ['George Orwell'],
    couverture: 'https://covers.openlibrary.org/b/id/967386-L.jpg',
  },
  emplacementTheorique: { emplacementId: 'etagere-1-1-1', localisation: localisation('etagere-1-1-1', 'Étagère Romans 1', { x: 10, y: 10 }) },
  derniereDetection: null,
  malRange: false,
};

export const exemplaireMalRange: Exemplaire = {
  id: 'ex-2',
  isbn: '9780306406157',
  livre: { isbn: '9780306406157', titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: null },
  emplacementTheorique: { emplacementId: 'etagere-1-1-1', localisation: localisation('etagere-1-1-1', 'Étagère Romans 1', { x: 10, y: 10 }) },
  derniereDetection: {
    emplacementId: 'etagere-1-1-3',
    localisation: localisation('etagere-1-1-3', 'Étagère Romans 3', { x: 30, y: 10 }),
    date: '2026-03-14T09:30:00.000Z',
  },
  malRange: true,
};
