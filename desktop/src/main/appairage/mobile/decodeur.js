/*
 * Lecture d'un code-barres de livre (EAN-13 = ISBN-13) avec ZXing, et logique
 * pure du scanner vidéo (zone analysée, confirmation des lectures).
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

  /** Rotation d'un quart de tour (pour un livre tenu de travers). */
  function rotation90(gris, largeur, hauteur) {
    var tourne = new Uint8ClampedArray(gris.length);
    for (var y = 0; y < hauteur; y++) {
      for (var x = 0; x < largeur; x++) {
        tourne[x * hauteur + (hauteur - 1 - y)] = gris[y * largeur + x];
      }
    }
    return tourne;
  }

  function essayer(ZXing, gris, largeur, hauteur, approfondi) {
    var indices = new Map();
    indices.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.EAN_8,
    ]);
    if (approfondi) indices.set(ZXing.DecodeHintType.TRY_HARDER, true);
    var lecteur = new ZXing.MultiFormatReader();
    lecteur.setHints(indices);
    try {
      var source = new ZXing.RGBLuminanceSource(gris, largeur, hauteur);
      return lecteur.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source))).getText();
    } catch (e) {
      return null; // aucun code lisible dans cette orientation
    }
  }

  /**
   * Renvoie le texte du code-barres, ou null.
   * Par défaut (photo) : lecture approfondie, image droite puis tournée.
   * `{ rapide: true }` (image vidéo, plusieurs fois par seconde) : une seule
   * lecture légère, dans l'orientation demandée par `tourne`.
   */
  function decoder(ZXing, gris, largeur, hauteur, options) {
    if (options && options.rapide) {
      return options.tourne
        ? essayer(ZXing, rotation90(gris, largeur, hauteur), hauteur, largeur, false)
        : essayer(ZXing, gris, largeur, hauteur, false);
    }
    return essayer(ZXing, gris, largeur, hauteur, true) || essayer(ZXing, rotation90(gris, largeur, hauteur), hauteur, largeur, true);
  }

  /** Un code-barres de livre est un EAN-13 commençant par 978 ou 979 ; on accepte aussi un ISBN-10 saisi. */
  function estIsbn(texte) {
    var t = String(texte).replace(/[\s-]/g, '').toUpperCase();
    return /^97[89]\d{10}$/.test(t) || /^\d{9}[\dX]$/.test(t);
  }

  /**
   * Partie de l'image vidéo à analyser : le viseur affiché à l'écran, agrandi
   * d'une marge, ramené en pixels de la vidéo. La vidéo est affichée en
   * « object-fit: cover » : elle est agrandie puis rognée au centre.
   */
  function zoneAnalyse(z) {
    var echelle = Math.max(z.largeurElement / z.largeurVideo, z.hauteurElement / z.hauteurVideo);
    var decalageX = (z.largeurVideo * echelle - z.largeurElement) / 2;
    var decalageY = (z.hauteurVideo * echelle - z.hauteurElement) / 2;
    var marge = z.marge || 0;
    var x = (z.viseur.x - z.viseur.largeur * marge + decalageX) / echelle;
    var y = (z.viseur.y - z.viseur.hauteur * marge + decalageY) / echelle;
    var largeur = (z.viseur.largeur * (1 + 2 * marge)) / echelle;
    var hauteur = (z.viseur.hauteur * (1 + 2 * marge)) / echelle;
    var x0 = Math.max(0, Math.round(x));
    var y0 = Math.max(0, Math.round(y));
    return {
      x: x0,
      y: y0,
      largeur: Math.min(z.largeurVideo - x0, Math.round(largeur + Math.min(0, x))),
      hauteur: Math.min(z.hauteurVideo - y0, Math.round(hauteur + Math.min(0, y))),
    };
  }

  /**
   * Décide quand une lecture devient un envoi :
   * - le même code doit être lu `lecturesRequises` fois de suite en moins de `fenetreMs` ;
   * - un code déjà envoyé est ignoré TANT QU'IL RESTE EN VUE ; il redevient
   *   envoyable après `absenceMs` sans être vu (deuxième exemplaire du même livre).
   * `proposer` renvoie « confirme », « attente », « deja-envoye » ou « pas-un-isbn ».
   */
  function creerConfirmateur(options) {
    var requises = options.lecturesRequises || 2;
    var fenetre = options.fenetreMs || 1500;
    var absence = options.absenceMs || 2500;
    var candidat = null;
    var compte = 0;
    var derniere = 0;
    var envoyes = new Map(); // ISBN envoyé → dernière fois qu'il a été vu

    return {
      proposer: function (texte, maintenant) {
        var t = String(texte).replace(/[\s-]/g, '').toUpperCase();
        if (!estIsbn(t)) return 'pas-un-isbn';
        var vu = envoyes.get(t);
        if (vu !== undefined && maintenant - vu < absence) {
          envoyes.set(t, maintenant); // toujours devant l'objectif : on prolonge
          return 'deja-envoye';
        }
        if (t === candidat && maintenant - derniere <= fenetre) compte += 1;
        else {
          candidat = t;
          compte = 1;
        }
        derniere = maintenant;
        if (compte < requises) return 'attente';
        envoyes.set(t, maintenant);
        candidat = null;
        compte = 0;
        return 'confirme';
      },
      /** Permet de renvoyer tout de suite un ISBN dont l'envoi a échoué. */
      oublier: function (texte) {
        envoyes.delete(String(texte));
      },
    };
  }

  global.EBiblioDecodeur = {
    niveauxDeGris: niveauxDeGris,
    rotation90: rotation90,
    decoder: decoder,
    estIsbn: estIsbn,
    zoneAnalyse: zoneAnalyse,
    creerConfirmateur: creerConfirmateur,
  };
})(globalThis);
