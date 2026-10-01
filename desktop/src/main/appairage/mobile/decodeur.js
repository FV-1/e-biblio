/*
 * Lecture d'un code-barres de livre (EAN-13 = ISBN-13) dans une image, avec ZXing.
 * Script autonome exécuté par le navigateur du téléphone ; exposé sur
 * globalThis.EBiblioDecodeur pour être testé hors navigateur.
 */
(function (global) {
  'use strict';

  /** Pixels RGBA → niveaux de gris (1 octet par pixel). */
  function niveauxDeGris(rgba, largeur, hauteur) {
    var gris = new Uint8ClampedArray(largeur * hauteur);
    for (var i = 0, p = 0; i < gris.length; i++, p += 4) {
      gris[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
    }
    return gris;
  }

  /** Rotation d'un quart de tour (pour un livre photographié de travers). */
  function rotation90(gris, largeur, hauteur) {
    var tourne = new Uint8ClampedArray(gris.length);
    for (var y = 0; y < hauteur; y++) {
      for (var x = 0; x < largeur; x++) {
        tourne[x * hauteur + (hauteur - 1 - y)] = gris[y * largeur + x];
      }
    }
    return tourne;
  }

  function essayer(ZXing, gris, largeur, hauteur) {
    var indices = new Map();
    indices.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.EAN_8,
    ]);
    indices.set(ZXing.DecodeHintType.TRY_HARDER, true);
    var lecteur = new ZXing.MultiFormatReader();
    lecteur.setHints(indices);
    try {
      var source = new ZXing.RGBLuminanceSource(gris, largeur, hauteur);
      return lecteur.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source))).getText();
    } catch (e) {
      return null; // aucun code lisible dans cette orientation
    }
  }

  /** Renvoie le texte du code-barres, ou null. Essaie l'image droite puis tournée. */
  function decoder(ZXing, gris, largeur, hauteur) {
    return essayer(ZXing, gris, largeur, hauteur) || essayer(ZXing, rotation90(gris, largeur, hauteur), hauteur, largeur);
  }

  /** Un code-barres de livre est un EAN-13 commençant par 978 ou 979 ; on accepte aussi un ISBN-10 saisi. */
  function estIsbn(texte) {
    var t = String(texte).replace(/[\s-]/g, '').toUpperCase();
    return /^97[89]\d{10}$/.test(t) || /^\d{9}[\dX]$/.test(t);
  }

  global.EBiblioDecodeur = { niveauxDeGris: niveauxDeGris, rotation90: rotation90, decoder: decoder, estIsbn: estIsbn };
})(globalThis);
