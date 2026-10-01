import type { Emplacement } from '../../domain/emplacement.js';
import { ErreurIntrouvable } from '../../domain/erreurs.js';
import type { Exemplaire } from '../../domain/exemplaire.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';

export async function chargerEmplacement(repository: EmplacementRepository, id: string): Promise<Emplacement> {
  const emplacement = await repository.trouverParId(id);
  if (!emplacement) throw new ErreurIntrouvable('EMPLACEMENT_INTROUVABLE', `Emplacement « ${id} » introuvable`);
  return emplacement;
}

export async function chargerExemplaire(repository: ExemplaireRepository, id: string): Promise<Exemplaire> {
  const exemplaire = await repository.trouverParId(id);
  if (!exemplaire) throw new ErreurIntrouvable('EXEMPLAIRE_INTROUVABLE', `Exemplaire « ${id} » introuvable`);
  return exemplaire;
}
