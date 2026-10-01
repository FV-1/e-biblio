import { ParametresServeur } from './parametres/ParametresServeur';
import { EcranRecherche } from './recherche/EcranRecherche';

export function App() {
  return (
    <div className="app">
      <header className="entete">
        <div>
          <h1>e-biblio</h1>
          <p className="sous-titre">Recherche et localisation des exemplaires</p>
        </div>
        <ParametresServeur />
      </header>
      <main className="contenu">
        <EcranRecherche />
      </main>
    </div>
  );
}
