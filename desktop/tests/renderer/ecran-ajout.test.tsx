import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Livre, Notice } from '../../src/commun/api';
import { echec, succes } from '../../src/commun/service-bibliotheque';
import { EcranAjout } from '../../src/renderer/src/ajout/EcranAjout';
import { FournisseurService } from '../../src/renderer/src/service/contexte-service';
import { useAppairage } from '../../src/renderer/src/telephone/use-appairage';
import { emplacements, exemplaireBienRange } from '../fixtures/exemplaires';
import { ServiceFake } from './service-fake';

let service: ServiceFake;

const noticeCatalogue: Notice = {
  source: 'catalogue',
  livre: { id: null, isbn: '9782070368228', titre: '1984', auteurs: ['George Orwell'], couverture: null },
};

beforeEach(() => {
  localStorage.clear();
  service = new ServiceFake();
  service.reponseEmplacements = async () => succes(emplacements);
  service.reponseNotice = async () => succes(noticeCatalogue);
  service.reponseAjout = async () => succes({ ...exemplaireBienRange, sourceLivre: 'catalogue' });
});

interface PropsTest {
  livrePrechoisi?: Livre | null;
  onVoirDansRecherche?: (t: string) => void;
}

/** L'écran reçoit sa session téléphone de l'application : on la crée ici de la même façon. */
function Harnais({ livrePrechoisi, onVoirDansRecherche }: PropsTest) {
  const appairage = useAppairage(() => undefined);
  return (
    <EcranAjout livrePrechoisi={livrePrechoisi ?? null} onVoirDansRecherche={onVoirDansRecherche ?? vi.fn()} appairage={appairage} />
  );
}

function afficher(props: PropsTest = {}) {
  render(
    <FournisseurService service={service}>
      <Harnais {...props} />
    </FournisseurService>,
  );
  return userEvent.setup();
}

type Utilisateur = ReturnType<typeof userEvent.setup>;

const boutonAjouter = () => screen.getByRole('button', { name: /Ajouter l’exemplaire/ });

async function chercherIsbn(u: Utilisateur, isbn: string) {
  await u.type(screen.getByLabelText('ISBN du livre'), isbn);
  await u.click(screen.getByRole('button', { name: /Chercher la notice/ }));
}

/** Salle A → (Rayon Romans, choisi d'office car seul) → étagère demandée. */
async function choisirEtagereRomans(u: Utilisateur, etagere = 'Étagère Romans 2') {
  await u.selectOptions(await screen.findByLabelText('Salle'), 'Salle A');
  await u.selectOptions(screen.getByLabelText('Étagère'), etagere);
}

