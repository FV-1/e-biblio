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

const pastille = () => screen.findByRole('button', { name: /^Serveur / });

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.click(await pastille());
  return screen.getByRole('dialog', { name: 'Connexion au serveur' });
}

describe('ParametresServeur', () => {
  it('affiche une pastille avec l’hôte et l’état de connexion', async () => {
    afficher();
    expect(await screen.findByRole('button', { name: 'Serveur http://localhost:3000 : Connecté' })).toHaveTextContent(
      'localhost:3000',
    );
  });

  it('ouvre un panneau avec l’URL, l’état et la source du réglage', async () => {
    const utilisateur = afficher();
    await screen.findByRole('button', { name: /Connecté/ });
    const panneau = await ouvrir(utilisateur);
    expect(panneau).toHaveTextContent('http://localhost:3000');
    expect(panneau).toHaveTextContent('Connecté · valeur par défaut');
  });

  it('ferme le panneau avec Échap', async () => {
    const utilisateur = afficher();
    await ouvrir(utilisateur);
    await utilisateur.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('indique un serveur injoignable avec le détail de l’erreur', async () => {
    service.reponseConnexion = async () => echec({ type: 'serveur-injoignable', message: 'ECONNREFUSED' });
    const utilisateur = afficher();
    expect(await screen.findByRole('button', { name: /Injoignable/ })).toBeInTheDocument();
    expect(await ouvrir(utilisateur)).toHaveTextContent('ECONNREFUSED');
  });

  it('indique quand l’URL vient de la variable BIBLIO_API_URL', async () => {
    service.configuration = { urlServeur: 'http://srv:4000', source: 'environnement', urlParDefaut: 'http://srv:4000' };
    const utilisateur = afficher();
    expect(await ouvrir(utilisateur)).toHaveTextContent(/variable BIBLIO_API_URL/);
  });

  it('teste à nouveau la connexion à la demande', async () => {
    const utilisateur = afficher();
    await screen.findByRole('button', { name: /Connecté/ });
    await ouvrir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Tester' }));
    expect(service.verificationsConnexion).toBe(2);
  });

  it('modifie l’URL, l’affiche et revérifie la connexion', async () => {
    const utilisateur = afficher();
    await ouvrir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Modifier' }));

    const champ = screen.getByLabelText('Adresse du serveur');
    expect(champ).toHaveValue('http://localhost:3000');
    await utilisateur.clear(champ);
    await utilisateur.type(champ, 'http://192.168.1.20:3000');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(service.modificationsUrl).toEqual(['http://192.168.1.20:3000']);
    expect(await screen.findByRole('button', { name: /^Serveur http:\/\/192\.168\.1\.20:3000/ })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(/réglée dans l’application/);
    expect(service.verificationsConnexion).toBe(2);
  });

  it('affiche l’erreur et garde le formulaire ouvert pour une URL invalide', async () => {
    const utilisateur = afficher();
    await ouvrir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Modifier' }));
    const champ = screen.getByLabelText('Adresse du serveur');
    await utilisateur.clear(champ);
    await utilisateur.type(champ, 'pas une url{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('n\'est pas une URL valide');
    expect(champ).toHaveAttribute('aria-invalid', 'true');
  });

  it('permet de revenir à l’URL par défaut après un réglage', async () => {
    service.configuration = { urlServeur: 'http://autre:3000', source: 'interface', urlParDefaut: 'http://localhost:3000' };
    const utilisateur = afficher();
    await ouvrir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Modifier' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Revenir à http://localhost:3000' }));

    expect(service.modificationsUrl).toEqual([null]);
    expect(await screen.findByRole('button', { name: /^Serveur http:\/\/localhost:3000/ })).toBeInTheDocument();
  });

  it('annule la modification sans rien enregistrer', async () => {
    const utilisateur = afficher();
    await ouvrir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Modifier' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(service.modificationsUrl).toEqual([]);
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });
});
