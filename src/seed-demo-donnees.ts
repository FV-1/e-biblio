import type { Emplacement } from './domain/emplacement.js';
import { Exemplaire } from './domain/exemplaire.js';
import { Isbn } from './domain/isbn.js';
import { Livre } from './domain/livre.js';
import type { ExemplaireRepository } from './ports/exemplaire-repository.js';
import type { LivreRepository } from './ports/livre-repository.js';

/**
 * Un exemplaire de démonstration : son étagère théorique et, s'il a déjà été
 * scanné, l'étagère où il a été vu et il y a combien de jours.
 * vuSur différent de etagere ⇒ exemplaire mal rangé.
 */
interface ExemplaireDemo {
  readonly etagere: string;
  readonly vuSur?: string;
  readonly ilYaJours?: number;
}

interface OeuvreDemo {
  /** Suffixe des identifiants lisibles : livre-<cle>, ex-<cle>-<numéro>. */
  readonly cle: string;
  readonly isbn: string | null;
  readonly titre: string;
  readonly auteurs: readonly string[];
  /** Faux : notice sans couverture (à compléter), même si l'ISBN en a une. */
  readonly avecCouverture?: boolean;
  readonly exemplaires: readonly ExemplaireDemo[];
}

/**
 * Fonds de démonstration, rangé dans la hiérarchie du seed (cf. CONFIG_SEED) :
 * Romans (rayon-1-1), Policiers (rayon-1-2), Sciences (rayon-2-1), Histoire (rayon-2-2).
 *
 * Les ISBN sont ceux d'éditions réelles (Folio, Livre de Poche, Champs…), dont la
 * couverture Open Library a été vérifiée. Le jeu couvre les cas utiles à l'interface :
 * plus de 25 œuvres (pagination), plusieurs exemplaires, plusieurs auteurs, accents,
 * œuvres sans ISBN, sans couverture ou sans auteur, exemplaires jamais détectés,
 * bien rangés et mal rangés (dans la même salle ou dans l'autre).
 */
