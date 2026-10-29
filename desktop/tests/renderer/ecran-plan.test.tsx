import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exemplaire } from '../../src/commun/api';
import { echec, succes } from '../../src/commun/service-bibliotheque';
import { EcranPlan, INTERVALLE_SUIVI_MS } from '../../src/renderer/src/plan/EcranPlan';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { emplacements, exemplaireBienRange, exemplaireMalRange, localisation } from '../fixtures/exemplaires';
import { ServiceFake } from './service-fake';

interface ProprietesScene {
  disposition: { etageres: unknown[] };
  contenus: ReadonlyMap<string, readonly unknown[]>;
  prevue: string | null;
  vue: string | null;
  ouverte: string | null;
  commande: { type: string } | null;
  onOuvrirEtagere: (id: string) => void;
}

// jsdom n'a pas de WebGL : la scène est remplacée par un double qui expose ce qu'elle reçoit.
vi.mock('../../src/renderer/src/plan/ScenePlan', () => ({
  ScenePlan: (p: ProprietesScene) => (
    <div
      data-testid="scene"
      data-etageres={p.disposition.etageres.length}
      data-livres={[...p.contenus.values()].flat().length}
      data-prevue={p.prevue ?? ''}
      data-vue={p.vue ?? ''}
      data-ouverte={p.ouverte ?? ''}
      data-commande={p.commande?.type ?? ''}
    >
      <button type="button" onClick={() => p.onOuvrirEtagere('etagere-1-1-1')}>
        clic sur Étagère Romans 1
      </button>
    </div>
  ),
}));

let service: ServiceFake;

beforeEach(() => {
  service = new ServiceFake();
  service.reponseEmplacements = async () => succes(emplacements);
  service.reponseRecherche = async () => succes([exemplaireBienRange, exemplaireMalRange]);
});

afterEach(() => vi.useRealTimers());

function afficher(props: Parameters<typeof EcranPlan>[0] = { actif: true }) {
  const vue = render(
    <FournisseurService service={service}>
      <EcranPlan {...props} />
    </FournisseurService>,
  );
  return { u: userEvent.setup(), ...vue };
}

/** Étagère Romans 1 contient « 1984 » (à sa place) et « Les Misérables » (vu sur Romans 3). */
const contenuRomans1 = async (id: string) => succes(id === 'etagere-1-1-1' ? [exemplaireBienRange, exemplaireMalRange] : []);

