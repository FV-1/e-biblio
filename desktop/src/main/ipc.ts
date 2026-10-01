import type { IpcMain } from 'electron';
import { z } from 'zod';
import { CANAUX_IPC, echec, type ServiceBibliotheque } from '../commun/service-bibliotheque';

/**
 * Adapter entrant du processus main : relaie les appels IPC de la page vers
 * le service. La page est considérée comme NON fiable : chaque argument reçu
 * est validé avant usage.
 */
export function brancherIpc(ipc: Pick<IpcMain, 'handle'>, service: ServiceBibliotheque): void {
  ipc.handle(CANAUX_IPC.rechercherExemplaires, async (_evenement, terme: unknown) => {
    const valide = z.string().max(200).safeParse(terme);
    if (!valide.success) return echec({ type: 'requete-invalide', message: 'Terme de recherche invalide' });
    return service.rechercherExemplaires(valide.data);
  });

  ipc.handle(CANAUX_IPC.verifierConnexion, async () => service.verifierConnexion());
}