export const OEUVRES_DEMO: readonly OeuvreDemo[] = [
  // Romans
  {
    cle: 'etranger', isbn: '9782070360024', titre: "L'Étranger", auteurs: ['Albert Camus'],
    exemplaires: [
      { etagere: 'etagere-1-1-1', vuSur: 'etagere-1-1-1', ilYaJours: 3 },
      { etagere: 'etagere-1-1-1', vuSur: 'etagere-1-1-1', ilYaJours: 3 },
      { etagere: 'etagere-1-1-1', vuSur: 'etagere-2-2-1', ilYaJours: 1 },
    ],
  },
  {
    cle: 'peste', isbn: '9782070360420', titre: 'La Peste', auteurs: ['Albert Camus'],
    exemplaires: [{ etagere: 'etagere-1-1-1', vuSur: 'etagere-1-1-1', ilYaJours: 3 }, { etagere: 'etagere-1-1-1' }],
  },
  {
    cle: 'condition-humaine', isbn: '9782070360017', titre: 'La Condition humaine', auteurs: ['André Malraux'],
    exemplaires: [{ etagere: 'etagere-1-1-2', vuSur: 'etagere-1-1-2', ilYaJours: 5 }],
  },
  {
    cle: 'voyage', isbn: '9782070360284', titre: 'Voyage au bout de la nuit', auteurs: ['Louis-Ferdinand Céline'],
    exemplaires: [{ etagere: 'etagere-1-1-1', vuSur: 'etagere-1-1-1', ilYaJours: 3 }],
  },
  {
    cle: 'bovary', isbn: '9782070413119', titre: 'Madame Bovary', auteurs: ['Gustave Flaubert'],
    exemplaires: [{ etagere: 'etagere-1-1-2', vuSur: 'etagere-1-1-2', ilYaJours: 5 }, { etagere: 'etagere-1-1-2', vuSur: 'etagere-1-1-3', ilYaJours: 5 }],
  },
  {
    cle: 'education-sentimentale', isbn: '9782253010692', titre: "L'Éducation sentimentale", auteurs: ['Gustave Flaubert'],
    exemplaires: [{ etagere: 'etagere-1-1-2' }],
  },
  {
    cle: 'bonheur-des-dames', isbn: '9782253002864', titre: 'Au Bonheur des Dames', auteurs: ['Émile Zola'],
    exemplaires: [{ etagere: 'etagere-1-1-3', vuSur: 'etagere-1-1-3', ilYaJours: 8 }],
  },
  {
    cle: 'germinal', isbn: '9782253004226', titre: 'Germinal', auteurs: ['Émile Zola'],
    exemplaires: [{ etagere: 'etagere-1-1-3', vuSur: 'etagere-1-1-3', ilYaJours: 8 }, { etagere: 'etagere-1-1-3' }],
  },
  {
    cle: 'colline', isbn: '9782253002895', titre: 'Colline', auteurs: ['Jean Giono'], avecCouverture: false,
    exemplaires: [{ etagere: 'etagere-1-1-2' }],
  },
  {
    cle: 'vingt-mille-lieues', isbn: '9782253006329', titre: 'Vingt mille lieues sous les mers', auteurs: ['Jules Verne'],
    exemplaires: [{ etagere: 'etagere-1-1-3', vuSur: 'etagere-2-1-1', ilYaJours: 2 }, { etagere: 'etagere-1-1-3', vuSur: 'etagere-1-1-3', ilYaJours: 8 }],
  },
  {
    cle: 'notre-dame', isbn: '9782253009689', titre: 'Notre-Dame de Paris', auteurs: ['Victor Hugo'],
    exemplaires: [{ etagere: 'etagere-1-1-2', vuSur: 'etagere-1-1-2', ilYaJours: 5 }],
  },
  {
    cle: 'sophie-trebuchet', isbn: '9782253034643', titre: 'Le Roman de Sophie Trébuchet', auteurs: ['Geneviève Dormann'], avecCouverture: false,
    exemplaires: [{ etagere: 'etagere-1-1-3' }],
  },
  {
    cle: 'ecume-des-jours', isbn: '9782253140870', titre: "L'Écume des jours", auteurs: ['Boris Vian'],
    exemplaires: [{ etagere: 'etagere-1-1-1', vuSur: 'etagere-1-1-1', ilYaJours: 3 }, { etagere: 'etagere-1-1-1', vuSur: 'etagere-1-2-2', ilYaJours: 1 }],
  },
  {
    cle: 'vieille-dame-djerba', isbn: '9782253033059', titre: 'La Vieille Dame de Djerba', auteurs: ['Joseph Joffo'],
    exemplaires: [{ etagere: 'etagere-1-1-3' }],
  },
  {
    cle: 'folleville', isbn: '9782080706355', titre: 'Embrassons-nous, Folleville ! et autres pièces', auteurs: ['Eugène Labiche'],
    exemplaires: [{ etagere: 'etagere-1-1-3', vuSur: 'etagere-1-1-3', ilYaJours: 8 }],
  },

  // Policiers
  {
    cle: 'millenium-1', isbn: '9782742761579', titre: "Millénium 1 : Les hommes qui n'aimaient pas les femmes", auteurs: ['Stieg Larsson'],
    exemplaires: [
      { etagere: 'etagere-1-2-1', vuSur: 'etagere-1-2-1', ilYaJours: 4 },
      { etagere: 'etagere-1-2-1', vuSur: 'etagere-1-2-1', ilYaJours: 4 },
      { etagere: 'etagere-1-2-1' },
    ],
  },
  {
    cle: 'millenium-2', isbn: '9782742765010', titre: "Millénium 2 : La fille qui rêvait d'un bidon d'essence et d'une allumette", auteurs: ['Stieg Larsson'],
    exemplaires: [{ etagere: 'etagere-1-2-1', vuSur: 'etagere-1-2-1', ilYaJours: 4 }, { etagere: 'etagere-1-2-1', vuSur: 'etagere-1-2-3', ilYaJours: 4 }],
  },
  {
    cle: 'harry-quebert', isbn: '9782877068161', titre: "La Vérité sur l'affaire Harry Quebert", auteurs: ['Joël Dicker'],
    exemplaires: [{ etagere: 'etagere-1-2-2', vuSur: 'etagere-1-2-2', ilYaJours: 6 }, { etagere: 'etagere-1-2-2' }],
  },
  {
    cle: 'nom-de-la-rose', isbn: '9782253033134', titre: 'Le Nom de la rose', auteurs: ['Umberto Eco'],
    exemplaires: [{ etagere: 'etagere-1-2-2', vuSur: 'etagere-1-2-2', ilYaJours: 6 }],
  },
  {
    cle: 'monsieur-monde', isbn: '9782253142836', titre: 'La Fuite de Monsieur Monde', auteurs: ['Georges Simenon'],
    exemplaires: [{ etagere: 'etagere-1-2-3' }],
  },
  {
    cle: 'net-force', isbn: '9782253171768', titre: 'Net Force : Vandales virtuels', auteurs: ['Tom Clancy', 'Steve Pieczenik'],
    exemplaires: [{ etagere: 'etagere-1-2-3', vuSur: 'etagere-1-2-3', ilYaJours: 6 }],
  },

  // Sciences
  {
    cle: 'algorithmique', isbn: '9782100545261', titre: 'Algorithmique', auteurs: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
    exemplaires: [{ etagere: 'etagere-2-1-1', vuSur: 'etagere-2-1-1', ilYaJours: 2 }, { etagere: 'etagere-2-1-1', vuSur: 'etagere-2-1-2', ilYaJours: 2 }],
  },
  {
    cle: 'revolutions-scientifiques', isbn: '9782080811158', titre: 'La Structure des révolutions scientifiques', auteurs: ['Thomas S. Kuhn'],
    exemplaires: [{ etagere: 'etagere-2-1-2', vuSur: 'etagere-2-1-2', ilYaJours: 2 }],
  },
  {
    cle: 'idees-en-physique', isbn: '9782080811196', titre: "L'Évolution des idées en physique", auteurs: ['Albert Einstein', 'Leopold Infeld'],
    exemplaires: [{ etagere: 'etagere-2-1-2' }],
  },
  {
    cle: 'diversite-du-monde', isbn: '9782020981118', titre: 'Penser la diversité du monde', auteurs: ["Philippe d'Iribarne"],
    exemplaires: [{ etagere: 'etagere-2-1-3', vuSur: 'etagere-2-1-3', ilYaJours: 2 }],
  },
  {
    cle: 'rapport-inventaire', isbn: null, titre: "Rapport d'inventaire des collections 2025", auteurs: ['Service documentation'],
    exemplaires: [{ etagere: 'etagere-2-1-3' }],
  },
  {
    cle: 'polycopie-quantique', isbn: null, titre: 'Polycopié de mécanique quantique', auteurs: [],
    exemplaires: [{ etagere: 'etagere-2-1-3' }, { etagere: 'etagere-2-1-3' }],
  },

  // Histoire
  {
    cle: 'etrange-defaite', isbn: '9782070325696', titre: "L'Étrange Défaite", auteurs: ['Marc Bloch'],
    exemplaires: [{ etagere: 'etagere-2-2-1', vuSur: 'etagere-2-2-1', ilYaJours: 7 }],
  },
  {
    cle: 'sapiens', isbn: '9782226257017', titre: "Sapiens : Une brève histoire de l'humanité", auteurs: ['Yuval Noah Harari'],
    exemplaires: [{ etagere: 'etagere-2-2-1', vuSur: 'etagere-2-1-1', ilYaJours: 1 }, { etagere: 'etagere-2-2-1', vuSur: 'etagere-2-2-1', ilYaJours: 7 }],
  },
  {
    cle: 'afrique-des-africains', isbn: '9782020022415', titre: "L'Afrique des Africains : Inventaire de la négritude", auteurs: ['Claude Wauthier'],
    exemplaires: [{ etagere: 'etagere-2-2-2' }],
  },
  {
    cle: 'art-et-institutions', isbn: '9782070328659', titre: "L'Art et ses institutions en France : De la Révolution à nos jours", auteurs: ['Gérard Monnier'],
    exemplaires: [{ etagere: 'etagere-2-2-2', vuSur: 'etagere-2-2-2', ilYaJours: 7 }],
  },
  {
    cle: 'jours-tranquilles-89', isbn: '9782738100559', titre: 'Jours tranquilles en 89', auteurs: ['Marc Abélès'],
    exemplaires: [{ etagere: 'etagere-2-2-2' }],
  },
  {
    cle: 'mythes-reves-mysteres', isbn: '9782070325207', titre: 'Mythes, rêves et mystères', auteurs: ['Mircea Eliade'],
    exemplaires: [{ etagere: 'etagere-2-2-3', vuSur: 'etagere-2-2-3', ilYaJours: 7 }],
  },
  {
    cle: 'cadastre-1812', isbn: null, titre: 'Cadastre napoléonien de la commune (1812)', auteurs: [],
    exemplaires: [{ etagere: 'etagere-2-2-3' }],
  },
  {
    cle: 'carte-cassini', isbn: null, titre: 'Carte de Cassini : feuille de Paris', auteurs: ['César-François Cassini de Thury'],
    exemplaires: [{ etagere: 'etagere-2-2-3', vuSur: 'etagere-2-2-3', ilYaJours: 7 }],
  },
];

