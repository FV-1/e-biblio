import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Exemplaire } from '../../src/commun/api';
import { VueEtagere } from '../../src/renderer/src/plan/VueEtagere';
import { exemplaireBienRange, exemplaireMalRange, exemplaireSansIsbn } from '../fixtures/exemplaires';

const noms: Record<string, string> = { 'etagere-1-1-1': 'Étagère Romans 1', 'etagere-1-1-3': 'Étagère Romans 3' };

function afficher(etagereId: string, contenu: readonly Exemplaire[] | null, onSuivre = vi.fn()) {
  render(
    <VueEtagere
      etagere={{ id: etagereId, nom: noms[etagereId]!, chemin: 'Étage 1 › Salle A › Rayon Romans' }}
      contenu={contenu}
      suivi={null}
      nomEtagere={(id) => noms[id] ?? id}
      onSuivre={onSuivre}
      onFermer={vi.fn()}
    />,
  );
  return { u: userEvent.setup(), onSuivre };
}

describe('VueEtagere', () => {
  it('fait le bilan de l’étagère : exemplaires, intrus, absents', () => {
    afficher('etagere-1-1-1', [exemplaireBienRange, exemplaireMalRange, exemplaireSansIsbn]);
    expect(screen.getByText('3 exemplaires')).toBeInTheDocument();
    expect(screen.getByText('1 absent')).toBeInTheDocument();
  });

  it('décrit chaque tranche pour un lecteur d’écran, avec son statut sur CETTE étagère', () => {
    afficher('etagere-1-1-1', [exemplaireBienRange, exemplaireMalRange]);
    expect(screen.getByRole('button', { name: '1984, exemplaire n°1 : à sa place, jamais scanné' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Les Misérables, exemplaire n°1 : absent, vu sur Étagère Romans 3 le/ })).toBeInTheDocument();
  });

  it('signale un intrus et l’étagère où le ranger', () => {
    afficher('etagere-1-1-3', [exemplaireMalRange]);
    expect(screen.getByText('1 intrus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Les Misérables, exemplaire n°1 : intrus, à ranger sur Étagère Romans 1' })).toBeInTheDocument();
  });

  it('ouvre la fiche d’un livre au clic sur sa tranche, et permet de le suivre sur le plan', async () => {
    const { u, onSuivre } = afficher('etagere-1-1-3', [exemplaireMalRange]);
    await u.click(screen.getByRole('button', { name: /^Les Misérables/ }));
    expect(screen.getByRole('heading', { name: 'Les Misérables' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Suivre sur le plan' }));
    expect(onSuivre).toHaveBeenCalledWith(exemplaireMalRange);
  });

  it('range les livres sur des planches nommées, de haut en bas', () => {
    afficher('etagere-1-1-1', [exemplaireBienRange]);
    expect(screen.getByRole('list', { name: 'Planche 1 (en haut)' })).toHaveTextContent('1984');
  });

  it('indique le chargement du contenu', () => {
    afficher('etagere-1-1-1', null);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du contenu…');
  });

  it('indique une étagère vide', () => {
    afficher('etagere-1-1-1', []);
    expect(screen.getByText(/Aucun exemplaire n’est rangé/)).toBeInTheDocument();
  });
});
