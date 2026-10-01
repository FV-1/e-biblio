import { createContext, useContext, type ReactNode } from 'react';
import type { ServiceBibliotheque } from '../../../commun/service-bibliotheque';

/**
 * Injection de dépendance côté interface : les composants obtiennent le port
 * ServiceBibliotheque par ce contexte, sans savoir s'il s'agit du pont IPC
 * (application réelle) ou d'un fake (tests).
 */
const ContexteService = createContext<ServiceBibliotheque | null>(null);

export function FournisseurService({ service, children }: { service: ServiceBibliotheque; children: ReactNode }) {
  return <ContexteService.Provider value={service}>{children}</ContexteService.Provider>;
}

export function useService(): ServiceBibliotheque {
  const service = useContext(ContexteService);
  if (!service) throw new Error('useService doit être utilisé sous un <FournisseurService>');
  return service;
}
