import { useEffect, useState, type ReactNode } from 'react';
import type { Exemplaire, Livre } from '../../commun/api';
import { EcranAjout, type Scan } from './ajout/EcranAjout';
import { EcranBase } from './base/EcranBase';
import { ParametresServeur } from './parametres/ParametresServeur';
import { EcranPlan } from './plan/EcranPlan';
import { EcranRecherche } from './recherche/EcranRecherche';
import { useAppairage } from './telephone/use-appairage';
import { IconeBase, IconeLivres, IconePlan, IconePlus, IconeRecherche, IconeTelephone } from './ui/icones';

type Onglet = 'recherche' | 'base' | 'plan' | 'ajout';

export function App() {
  const [onglet, setOnglet] = useState<Onglet>('recherche');
  // Changer de livre présélectionné remonte l'écran d'ajout (état neuf).
  const [ajout, setAjout] = useState<{ livre: Livre | null; numero: number }>({ livre: null, numero: 0 });
  const [requete, setRequete] = useState<{ terme: string; numero: number } | null>(null);
  const [demandeFocus, setDemandeFocus] = useState(0);
  const [scan, setScan] = useState<Scan | null>(null);
  const [ciblePlan, setCiblePlan] = useState<{ exemplaire: Exemplaire; numero: number } | null>(null);

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

  const voirSurPlan = (exemplaire: Exemplaire) => {
    setCiblePlan((c) => ({ exemplaire, numero: (c?.numero ?? 0) + 1 }));
    setOnglet('plan');
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
            <Onglet actif={onglet === 'base'} controle="vue-base" onClick={() => setOnglet('base')}>
              <IconeBase /> Base de données
            </Onglet>
            <Onglet actif={onglet === 'plan'} controle="vue-plan" onClick={() => setOnglet('plan')}>
              <IconePlan /> Plan 3D
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

      {/* Les écrans restent montés : changer d'onglet ne perd ni la recherche, ni les filtres, ni l'ajout en cours. */}
      <main className={`contenu${onglet === 'base' || onglet === 'plan' ? ' contenu-large' : ''}`}>
        <div id="vue-recherche" role="tabpanel" aria-label="Rechercher" hidden={onglet !== 'recherche'}>
          <EcranRecherche onAjouterExemplaire={ouvrirAjout} onVoirSurPlan={voirSurPlan} requeteExterne={requete} demandeFocus={demandeFocus} />
        </div>
        <div id="vue-base" role="tabpanel" aria-label="Base de données" hidden={onglet !== 'base'}>
          <EcranBase onAjouterExemplaire={ouvrirAjout} actif={onglet === 'base'} />
        </div>
        <div id="vue-plan" role="tabpanel" aria-label="Plan 3D" hidden={onglet !== 'plan'}>
          <EcranPlan actif={onglet === 'plan'} cible={ciblePlan} />
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
