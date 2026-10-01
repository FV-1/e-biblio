import { Exemplaire } from '../../../src/domain/exemplaire.js';
import { Isbn } from '../../../src/domain/isbn.js';
import { Livre } from '../../../src/domain/livre.js';
import { CatalogueExterneFake } from '../../fakes/catalogue-externe-fake.js';
import { EmplacementRepositoryEnMemoire } from '../../fakes/emplacement-repository-en-memoire.js';
import { EventPublisherEspion } from '../../fakes/event-publisher-espion.js';
import { ExemplaireRepositoryEnMemoire } from '../../fakes/exemplaire-repository-en-memoire.js';
import { GenerateurIdSequentiel } from '../../fakes/generateur-id-sequentiel.js';
import { HorlogeFixe } from '../../fakes/horloge-fixe.js';
import { InventaireLivresEnMemoire } from '../../fakes/inventaire-livres-en-memoire.js';
import { LivreRepositoryEnMemoire } from '../../fakes/livre-repository-en-memoire.js';
import { construireHierarchie } from '../../fixtures/hierarchie.js';

export const ISBN_HUGO = Isbn.creer('9780306406157');
export const ISBN_ZOLA = Isbn.creer('9780804429573');

export const hugo = Livre.creer({
  id: 'livre-hugo',
  isbn: ISBN_HUGO,
  titre: 'Les Misérables',
  auteurs: ['Victor Hugo'],
  couverture: null,
});

/**
 * Tous les ports remplacés par des fakes, pré-remplis avec la hiérarchie de test
 * (étagères R1 et R2 dans le rayon Romans) et le livre « Les Misérables ».
 */
export function creerContexte() {
  const hierarchie = construireHierarchie();
  const livres = new LivreRepositoryEnMemoire([hugo]);
  const exemplaires = new ExemplaireRepositoryEnMemoire(livres);
  return {
    hierarchie,
    emplacements: new EmplacementRepositoryEnMemoire(hierarchie.tous),
    livres,
    exemplaires,
    inventaire: new InventaireLivresEnMemoire(livres, exemplaires),
    catalogue: new CatalogueExterneFake(),
    publisher: new EventPublisherEspion(),
    horloge: new HorlogeFixe(),
    generateurId: new GenerateurIdSequentiel('gen'),
  };
}

export type Contexte = ReturnType<typeof creerContexte>;

/** Ajoute directement un exemplaire de « Les Misérables » rangé sur l'étagère R1. */
export async function ajouterExemplaireHugo(ctx: Contexte, id = 'ex-hugo'): Promise<Exemplaire> {
  const exemplaire = Exemplaire.creer({ id, livre: hugo, emplacement: ctx.hierarchie.etagere1 });
  await ctx.exemplaires.enregistrer(exemplaire);
  return exemplaire;
}
