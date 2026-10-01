import { ErreurIntrouvable } from '../../domain/erreurs.js';
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
import { ResolveurNotice } from '../commun/resolveur-notice.js';
import type { VueExemplaire } from '../commun/vues.js';

export interface SaisieManuelleLivre {
  readonly titre: string;
  readonly auteurs: readonly string[];
  readonly couverture: string | null;
}

/** Trois façons de désigner le livre dont on ajoute un exemplaire. */
export type LivreAAjouter =
  /** Par ISBN : notice en base ou catalogue ; la saisie manuelle, si fournie, évite le catalogue. */
  | { readonly type: 'isbn'; readonly isbn: string; readonly saisieManuelle: SaisieManuelleLivre | null }
  /** Entièrement manuel, sans ISBN (ouvrage ancien, document interne…). */
  | { readonly type: 'manuel'; readonly saisieManuelle: SaisieManuelleLivre }
  /** Nouvel exemplaire d'un livre déjà enregistré (avec ou sans ISBN). */
  | { readonly type: 'existant'; readonly livreId: string };

export interface CommandeAjouterExemplaire {
  readonly emplacementId: string;
  readonly livre: LivreAAjouter;
}

/** D'où vient la notice du livre : déjà en base, catalogue externe ou saisie manuelle. */
export type SourceLivre = 'base' | 'catalogue' | 'saisie';

export interface ResultatAjoutExemplaire {
  readonly exemplaire: VueExemplaire;
  readonly sourceLivre: SourceLivre;
}

export class AjouterExemplaire {
  private readonly presentateur: PresentateurExemplaires;
  private readonly resolveur: ResolveurNotice;

  constructor(
    private readonly exemplaires: ExemplaireRepository,
    private readonly livres: LivreRepository,
    private readonly emplacements: EmplacementRepository,
    catalogue: CatalogueExterne,
    private readonly generateurId: GenerateurId,
  ) {
    this.presentateur = new PresentateurExemplaires(livres, emplacements);
    this.resolveur = new ResolveurNotice(livres, catalogue);
  }

  async executer(commande: CommandeAjouterExemplaire): Promise<ResultatAjoutExemplaire> {
    // Tout ce qui peut être validé localement l'est AVANT un éventuel appel
    // réseau : inutile d'interroger le catalogue pour une requête vouée à l'échec.
    const isbn = commande.livre.type === 'isbn' ? Isbn.creer(commande.livre.isbn) : null;
    const emplacement = await chargerEmplacement(this.emplacements, commande.emplacementId);
    Exemplaire.verifierRangeable(emplacement);

    const { livre, source } = await this.obtenirLivre(commande.livre, isbn);
    const numero = source === 'base' ? Exemplaire.prochainNumero(await this.exemplaires.trouverParLivre(livre.id)) : 1;
    const exemplaire = Exemplaire.creer({ id: this.generateurId.generer(), livre, numero, emplacement });

    if (source !== 'base') await this.livres.enregistrer(livre);
    await this.exemplaires.enregistrer(exemplaire);

    return { exemplaire: await this.presentateur.presenter(exemplaire), sourceLivre: source };
  }

  private async obtenirLivre(demande: LivreAAjouter, isbn: Isbn | null): Promise<{ livre: Livre; source: SourceLivre }> {
    switch (demande.type) {
      case 'existant': {
        const livre = await this.livres.trouverParId(demande.livreId);
        if (!livre) throw new ErreurIntrouvable('LIVRE_INTROUVABLE', `Livre « ${demande.livreId} » introuvable`);
        return { livre, source: 'base' };
      }

      case 'manuel':
        return { livre: this.nouveauLivre(null, demande.saisieManuelle), source: 'saisie' };

      case 'isbn': {
        const connu = await this.livres.trouverParIsbn(isbn!);
        if (connu) return { livre: connu, source: 'base' };
        if (demande.saisieManuelle) return { livre: this.nouveauLivre(isbn, demande.saisieManuelle), source: 'saisie' };

        const notice = await this.resolveur.resoudre(isbn!);
        return notice.source === 'base'
          ? { livre: notice.livre, source: 'base' }
          : { livre: this.nouveauLivre(isbn, notice.infos), source: 'catalogue' };
      }
    }
  }

  private nouveauLivre(isbn: Isbn | null, notice: SaisieManuelleLivre): Livre {
    return Livre.creer({ id: this.generateurId.generer(), isbn, ...notice });
  }
}