describe('EcranAjout', () => {
  describe('par ISBN', () => {
    it('affiche la notice, puis ajoute l’exemplaire sur l’étagère choisie', async () => {
      const u = afficher();
      await chercherIsbn(u, '978-2-07-036822-8');

      expect(service.noticesDemandees).toEqual(['9782070368228']);
      const apercu = await screen.findByRole('article', { name: 'Livre choisi : 1984' });
      expect(apercu).toHaveTextContent('Trouvé sur Open Library');
      expect(apercu).toHaveTextContent('George Orwell');

      expect(boutonAjouter()).toBeDisabled();
      await choisirEtagereRomans(u);
      expect(screen.getByLabelText('Rayon')).toHaveValue('rayon-1-1'); // seul rayon de la salle : choisi d'office
      await u.click(boutonAjouter());

      expect(service.ajouts).toEqual([{ emplacementId: 'etagere-1-1-2', livre: { type: 'isbn', isbn: '9782070368228' } }]);
      expect(await screen.findByRole('heading', { name: 'Exemplaire ajouté' })).toBeInTheDocument();
      expect(screen.getByText('Notice Open Library')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /Chemin : Étage 1 > Salle A > Rayon Romans > Étagère Romans 1/ })).toBeInTheDocument();
    });

    it('réutilise le livre déjà en base (ajout par livreId)', async () => {
      service.reponseNotice = async () => succes({ ...noticeCatalogue, source: 'base', livre: { ...noticeCatalogue.livre, id: 'livre-1984' } });
      const u = afficher();
      await chercherIsbn(u, '9782070368228');
      expect(await screen.findByText('Déjà dans la bibliothèque')).toBeInTheDocument();
      await choisirEtagereRomans(u);
      await u.click(boutonAjouter());
      expect(service.ajouts[0]?.livre).toEqual({ type: 'existant', livreId: 'livre-1984' });
    });

    it('refuse un ISBN de forme invalide sans interroger le serveur', async () => {
      const u = afficher();
      await chercherIsbn(u, '12345');
      expect(await screen.findByRole('alert')).toHaveTextContent('10 ou 13 caractères');
      expect(service.noticesDemandees).toEqual([]);
    });

    it('ISBN inconnu : propose la saisie manuelle en conservant l’ISBN', async () => {
      service.reponseNotice = async () => echec({ type: 'erreur-api', code: 'LIVRE_INCONNU_DU_CATALOGUE', message: 'ISBN inconnu du catalogue' });
      const u = afficher();
      await chercherIsbn(u, '978-0-306-40615-7');

      expect(await screen.findByRole('alert')).toHaveTextContent('ISBN inconnu du catalogue');
      await u.click(screen.getByRole('button', { name: 'Saisir la notice à la main' }));

      expect(screen.getByLabelText('ISBN')).toHaveValue('9780306406157');
      await u.type(screen.getByLabelText(/Titre/), 'Les Misérables');
      await u.type(screen.getByLabelText('Auteurs'), 'Victor Hugo{Enter}Préface : X');
      await u.click(screen.getByRole('button', { name: 'Utiliser cette notice' }));

      expect(await screen.findByRole('article', { name: 'Livre choisi : Les Misérables' })).toHaveTextContent('Saisie manuelle');
      await choisirEtagereRomans(u);
      await u.click(boutonAjouter());
      expect(service.ajouts[0]?.livre).toEqual({
        type: 'saisie',
        isbn: '9780306406157',
        titre: 'Les Misérables',
        auteurs: ['Victor Hugo', 'Préface : X'],
        couverture: null,
      });
    });

    it('si le catalogue tombe entre l’aperçu et l’ajout, enregistre la notice affichée', async () => {
      let appels = 0;
      service.reponseAjout = async () =>
        ++appels === 1
          ? echec({ type: 'erreur-api', code: 'CATALOGUE_INDISPONIBLE', message: 'hors ligne' })
          : succes({ ...exemplaireBienRange, sourceLivre: 'saisie' });
      const u = afficher();
      await chercherIsbn(u, '9782070368228');
      await screen.findByRole('article', { name: 'Livre choisi : 1984' });
      await choisirEtagereRomans(u);
      await u.click(boutonAjouter());

      expect(await screen.findByRole('heading', { name: 'Exemplaire ajouté' })).toBeInTheDocument();
      expect(service.ajouts.map((a) => a.livre)).toEqual([
        { type: 'isbn', isbn: '9782070368228' },
        { type: 'saisie', isbn: '9782070368228', titre: '1984', auteurs: ['George Orwell'], couverture: null },
      ]);
    });
  });

  describe('saisie manuelle', () => {
    it('ajoute un livre sans ISBN', async () => {
      const u = afficher();
      await u.click(screen.getByRole('tab', { name: /Saisie manuelle/ }));
      await u.type(screen.getByLabelText(/Titre/), 'Registre paroissial 1789');
      await u.click(screen.getByRole('button', { name: 'Utiliser cette notice' }));

      const apercu = await screen.findByRole('article', { name: 'Livre choisi : Registre paroissial 1789' });
      expect(apercu).toHaveTextContent('Sans ISBN');
      await choisirEtagereRomans(u);
      await u.click(boutonAjouter());
      expect(service.ajouts[0]?.livre).toEqual({ type: 'saisie', isbn: null, titre: 'Registre paroissial 1789', auteurs: [], couverture: null });
    });

    it('signale les champs invalides et ne valide pas la notice', async () => {
      const u = afficher();
      await u.click(screen.getByRole('tab', { name: /Saisie manuelle/ }));
      await u.type(screen.getByLabelText('ISBN'), '123');
      await u.type(screen.getByLabelText('Image de couverture'), 'pas-une-url');
      await u.click(screen.getByRole('button', { name: 'Utiliser cette notice' }));

      const alertes = screen.getAllByRole('alert').map((a) => a.textContent);
      expect(alertes).toEqual([
        'Le titre est obligatoire.',
        'Format d’ISBN invalide (10 ou 13 caractères), ou laissez vide.',
        'Adresse d’image invalide (http ou https).',
      ]);
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });
  });

  it('nouvel exemplaire d’un livre présélectionné depuis la recherche', async () => {
    const u = afficher({ livrePrechoisi: exemplaireBienRange.livre });
    expect(screen.getByRole('article', { name: 'Livre choisi : 1984' })).toHaveTextContent('Nouvel exemplaire');
    await choisirEtagereRomans(u);
    await u.click(boutonAjouter());
    expect(service.ajouts[0]?.livre).toEqual({ type: 'existant', livreId: 'livre-1984' });
  });

  it('guide l’utilisateur tant que le livre ou l’étagère manquent', async () => {
    const u = afficher();
    expect(await screen.findByText('Choisissez d’abord le livre.')).toBeInTheDocument();
    await chercherIsbn(u, '9782070368228');
    expect(await screen.findByText('Choisissez l’étagère où ranger l’exemplaire.')).toBeInTheDocument();
    expect(boutonAjouter()).toBeDisabled();
  });

  it('mémorise la dernière étagère et la propose aux ajouts suivants', async () => {
    const u = afficher();
    await chercherIsbn(u, '9782070368228');
    await choisirEtagereRomans(u, 'Étagère Romans 2');
    await u.click(boutonAjouter());
    await u.click(await screen.findByRole('button', { name: /Ajouter un autre livre/ }));

    expect(await screen.findByLabelText('Étagère')).toHaveValue('etagere-1-1-2');
    await chercherIsbn(u, '9782070368228');
    await screen.findByRole('article', { name: 'Livre choisi : 1984' });
    expect(boutonAjouter()).toBeEnabled();
  });

  it('après un ajout, propose de voir le livre dans la recherche', async () => {
    const onVoirDansRecherche = vi.fn();
    const u = afficher({ onVoirDansRecherche });
    await chercherIsbn(u, '9782070368228');
    await choisirEtagereRomans(u);
    await u.click(boutonAjouter());
    await u.click(await screen.findByRole('button', { name: /Voir dans la recherche/ }));
    expect(onVoirDansRecherche).toHaveBeenCalledWith('1984');
  });

  it('affiche l’erreur d’un ajout refusé sans quitter le formulaire', async () => {
    service.reponseAjout = async () => echec({ type: 'serveur-injoignable', message: 'Impossible de joindre le serveur' });
    const u = afficher();
    await chercherIsbn(u, '9782070368228');
    await choisirEtagereRomans(u);
    await u.click(boutonAjouter());
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('L’exemplaire n’a pas été ajouté : Impossible de joindre le serveur');
    expect(boutonAjouter()).toBeEnabled();
  });

  it('permet de réessayer le chargement des emplacements', async () => {
    let tentatives = 0;
    service.reponseEmplacements = async () =>
      ++tentatives === 1 ? echec({ type: 'serveur-injoignable', message: 'hors ligne' }) : succes(emplacements);
    const u = afficher();
    const alerte = await screen.findByRole('alert');
    await u.click(within(alerte).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByLabelText('Salle')).toBeInTheDocument();
  });
});
