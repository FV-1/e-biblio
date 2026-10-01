import { contratRepositories } from '../../contrats/repositories.contrat.js';
import { EmplacementRepositoryEnMemoire } from '../../fakes/emplacement-repository-en-memoire.js';
import { ExemplaireRepositoryEnMemoire } from '../../fakes/exemplaire-repository-en-memoire.js';
import { LivreRepositoryEnMemoire } from '../../fakes/livre-repository-en-memoire.js';

contratRepositories('fakes en mémoire', () => {
  const livres = new LivreRepositoryEnMemoire();
  return {
    emplacements: new EmplacementRepositoryEnMemoire(),
    livres,
    exemplaires: new ExemplaireRepositoryEnMemoire(livres),
  };
});
