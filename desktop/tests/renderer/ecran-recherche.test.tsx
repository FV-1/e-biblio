import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Exemplaire } from '../../src/commun/api';
import { echec, succes, type Resultat } from '../../src/commun/service-bibliotheque';
import { EcranRecherche } from '../../src/renderer/src/recherche/EcranRecherche';
import { useRecherche } from '../../src/renderer/src/recherche/use-recherche';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { exemplaireBienRange, exemplaireMalRange } from '../fixtures/exemplaires';
import { promesseManuelle, ServiceFake } from './service-fake';

let service: ServiceFake;

beforeEach(() => {
  service = new ServiceFake();
});

function afficher() {
  render(
    <FournisseurService service={service}>
      <EcranRecherche />
    </FournisseurService>,
  );
  return userEvent.setup();
}

async function rechercher(utilisateur: ReturnType<typeof userEvent.setup>, terme: string) {
  const champ = screen.getByRole('searchbox', { name: 'Rechercher un exemplaire' });
  await utilisateur.clear(champ);
  await utilisateur.type(champ, `${terme}{Enter}`);
}

describe('EcranRecherche', () => {
  it('affiche une invitation et ne contacte pas le service au démarrage', () => {
    afficher();
    expect(screen.getByText(/Saisissez un titre, un auteur ou un ISBN/)).toBeInTheDocument();
    expect(service.recherches).toEqual([]);
  });

  it('ne lance pas de recherche pour une saisie vide', async () => {
    const utilisateur = afficher();
    await utilisateur.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(service.recherches).toEqual([]);
  });

  it('recherche le terme saisi et affiche les exemplaires avec leur localisation complète', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange]);
    const utilisateur = afficher();

    await rechercher(utilisateur, '  1984 ');

    expect(service.recherches).toEqual(['1984']);
    expect(await screen.findByText('1 exemplaire trouvé pour « 1984 »')).toBeInTheDocument();

    const carte = screen.getByRole('article', { name: '1984' });
    expect(within(carte).getByText('George Orwell')).toBeInTheDocument();
    expect(within(carte).getByText('Jamais détecté')).toBeInTheDocument();
    expect(within(carte).getByRole('img', { name: 'Couverture de 1984' })).toHaveAttribute(
      'src',
      'https://covers.openlibrary.org/b/id/967386-L.jpg',
    );

    const chemin = within(carte).getByRole('list', { name: /Chemin/ });
    expect(within(chemin).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'ÉtageÉtage 1',
      'SalleSalle A',
      'RayonRayon Romans',
      'ÉtagèreÉtagère Romans 1',
    ]);
    expect(within(carte).getByText('Position sur le plan : x 10 · y 10')).toBeInTheDocument();
  });

  it('met en évidence un exemplaire mal rangé avec l’endroit où il a été vu', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange, exemplaireMalRange]);
    const utilisateur = afficher();

    await rechercher(utilisateur, 'romans');

    expect(await screen.findByText('2 exemplaires trouvés pour « romans »')).toBeInTheDocument();
    const carte = screen.getByRole('article', { name: 'Les Misérables' });
    expect(carte).toHaveClass('carte-mal-rangee');
    expect(within(carte).getByText('Mal rangé')).toBeInTheDocument();
    expect(within(carte).getByRole('heading', { name: /Vu ailleurs le 14 mars 2026/ })).toBeInTheDocument();
    expect(within(carte).getByRole('list', { name: /Étagère Romans 3/ })).toBeInTheDocument();
    expect(within(carte).getByText('Position sur le plan : x 30 · y 10')).toBeInTheDocument();
    // Pas de couverture : un aplat avec l'initiale la remplace.
    expect(within(carte).queryByRole('img')).not.toBeInTheDocument();
  });

  it('affiche « Bien rangé » pour un exemplaire détecté à sa place', async () => {
    const detecteALaPlace: Exemplaire = {
      ...exemplaireBienRange,
      derniereDetection: {
        emplacementId: 'etagere-1-1-1',
        localisation: exemplaireBienRange.emplacementTheorique.localisation,
        date: '2026-03-14T09:30:00.000Z',
      },
    };
    service.reponseRecherche = async () => succes([detecteALaPlace]);
    const utilisateur = afficher();

    await rechercher(utilisateur, '1984');

    expect(await screen.findByText('Bien rangé')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Vu à sa place le/ })).toBeInTheDocument();
  });

  it('indique quand aucun exemplaire ne correspond', async () => {
    const utilisateur = afficher();
    await rechercher(utilisateur, 'balzac');
    expect(await screen.findByText('Aucun exemplaire ne correspond à « balzac ».')).toBeInTheDocument();
  });

  it('affiche un état de chargement et désactive le bouton pendant la recherche', async () => {
    const { promesse, resoudre } = promesseManuelle<Resultat<Exemplaire[]>>();
    service.reponseRecherche = () => promesse;
    const utilisateur = afficher();

    await rechercher(utilisateur, 'hugo');

    expect(screen.getByRole('status')).toHaveTextContent('Recherche de « hugo » en cours…');
    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeDisabled();

    resoudre(succes([]));
    expect(await screen.findByText(/Aucun exemplaire/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeEnabled();
  });

  it.each([
    [{ type: 'serveur-injoignable', message: 'Impossible de joindre le serveur http://localhost:3000' }, 'Serveur injoignable'],
    [{ type: 'erreur-api', code: 'REQUETE_INVALIDE', message: 'q trop long' }, 'Erreur du serveur (REQUETE_INVALIDE)'],
    [{ type: 'reponse-invalide', message: 'format inattendu' }, 'Réponse inattendue du serveur'],
  ] as const)('affiche une erreur explicite (%o)', async (erreur, titre) => {
    service.reponseRecherche = async () => echec(erreur);
    const utilisateur = afficher();

    await rechercher(utilisateur, 'hugo');

    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(titre);
    expect(alerte).toHaveTextContent(erreur.message);
  });

  it('affiche une erreur si la communication avec le processus main échoue', async () => {
    service.reponseRecherche = async () => {
      throw new Error('IPC rompu');
    };
    const utilisateur = afficher();
    await rechercher(utilisateur, 'hugo');
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur inattendue de communication');
  });

  it('empêche de relancer une recherche tant que la précédente est en cours', async () => {
    const lente = promesseManuelle<Resultat<Exemplaire[]>>();
    service.reponseRecherche = () => lente.promesse;
    const utilisateur = afficher();

    await rechercher(utilisateur, 'lente');
    await rechercher(utilisateur, 'autre'); // Entrée sans effet : bouton d'envoi désactivé
    expect(service.recherches).toEqual(['lente']);
  });
});

