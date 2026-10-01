import type { IpcMain } from 'electron';
import { describe, expect, it } from 'vitest';
import { CANAUX_IPC, succes, type ServiceBibliotheque } from '../../src/commun/service-bibliotheque';
import { brancherIpc } from '../../src/main/ipc';

/** Faux ipcMain : mémorise les gestionnaires pour les appeler comme le ferait Electron. */
function fauxIpc() {
  const gestionnaires = new Map<string, (evenement: unknown, ...args: unknown[]) => unknown>();
  const ipc = { handle: (canal: string, g: (e: unknown, ...a: unknown[]) => unknown) => gestionnaires.set(canal, g) };
  const appeler = (canal: string, ...args: unknown[]) => gestionnaires.get(canal)!({}, ...args);
  return { ipc: ipc as unknown as Pick<IpcMain, 'handle'>, appeler, canaux: () => [...gestionnaires.keys()] };
}

function serviceEspion() {
  const termes: string[] = [];
  const service: ServiceBibliotheque = {
    rechercherExemplaires: async (terme) => {
      termes.push(terme);
      return succes([]);
    },
    verifierConnexion: async () => succes(null),
  };
  return { service, termes };
}

describe('brancherIpc', () => {
  it('enregistre un gestionnaire pour chaque canal du contrat', () => {
    const { ipc, canaux } = fauxIpc();
    brancherIpc(ipc, serviceEspion().service);
    expect(canaux().sort()).toEqual(Object.values(CANAUX_IPC).sort());
  });

  it('relaie la recherche au service', async () => {
    const { ipc, appeler } = fauxIpc();
    const { service, termes } = serviceEspion();
    brancherIpc(ipc, service);
    expect(await appeler(CANAUX_IPC.rechercherExemplaires, 'hugo')).toEqual({ ok: true, valeur: [] });
    expect(termes).toEqual(['hugo']);
  });

  it.each([[42], [null], [{ terme: 'x' }], ['x'.repeat(201)]])(
    'refuse un argument invalide venant de la page (%j) sans appeler le service',
    async (argument) => {
      const { ipc, appeler } = fauxIpc();
      const { service, termes } = serviceEspion();
      brancherIpc(ipc, service);
      expect(await appeler(CANAUX_IPC.rechercherExemplaires, argument)).toMatchObject({
        ok: false,
        erreur: { type: 'requete-invalide' },
      });
      expect(termes).toEqual([]);
    },
  );

  it('relaie la vérification de connexion', async () => {
    const { ipc, appeler } = fauxIpc();
    brancherIpc(ipc, serviceEspion().service);
    expect(await appeler(CANAUX_IPC.verifierConnexion)).toEqual({ ok: true, valeur: null });
  });
});
