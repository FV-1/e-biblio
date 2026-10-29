import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { succes } from '../../src/commun/service-bibliotheque';
import { App } from '../../src/renderer/src/App';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { emplacements, exemplaireBienRange } from '../fixtures/exemplaires';
import { ServiceFake } from './service-fake';

// jsdom n'a pas de WebGL : la scène 3D est remplacée par un double.
vi.mock('../../src/renderer/src/plan/ScenePlan', () => ({
  ScenePlan: (p: { prevue: string | null }) => <div data-testid="scene" data-prevue={p.prevue ?? ''} />,
}));

let service: ServiceFake;

beforeEach(() => {
  localStorage.clear();
  service = new ServiceFake();
  service.reponseRecherche = async () => succes([exemplaireBienRange]);
  service.reponseEmplacements = async () => succes(emplacements);
});

function afficher() {
  render(
    <FournisseurService service={service}>
      <App />
    </FournisseurService>,
  );
  return userEvent.setup();
}

const onglet = (nom: RegExp) => screen.getByRole('tab', { name: nom });

describe('App', () => {
  it('s’ouvre sur la recherche', () => {
    afficher();
    expect(onglet(/Rechercher/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Rechercher' })).toBeVisible();
  });

  it('depuis une carte, ouvre le plan 3D centré sur l’exemplaire', async () => {
    const u = afficher();
    await u.type(screen.getByRole('searchbox'), '1984{Enter}');
    await u.click(await screen.findByRole('button', { name: 'Voir sur le plan' }));

    expect(onglet(/Plan 3D/)).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('scene')).toHaveAttribute('data-prevue', 'etagere-1-1-1');
    expect(screen.getByRole('region', { name: 'Exemplaire sélectionné' })).toHaveTextContent('1984');
  });

  it('depuis une carte, ouvre l’ajout avec le livre présélectionné', async () => {
    const u = afficher();
    await u.type(screen.getByRole('searchbox'), '1984{Enter}');
    await u.click(await screen.findByRole('button', { name: 'Ajouter un exemplaire' }));

    expect(onglet(/Ajouter un livre/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('article', { name: 'Livre choisi : 1984' })).toHaveTextContent('Nouvel exemplaire');
  });

  it('conserve la recherche en cours quand on change d’onglet', async () => {
    const u = afficher();
    await u.type(screen.getByRole('searchbox'), '1984{Enter}');
    await screen.findByRole('article', { name: '1984' });

    await u.click(onglet(/Ajouter un livre/));
    await u.click(onglet(/Rechercher/));
    expect(screen.getByRole('searchbox')).toHaveValue('1984');
    expect(screen.getByRole('article', { name: '1984' })).toBeVisible();
    expect(service.recherches).toEqual(['1984']);
  });

  it('Ctrl+K ramène à la recherche et place le curseur dans le champ', async () => {
    const u = afficher();
    await u.click(onglet(/Ajouter un livre/));
    await u.keyboard('{Control>}k{/Control}');
    expect(onglet(/Rechercher/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});
