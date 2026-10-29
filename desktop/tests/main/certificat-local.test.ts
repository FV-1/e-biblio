import { X509Certificate } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { obtenirCertificat } from '../../src/main/appairage/certificat-local';

let dossier: string;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'e-biblio-cert-'));
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

describe('obtenirCertificat', () => {
  it('crée un certificat valide un an, avec les adresses du poste', async () => {
    const maintenant = new Date('2026-10-29T10:00:00Z');
    const { cert, cle } = await obtenirCertificat(dossier, ['192.168.1.20'], maintenant);

    const x509 = new X509Certificate(cert);
    expect(x509.subjectAltName).toContain('IP Address:192.168.1.20');
    expect(new Date(x509.validTo).getFullYear()).toBe(2027);
    expect(cle).toContain('PRIVATE KEY');
  });

  it('réutilise le même certificat : le téléphone n’a pas à accepter l’avertissement à chaque fois', async () => {
    const premier = await obtenirCertificat(dossier, ['192.168.1.20']);
    const second = await obtenirCertificat(dossier, ['10.0.0.5']);
    expect(second).toEqual(premier);
  });

  it('en recrée un quand l’échéance approche', async () => {
    const maintenant = new Date('2026-10-29T10:00:00Z');
    const premier = await obtenirCertificat(dossier, [], maintenant);
    const presqueUnAnPlusTard = new Date('2027-10-10T10:00:00Z');
    expect((await obtenirCertificat(dossier, [], presqueUnAnPlusTard)).cert).not.toBe(premier.cert);
  });

  it('en recrée un si le fichier est illisible', async () => {
    await writeFile(join(dossier, 'appairage-certificat.pem'), 'corrompu');
    await writeFile(join(dossier, 'appairage-cle.pem'), 'corrompu');
    const { cert } = await obtenirCertificat(dossier, []);
    expect(() => new X509Certificate(cert)).not.toThrow();
  });
});
