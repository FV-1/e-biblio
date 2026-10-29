import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exemplaire } from '../../src/commun/api';
import { echec, succes } from '../../src/commun/service-bibliotheque';
import { EcranPlan, INTERVALLE_SUIVI_MS } from '../../src/renderer/src/plan/EcranPlan';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { emplacements, exemplaireBienRange, exemplaireMalRange, localisation } from '../fixtures/exemplaires';
import { ServiceFake } from './service-fake';

// jsdom n'a pas de WebGL : la scène est remplacée par un double qui expose ce qu'elle reçoit.
vi.mock('../../src/renderer/src/plan/ScenePlan', () => ({
  ScenePlan: (p: { disposition: { etageres: unknown[] }; prevue: string | null; vue: string | null; actif: boolean }) => (
    <div data-testid="scene" data-etageres={p.disposition.etageres.length} data-prevue={p.prevue ?? ''} data-vue={p.vue ?? ''} />
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALLE_SUIVI_MS);
    });

    expect(screen.getByTestId('scene')).toHaveAttribute('data-vue', 'etagere-2-1-1');
    expect(screen.getByRole('status')).toHaveTextContent('1984 a été vu ailleurs.');
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
