import { contratRepositories } from '../../contrats/repositories.contrat.js';
import { EmplacementRepositoryEnMemoire } from '../../fakes/emplacement-repository-en-memoire.js';
import { ExemplaireRepositoryEnMemoire } from '../../fakes/exemplaire-repository-en-memoire.js';
import { InventaireLivresEnMemoire } from '../../fakes/inventaire-livres-en-memoire.js';
import { LivreRepositoryEnMemoire } from '../../fakes/livre-repository-en-memoire.js';

contratRepositories('fakes en mémoire', () => {
  const livres = new LivreRepositoryEnMemoire();
  const exemplaires = new ExemplaireRepositoryEnMemoire(livres);
  return {
    emplacements: new EmplacementRepositoryEnMemoire(),
    livres,
    exemplaires,
    inventaire: new InventaireLivresEnMemoire(livres, exemplaires),
  };
});
