import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { adressesReseau } from '../../src/main/appairage/adresses-reseau';
import { AppairageTelephone } from '../../src/main/appairage/appairage-telephone';

function carte(address: string, options: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo {
  return { address, family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null, ...options } as NetworkInterfaceInfo;
}

describe('adressesReseau', () => {
  it('garde les IPv4 externes, cartes physiques privées en premier', () => {
    const adresses = adressesReseau({
      'vEthernet (WSL)': [carte('172.22.16.1')],
      'Loopback Pseudo-Interface 1': [carte('127.0.0.1', { internal: true })],
      'Wi-Fi': [carte('fe80::1', { family: 'IPv6' }), carte('192.168.1.42')],
      Ethernet: [carte('169.254.10.2')], // auto-configurée : inutilisable
      'Carte publique': [carte('203.0.113.7')],
    });
    expect(adresses).toEqual([
      { carte: 'Wi-Fi', ip: '192.168.1.42' },
      { carte: 'vEthernet (WSL)', ip: '172.22.16.1' },
      { carte: 'Carte publique', ip: '203.0.113.7' },
    ]);
  });

  it('renvoie une liste vide sans réseau', () => {
    expect(adressesReseau({ lo: [carte('127.0.0.1', { internal: true })] })).toEqual([]);
  });
});

describe('AppairageTelephone', () => {
  const serveurFake = (echoue = false) => {
    const appels: string[] = [];
    return {
      appels,
      serveur: {
        protocole: 'https' as const,
        demarrer: async () => {
          appels.push('demarrer');
          if (echoue) throw new Error('EACCES');
          return { port: 47800, jeton: 'abc' };
        },
        arreter: async () => {
          appels.push('arreter');
        },
      },
    };
  };

  it('construit une URL et un QR code par adresse réseau', async () => {
    const { serveur } = serveurFake();
    const appairage = new AppairageTelephone({
      serveur,
      interfacesReseau: () => ({ 'Wi-Fi': [carte('192.168.1.42')], Ethernet: [carte('10.0.0.5')] }),
      genererQrCode: async (texte) => `qr:${texte}`,
    });

    expect(await appairage.demarrer()).toEqual({
      ok: true,
      valeur: {
        adresses: [
          { carte: 'Wi-Fi', url: 'https://192.168.1.42:47800/s/abc/', qrCode: 'qr:https://192.168.1.42:47800/s/abc/' },
          { carte: 'Ethernet', url: 'https://10.0.0.5:47800/s/abc/', qrCode: 'qr:https://10.0.0.5:47800/s/abc/' },
        ],
      },
    });
  });

  it('échoue explicitement sans réseau, sans ouvrir de serveur', async () => {
    const { serveur, appels } = serveurFake();
    const appairage = new AppairageTelephone({ serveur, interfacesReseau: () => ({}), genererQrCode: async () => '' });
    expect(await appairage.demarrer()).toMatchObject({ ok: false, erreur: { message: /Aucun réseau local/ } });
    expect(appels).toEqual([]);
  });

  it('transforme un échec d’ouverture du serveur en erreur lisible', async () => {
    const { serveur } = serveurFake(true);
    const appairage = new AppairageTelephone({
      serveur,
      interfacesReseau: () => ({ 'Wi-Fi': [carte('192.168.1.42')] }),
      genererQrCode: async () => '',
    });
    expect(await appairage.demarrer()).toMatchObject({ ok: false, erreur: { message: /EACCES/ } });
  });

  it('arrête le serveur', async () => {
    const { serveur, appels } = serveurFake();
    await new AppairageTelephone({ serveur, interfacesReseau: () => ({}), genererQrCode: async () => '' }).arreter();
    expect(appels).toEqual(['arreter']);
  });
});
