import type { IpcMain } from 'electron';
import { describe, expect, it } from 'vitest';
import { CANAUX_IPC, succes, type Configuration, type ServiceInvocable } from '../../src/commun/service-bibliotheque';
import { brancherIpc } from '../../src/main/ipc';
import { exemplaireBienRange } from '../fixtures/exemplaires';

/** Faux ipcMain : mémorise les gestionnaires pour les appeler comme le ferait Electron. */
function fauxIpc() {
  const gestionnaires = new Map<string, (evenement: unknown, ...args: unknown[]) => unknown>();
  const ipc = { handle: (canal: string, g: (e: unknown, ...a: unknown[]) => unknown) => gestionnaires.set(canal, g) };
  const appeler = (canal: string, ...args: unknown[]) => gestionnaires.get(canal)!({}, ...args);
  return { ipc: ipc as unknown as Pick<IpcMain, 'handle'>, appeler, canaux: () => [...gestionnaires.keys()] };
}

const CONFIGURATION: Configuration = { urlServeur: 'http://x:3000', source: 'defaut', urlParDefaut: 'http://x:3000' };

function serviceEspion() {
  const appels: { methode: string; argument: unknown }[] = [];
  const service: ServiceInvocable = {
    rechercherExemplaires: async (terme) => {
      appels.push({ methode: 'rechercher', argument: terme });
      return succes([]);
    },
    verifierConnexion: async () => succes(null),
    listerEmplacements: async () => succes([]),
    consulterNotice: async (isbn) => {
      appels.push({ methode: 'notice', argument: isbn });
      return succes({ source: 'catalogue', livre: { id: null, isbn, titre: 'T', auteurs: [], couverture: null } });
    },
    ajouterExemplaire: async (demande) => {
      appels.push({ methode: 'ajouter', argument: demande });
      return succes({ ...exemplaireBienRange, sourceLivre: 'base' });
    },
    lireConfiguration: async () => CONFIGURATION,
    modifierUrlServeur: async (url) => {
      appels.push({ methode: 'modifierUrl', argument: url });
      return succes(CONFIGURATION);
    },
    listerLivres: async (criteres) => {
      appels.push({ methode: 'listerLivres', argument: criteres });
      return succes({ livres: [], total: 0, page: 1, parPage: 25, pages: 1 });
    },
    listerExemplairesDuLivre: async (livreId) => {
      appels.push({ methode: 'listerExemplairesDuLivre', argument: livreId });
      return succes([]);
    },
    demarrerAppairage: async () => {
      appels.push({ methode: 'demarrerAppairage', argument: undefined });
      return succes({ adresses: [] });
    },
    arreterAppairage: async () => {
      appels.push({ methode: 'arreterAppairage', argument: undefined });
    },
  };
  return { service, appels };
}

function brancher() {
  const { ipc, appeler, canaux } = fauxIpc();
  const { service, appels } = serviceEspion();
  brancherIpc(ipc, service);
  return { appeler, canaux, appels };
}

