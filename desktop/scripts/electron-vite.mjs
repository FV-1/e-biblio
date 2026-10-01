/**
 * Lance la CLI electron-vite après avoir retiré ELECTRON_RUN_AS_NODE.
 *
 * Certains environnements (terminal intégré de VS Code, outils basés sur
 * Electron…) définissent cette variable : Electron démarre alors comme un
 * simple Node.js, sans jamais ouvrir de fenêtre. electron-vite transmet
 * l'environnement tel quel au processus Electron, d'où ce garde-fou.
 */
delete process.env.ELECTRON_RUN_AS_NODE;

await import('../node_modules/electron-vite/bin/electron-vite.js');
