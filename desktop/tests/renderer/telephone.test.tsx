import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { echec, succes } from '../../src/commun/service-bibliotheque';
import { App } from '../../src/renderer/src/App';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { emplacements } from '../fixtures/exemplaires';
import { ServiceFake } from './service-fake';

let service: ServiceFake;

beforeEach(() => {
  localStorage.clear();
  service = new ServiceFake();
  service.reponseEmplacements = async () => succes(emplacements);
  service.reponseNotice = async (isbn) =>
    succes({ source: 'catalogue', livre: { id: null, isbn, titre: 'Le Petit Prince', auteurs: ['Saint-Exupéry'], couverture: null } });
});

function afficher() {
  render(
    <FournisseurService service={service}>
      <App />
    </FournisseurService>,
  );
  return userEvent.setup();
}

async function ouvrirModeTelephone(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole('tab', { name: /Ajouter un livre/ }));
  await u.click(screen.getByRole('tab', { name: /Avec le téléphone/ }));
}

describe('Ajout avec le téléphone', () => {
  it('affiche le QR code et les consignes, et démarre la session une seule fois', async () => {
    const u = afficher();
    await ouvrirModeTelephone(u);

    expect(await screen.findByRole('img', { name: 'QR code à scanner avec le téléphone' })).toHaveAttribute(
      'src',
      'data:image/png;base64,QR1',
    );
    expect(screen.getByText(/même réseau Wi-Fi/)).toBeInTheDocument();
    expect(screen.getByText('http://192.168.1.10:47800/s/jeton/')).toBeInTheDocument();
    expect(screen.getByText(/En attente d’un scan/)).toBeInTheDocument();
    expect(service.appairagesDemarres).toBe(1);
  });

  it('permet de choisir une autre carte réseau', async () => {
    const u = afficher();
    await ouvrirModeTelephone(u);
    await u.selectOptions(await screen.findByLabelText(/autre carte réseau/), 'Ethernet — 10.0.0.5');
    expect(screen.getByRole('img', { name: /QR code/ })).toHaveAttribute('src', 'data:image/png;base64,QR2');
  });

  it('un ISBN scanné affiche aussitôt sa notice, prête à être rangée', async () => {
    const u = afficher();
    await ouvrirModeTelephone(u);
    await screen.findByRole('img', { name: /QR code/ });

    act(() => service.simulerScan('9782070612758'));

    expect(await screen.findByRole('article', { name: 'Livre choisi : Le Petit Prince' })).toBeInTheDocument();
    expect(service.noticesDemandees).toEqual(['9782070612758']);
    expect(screen.getByText(/Téléphone connecté : scannez un livre/)).toBeInTheDocument();
  });

  it('un scan reçu pendant la recherche ouvre l’écran d’ajout', async () => {
    const u = afficher();
    await ouvrirModeTelephone(u);
    await screen.findByRole('img', { name: /QR code/ });
    await u.click(screen.getByRole('tab', { name: /Rechercher/ }));

    act(() => service.simulerScan('9782070612758'));

    expect(screen.getByRole('tab', { name: /Ajouter un livre/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('article', { name: 'Livre choisi : Le Petit Prince' })).toBeInTheDocument();
  });

  it('deux scans successifs du même livre relancent bien la recherche de notice', async () => {
    const u = afficher();
    await ouvrirModeTelephone(u);
    await screen.findByRole('img', { name: /QR code/ });

    act(() => service.simulerScan('9782070612758'));
    await screen.findByRole('article', { name: /Le Petit Prince/ });
    act(() => service.simulerScan('9782070612758'));
    await screen.findByRole('article', { name: /Le Petit Prince/ });
    expect(service.noticesDemandees).toEqual(['9782070612758', '9782070612758']);
  });

  it('déconnecter le téléphone arrête la session et l’écoute des scans', async () => {
    const u = afficher();
    await ouvrirModeTelephone(u);
    await screen.findByRole('img', { name: /QR code/ });
    expect(service.nombreAbonnesScan).toBe(1);

    await u.click(screen.getByRole('button', { name: /Déconnecter le téléphone/ }));

    expect(service.appairagesArretes).toBe(1);
    expect(service.nombreAbonnesScan).toBe(0);
    expect(screen.getByRole('button', { name: /Connecter un téléphone/ })).toBeInTheDocument();
  });

  it('affiche l’erreur de démarrage et permet de réessayer', async () => {
    let tentatives = 0;
    service.reponseAppairage = async () =>
      ++tentatives === 1
        ? echec({ type: 'requete-invalide', message: 'Aucun réseau local détecté' })
        : succes({ adresses: [{ carte: 'Wi-Fi', url: 'http://192.168.1.10:47800/s/j/', qrCode: 'data:image/png;base64,QR1' }] });
    const u = afficher();
    await ouvrirModeTelephone(u);

    expect(await screen.findByRole('alert')).toHaveTextContent('Aucun réseau local détecté');
    await u.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
  });
});
