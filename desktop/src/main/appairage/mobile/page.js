/*
 * Page « scanner » ouverte par le téléphone (QR code affiché sur le poste).
 * Le flux vidéo en direct exige HTTPS sur mobile : on passe donc par une
 * PHOTO (input capture), autorisée en HTTP, puis on lit le code-barres dedans.
 */
(function () {
  'use strict';

  var D = window.EBiblioDecodeur;
  var etat = document.getElementById('etat');
  var photo = document.getElementById('photo');
  var formulaire = document.getElementById('formulaire');
  var champIsbn = document.getElementById('isbn');
  var TAILLE_MAX = 1600; // px : au-delà, la lecture est plus lente sans être plus fiable

  function afficher(message, type) {
    etat.hidden = false;
    etat.textContent = message;
    etat.className = type || '';
  }

  function envoyer(isbn) {
    var propre = String(isbn).replace(/[\s-]/g, '').toUpperCase();
    if (!D.estIsbn(propre)) {
      afficher('« ' + isbn + ' » n’est pas un ISBN (10 ou 13 chiffres, commençant par 978 ou 979).', 'erreur');
      return;
    }
    afficher('Envoi de l’ISBN ' + propre + '…');
    fetch('isbn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn: propre }),
    })
      .then(function (reponse) {
        if (reponse.ok) {
          afficher('✓ ISBN ' + propre + ' envoyé à l’ordinateur. Vous pouvez scanner le livre suivant.', 'succes');
          champIsbn.value = '';
        } else if (reponse.status === 404) {
          afficher('Session expirée : scannez à nouveau le QR code affiché sur l’ordinateur.', 'erreur');
        } else {
          afficher('L’ordinateur a refusé l’ISBN (erreur ' + reponse.status + ').', 'erreur');
        }
      })
      .catch(function () {
        afficher('Impossible de joindre l’ordinateur. Vérifiez que le téléphone est sur le même réseau Wi-Fi.', 'erreur');
      });
  }

  /** Charge la photo dans un canevas réduit et en extrait les niveaux de gris. */
  function lireImage(fichier) {
    return new Promise(function (resoudre, rejeter) {
      var url = URL.createObjectURL(fichier);
      var image = new Image();
      image.onload = function () {
        var echelle = Math.min(1, TAILLE_MAX / Math.max(image.naturalWidth, image.naturalHeight));
        var largeur = Math.round(image.naturalWidth * echelle);
        var hauteur = Math.round(image.naturalHeight * echelle);
        var canevas = document.createElement('canvas');
        canevas.width = largeur;
        canevas.height = hauteur;
        var ctx = canevas.getContext('2d');
        ctx.drawImage(image, 0, 0, largeur, hauteur);
        URL.revokeObjectURL(url);
        resoudre({ canevas: canevas, largeur: largeur, hauteur: hauteur, rgba: ctx.getImageData(0, 0, largeur, hauteur).data });
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        rejeter(new Error('image illisible'));
      };
      image.src = url;
    });
  }

  /** Lecteur natif du navigateur s'il existe (Chrome Android), sinon ZXing (tous navigateurs, dont iPhone). */
  function lireCode(img) {
    if ('BarcodeDetector' in window) {
      return new window.BarcodeDetector({ formats: ['ean_13'] })
        .detect(img.canevas)
        .then(function (codes) {
          return codes.length > 0 ? codes[0].rawValue : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (texte) {
          return texte || D.decoder(window.ZXing, D.niveauxDeGris(img.rgba, img.largeur, img.hauteur), img.largeur, img.hauteur);
        });
    }
    return Promise.resolve(D.decoder(window.ZXing, D.niveauxDeGris(img.rgba, img.largeur, img.hauteur), img.largeur, img.hauteur));
  }

  photo.addEventListener('change', function () {
    var fichier = photo.files && photo.files[0];
    photo.value = '';
    if (!fichier) return;
    afficher('Lecture du code-barres…');
    lireImage(fichier)
      .then(lireCode)
      .then(function (texte) {
        if (!texte) {
          afficher('Code-barres illisible. Rapprochez-vous, évitez les reflets, ou saisissez l’ISBN ci-dessous.', 'erreur');
          champIsbn.focus();
        } else {
          champIsbn.value = texte;
          envoyer(texte);
        }
      })
      .catch(function () {
        afficher('Impossible de lire la photo. Réessayez ou saisissez l’ISBN.', 'erreur');
      });
  });

  formulaire.addEventListener('submit', function (evenement) {
    evenement.preventDefault();
    if (champIsbn.value.trim()) envoyer(champIsbn.value.trim());
  });
})();