const URL_COUVERTURES = 'https://covers.openlibrary.org/b/isbn';

export interface DonneesDemo {
  readonly livres: Livre[];
  readonly exemplaires: Exemplaire[];
}

/**
 * Construit les livres et exemplaires de démonstration à partir des emplacements
 * du seed. Les dates de détection sont calculées depuis `maintenant`, pour que
 * le fonds paraisse toujours scanné récemment.
 */
export function construireDonneesDemo(emplacements: readonly Emplacement[], maintenant: Date): DonneesDemo {
  const parId = new Map(emplacements.map((e) => [e.id, e]));
  const emplacement = (id: string): Emplacement => {
    const trouve = parId.get(id);
    if (!trouve) throw new Error(`Emplacement de démonstration inconnu : ${id}`);
    return trouve;
  };

  const livres: Livre[] = [];
  const exemplaires: Exemplaire[] = [];
  for (const oeuvre of OEUVRES_DEMO) {
    const livre = Livre.creer({
      id: `livre-${oeuvre.cle}`,
      isbn: oeuvre.isbn === null ? null : Isbn.creer(oeuvre.isbn),
      titre: oeuvre.titre,
      auteurs: oeuvre.auteurs,
      couverture: oeuvre.isbn !== null && oeuvre.avecCouverture !== false ? `${URL_COUVERTURES}/${oeuvre.isbn}-L.jpg` : null,
    });
    livres.push(livre);

    oeuvre.exemplaires.forEach((ex, i) => {
      const exemplaire = Exemplaire.creer({
        id: `ex-${oeuvre.cle}-${i + 1}`,
        livre,
        numero: i + 1,
        emplacement: emplacement(ex.etagere),
      });
      if (ex.vuSur) {
        const date = new Date(maintenant.getTime() - (ex.ilYaJours ?? 0) * 24 * 60 * 60 * 1000);
        exemplaire.enregistrerDetection(emplacement(ex.vuSur), date);
      }
      exemplaires.push(exemplaire);
    });
  }
  return { livres, exemplaires };
}

/** Enregistre le fonds de démonstration via les ports : fonctionne avec n'importe quel adapter. */
export async function peuplerDemo(
  livreRepository: LivreRepository,
  exemplaireRepository: ExemplaireRepository,
  emplacements: readonly Emplacement[],
  maintenant: Date,
): Promise<DonneesDemo> {
  const donnees = construireDonneesDemo(emplacements, maintenant);
  for (const livre of donnees.livres) await livreRepository.enregistrer(livre);
  for (const exemplaire of donnees.exemplaires) await exemplaireRepository.enregistrer(exemplaire);
  return donnees;
}
