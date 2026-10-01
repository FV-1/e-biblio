import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import type { ServiceBibliotheque } from '../commun/service-bibliotheque';
import { ClientApiHttp } from './client-api-http';
import { brancherIpc } from './ipc';
import { StockageConfiguration } from './stockage-configuration';

/**
 * Processus main : point d'entrée Electron et composition root du client desktop.
 * Seul endroit qui connaît les implémentations concrètes des ports.
 */
function composerService(): ServiceBibliotheque {
  const configuration = new StockageConfiguration({
    cheminFichier: join(app.getPath('userData'), 'configuration.json'),
    urlEnvironnement: process.env.BIBLIO_API_URL,
  });
  const client = new ClientApiHttp({ urlServeur: () => configuration.urlServeur(), delaiMaxMs: 5000 });

  // Assemblage des deux ports (recherche + configuration) en un seul service.
  return {
    rechercherExemplaires: (terme) => client.rechercherExemplaires(terme),
    verifierConnexion: () => client.verifierConnexion(),
    listerEmplacements: () => client.listerEmplacements(),
    consulterNotice: (isbn) => client.consulterNotice(isbn),
    ajouterExemplaire: (demande) => client.ajouterExemplaire(demande),
    lireConfiguration: () => configuration.lireConfiguration(),
    modifierUrlServeur: (url) => configuration.modifierUrlServeur(url),
  };
}

function creerFenetre(): BrowserWindow {
  const fenetre = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    title: 'e-biblio',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Sécurité : la page n'a aucun accès à Node.js ni à Electron ;
      // elle ne communique avec le main que via l'API exposée par le preload.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  fenetre.once('ready-to-show', () => fenetre.show());

  // Aucune nouvelle fenêtre ne peut être ouverte depuis la page.
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.ELECTRON_RENDERER_URL) {
    void fenetre.loadURL(process.env.ELECTRON_RENDERER_URL); // développement : serveur Vite
  } else {
    void fenetre.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return fenetre;
}

app.whenReady().then(() => {
  brancherIpc(ipcMain, composerService());
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
