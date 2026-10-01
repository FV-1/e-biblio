import { Coordonnees } from '../../src/domain/coordonnees.js';
import { Emplacement } from '../../src/domain/emplacement.js';

/**
 * Petite hiérarchie de test :
 *   Étage 1 > Salle A > Rayon Romans > Étagère R1 (coord. 10,20) / Étagère R2 (sans coord.) > Niveau bas
 */
export function construireHierarchie() {
  const etage = Emplacement.creer({ id: 'etage-1', type: 'etage', nom: 'Étage 1', parent: null });
  const salle = Emplacement.creer({ id: 'salle-a', type: 'salle', nom: 'Salle A', parent: etage, coordonnees: Coordonnees.creer(0, 0) });
  const rayon = Emplacement.creer({ id: 'rayon-romans', type: 'rayon', nom: 'Rayon Romans', parent: salle, coordonnees: Coordonnees.creer(5, 5) });
  const etagere1 = Emplacement.creer({ id: 'etagere-r1', type: 'etagere', nom: 'Étagère R1', parent: rayon, coordonnees: Coordonnees.creer(10, 20) });
  const etagere2 = Emplacement.creer({ id: 'etagere-r2', type: 'etagere', nom: 'Étagère R2', parent: rayon });
  const niveau = Emplacement.creer({ id: 'niveau-bas', type: 'niveau', nom: 'Niveau bas', parent: etagere1 });

  return { etage, salle, rayon, etagere1, etagere2, niveau, tous: [etage, salle, rayon, etagere1, etagere2, niveau] };
}
