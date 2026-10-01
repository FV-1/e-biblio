import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decodeurJs from './mobile/decodeur.js?raw';
import html from './mobile/index.html?raw';
import css from './mobile/page.css?raw';
import pageJs from './mobile/page.js?raw';
import type { RessourcesMobiles } from './serveur-appairage';

/**
 * Fichiers servis au téléphone. Ceux de l'application sont intégrés au bundle
 * à la compilation (`?raw`) ; le décodeur ZXing est lu depuis node_modules.
 */
export function chargerRessourcesMobiles(): RessourcesMobiles {
  const require = createRequire(__filename);
  const zxingJs = readFileSync(require.resolve('@zxing/library/umd/index.min.js'), 'utf8');
  return { html, css, pageJs, decodeurJs, zxingJs };
}
