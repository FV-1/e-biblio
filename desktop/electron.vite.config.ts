import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

/**
 * Trois cibles de build, une par processus Electron :
 *   main     → src/main/index.ts      (Node.js : fenêtre, IPC, accès réseau)
 *   preload  → src/preload/index.ts   (pont sécurisé main ↔ page)
 *   renderer → src/renderer/index.html (React, sans aucun accès Node)
 */
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
