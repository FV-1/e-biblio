import { ErreurValidation } from '../../domain/erreurs.js';
import { Exemplaire } from '../../domain/exemplaire.js';
import { Isbn } from '../../domain/isbn.js';
import { Livre } from '../../domain/livre.js';
import type { CatalogueExterne } from '../../ports/catalogue-externe.js';
import type { EmplacementRepository } from '../../ports/emplacement-repository.js';
import type { ExemplaireRepository } from '../../ports/exemplaire-repository.js';
import type { GenerateurId } from '../../ports/generateur-id.js';
import type { LivreRepository } from '../../ports/livre-repository.js';
import { chargerEmplacement } from '../commun/chargement.js';
import { PresentateurExemplaires } from '../commun/presentateur-exemplaires.js';
import type { VueExemplaire } from '../commun/vues.js';

export interface SaisieManuelleLivre {
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

export interface CommandeAjouterExemplaire {
  readonly isbn: string;
  readonly emplacementId: string;
  /** Notice saisie à la main ; si présente, le catalogue externe n'est pas interrogé. */
  readonly saisieManuelle: SaisieManuelleLivre | null;
}

/** D'où vient la notice du livre : déjà en base, catalogue externe ou saisie manuelle. */
export type SourceLivre = 'base' | 'catalogue' | 'saisie';

export interface ResultatAjoutExemplaire {
  readonly exemplaire: VueExemplaire;
  readonly sourceLivre: SourceLivre;
}

/**
 * Ajout d'un exemplaire par ISBN. Ordre de résolution de la notice :
 *   1. livre déjà connu en base → aucun appel externe
 *   2. saisie manuelle fournie → utilisée telle quelle
 *   3. sinon, interrogation du catalogue externe ; s'il est indisponible ou ne
 *      connaît pas l'ISBN, erreur explicite invitant à renvoyer une saisie manuelle.
 */
export class AjouterExemplaire {
  private readonly presentateur: PresentateurExemplaires;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    private readonly livres: LivreRepository,
    private readonly emplacements: EmplacementRepository,
    private readonly catalogue: CatalogueExterne,
    private readonly generateurId: GenerateurId,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
  }

  async executer(commande: CommandeAjouterExemplaire): Promise<ResultatAjoutExemplaire> {
    const isbn = Isbn.creer(commande.isbn);
    // ISBN, emplacement et règles de rangement sont validés AVANT tout appel
    // réseau : inutile d'interroger le catalogue pour une requête vouée à l'échec.
    const emplacement = await chargerEmplacement(this.emplacements, commande.emplacementId);
    const exemplaire = Exemplaire.creer({ id: this.generateurId.generer(), isbn, emplacement });

    const { livre, source } = await this.resoudreLivre(isbn, commande.saisieManuelle);

    if (source !== 'base') await this.livres.enregistrer(livre);
    await this.exemplaires.enregistrer(exemplaire);

    return { exemplaire: await this.presentateur.presenter(exemplaire), sourceLivre: source };
  }

  private async resoudreLivre(
    isbn: Isbn,
    saisie: SaisieManuelleLivre | null,
  ): Promise<{ livre: Livre; source: SourceLivre }> {
    const connu = await this.livres.trouverParIsbn(isbn);
    if (connu) return { livre: connu, source: 'base' };

    if (saisie) return { livre: Livre.creer({ isbn, ...saisie }), source: 'saisie' };

    const resultat = await this.catalogue.rechercherParIsbn(isbn);
    switch (resultat.statut) {
      case 'trouve':
        return { livre: Livre.creer({ isbn, ...resultat.livre }), source: 'catalogue' };
      case 'introuvable':
        throw new ErreurValidation(
          'LIVRE_INCONNU_DU_CATALOGUE',
          `L'ISBN ${isbn.valeur} est inconnu du catalogue : renvoyez la requête avec « titre » et « auteurs » pour une saisie manuelle`,
        );
      case 'indisponible':
        throw new ErreurValidation(
          'CATALOGUE_INDISPONIBLE',
          `Le catalogue est indisponible (${resultat.raison}) : renvoyez la requête avec « titre » et « auteurs » pour une saisie manuelle`,
        );
    }
  }
}
