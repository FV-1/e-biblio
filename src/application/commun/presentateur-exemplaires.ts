import type { Exemplaire } from '../../domain/exemplaire.js';
import type { Livre } from '../../domain/livre.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { Localisateur } from './localisateur.js';
import { vueLivre, type VueExemplaire } from './vues.js';

/**
 * Assemble la vue complète d'exemplaires : notice du livre, localisation
 * théorique et constatée, statut « mal rangé ». Partagé par tous les cas
 * d'usage qui renvoient des exemplaires.
 */
export class PresentateurExemplaires {
  constructor(
    private readonly livres: LivreRepository,
    private readonly emplacements: EmplacementRepository,
  ) {}

  async presenter(exemplaire: Exemplaire): Promise<VueExemplaire> {
    const [vue] = await this.presenterTous([exemplaire]);
    return vue!;
  }

  async presenterTous(exemplaires: readonly Exemplaire[]): Promise<VueExemplaire[]> {
    const localisateur = new Localisateur(this.emplacements);
    const livres = new Map<string, Livre>();
    const vues: VueExemplaire[] = [];

    for (const exemplaire of exemplaires) {
      const livre = livres.get(exemplaire.isbn.valeur) ?? (await this.chargerLivre(exemplaire));
      livres.set(livre.isbn.valeur, livre);

      const detection = exemplaire.derniereDetection;
      vues.push({
        id: exemplaire.id,
        isbn: exemplaire.isbn.valeur,
        livre: vueLivre(livre),
        emplacementTheorique: {
          emplacementId: exemplaire.emplacementId,
          localisation: await localisateur.localiser(exemplaire.emplacementId),
        },
        derniereDetection: detection
          ? {
              emplacementId: detection.emplacementId,
              localisation: await localisateur.localiser(detection.emplacementId),
              date: detection.date,
            }
          : null,
        malRange: exemplaire.estMalRange(),
      });
    }
    return vues;
  }

  private async chargerLivre(exemplaire: Exemplaire): Promise<Livre> {
    const livre = await this.livres.trouverParIsbn(exemplaire.isbn);
    if (!livre) throw new Error(`Livre ${exemplaire.isbn.valeur} absent pour l'exemplaire « ${exemplaire.id} »`);
    return livre;
  }
}
