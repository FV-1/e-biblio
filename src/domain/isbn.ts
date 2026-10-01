import { ErreurValidation } from './erreurs.js';

/**
 * Objet valeur ISBN.
 * Accepte un ISBN-10 ou un ISBN-13 (tirets et espaces tolérés), vérifie la clé
 * de contrôle et normalise toujours en ISBN-13 : un même livre saisi sous ses
 * deux formes a ainsi une seule identité.
 */
export class Isbn {
  private constructor(readonly valeur: string) {}

  static creer(brut: string): Isbn {
    const nettoye = brut.replace(/[\s-]/g, '').toUpperCase();

    if (/^\d{9}[\dX]$/.test(nettoye)) {
      if (!cleIsbn10Valide(nettoye)) throw isbnInvalide(brut, 'clé de contrôle ISBN-10 incorrecte');
      return new Isbn(isbn10VersIsbn13(nettoye));
    }

    if (/^\d{13}$/.test(nettoye)) {
      if (!/^97[89]/.test(nettoye)) throw isbnInvalide(brut, 'un ISBN-13 commence par 978 ou 979');
      if (calculerCleIsbn13(nettoye.slice(0, 12)) !== nettoye[12]) {
        throw isbnInvalide(brut, 'clé de contrôle ISBN-13 incorrecte');
      }
      return new Isbn(nettoye);
    }

    throw isbnInvalide(brut, 'format attendu : 10 ou 13 caractères');
  }

  egale(autre: Isbn): boolean {
    return this.valeur === autre.valeur;
  }

  toString(): string {
    return this.valeur;
  }
}

function cleIsbn10Valide(isbn10: string): boolean {
  const somme = [...isbn10].reduce((total, caractere, i) => {
    const chiffre = caractere === 'X' ? 10 : Number(caractere);
    return total + chiffre * (10 - i);
  }, 0);
  // 'X' n'est autorisé qu'en dernière position (garanti par la regex appelante).
  return somme % 11 === 0;
}

function calculerCleIsbn13(douzePremiers: string): string {
  const somme = [...douzePremiers].reduce((total, c, i) => total + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (somme % 10)) % 10);
}

function isbn10VersIsbn13(isbn10: string): string {
  const base = `978${isbn10.slice(0, 9)}`;
  return base + calculerCleIsbn13(base);
}

function isbnInvalide(brut: string, raison: string): ErreurValidation {
  return new ErreurValidation('ISBN_INVALIDE', `ISBN « ${brut} » invalide : ${raison}`);
}
