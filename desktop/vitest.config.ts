import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Processus main : client HTTP, IPC, configuration. Environnement Node, sans Electron.
        test: { name: 'main', include: ['tests/main/**/*.test.ts'], environment: 'node' },
      },
      {
        // Composants React avec un faux ServiceBibliotheque, dans un DOM simulé.
        plugins: [react()],
        test: {
          name: 'renderer',
          include: ['tests/renderer/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/renderer/setup.ts'],
        },
      },
    ],
  },
});
