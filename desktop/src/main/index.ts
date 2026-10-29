import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import QRCode from 'qrcode';
import { CANAUX_IPC, type ServiceInvocable } from '../commun/service-bibliotheque';
import { adressesReseau } from './appairage/adresses-reseau';
import { AppairageTelephone } from './appairage/appairage-telephone';
import { obtenirCertificat } from './appairage/certificat-local';
import { chargerRessourcesMobiles } from './appairage/ressources-mobiles';
import { ServeurAppairage } from './appairage/serveur-appairage';
import { ClientApiHttp } from './client-api-http';
import { brancherIpc } from './ipc';
import { StockageConfiguration } from './stockage-configuration';

/** Port du serveur d'appairage (un port libre est choisi s'il est occupé). */
const PORT_APPAIRAGE = 47800;

/**
 * Processus main : point d'entrée Electron et composition root du client desktop.
 * Seul endroit qui connaît les implémentations concrètes des ports.
 */
function composerService(): { service: ServiceInvocable; arreter: () => Promise<void> } {
  const configuration = new StockageConfiguration({
    cheminFichier: join(app.getPath('userData'), 'configuration.json'),
    urlEnvironnement: process.env.BIBLIO_API_URL,
  });
  // Plus long que le délai du serveur pour Open Library (3 s), pour recevoir CATALOGUE_INDISPONIBLE.
  const client = new ClientApiHttp({ urlServeur: () => configuration.urlServeur(), delaiMaxMs: 5000 });

  // Appairage du téléphone : chaque ISBN reçu est poussé vers les fenêtres (IPC main → page).
  const appairage = new AppairageTelephone({
    serveur: new ServeurAppairage({
      ressources: chargerRessourcesMobiles(),
      portPrefere: PORT_APPAIRAGE,
      // HTTPS : seule façon d'ouvrir la caméra en direct sur le téléphone (ADR-008).
      tls: () =>
        obtenirCertificat(
          join(app.getPath('userData'), 'appairage'),
          adressesReseau(networkInterfaces()).map((a) => a.ip),
        ),
      onIsbn: (isbn) => {
        for (const fenetre of BrowserWindow.getAllWindows()) fenetre.webContents.send(CANAUX_IPC.isbnScanne, isbn);
      },
    }),
    interfacesReseau: () => networkInterfaces(),
    genererQrCode: (texte) => QRCode.toDataURL(texte, { margin: 1, scale: 8, errorCorrectionLevel: 'M' }),
  });

  // Assemblage des ports (recherche, configuration, appairage) en un seul service.
  const service: ServiceInvocable = {
    rechercherExemplaires: (terme) => client.rechercherExemplaires(terme),
    verifierConnexion: () => client.verifierConnexion(),
    listerEmplacements: () => client.listerEmplacements(),
    consulterNotice: (isbn) => client.consulterNotice(isbn),
    ajouterExemplaire: (demande) => client.ajouterExemplaire(demande),
    listerLivres: (criteres) => client.listerLivres(criteres),
    listerExemplairesDuLivre: (livreId) => client.listerExemplairesDuLivre(livreId),
    listerExemplairesDeLEmplacement: (emplacementId) => client.listerExemplairesDeLEmplacement(emplacementId),
    lireConfiguration: () => configuration.lireConfiguration(),
    modifierUrlServeur: (url) => configuration.modifierUrlServeur(url),
    demarrerAppairage: () => appairage.demarrer(),
    arreterAppairage: () => appairage.arreter(),
  };
  return { service, arreter: () => appairage.arreter() };
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
  const { service, arreter } = composerService();
  brancherIpc(ipcMain, service);
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
  // Le serveur d'appairage ne survit jamais à l'application.
  app.on('will-quit', () => void arreter());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
