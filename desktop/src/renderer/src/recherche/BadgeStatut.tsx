import type { Exemplaire } from '../../../commun/api';

/**
 * Trois états visibles, alors que l'API ne fournit qu'un booléen `malRange` :
 * un exemplaire jamais détecté n'est pas « mal rangé », mais on ne peut pas
 * non plus affirmer qu'il est bien rangé.
 */
export function BadgeStatut({ exemplaire }: { exemplaire: Exemplaire }) {
  if (exemplaire.malRange) return <span className="badge badge-alerte">Mal rangé</span>;
  if (exemplaire.derniereDetection === null) return <span className="badge badge-neutre">Jamais détecté</span>;
  return <span className="badge badge-succes">Bien rangé</span>;
}
