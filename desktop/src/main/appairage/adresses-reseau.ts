import type { NetworkInterfaceInfo } from 'node:os';

export interface AdresseReseau {
  readonly carte: string;
  readonly ip: string;
}

/** Cartes virtuelles (WSL, Hyper-V, VirtualBox, Docker, VPN…) : rarement celles du téléphone. */
const CARTE_VIRTUELLE = /vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|loopback|tailscale|zerotier|vpn|tun|tap/i;

function estPrivee(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/**
 * Adresses IPv4 du poste joignables depuis le réseau local, la plus probable
 * en premier : adresses privées des cartes physiques, puis les autres.
 */
export function adressesReseau(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): AdresseReseau[] {
  const adresses = Object.entries(interfaces).flatMap(([carte, infos]) =>
    (infos ?? [])
      .filter((i) => i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
      .map((i) => ({ carte, ip: i.address })),
  );
  const score = (a: AdresseReseau) => (estPrivee(a.ip) ? 0 : 2) + (CARTE_VIRTUELLE.test(a.carte) ? 1 : 0);
  return adresses.sort((a, b) => score(a) - score(b));
}
