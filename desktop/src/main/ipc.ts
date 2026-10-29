import type { IpcMain } from 'electron';
import { z } from 'zod';
import { schemaCriteresLivres, schemaDemandeAjout } from '../commun/api';
import { CANAUX_IPC, echec, type ServiceInvocable } from '../commun/service-bibliotheque';

/**
 * Adapter entrant du processus main : relaie les appels IPC de la page vers
 * le service. La page est considérée comme NON fiable : chaque argument reçu
 * est validé avant usage.
 */
export function brancherIpc(ipc: Pick<IpcMain, 'handle'>, service: ServiceInvocable): void {
  const invalide = (message: string) => echec({ type: 'requete-invalide', message });

  ipc.handle(CANAUX_IPC.rechercherExemplaires, async (_evenement, terme: unknown) => {
    const valide = z.string().max(200).safeParse(terme);
    return valide.success ? service.rechercherExemplaires(valide.data) : invalide('Terme de recherche invalide');
  });

  ipc.handle(CANAUX_IPC.verifierConnexion, async () => service.verifierConnexion());

  ipc.handle(CANAUX_IPC.listerEmplacements, async () => service.listerEmplacements());

  ipc.handle(CANAUX_IPC.consulterNotice, async (_evenement, isbn: unknown) => {
    const valide = z.string().trim().min(1).max(30).safeParse(isbn);
    return valide.success ? service.consulterNotice(valide.data) : invalide('ISBN invalide');
  });

  ipc.handle(CANAUX_IPC.ajouterExemplaire, async (_evenement, demande: unknown) => {
    const valide = schemaDemandeAjout.safeParse(demande);
    return valide.success ? service.ajouterExemplaire(valide.data) : invalide('Demande d’ajout invalide');
  });

  ipc.handle(CANAUX_IPC.listerLivres, async (_evenement, criteres: unknown) => {
    const valide = schemaCriteresLivres.safeParse(criteres);
    return valide.success ? service.listerLivres(valide.data) : invalide('Critères de liste invalides');
  });

  ipc.handle(CANAUX_IPC.listerExemplairesDuLivre, async (_evenement, livreId: unknown) => {
    const valide = z.string().min(1).max(200).safeParse(livreId);
    return valide.success ? service.listerExemplairesDuLivre(valide.data) : invalide('Identifiant de livre invalide');
  });

  ipc.handle(CANAUX_IPC.listerExemplairesDeLEmplacement, async (_evenement, emplacementId: unknown) => {
    const valide = z.string().min(1).max(200).safeParse(emplacementId);
    return valide.success ? service.listerExemplairesDeLEmplacement(valide.data) : invalide('Identifiant d’emplacement invalide');
  });

  ipc.handle(CANAUX_IPC.demarrerAppairage, async () => service.demarrerAppairage());

  ipc.handle(CANAUX_IPC.arreterAppairage, async () => service.arreterAppairage());

  ipc.handle(CANAUX_IPC.lireConfiguration, async () => service.lireConfiguration());

  ipc.handle(CANAUX_IPC.modifierUrlServeur, async (_evenement, url: unknown) => {
    const valide = z.string().max(500).nullable().safeParse(url);
    return valide.success ? service.modifierUrlServeur(valide.data) : invalide('URL invalide');
  });
}
