import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CANAUX_IPC, type ServiceBibliotheque } from '../commun/service-bibliotheque';

/**
 * Preload : seul pont entre la page (sans privilèges) et le processus main.
 * Expose `window.biblio`, une implémentation du port ServiceBibliotheque qui
 * relaie chaque appel par IPC. La page ne voit ni ipcRenderer, ni Node.js.
 */
const service: ServiceBibliotheque = {
  rechercherExemplaires: (terme) => ipcRenderer.invoke(CANAUX_IPC.rechercherExemplaires, terme),
  verifierConnexion: () => ipcRenderer.invoke(CANAUX_IPC.verifierConnexion),
  listerEmplacements: () => ipcRenderer.invoke(CANAUX_IPC.listerEmplacements),
  consulterNotice: (isbn) => ipcRenderer.invoke(CANAUX_IPC.consulterNotice, isbn),
  ajouterExemplaire: (demande) => ipcRenderer.invoke(CANAUX_IPC.ajouterExemplaire, demande),
  listerLivres: (criteres) => ipcRenderer.invoke(CANAUX_IPC.listerLivres, criteres),
  listerExemplairesDuLivre: (livreId) => ipcRenderer.invoke(CANAUX_IPC.listerExemplairesDuLivre, livreId),
  listerExemplairesDeLEmplacement: (emplacementId) => ipcRenderer.invoke(CANAUX_IPC.listerExemplairesDeLEmplacement, emplacementId),
  lireConfiguration: () => ipcRenderer.invoke(CANAUX_IPC.lireConfiguration),
  modifierUrlServeur: (url) => ipcRenderer.invoke(CANAUX_IPC.modifierUrlServeur, url),
  demarrerAppairage: () => ipcRenderer.invoke(CANAUX_IPC.demarrerAppairage),
  arreterAppairage: () => ipcRenderer.invoke(CANAUX_IPC.arreterAppairage),
  surIsbnScanne: (rappel) => {
    // Seul l'ISBN est transmis à la page, jamais l'objet événement d'Electron.
    const ecouteur = (_evenement: IpcRendererEvent, isbn: unknown) => {
      if (typeof isbn === 'string') rappel(isbn);
    };
    ipcRenderer.on(CANAUX_IPC.isbnScanne, ecouteur);
    return () => {
      ipcRenderer.removeListener(CANAUX_IPC.isbnScanne, ecouteur);
    };
  },
};

contextBridge.exposeInMainWorld('biblio', service);
