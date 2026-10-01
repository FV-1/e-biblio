import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { echec } from '../../src/commun/service-bibliotheque';
import { ParametresServeur } from '../../src/renderer/src/parametres/ParametresServeur';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { ServiceFake } from './service-fake';

let service: ServiceFake;

beforeEach(() => {
  service = new ServiceFake();
});

function afficher() {
  render(
    <FournisseurService service={service}>
      <ParametresServeur />
    </FournisseurService>,
  );
  return userEvent.setup();
}

describe('ParametresServeur', () => {
  it('affiche l’URL utilisée, sa source et l’état « Connecté »', async () => {
    afficher();
    expect(await screen.findByText('http://localhost:3000')).toBeInTheDocument();
    expect(await screen.findByText(/Connecté · valeur par défaut/)).toBeInTheDocument();
  });

  it('indique un serveur injoignable, avec le détail en info-bulle', async () => {
    service.reponseConnexion = async () => echec({ type: 'serveur-injoignable', message: 'ECONNREFUSED' });
    afficher();
    const statut = await screen.findByText(/Injoignable/);
    expect(statut).toHaveAttribute('title', 'ECONNREFUSED');
  });

  it('indique quand l’URL vient de la variable BIBLIO_API_URL', async () => {
    service.configuration = { urlServeur: 'http://srv:4000', source: 'environnement', urlParDefaut: 'http://srv:4000' };
    afficher();
    expect(await screen.findByText(/variable BIBLIO_API_URL/)).toBeInTheDocument();
  });

  it('teste à nouveau la connexion à la demande', async () => {
    const utilisateur = afficher();
    await screen.findByText(/Connecté/);
    await utilisateur.click(screen.getByRole('button', { name: 'Tester' }));
    expect(service.verificationsConnexion).toBe(2);
  });

  it('modifie l’URL, l’affiche et revérifie la connexion', async () => {
    const utilisateur = afficher();
    await utilisateur.click(await screen.findByRole('button', { name: 'Modifier' }));

    const champ = screen.getByLabelText('Adresse du serveur');
    expect(champ).toHaveValue('http://localhost:3000');
    await utilisateur.clear(champ);
    await utilisateur.type(champ, 'http://192.168.1.20:3000');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(service.modificationsUrl).toEqual(['http://192.168.1.20:3000']);
    expect(await screen.findByText('http://192.168.1.20:3000')).toBeInTheDocument();
    expect(await screen.findByText(/réglée dans l’application/)).toBeInTheDocument();
    expect(service.verificationsConnexion).toBe(2);
  });

  it('affiche l’erreur et garde le formulaire ouvert pour une URL invalide', async () => {
    const utilisateur = afficher();
    await utilisateur.click(await screen.findByRole('button', { name: 'Modifier' }));
    const champ = screen.getByLabelText('Adresse du serveur');
    await utilisateur.clear(champ);
    await utilisateur.type(champ, 'pas une url{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('n\'est pas une URL valide');
    expect(champ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('permet de revenir à l’URL par défaut après un réglage', async () => {
    service.configuration = { urlServeur: 'http://autre:3000', source: 'interface', urlParDefaut: 'http://localhost:3000' };
    const utilisateur = afficher();
    await utilisateur.click(await screen.findByRole('button', { name: 'Modifier' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Revenir à http://localhost:3000' }));

    expect(service.modificationsUrl).toEqual([null]);
    expect(await screen.findByText('http://localhost:3000')).toBeInTheDocument();
  });

  it('annule la modification sans rien enregistrer', async () => {
    const utilisateur = afficher();
    await utilisateur.click(await screen.findByRole('button', { name: 'Modifier' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(service.modificationsUrl).toEqual([]);
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });
});
