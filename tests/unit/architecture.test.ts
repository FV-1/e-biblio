import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou de l'architecture hexagonale : analyse les imports de src/
 * et vérifie le sens des dépendances.
 *
 *   domain       → domain uniquement, aucune bibliothèque
 *   ports        → domain, ports, aucune bibliothèque
 *   application  → domain, ports, application, aucune bibliothèque
 *   adapters/X   → tout sauf un autre adapter et les points d'entrée
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

type Couche = 'domain' | 'ports' | 'application' | `adapters/${string}` | 'racine';

interface Import {
  fichier: string;
  cible: string;
}

function fichiersTs(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersTs(chemin);
    return chemin.endsWith('.ts') ? [chemin] : [];
  });
}

function extraireImports(fichier: string): Import[] {
  const source = readFileSync(fichier, 'utf8');
  const motif = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
  return [...source.matchAll(motif)].map((m) => ({ fichier, cible: (m[1] ?? m[2] ?? m[3])! }));
}

function coucheDe(cheminAbsolu: string): Couche {
  const [premier, second] = relative(SRC, cheminAbsolu).split(sep);
  if (premier === 'domain' || premier === 'ports' || premier === 'application') return premier;
  if (premier === 'adapters' && second) return `adapters/${second}`;
  return 'racine';
}

/** Couche visée par un import, ou 'bibliotheque' pour un paquet npm / module node. */
function coucheCible(imp: Import): Couche | 'bibliotheque' {
  if (!imp.cible.startsWith('.')) return 'bibliotheque';
  return coucheDe(resolve(dirname(imp.fichier), imp.cible));
}

const AUTORISATIONS: Record<'domain' | 'ports' | 'application', ReadonlyArray<Couche>> = {
  domain: ['domain'],
  ports: ['domain', 'ports'],
  application: ['domain', 'ports', 'application'],
};

function violations(): string[] {
  const erreurs: string[] = [];
  for (const fichier of fichiersTs(SRC)) {
    const source = coucheDe(fichier);
    if (source === 'racine') continue; // main.ts, seed.ts, config.ts : composition roots

    for (const imp of extraireImports(fichier)) {
      const cible = coucheCible(imp);
      const nomFichier = relative(SRC, fichier);

      if (source.startsWith('adapters/')) {
        if (cible !== source && (cible.startsWith('adapters/') || cible === 'racine')) {
          erreurs.push(`${nomFichier} (${source}) ne doit pas importer ${imp.cible} (${cible})`);
        }
        continue;
      }

      const autorisees = AUTORISATIONS[source as keyof typeof AUTORISATIONS];
      if (cible === 'bibliotheque' || !autorisees.includes(cible)) {
        erreurs.push(`${nomFichier} (${source}) ne doit pas importer ${imp.cible} (${cible})`);
      }
    }
  }
  return erreurs;
}

describe('architecture hexagonale', () => {
  it('respecte le sens des dépendances entre couches', () => {
    expect(violations()).toEqual([]);
  });

  it('détecte bien une violation (auto-test du garde-fou)', () => {
    const faux: Import = { fichier: join(SRC, 'domain', 'x.ts'), cible: '../adapters/persistence/y.js' };
    expect(coucheCible(faux)).toBe('adapters/persistence');
    expect(coucheCible({ fichier: join(SRC, 'domain', 'x.ts'), cible: 'express' })).toBe('bibliotheque');
    expect(AUTORISATIONS.domain).not.toContain('adapters/persistence');
  });
});