describe('useRecherche', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FournisseurService service={service}>{children}</FournisseurService>
  );

  it('ignore la réponse tardive d’une recherche précédente', async () => {
    const lente = promesseManuelle<Resultat<Exemplaire[]>>();
    service.reponseRecherche = async (terme) => (terme === 'lente' ? lente.promesse : succes([exemplaireMalRange]));
    const { result } = renderHook(() => useRecherche(), { wrapper });

    let premiere!: Promise<void>;
    act(() => {
      premiere = result.current.rechercher('lente');
    });
    await act(() => result.current.rechercher('rapide'));
    expect(result.current.etat).toMatchObject({ statut: 'succes', terme: 'rapide' });

    await act(async () => {
      lente.resoudre(succes([exemplaireBienRange]));
      await premiere;
    });
    expect(result.current.etat).toMatchObject({ statut: 'succes', terme: 'rapide', exemplaires: [exemplaireMalRange] });
  });

  it('revient à l’état initial pour une saisie vide, même après une recherche', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange]);
    const { result } = renderHook(() => useRecherche(), { wrapper });
    await act(() => result.current.rechercher('1984'));
    await act(() => result.current.rechercher('   '));
    expect(result.current.etat).toEqual({ statut: 'initial' });
    expect(service.recherches).toEqual(['1984']);
  });
});
