/**
 * `npm start` : lance tout e-biblio en une commande.
 *
 * 1. installe ce qui manque (serveur, application desktop) ;
 * 2. crée la base avec le fonds de démonstration si elle n'existe pas encore
 *    (une base existante n'est jamais touchée) ;
 * 3. démarre l'API, attend qu'elle réponde, puis ouvre l'application ;
 * 4. fermer la fenêtre de l'application, ou Ctrl+C, arrête tout.
 *
 * Uniquement des modules Node : le script fonctionne avant même `npm install`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));
const desktop = join(racine, 'desktop');
const port = Number(process.env.PORT ?? 3000);
const urlApi = `http://localhost:${port}`;
const cheminBase = process.env.DB_PATH ?? join(racine, 'data', 'biblio.db');
const windows = process.platform === 'win32';

const enfants = [];
let arretEnCours = false;

function titre(texte) {
  console.log(`\n\x1b[1m\x1b[36m▸ ${texte}\x1b[0m`);
}

function echouer(message) {
  console.error(`\n\x1b[31m✗ ${message}\x1b[0m`);
  arreterTout(1);
}

/** Commande npm bloquante (installation, seed) : sa sortie s'affiche telle quelle. */
function npmBloquant(args, dossier) {
  const r = spawnSync('npm', args, { cwd: dossier, stdio: 'inherit', shell: true });
  if (r.status !== 0) echouer(`« npm ${args.join(' ')} » a échoué (dossier ${dossier}).`);
}

/** Commande npm de longue durée : chaque ligne est préfixée pour savoir qui parle. */
function npmEnFond(nom, couleur, args, dossier, env = {}) {
  const enfant = spawn('npm', args, {
    cwd: dossier,
    shell: true,
    env: { ...process.env, ...env },
    detached: !windows, // un groupe de processus à arrêter d'un coup (macOS, Linux)
  });
  const prefixe = `\x1b[${couleur}m[${nom}]\x1b[0m `;
  const relayer = (flux) => {
    let reste = '';
    flux.on('data', (morceau) => {
      const lignes = (reste + morceau).split(/\r?\n/);
      reste = lignes.pop() ?? '';
      for (const ligne of lignes) if (ligne.trim()) console.log(prefixe + ligne);
    });
  };
  relayer(enfant.stdout);
  relayer(enfant.stderr);
  enfants.push(enfant);
  return enfant;
}

/** Arrête un processus et tous ses descendants (npm lance tsx, electron-vite lance Electron…). */
function tuerArbre(enfant) {
  if (enfant.exitCode !== null || enfant.pid === undefined) return;
  if (windows) spawnSync('taskkill', ['/pid', String(enfant.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-enfant.pid, 'SIGTERM');
    } catch {
      /* déjà arrêté */
    }
  }
}

function arreterTout(code = 0) {
  if (arretEnCours) return;
  arretEnCours = true;
  enfants.forEach(tuerArbre);
  process.exit(code);
}

async function apiRepond() {
  try {
    return (await fetch(`${urlApi}/sante`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

async function attendreApi(delaiMs) {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    if (await apiRepond()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

process.on('SIGINT', () => arreterTout(0));
process.on('SIGTERM', () => arreterTout(0));

// ---------- 0. Node.js ----------
const [majeure] = process.versions.node.split('.').map(Number);
if (majeure < 20) echouer(`Node.js 20 ou plus récent est requis (version actuelle : ${process.versions.node}). Téléchargement : https://nodejs.org`);

// ---------- 1. Dépendances ----------
if (!existsSync(join(racine, 'node_modules'))) {
  titre('Installation du serveur (première fois)…');
  npmBloquant(['install'], racine);
}
if (!existsSync(join(desktop, 'node_modules'))) {
  titre('Installation de l’application desktop (première fois, quelques minutes)…');
  npmBloquant(['install'], desktop);
}

// ---------- 2. API (et base au premier lancement) ----------
let apiLancee = false;
if (await apiRepond()) {
  titre(`L’API tourne déjà sur ${urlApi} : elle est réutilisée.`);
} else {
  if (!existsSync(cheminBase)) {
    titre('Création de la base avec le fonds de démonstration (première fois)…');
    npmBloquant(['run', 'seed:demo'], racine);
  }
  titre(`Démarrage de l’API sur ${urlApi}…`);
  const api = npmEnFond('api', 34, ['run', 'dev'], racine);
  apiLancee = true;
  api.on('exit', (code) => {
    if (!arretEnCours) echouer(`L’API s’est arrêtée (code ${code}). Le port ${port} est peut-être pris : essayez PORT=3001 npm start.`);
  });
  if (!(await attendreApi(30_000))) echouer(`L’API ne répond pas sur ${urlApi} après 30 s.`);
}

// ---------- 3. Application ----------
titre('Ouverture de l’application e-biblio…');
const app = npmEnFond('app', 35, ['run', 'dev'], desktop, { BIBLIO_API_URL: urlApi });
app.on('exit', () => {
  titre(apiLancee ? 'Application fermée : arrêt de l’API. À bientôt !' : 'Application fermée. À bientôt !');
  arreterTout(0);
});

console.log(`\n\x1b[32m✓ e-biblio démarre. Fermez la fenêtre de l’application (ou Ctrl+C ici) pour tout arrêter.\x1b[0m\n`);
