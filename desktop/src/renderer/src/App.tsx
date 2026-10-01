import { EcranRecherche } from './recherche/EcranRecherche';

export function App() {
  return (
    <div className="app">
      <header className="entete">
        <div>
          <h1>e-biblio</h1>
          <p className="sous-titre">Recherche et localisation des exemplaires</p>
        </div>
      </header>
      <main className="contenu">
        <EcranRecherche />
      </main>
    </div>
  );
}
