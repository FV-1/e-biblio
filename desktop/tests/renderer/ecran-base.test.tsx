import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CriteresLivres, LigneLivre } from '../../src/commun/api';
import { echec, succes } from '../../src/commun/service-bibliotheque';
import { EcranBase, numerosAffiches } from '../../src/renderer/src/base/EcranBase';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { exemplaireBienRange, exemplaireMalRange } from '../fixtures/exemplaires';
import { ServiceFake } from './service-fake';

const oeuvres: LigneLivre[] = [
  { ...exemplaireBienRange.livre, nombreExemplaires: 2, nombreMalRanges: 0 },
  { ...exemplaireMalRange.livre, nombreExemplaires: 1, nombreMalRanges: 1 },
  { id: 'livre-registre', isbn: null, titre: 'Registre paroissial', auteurs: [], couverture: null, nombreExemplaires: 0, nombreMalRanges: 0 },
];

let service: ServiceFake;

beforeEach(() => {
  service = new ServiceFake();
  // Faux serveur : 3 œuvres sur la page demandée, 120 au total (5 pages de 25).
  service.reponseLivres = async (c) =>
    succes({ livres: oeuvres, total: 120, page: c.page, parPage: c.parPage, pages: Math.ceil(120 / c.parPage) });
  service.reponseExemplairesDuLivre = async (id) => succes(id === 'livre-1984' ? [exemplaireBienRange] : []);
});

function afficher(props: Partial<Parameters<typeof EcranBase>[0]> = {}) {
  const resultat = render(
    <FournisseurService service={service}>
      <EcranBase delaiSaisie={0} {...props} />
    </FournisseurService>,
  );
  return { u: userEvent.setup(), ...resultat };
}

const derniersCriteres = (): CriteresLivres => service.listesDemandees.at(-1)!;
const lignes = () => screen.getAllByRole('row').slice(1); // sans l'en-tête
const entete = (nom: string) => screen.getByRole('columnheader', { name: new RegExp(nom) });

