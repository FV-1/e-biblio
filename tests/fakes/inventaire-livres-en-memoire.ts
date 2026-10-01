import { cleTriAuteur, cleTriTitre, type Livre } from '../../src/domain/livre.js';
import type { CriteresLivres, InventaireLivres, LigneInventaire, PageInventaire } from '../../src/ports/inventaire-livres.js';
import type { ExemplaireRepositoryEnMemoire } from './exemplaire-repository-en-memoire.js';
import type { LivreRepositoryEnMemoire } from './livre-repository-en-memoire.js';

const comparer = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Modèle de lecture en mémoire, construit directement sur les règles du domaine
 * (Livre.correspond, Exemplaire.estMalRange, clés de tri). Les tests de contrat
 * vérifient que l'implémentation SQLite donne exactement les mêmes résultats.
 */
export class InventaireLivresEnMemoire implements InventaireLivres {
  constructor(
    private readonly livres: LivreRepositoryEnMemoire,
    private readonly exemplaires: ExemplaireRepositoryEnMemoire,
  ) {}

  async lister(c: CriteresLivres): Promise<PageInventaire> {
    const exemplaires = this.exemplaires.tous();
    const lignes: LigneInventaire[] = this.livres
      .tous()
      .filter((l) => !c.terme || l.correspond(c.terme))
      .filter((l) => c.avecIsbn === undefined || (l.isbn !== null) === c.avecIsbn)
      .filter((l) => c.avecCouverture === undefined || (l.couverture !== null) === c.avecCouverture)
      .map((livre) => {
        const siens = exemplaires.filter((e) => e.livreId === livre.id);
        return { livre, nombreExemplaires: siens.length, nombreMalRanges: siens.filter((e) => e.estMalRange()).length };
      });

    const sens = c.ordre === 'desc' ? -1 : 1;
    const departage = (a: LigneInventaire, b: LigneInventaire) =>
      comparer(cleTriTitre(a.livre), cleTriTitre(b.livre)) || comparer(a.livre.id, b.livre.id);
    const sansAuteur = (l: Livre) => (cleTriAuteur(l) === '' ? 1 : 0);

    lignes.sort((a, b) => {
      switch (c.tri) {
        case 'titre':
          return sens * comparer(cleTriTitre(a.livre), cleTriTitre(b.livre)) || comparer(a.livre.id, b.livre.id);
        case 'auteur':
          return (
            sansAuteur(a.livre) - sansAuteur(b.livre) ||
            sens * comparer(cleTriAuteur(a.livre), cleTriAuteur(b.livre)) ||
            departage(a, b)
          );
        case 'exemplaires':
          return sens * comparer(a.nombreExemplaires, b.nombreExemplaires) || departage(a, b);
        case 'malRanges':
          return sens * comparer(a.nombreMalRanges, b.nombreMalRanges) || departage(a, b);
      }
    });

    const debut = (c.page - 1) * c.parPage;
    return { total: lignes.length, lignes: lignes.slice(debut, debut + c.parPage) };
  }
}