describe('brancherIpc', () => {
  it('enregistre un gestionnaire pour chaque canal invocable du contrat', () => {
    // isbnScanne est un événement main → page : aucun gestionnaire côté main.
    const invocables = Object.values(CANAUX_IPC).filter((c) => c !== CANAUX_IPC.isbnScanne);
    expect(brancher().canaux().sort()).toEqual(invocables.sort());
  });

  it('relaie le démarrage et l’arrêt de l’appairage', async () => {
    const { appeler, appels } = brancher();
    expect(await appeler(CANAUX_IPC.demarrerAppairage)).toEqual({ ok: true, valeur: { adresses: [] } });
    await appeler(CANAUX_IPC.arreterAppairage);
    expect(appels.map((a) => a.methode)).toEqual(['demarrerAppairage', 'arreterAppairage']);
  });

  it('relaie la recherche au service', async () => {
    const { appeler, appels } = brancher();
    expect(await appeler(CANAUX_IPC.rechercherExemplaires, 'hugo')).toEqual({ ok: true, valeur: [] });
    expect(appels).toEqual([{ methode: 'rechercher', argument: 'hugo' }]);
  });

  it.each([[42], [null], [{ terme: 'x' }], ['x'.repeat(201)]])(
    'refuse un terme invalide venant de la page (%j) sans appeler le service',
    async (argument) => {
      const { appeler, appels } = brancher();
      expect(await appeler(CANAUX_IPC.rechercherExemplaires, argument)).toMatchObject({
        ok: false,
        erreur: { type: 'requete-invalide' },
      });
      expect(appels).toEqual([]);
    },
  );

  it('relaie la vérification de connexion et la lecture de configuration', async () => {
    const { appeler } = brancher();
    expect(await appeler(CANAUX_IPC.verifierConnexion)).toEqual({ ok: true, valeur: null });
    expect(await appeler(CANAUX_IPC.lireConfiguration)).toEqual(CONFIGURATION);
  });

  it('relaie la modification d’URL (chaîne ou null pour réinitialiser)', async () => {
    const { appeler, appels } = brancher();
    await appeler(CANAUX_IPC.modifierUrlServeur, 'http://y:3000');
    await appeler(CANAUX_IPC.modifierUrlServeur, null);
    expect(appels.map((a) => a.argument)).toEqual(['http://y:3000', null]);
  });

  it('relaie l’aperçu de notice et l’ajout validés', async () => {
    const { appeler, appels } = brancher();
    const demande = { emplacementId: 'e1', livre: { type: 'isbn', isbn: '9782070368228' } };
    await appeler(CANAUX_IPC.consulterNotice, ' 9782070368228 ');
    await appeler(CANAUX_IPC.ajouterExemplaire, demande);
    expect(appels).toEqual([
      { methode: 'notice', argument: '9782070368228' },
      { methode: 'ajouter', argument: demande },
    ]);
  });

  it('relaie la liste des œuvres et les exemplaires d’une œuvre', async () => {
    const { appeler, appels } = brancher();
    const criteres = { terme: 'zola', tri: 'titre', ordre: 'asc', page: 1, parPage: 25 };
    await appeler(CANAUX_IPC.listerLivres, criteres);
    await appeler(CANAUX_IPC.listerExemplairesDuLivre, 'livre-1');
    expect(appels).toEqual([
      { methode: 'listerLivres', argument: criteres },
      { methode: 'listerExemplairesDuLivre', argument: 'livre-1' },
    ]);
  });

  it.each([
    [CANAUX_IPC.listerLivres, { tri: 'pirate', ordre: 'asc', page: 1, parPage: 25 }],
    [CANAUX_IPC.listerLivres, { tri: 'titre', ordre: 'asc', page: 0, parPage: 25 }],
    [CANAUX_IPC.listerLivres, { tri: 'titre', ordre: 'asc', page: 1, parPage: 1000 }],
    [CANAUX_IPC.listerExemplairesDuLivre, ''],
    [CANAUX_IPC.listerExemplairesDuLivre, 12],
    [CANAUX_IPC.consulterNotice, 42],
    [CANAUX_IPC.consulterNotice, ''],
    [CANAUX_IPC.ajouterExemplaire, { emplacementId: 'e1' }],
    [CANAUX_IPC.ajouterExemplaire, { emplacementId: 'e1', livre: { type: 'pirate' } }],
    [CANAUX_IPC.ajouterExemplaire, { emplacementId: 'e1', livre: { type: 'saisie', isbn: null, titre: '', auteurs: [], couverture: null } }],
  ])('refuse un argument invalide sur %s (%j)', async (canal, argument) => {
    const { appeler, appels } = brancher();
    expect(await appeler(canal, argument)).toMatchObject({ ok: false, erreur: { type: 'requete-invalide' } });
    expect(appels).toEqual([]);
  });

  it.each([[42], [undefined], [{ url: 'x' }], ['x'.repeat(501)]])(
    'refuse une URL invalide venant de la page (%j)',
    async (argument) => {
      const { appeler, appels } = brancher();
      expect(await appeler(CANAUX_IPC.modifierUrlServeur, argument)).toMatchObject({ ok: false });
      expect(appels).toEqual([]);
    },
  );
});
