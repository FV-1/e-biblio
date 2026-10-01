import type { IpcMain } from 'electron';
import { describe, expect, it } from 'vitest';
import { CANAUX_IPC, succes, type Configuration, type ServiceBibliotheque } from '../../src/commun/service-bibliotheque';
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
  const service: ServiceBibliotheque = {
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
  it('enregistre un gestionnaire pour chaque canal du contrat', () => {
    expect(brancher().canaux().sort()).toEqual(Object.values(CANAUX_IPC).sort());
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

  it.each([
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
