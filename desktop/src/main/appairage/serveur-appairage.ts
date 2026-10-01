import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';

/** Fichiers de la page mobile, fournis par la composition root. */
export interface RessourcesMobiles {
  readonly html: string;
  readonly css: string;
  readonly pageJs: string;
  readonly decodeurJs: string;
  readonly zxingJs: string;
}

export interface OptionsServeurAppairage {
  readonly ressources: RessourcesMobiles;
  /** Appelé pour chaque ISBN reçu (déjà validé et nettoyé). */
  readonly onIsbn: (isbn: string) => void;
  /** 0.0.0.0 : joignable depuis le réseau local (le téléphone). */
  readonly hote?: string;
  /** Port tenté en premier ; si occupé, un port libre est choisi. */
  readonly portPrefere?: number;
  readonly genererJeton?: () => string;
}

const TAILLE_MAX_CORPS = 1024;
const schemaCorps = z.object({ isbn: z.string().max(30) });

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
};

/**
 * Mini-serveur HTTP du poste, ouvert le temps de l'appairage d'un téléphone.
 * Sécurité : toutes les routes exigent un jeton aléatoire (128 bits) présent
 * dans l'URL du QR code ; sans lui, le serveur ne révèle rien (404).
 * Le téléphone ne peut faire qu'une chose : transmettre un ISBN.
 */
export class ServeurAppairage {
  private serveur: Server | null = null;
  private jeton: string | null = null;

  constructor(private readonly options: OptionsServeurAppairage) {}

  /** Démarre le serveur (idempotent : renvoie la session en cours si elle existe). */
  async demarrer(): Promise<{ port: number; jeton: string }> {
    if (this.serveur && this.jeton) return { port: (this.serveur.address() as AddressInfo).port, jeton: this.jeton };

    const serveur = createServer((req, res) => this.traiter(req, res));
    const hote = this.options.hote ?? '0.0.0.0';
    try {
      await ecouter(serveur, this.options.portPrefere ?? 0, hote);
    } catch (erreur) {
      if ((erreur as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw erreur;
      await ecouter(serveur, 0, hote);
    }
    this.serveur = serveur;
    this.jeton = (this.options.genererJeton ?? (() => randomBytes(16).toString('hex')))();
    return { port: (serveur.address() as AddressInfo).port, jeton: this.jeton };
  }

  /** Arrête le serveur : le jeton devient invalide, le téléphone devra rescanner un QR code. */
  async arreter(): Promise<void> {
    const serveur = this.serveur;
    this.serveur = null;
    this.jeton = null;
    if (!serveur) return;
    serveur.closeAllConnections();
    await new Promise<void>((resoudre) => serveur.close(() => resoudre()));
  }

  private traiter(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    const [prefixe, jeton, fichier, ...reste] = new URL(req.url ?? '/', 'http://x').pathname.split('/').filter(Boolean);
    if (prefixe !== 's' || !jeton || jeton !== this.jeton || reste.length > 0) {
      repondre(res, 404, 'text/plain; charset=utf-8', 'Session inconnue ou expirée : scannez le QR code affiché sur l’ordinateur.');
      return;
    }

    if (req.method === 'GET') {
      if (fichier === undefined && !req.url?.endsWith('/')) {
        // Les ressources de la page sont relatives : l'URL doit finir par « / ».
        res.writeHead(301, { Location: `/s/${jeton}/` }).end();
        return;
      }
      const contenu = this.ressource(fichier ?? 'index.html');
      if (contenu) {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'",
        );
        repondre(res, 200, contenu.type, contenu.texte);
        return;
      }
    }

    if (req.method === 'POST' && fichier === 'isbn') {
      void this.recevoirIsbn(req, res);
      return;
    }

    repondre(res, 404, 'text/plain; charset=utf-8', 'Introuvable');
  }

  private ressource(fichier: string): { type: string; texte: string } | null {
    const r = this.options.ressources;
    const table: Record<string, string> = {
      'index.html': r.html,
      'page.css': r.css,
      'page.js': r.pageJs,
      'decodeur.js': r.decodeurJs,
      'zxing.js': r.zxingJs,
    };
    const texte = table[fichier];
    const extension = fichier.split('.').pop() ?? '';
    return texte === undefined ? null : { type: TYPES[extension] ?? 'text/plain', texte };
  }

  private async recevoirIsbn(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let corps = '';
    for await (const morceau of req) {
      corps += String(morceau);
      if (corps.length > TAILLE_MAX_CORPS) {
        repondre(res, 413, 'text/plain; charset=utf-8', 'Requête trop volumineuse');
        req.destroy();
        return;
      }
    }

    let isbn: string;
    try {
      isbn = schemaCorps.parse(JSON.parse(corps)).isbn.replace(/[\s-]/g, '').toUpperCase();
    } catch {
      repondre(res, 400, 'text/plain; charset=utf-8', 'Corps invalide');
      return;
    }
    if (!/^97[89]\d{10}$/.test(isbn) && !/^\d{9}[\dX]$/.test(isbn)) {
      repondre(res, 400, 'text/plain; charset=utf-8', 'ISBN invalide');
      return;
    }

    this.options.onIsbn(isbn);
    res.writeHead(204).end();
  }
}

function ecouter(serveur: Server, port: number, hote: string): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    serveur.once('error', rejeter);
    serveur.listen(port, hote, () => {
      serveur.off('error', rejeter);
      resoudre();
    });
  });
}

function repondre(res: ServerResponse, statut: number, type: string, texte: string): void {
  res.writeHead(statut, { 'Content-Type': type }).end(texte);
}
