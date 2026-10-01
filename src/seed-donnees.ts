import { Coordonnees } from './domain/coordonnees.js';
import { Emplacement } from './domain/emplacement.js';
import type { EmplacementRepository } from './ports/emplacement-repository.js';

/**
 * Paramètres du jeu de données initial. À ajuster quand la configuration
 * réelle de la bibliothèque sera connue : le reste du code n'en dépend pas.
 */
export const CONFIG_SEED = {
  salles: ['Salle A', 'Salle B'],
  rayonsParSalle: [
    ['Romans', 'Policiers'],
    ['Sciences', 'Histoire'],
  ],
  etageresParRayon: 3,
} as const;

/**
 * Construit la hiérarchie de démonstration, parents avant enfants.
 * Identifiants lisibles et stables (etage-1, salle-1, rayon-1-2, etagere-1-2-3)
 * pour faciliter les essais manuels (requests.http).
 *
 * Plan de l'étage (unités arbitraires) : salles côte à côte sur l'axe x,
 * rayons empilés sur l'axe y dans chaque salle, étagères alignées dans leur rayon.
 */
export function construireEmplacementsSeed(config = CONFIG_SEED): Emplacement[] {
  const etage = Emplacement.creer({ id: 'etage-1', type: 'etage', nom: 'Étage 1', parent: null });
  const resultat: Emplacement[] = [etage];

  config.salles.forEach((nomSalle, s) => {
    const xSalle = s * 50;
    const salle = Emplacement.creer({
      id: `salle-${s + 1}`,
      type: 'salle',
      nom: nomSalle,
      parent: etage,
      coordonnees: Coordonnees.creer(xSalle, 0),
    });
    resultat.push(salle);

    (config.rayonsParSalle[s] ?? []).forEach((nomRayon, r) => {
      const yRayon = 10 + r * 20;
      const rayon = Emplacement.creer({
        id: `rayon-${s + 1}-${r + 1}`,
        type: 'rayon',
        nom: `Rayon ${nomRayon}`,
        parent: salle,
        coordonnees: Coordonnees.creer(xSalle + 5, yRayon),
      });
      resultat.push(rayon);

      for (let e = 0; e < config.etageresParRayon; e++) {
        resultat.push(
          Emplacement.creer({
            id: `etagere-${s + 1}-${r + 1}-${e + 1}`,
            type: 'etagere',
            nom: `Étagère ${nomRayon} ${e + 1}`,
            parent: rayon,
            coordonnees: Coordonnees.creer(xSalle + 10 + e * 10, yRayon),
          }),
        );
      }
    });
  });

  return resultat;
}

/** Enregistre la hiérarchie via le port : fonctionne avec n'importe quel adapter. */
export async function peuplerEmplacements(repository: EmplacementRepository): Promise<Emplacement[]> {
  const emplacements = construireEmplacementsSeed();
  for (const emplacement of emplacements) {
    await repository.enregistrer(emplacement);
  }
  return emplacements;
}
