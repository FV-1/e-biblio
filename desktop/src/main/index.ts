import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { ClientApiHttp } from './client-api-http';
import { brancherIpc } from './ipc';

/**
 * Processus main : point d'entrée Electron et composition root du client desktop.
 */
const URL_SERVEUR = process.env.BIBLIO_API_URL ?? 'http://localhost:3000';

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

  // Liens externes (ex. couverture) ouverts hors de l'application, jamais dans la fenêtre.
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.ELECTRON_RENDERER_URL) {
    void fenetre.loadURL(process.env.ELECTRON_RENDERER_URL); // développement : serveur Vite
  } else {
    void fenetre.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return fenetre;
}

app.whenReady().then(() => {
  const client = new ClientApiHttp({ urlServeur: () => URL_SERVEUR, delaiMaxMs: 5000 });
  brancherIpc(ipcMain, client);
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
