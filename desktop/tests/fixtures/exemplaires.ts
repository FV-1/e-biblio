import type { Emplacement, Exemplaire, Localisation } from '../../src/commun/api';

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
  livreId: 'livre-1984',
  numero: 1,
  isbn: '9782070368228',
  livre: {
    id: 'livre-1984',
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
  livreId: 'livre-hugo',
  numero: 1,
  isbn: '9780306406157',
  livre: { id: 'livre-hugo', isbn: '9780306406157', titre: 'Les Misérables', auteurs: ['Victor Hugo'], couverture: null },
  emplacementTheorique: { emplacementId: 'etagere-1-1-1', localisation: localisation('etagere-1-1-1', 'Étagère Romans 1', { x: 10, y: 10 }) },
  derniereDetection: {
    emplacementId: 'etagere-1-1-3',
    localisation: localisation('etagere-1-1-3', 'Étagère Romans 3', { x: 30, y: 10 }),
    date: '2026-03-14T09:30:00.000Z',
  },
  malRange: true,
};

export const exemplaireSansIsbn: Exemplaire = {
  id: 'ex-3',
  livreId: 'livre-registre',
  numero: 1,
  isbn: null,
  livre: { id: 'livre-registre', isbn: null, titre: 'Registre paroissial 1789', auteurs: [], couverture: null },
  emplacementTheorique: { emplacementId: 'etagere-1-1-1', localisation: localisation('etagere-1-1-1', 'Étagère Romans 1', { x: 10, y: 10 }) },
  derniereDetection: null,
  malRange: false,
};

/** Petite hiérarchie : 1 étage, 2 salles, 2 rayons, 3 étagères. */
export const emplacements: Emplacement[] = [
  { id: 'etage-1', type: 'etage', nom: 'Étage 1', parentId: null, coordonnees: null },
  { id: 'salle-1', type: 'salle', nom: 'Salle A', parentId: 'etage-1', coordonnees: { x: 0, y: 0 } },
  { id: 'salle-2', type: 'salle', nom: 'Salle B', parentId: 'etage-1', coordonnees: { x: 50, y: 0 } },
  { id: 'rayon-1-1', type: 'rayon', nom: 'Rayon Romans', parentId: 'salle-1', coordonnees: null },
  { id: 'rayon-2-1', type: 'rayon', nom: 'Rayon Sciences', parentId: 'salle-2', coordonnees: null },
  { id: 'etagere-1-1-1', type: 'etagere', nom: 'Étagère Romans 1', parentId: 'rayon-1-1', coordonnees: { x: 10, y: 10 } },
  { id: 'etagere-1-1-2', type: 'etagere', nom: 'Étagère Romans 2', parentId: 'rayon-1-1', coordonnees: { x: 20, y: 10 } },
  { id: 'etagere-2-1-1', type: 'etagere', nom: 'Étagère Sciences 1', parentId: 'rayon-2-1', coordonnees: { x: 60, y: 10 } },
];
