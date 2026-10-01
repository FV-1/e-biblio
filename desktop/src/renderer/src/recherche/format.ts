const LIBELLES_TYPES: Record<string, string> = {
  etage: 'Étage',
  salle: 'Salle',
  rayon: 'Rayon',
  etagere: 'Étagère',
  niveau: 'Niveau',
};

/** Libellé lisible d'un type d'emplacement (un type inconnu est affiché tel quel). */
export function libelleType(type: string): string {
  return LIBELLES_TYPES[type] ?? type;
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

export function formaterDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : FORMAT_DATE.format(date);
}

export function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}
