import { X509Certificate } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from 'selfsigned';

export interface Certificat {
  readonly cle: string;
  readonly cert: string;
}

/** Durée de validité d'un certificat créé, et marge avant échéance qui déclenche son renouvellement. */
const VALIDITE_JOURS = 365;
const MARGE_JOURS = 30;
const JOUR_MS = 24 * 60 * 60 * 1000;

const FICHIER_CERT = 'appairage-certificat.pem';
const FICHIER_CLE = 'appairage-cle.pem';

/**
 * Certificat TLS auto-signé du serveur d'appairage. Les navigateurs mobiles
 * n'ouvrent la caméra en direct que sur une page HTTPS (ADR-008).
 *
 * Il est créé une fois puis réutilisé : le téléphone qui a accepté
 * l'avertissement « connexion non privée » n'a pas à le refaire à chaque
 * session. Il est recréé s'il approche de son échéance ou s'il est illisible.
 */
export async function obtenirCertificat(dossier: string, adressesIp: readonly string[], maintenant = new Date()): Promise<Certificat> {
  const existant = await lire(dossier);
  if (existant && encoreValide(existant.cert, maintenant)) return existant;

  const resultat = await generate([{ name: 'commonName', value: 'e-biblio (poste local)' }], {
    keyType: 'ec',
    curve: 'P-256',
    notBeforeDate: new Date(maintenant.getTime() - JOUR_MS),
    notAfterDate: new Date(maintenant.getTime() + VALIDITE_JOURS * JOUR_MS),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, ...adressesIp.map((ip) => ({ type: 7 as const, ip }))] },
    ],
  });
  const certificat = { cle: resultat.private, cert: resultat.cert };
  await mkdir(dossier, { recursive: true });
  await writeFile(join(dossier, FICHIER_CLE), certificat.cle, { mode: 0o600 });
  await writeFile(join(dossier, FICHIER_CERT), certificat.cert);
  return certificat;
}

async function lire(dossier: string): Promise<Certificat | null> {
  try {
    return {
      cle: await readFile(join(dossier, FICHIER_CLE), 'utf8'),
      cert: await readFile(join(dossier, FICHIER_CERT), 'utf8'),
    };
  } catch {
    return null;
  }
}

function encoreValide(cert: string, maintenant: Date): boolean {
  try {
    return new Date(new X509Certificate(cert).validTo).getTime() - maintenant.getTime() > MARGE_JOURS * JOUR_MS;
  } catch {
    return false; // fichier corrompu : on en refait un
  }
}
