import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exemplaire } from '../../src/commun/api';
import { echec, succes, type Resultat } from '../../src/commun/service-bibliotheque';
import { EcranRecherche } from '../../src/renderer/src/recherche/EcranRecherche';
import { useRecherche } from '../../src/renderer/src/recherche/use-recherche';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { exemplaireBienRange, exemplaireMalRange, exemplaireSansIsbn } from '../fixtures/exemplaires';
import { promesseManuelle, ServiceFake } from './service-fake';

let service: ServiceFake;

beforeEach(() => {
  service = new ServiceFake();
});

/** Par défaut, recherche pendant la frappe désactivée : seules les validations (Entrée) cherchent. */
function afficher(props: Partial<Parameters<typeof EcranRecherche>[0]> = {}) {
  const resultat = render(
    <FournisseurService service={service}>
      <EcranRecherche delaiSaisie={null} {...props} />
    </FournisseurService>,
  );
  return { utilisateur: userEvent.setup(), ...resultat };
}

const champ = () => screen.getByRole('searchbox', { name: 'Rechercher un exemplaire' });

async function rechercher(utilisateur: ReturnType<typeof userEvent.setup>, terme: string) {
  await utilisateur.clear(champ());
  await utilisateur.type(champ(), `${terme}{Enter}`);
}

describe('EcranRecherche', () => {
  it('affiche une invitation et ne contacte pas le service au démarrage', () => {
    afficher();
    expect(screen.getByText(/Saisissez un titre, un auteur ou un ISBN/)).toBeInTheDocument();
    expect(service.recherches).toEqual([]);
  });

  it('ne lance pas de recherche pour une saisie vide', async () => {
    const { utilisateur } = afficher();
    await utilisateur.type(champ(), '   {Enter}');
    expect(service.recherches).toEqual([]);
  });

  it('recherche pendant la frappe, une seule fois quand la saisie se stabilise', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange]);
    render(
      <FournisseurService service={service}>
        <EcranRecherche delaiSaisie={30} />
      </FournisseurService>,
    );
    await userEvent.setup({ delay: null }).type(champ(), '1984');

    await waitFor(() => expect(service.recherches).toEqual(['1984']));
    expect(await screen.findByRole('article', { name: '1984' })).toBeInTheDocument();
  });

  it('affiche les exemplaires avec leur localisation complète', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange]);
    const { utilisateur } = afficher();

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
    const { utilisateur } = afficher();

    await rechercher(utilisateur, 'romans');

    expect(await screen.findByText('2 exemplaires trouvés pour « romans »')).toBeInTheDocument();
    const carte = screen.getByRole('article', { name: 'Les Misérables' });
    expect(carte).toHaveClass('carte-mal-rangee');
    expect(within(carte).getByText('Mal rangé')).toBeInTheDocument();
    expect(within(carte).getByRole('heading', { name: /Vu ailleurs le 14 mars 2026/ })).toBeInTheDocument();
    expect(within(carte).getByRole('list', { name: /Étagère Romans 3/ })).toBeInTheDocument();
    expect(within(carte).queryByRole('img')).not.toBeInTheDocument();
  });

  it('affiche « Sans ISBN » pour un livre qui n’en a pas', async () => {
    service.reponseRecherche = async () => succes([exemplaireSansIsbn]);
    const { utilisateur } = afficher();
    await rechercher(utilisateur, 'registre');
    expect(await screen.findByText(/Sans ISBN/)).toBeInTheDocument();
  });

  it('filtre les résultats par statut, avec le nombre d’exemplaires par statut', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange, exemplaireMalRange, exemplaireSansIsbn]);
    const { utilisateur } = afficher();
    await rechercher(utilisateur, 'e');

    const filtres = await screen.findByRole('group', { name: 'Filtrer par statut' });
    expect(within(filtres).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tous 3',
      'Mal rangés 1',
      'Jamais détectés 2',
    ]);

    await utilisateur.click(within(filtres).getByRole('button', { name: /Mal rangés/ }));
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Les Misérables']);
    expect(within(filtres).getByRole('button', { name: /Mal rangés/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('propose d’ajouter un exemplaire du livre depuis sa carte', async () => {
    const onAjouterExemplaire = vi.fn();
    service.reponseRecherche = async () => succes([exemplaireBienRange]);
    const { utilisateur } = afficher({ onAjouterExemplaire });
    await rechercher(utilisateur, '1984');

    await utilisateur.click(await screen.findByRole('button', { name: 'Ajouter un exemplaire' }));
    expect(onAjouterExemplaire).toHaveBeenCalledWith(exemplaireBienRange.livre);
  });

  it('lance une recherche demandée de l’extérieur', async () => {
    service.reponseRecherche = async () => succes([exemplaireBienRange]);
    afficher({ requeteExterne: { terme: '1984', numero: 1 } });
    expect(await screen.findByRole('article', { name: '1984' })).toBeInTheDocument();
    expect(champ()).toHaveValue('1984');
  });

  it('indique quand aucun exemplaire ne correspond', async () => {
    const { utilisateur } = afficher();
    await rechercher(utilisateur, 'balzac');
    expect(await screen.findByText('Aucun exemplaire ne correspond à « balzac ».')).toBeInTheDocument();
  });

  it('affiche un état de chargement pendant la recherche', async () => {
    const { promesse, resoudre } = promesseManuelle<Resultat<Exemplaire[]>>();
    service.reponseRecherche = () => promesse;
    const { utilisateur } = afficher();

    await rechercher(utilisateur, 'hugo');
    expect(screen.getByRole('status')).toHaveTextContent('Recherche de « hugo » en cours…');

    resoudre(succes([]));
    expect(await screen.findByText(/Aucun exemplaire/)).toBeInTheDocument();
  });

  it.each([
    [{ type: 'serveur-injoignable', message: 'Impossible de joindre le serveur http://localhost:3000' }, 'Serveur injoignable'],
    [{ type: 'erreur-api', code: 'REQUETE_INVALIDE', message: 'q trop long' }, 'Erreur du serveur (REQUETE_INVALIDE)'],
    [{ type: 'reponse-invalide', message: 'format inattendu' }, 'Réponse inattendue du serveur'],
  ] as const)('affiche une erreur explicite (%o)', async (erreur, titre) => {
    service.reponseRecherche = async () => echec(erreur);
    const { utilisateur } = afficher();

    await rechercher(utilisateur, 'hugo');

    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(titre);
    expect(alerte).toHaveTextContent(erreur.message);
  });

  it('affiche une erreur si la communication avec le processus main échoue', async () => {
    service.reponseRecherche = async () => {
      throw new Error('IPC rompu');
    };
    const { utilisateur } = afficher();
    await rechercher(utilisateur, 'hugo');
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur inattendue de communication');
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