describe('EcranPlan', () => {
  it('ne charge rien tant que l’onglet est caché', () => {
    let appels = 0;
    service.reponseEmplacements = async () => (appels++, succes(emplacements));
    afficher({ actif: false });
    expect(appels).toBe(0);
  });

  it('dessine les étagères des emplacements de l’API', async () => {
    afficher();
    expect(await screen.findByTestId('scene')).toHaveAttribute('data-etageres', '3');
  });

  it('charge le contenu de chaque étagère pour dessiner les livres', async () => {
    service.reponseExemplairesDeLEmplacement = contenuRomans1;
    afficher();
    await vi.waitFor(() => expect(screen.getByTestId('scene')).toHaveAttribute('data-livres', '2'));
    expect([...service.etageresDemandees].sort()).toEqual(['etagere-1-1-1', 'etagere-1-1-2', 'etagere-2-1-1']);
  });

  it('montre la place prévue et le lieu de détection d’un exemplaire mal rangé', async () => {
    const { u } = afficher();
    await u.type(await screen.findByLabelText('Livre à localiser'), 'hugo{Enter}');
    await u.click(await screen.findByRole('button', { name: /Les Misérables/ }));

    const scene = screen.getByTestId('scene');
    expect(scene).toHaveAttribute('data-prevue', 'etagere-1-1-1');
    expect(scene).toHaveAttribute('data-vue', 'etagere-1-1-3');
    expect(screen.getByRole('region', { name: 'Exemplaire sélectionné' })).toHaveTextContent(/Vu ailleurs le/);
  });

  it('ne marque aucun lieu de détection pour un exemplaire bien rangé', async () => {
    const { u } = afficher();
    await u.type(await screen.findByLabelText('Livre à localiser'), '1984{Enter}');
    await u.click(await screen.findByRole('button', { name: /1984/ }));

    expect(screen.getByTestId('scene')).toHaveAttribute('data-prevue', 'etagere-1-1-1');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-vue', '');
  });

  it('sélectionne directement l’exemplaire envoyé depuis la recherche', async () => {
    afficher({ actif: true, cible: { exemplaire: exemplaireMalRange, numero: 1 } });
    expect(await screen.findByTestId('scene')).toHaveAttribute('data-vue', 'etagere-1-1-3');
  });

  it('ouvre la vue « étagère » au clic sur un meuble, et la ferme avec Échap', async () => {
    service.reponseExemplairesDeLEmplacement = contenuRomans1;
    const { u } = afficher();
    await u.click(await screen.findByRole('button', { name: 'clic sur Étagère Romans 1' }));

    const vue = await screen.findByRole('region', { name: 'Étagère Étagère Romans 1' });
    expect(vue).toHaveTextContent('Étage 1 › Salle A › Rayon Romans');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-ouverte', 'etagere-1-1-1');

    await u.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Étagère Étagère Romans 1' })).not.toBeInTheDocument();
  });

  it('« Suivre sur le plan » depuis la vue étagère sélectionne l’exemplaire et referme la vue', async () => {
    service.reponseExemplairesDeLEmplacement = contenuRomans1;
    const { u } = afficher();
    await u.click(await screen.findByRole('button', { name: 'clic sur Étagère Romans 1' }));
    await u.click(await screen.findByRole('button', { name: /^Les Misérables, exemplaire n°1/ }));
    await u.click(screen.getByRole('button', { name: 'Suivre sur le plan' }));

    expect(screen.getByTestId('scene')).toHaveAttribute('data-vue', 'etagere-1-1-3');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-ouverte', '');
  });

  it('liste les mal rangés trouvés sur les étagères, pour y aller en un clic', async () => {
    service.reponseExemplairesDeLEmplacement = contenuRomans1;
    const { u } = afficher();
    await u.click(await screen.findByText('Mal rangés'));
    await u.click(screen.getByRole('button', { name: /Les Misérables/ }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-prevue', 'etagere-1-1-1');
  });

  it('envoie les commandes de la barre de navigation à la caméra', async () => {
    const { u } = afficher();
    await screen.findByTestId('scene');
    expect(screen.getByRole('button', { name: 'Centrer sur le livre' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Vue de dessus' }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-commande', 'dessus');
    await u.click(screen.getByRole('button', { name: 'Salle B' }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-commande', 'salle');
  });

  it('suit l’exemplaire : sa nouvelle position s’affiche après un scan', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    afficher({ actif: true, cible: { exemplaire: exemplaireBienRange, numero: 1 } });
    expect(await screen.findByTestId('scene')).toHaveAttribute('data-vue', '');

    const deplace: Exemplaire = {
      ...exemplaireBienRange,
      derniereDetection: {
        emplacementId: 'etagere-2-1-1',
        localisation: localisation('etagere-2-1-1', 'Étagère Sciences 1', { x: 60, y: 10 }),
        date: '2026-10-29T10:00:00.000Z',
      },
      malRange: true,
    };
    service.reponseExemplairesDuLivre = async () => succes([deplace]);
    await vi.waitFor(() => expect(service.etageresDemandees).toHaveLength(3)); // chargement initial terminé
    const avant = service.etageresDemandees.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALLE_SUIVI_MS);
    });

    expect(screen.getByTestId('scene')).toHaveAttribute('data-vue', 'etagere-2-1-1');
    expect(screen.getByRole('status')).toHaveTextContent('1984 a été vu ailleurs.');
    // Les étagères concernées sont rechargées : la place prévue et le nouveau lieu.
    expect(service.etageresDemandees.slice(avant).sort()).toEqual(['etagere-1-1-1', 'etagere-2-1-1']);
  });

  it('propose de réessayer si le plan ne se charge pas', async () => {
    service.reponseEmplacements = async () => echec({ type: 'serveur-injoignable', message: 'Serveur injoignable' });
    const { u } = afficher();
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur injoignable');

    service.reponseEmplacements = async () => succes(emplacements);
    await u.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('scene')).toBeInTheDocument();
  });
});
