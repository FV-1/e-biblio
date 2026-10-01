import { contextBridge, ipcRenderer } from 'electron';
import { CANAUX_IPC, type ServiceBibliotheque } from '../commun/service-bibliotheque';

/**
 * Preload : seul pont entre la page (sans privilèges) et le processus main.
 * Expose `window.biblio`, une implémentation du port ServiceBibliotheque qui
 * relaie chaque appel par IPC. La page ne voit ni ipcRenderer, ni Node.js.
 */
const service: ServiceBibliotheque = {
  rechercherExemplaires: (terme) => ipcRenderer.invoke(CANAUX_IPC.rechercherExemplaires, terme),
  verifierConnexion: () => ipcRenderer.invoke(CANAUX_IPC.verifierConnexion),
};

contextBridge.exposeInMainWorld('biblio', service);
