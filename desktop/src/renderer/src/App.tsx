import { useEffect, useState, type ReactNode } from 'react';
import type { Livre } from '../../commun/api';
import { EcranAjout, type Scan } from './ajout/EcranAjout';
import { ParametresServeur } from './parametres/ParametresServeur';
import { EcranRecherche } from './recherche/EcranRecherche';
import { useAppairage } from './telephone/use-appairage';
import { IconeLivres, IconePlus, IconeRecherche, IconeTelephone } from './ui/icones';

type Onglet = 'recherche' | 'ajout';

export function App() {
  const [onglet, setOnglet] = useState<Onglet>('recherche');
  // Changer de livre présélectionné remonte l'écran d'ajout (état neuf).
  const [ajout, setAjout] = useState<{ livre: Livre | null; numero: number }>({ livre: null, numero: 0 });
  const [requete, setRequete] = useState<{ terme: string; numero: number } | null>(null);
  const [demandeFocus, setDemandeFocus] = useState(0);
  const [scan, setScan] = useState<Scan | null>(null);

  // La session téléphone vit à l'échelle de l'application : un scan arrive
  // même si l'utilisateur est sur la recherche, et ouvre alors l'écran d'ajout.
  const appairage = useAppairage((isbn) => {
    setScan((s) => ({ isbn, numero: (s?.numero ?? 0) + 1 }));
    setOnglet('ajout');
  });

  const ouvrirAjout = (livre: Livre | null) => {
    setAjout((a) => ({ livre, numero: a.numero + 1 }));
    setOnglet('ajout');
  };

  const voirDansRecherche = (terme: string) => {
    setRequete((r) => ({ terme, numero: (r?.numero ?? 0) + 1 }));
    setOnglet('recherche');
  };

  // Ctrl+K (ou Cmd+K) : aller à la recherche depuis n'importe quel écran.
  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOnglet('recherche');
        setDemandeFocus((n) => n + 1);
      }
    };
    window.addEventListener('keydown', raccourci);
    return () => window.removeEventListener('keydown', raccourci);
  }, []);

  return (
    <div className="app">
      <header className="barre-haut">
        <div className="barre-haut-contenu">
          <div className="marque">
            <IconeLivres width={22} height={22} />
            <span>e-biblio</span>
          </div>
          <nav className="onglets" role="tablist" aria-label="Sections">
            <Onglet actif={onglet === 'recherche'} controle="vue-recherche" onClick={() => setOnglet('recherche')}>
              <IconeRecherche /> Rechercher
            </Onglet>
            <Onglet actif={onglet === 'ajout'} controle="vue-ajout" onClick={() => setOnglet('ajout')}>
              <IconePlus /> Ajouter un livre
            </Onglet>
          </nav>
          {appairage.etat.statut === 'actif' && (
            <span className="indicateur-telephone" title="Téléphone connecté comme lecteur de codes-barres">
              <IconeTelephone /> <span className="visuellement-cache">Téléphone connecté</span>
            </span>
          )}
          <ParametresServeur />
        </div>
      </header>

      {/* Les deux écrans restent montés : changer d'onglet ne perd ni la recherche ni l'ajout en cours. */}
      <main className="contenu">
        <div id="vue-recherche" role="tabpanel" aria-label="Rechercher" hidden={onglet !== 'recherche'}>
          <EcranRecherche onAjouterExemplaire={ouvrirAjout} requeteExterne={requete} demandeFocus={demandeFocus} />
        </div>
        <div id="vue-ajout" role="tabpanel" aria-label="Ajouter un livre" hidden={onglet !== 'ajout'}>
          <EcranAjout
            key={ajout.numero}
            livrePrechoisi={ajout.livre}
            onVoirDansRecherche={voirDansRecherche}
            appairage={appairage}
            scan={scan}
          />
        </div>
      </main>
    </div>
  );
}

function Onglet({ actif, controle, onClick, children }: { actif: boolean; controle: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={actif} aria-controls={controle} className={`onglet${actif ? ' onglet-actif' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}