describe('EcranBase', () => {
  it('charge la première page triée par titre et affiche une ligne par œuvre', async () => {
    afficher();
    expect(await screen.findByText('1984')).toBeInTheDocument();
    expect(service.listesDemandees).toEqual([{ tri: 'titre', ordre: 'asc', page: 1, parPage: 25 }]);
    expect(screen.getByRole('status')).toHaveTextContent('120 œuvres dans la bibliothèque');

    expect(lignes().map((l) => within(l).getAllByRole('cell').slice(2).map((c) => c.textContent))).toEqual([
      ['1984', 'George Orwell', '9782070368228', '2', '0'],
      ['Les Misérables', 'Victor Hugo', '9780306406157', '1', '1'],
      ['Registre paroissial', '—', 'Sans ISBN', '0', '0'],
    ]);
    expect(entete('Titre')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('filtre par texte pendant la frappe, en revenant à la page 1', async () => {
    const { u } = afficher();
    await screen.findByText('1984');
    await u.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(derniersCriteres().page).toBe(2);
    await u.type(screen.getByRole('searchbox', { name: 'Rechercher une œuvre' }), 'zola');

    await waitFor(() => expect(derniersCriteres()).toMatchObject({ terme: 'zola', page: 1 }));
    expect(await screen.findByText('120 œuvres correspondant aux filtres')).toBeInTheDocument();
  });

  it('filtre par présence d’ISBN et de couverture', async () => {
    const { u } = afficher();
    await screen.findByText('1984');
    await u.selectOptions(screen.getByLabelText('ISBN'), 'Sans ISBN');
    expect(derniersCriteres()).toMatchObject({ isbn: 'sans', page: 1 });
    await u.selectOptions(screen.getByLabelText('Couverture'), 'Avec couverture');
    expect(derniersCriteres()).toMatchObject({ isbn: 'sans', couverture: 'avec' });

    await u.selectOptions(screen.getByLabelText('ISBN'), 'Tous');
    expect(derniersCriteres()).not.toHaveProperty('isbn');
  });

  it('efface tous les filtres d’un clic', async () => {
    const { u } = afficher();
    await screen.findByText('1984');
    await u.selectOptions(screen.getByLabelText('ISBN'), 'Avec ISBN');
    await u.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(derniersCriteres()).toEqual({ tri: 'titre', ordre: 'asc', page: 1, parPage: 25 });
    expect(screen.queryByRole('button', { name: 'Effacer les filtres' })).not.toBeInTheDocument();
  });

  it('trie en cliquant sur les en-têtes ; un second clic inverse le sens', async () => {
    const { u } = afficher();
    await screen.findByText('1984');

    await u.click(within(entete('Titre')).getByRole('button'));
    expect(derniersCriteres()).toMatchObject({ tri: 'titre', ordre: 'desc' });
    expect(entete('Titre')).toHaveAttribute('aria-sort', 'descending');

    await u.click(within(entete('Exemplaires')).getByRole('button'));
    expect(derniersCriteres()).toMatchObject({ tri: 'exemplaires', ordre: 'desc', page: 1 });
    expect(entete('Titre')).toHaveAttribute('aria-sort', 'none');

    await u.click(within(entete('Auteurs')).getByRole('button'));
    expect(derniersCriteres()).toMatchObject({ tri: 'auteur', ordre: 'asc' });
  });

  it('pagine : suivant, précédent, numéro de page et taille de page', async () => {
    const { u } = afficher();
    await screen.findByText('1984');
    const pagination = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pagination).getByText('1–25 sur 120')).toBeInTheDocument();
    expect(within(pagination).getByRole('button', { name: 'Précédent' })).toBeDisabled();

    await u.click(within(pagination).getByRole('button', { name: 'Suivant' }));
    expect(derniersCriteres().page).toBe(2);
    expect(await within(pagination).findByText('26–50 sur 120')).toBeInTheDocument();

    await u.click(within(pagination).getByRole('button', { name: 'Page 5' }));
    expect(derniersCriteres().page).toBe(5);
    expect(await within(pagination).findByRole('button', { name: 'Suivant' })).toBeDisabled();

    await u.selectOptions(within(pagination).getByLabelText('Par page'), '50');
    expect(derniersCriteres()).toMatchObject({ page: 1, parPage: 50 });
  });

  it('déplie une œuvre pour afficher ses exemplaires et leur localisation', async () => {
    const onAjouterExemplaire = vi.fn();
    const { u } = afficher({ onAjouterExemplaire });
    await screen.findByText('1984');

    const deplier = screen.getByRole('button', { name: 'Déplier les exemplaires de 1984' });
    await u.click(deplier);

    expect(service.exemplairesDemandes).toEqual(['livre-1984']);
    const liste = await screen.findByRole('list', { name: 'Exemplaires de 1984' });
    expect(within(liste).getByText('ex-1')).toBeInTheDocument();
    expect(within(liste).getByText('Jamais détecté')).toBeInTheDocument();
    expect(within(liste).getByRole('list', { name: /Étagère Romans 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replier les exemplaires de 1984' })).toHaveAttribute('aria-expanded', 'true');

    await u.click(screen.getByRole('button', { name: 'Ajouter un exemplaire' }));
    expect(onAjouterExemplaire).toHaveBeenCalledWith(exemplaireBienRange.livre);

    await u.click(screen.getByRole('button', { name: 'Replier les exemplaires de 1984' }));
    expect(screen.queryByRole('list', { name: 'Exemplaires de 1984' })).not.toBeInTheDocument();
  });

  it('un clic sur la ligne la déplie aussi ; une œuvre sans exemplaire le signale', async () => {
    const { u } = afficher();
    await u.click(await screen.findByText('Registre paroissial'));
    expect(await screen.findByText('Aucun exemplaire : cette œuvre n’est rangée nulle part.')).toBeInTheDocument();
  });

  it('affiche un message adapté quand aucune œuvre ne correspond', async () => {
    service.reponseLivres = async (c) => succes({ livres: [], total: 0, page: 1, parPage: c.parPage, pages: 1 });
    const { u } = afficher();
    expect(await screen.findByText('La bibliothèque ne contient encore aucune œuvre.')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('ISBN'), 'Sans ISBN');
    expect(await screen.findByText('Aucune œuvre ne correspond à ces filtres.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('affiche l’erreur de chargement et permet de réessayer', async () => {
    let appels = 0;
    service.reponseLivres = async (c) =>
      ++appels === 1
        ? echec({ type: 'serveur-injoignable', message: 'Impossible de joindre le serveur' })
        : succes({ livres: oeuvres, total: 3, page: 1, parPage: c.parPage, pages: 1 });
    const { u } = afficher();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur');
    await u.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('1984')).toBeInTheDocument();
  });

  it('se rafraîchit quand on revient sur l’onglet', async () => {
    const { rerender } = afficher({ actif: true });
    await screen.findByText('1984');
    const rendre = (actif: boolean) =>
      rerender(
        <FournisseurService service={service}>
          <EcranBase delaiSaisie={0} actif={actif} />
        </FournisseurService>,
      );
    rendre(false);
    rendre(true);
    await waitFor(() => expect(service.listesDemandees).toHaveLength(2));
  });
});

describe('numerosAffiches', () => {
  it.each([
    [1, 1, [1]],
    [1, 5, [1, 2, null, 5]],
    [3, 5, [1, 2, 3, 4, 5]],
    [10, 20, [1, null, 9, 10, 11, null, 20]],
    [20, 20, [1, null, 19, 20]],
  ])('page %i sur %i → %j', (page, pages, attendu) => {
    expect(numerosAffiches(page, pages)).toEqual(attendu);
  });
});
