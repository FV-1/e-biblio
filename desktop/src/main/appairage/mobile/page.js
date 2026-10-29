/*
 * Page « scanner » ouverte par le téléphone (QR code affiché sur le poste).
 * La caméra filme en direct (page servie en HTTPS, ADR-008) et le code-barres
 * est lu tout seul dans le viseur : lecteur natif du navigateur s'il existe
 * (Chrome Android), sinon ZXing (tous navigateurs, dont iPhone). Une photo ou
 * la saisie de l'ISBN restent possibles si la caméra n'est pas disponible.
 */
(function () {
  'use strict';

  var D = window.EBiblioDecodeur;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var video = $('video');
  var camera = $('camera');
  var accueil = $('accueil');
  var viseur = $('viseur');
  var consigne = $('consigne');
  var boutonDemarrer = $('demarrer');
  var probleme = $('probleme');
  var lienPhoto = $('lien-photo');
  var photo = $('photo');
  var lampe = $('lampe');
  var ouvrirSaisie = $('ouvrir-saisie');
  var saisie = $('saisie');
  var champIsbn = $('isbn');
  var message = $('message');
  var historique = $('historique');
  var compte = $('compte');
  var vide = $('vide');
  var connexion = $('connexion');

  var INTERVALLE_NATIF_MS = 120;
  var INTERVALLE_ZXING_MS = 200;
  var PAUSE_APRES_LECTURE_MS = 1400;
  var LARGEUR_ANALYSE = 720; // px : au-delà, la lecture est plus lente sans être plus fiable
  var TAILLE_MAX_PHOTO = 1600;
  var CONSIGNE = 'Placez le code-barres du livre dans le cadre';

  var confirmateur = D.creerConfirmateur({ lecturesRequises: 2, fenetreMs: 1500, absenceMs: 2500 });
  var canevas = document.createElement('canvas');
  var ctx = canevas.getContext('2d', { willReadFrequently: true });
  var flux = null;
  var piste = null;
  var detecteurNatif = null;
  var minuterie = 0;
  var minuterieConsigne = 0;
  var pauseJusqua = 0;
  var dernierAvis = 0;
  var verrouEcran = null;
  var son = null;
  var cameraVoulue = false;
  var ouvertureEnCours = false;
  var nombreEnvoyes = 0;

  // ---------- Messages ----------

  function afficherMessage(texte, type) {
    message.hidden = false;
    message.textContent = texte;
    message.className = 'message' + (type ? ' ' + type : '');
  }

  function changerConsigne(texte, alerte, dureeMs) {
    clearTimeout(minuterieConsigne);
    consigne.textContent = texte;
    consigne.className = 'consigne' + (alerte ? ' alerte' : '');
    if (dureeMs) minuterieConsigne = setTimeout(function () { changerConsigne(CONSIGNE); }, dureeMs);
  }

  function etatConnexion(ok) {
    connexion.textContent = ok ? 'Relié à l’ordinateur' : 'Ordinateur injoignable';
    connexion.className = 'pastille ' + (ok ? 'pastille-ok' : 'pastille-ko');
  }

  // ---------- Retour sensoriel : cadre vert, vibration, bip ----------

  function debloquerSon() {
    if (son) return;
    var Contexte = window.AudioContext || window.webkitAudioContext;
    if (Contexte) son = new Contexte();
  }

  function bip() {
    if (!son) return;
    try {
      var t = son.currentTime;
      var oscillateur = son.createOscillator();
      var volume = son.createGain();
      oscillateur.frequency.value = 1320;
      volume.gain.setValueAtTime(0.0001, t);
      volume.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      oscillateur.connect(volume);
      volume.connect(son.destination);
      oscillateur.start(t);
      oscillateur.stop(t + 0.13);
    } catch (e) {
      /* pas de son : la vibration et le cadre vert suffisent */
    }
  }

  function signalerLecture() {
    viseur.classList.remove('trouve');
    void viseur.offsetWidth; // relance l'animation
    viseur.classList.add('trouve');
    setTimeout(function () { viseur.classList.remove('trouve'); }, 900);
    if (navigator.vibrate) navigator.vibrate(70);
    bip();
  }

  // ---------- Historique et envoi ----------

  function ajouterLigne(isbn) {
    var ligne = document.createElement('li');
    var numero = document.createElement('span');
    numero.className = 'isbn';
    numero.textContent = isbn;
    var etat = document.createElement('span');
    etat.className = 'etat';
    ligne.appendChild(numero);
    ligne.appendChild(etat);
    historique.insertBefore(ligne, historique.firstChild);
    vide.hidden = true;
    return ligne;
  }

  function envoyer(isbn, ligne) {
    ligne = ligne || ajouterLigne(isbn);
    var etat = ligne.querySelector('.etat');
    var ancien = ligne.querySelector('button');
    if (ancien) ancien.remove();
    ligne.className = '';
    etat.textContent = 'Envoi…';

    return fetch('isbn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn: isbn }),
    })
      .then(function (reponse) {
        if (reponse.ok) {
          ligne.className = 'ok';
          etat.textContent = '✓ Sur l’ordinateur';
          nombreEnvoyes += 1;
          compte.textContent = String(nombreEnvoyes);
          etatConnexion(true);
          afficherMessage('✓ ISBN ' + isbn + ' affiché sur l’ordinateur', 'succes');
        } else if (reponse.status === 404) {
          echec(isbn, ligne, 'Session expirée');
          afficherMessage('Session expirée : scannez à nouveau le QR code affiché sur l’ordinateur.', 'erreur');
        } else {
          echec(isbn, ligne, 'Refusé (' + reponse.status + ')');
        }
      })
      .catch(function () {
        etatConnexion(false);
        echec(isbn, ligne, 'Non envoyé');
        afficherMessage('Ordinateur injoignable : vérifiez que le téléphone est sur le même Wi-Fi.', 'erreur');
      });
  }

  function echec(isbn, ligne, texte) {
    ligne.className = 'ko';
    ligne.querySelector('.etat').textContent = texte;
    confirmateur.oublier(isbn); // le même livre pourra être rescanné tout de suite
    var reessayer = document.createElement('button');
    reessayer.type = 'button';
    reessayer.textContent = 'Réessayer';
    reessayer.addEventListener('click', function () { envoyer(isbn, ligne); });
    ligne.appendChild(reessayer);
  }

  // ---------- Caméra ----------

  function montrerProbleme(texte) {
    accueil.hidden = false;
    camera.hidden = true;
    probleme.hidden = false;
    probleme.textContent = texte;
    lienPhoto.hidden = false;
    saisie.hidden = false;
  }

  function demarrerCamera() {
    if (flux || ouvertureEnCours) return; // déjà ouverte (ouverture automatique puis toucher du bouton)
    cameraVoulue = true;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      montrerProbleme('Ce navigateur bloque la caméra en direct sur cette connexion. Prenez une photo du code-barres, ou saisissez l’ISBN.');
      return;
    }
    ouvertureEnCours = true;
    boutonDemarrer.disabled = true;
    boutonDemarrer.textContent = 'Ouverture de la caméra…';

    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then(function (f) {
        flux = f;
        piste = f.getVideoTracks()[0];
        video.srcObject = f;
        accueil.hidden = true;
        camera.hidden = false;
        return video.play().catch(function () {});
      })
      .then(function () {
        reglerPiste();
        garderEcranAllume();
        changerConsigne(CONSIGNE);
        planifier(300);
      })
      .catch(function (erreur) {
        cameraVoulue = false;
        var nom = erreur && erreur.name;
        montrerProbleme(
          nom === 'NotAllowedError'
            ? 'L’accès à la caméra a été refusé. Autorisez-le pour ce site dans les réglages du navigateur, puis touchez « Activer la caméra ».'
            : nom === 'NotFoundError'
              ? 'Aucune caméra n’a été trouvée sur cet appareil.'
              : 'Impossible d’ouvrir la caméra (' + (nom || 'erreur inconnue') + ').',
        );
      })
      .then(function () {
        ouvertureEnCours = false;
        boutonDemarrer.disabled = false;
        boutonDemarrer.textContent = 'Activer la caméra';
      });
  }

  /** Mise au point continue si possible ; bouton « lampe » seulement si le téléphone en a une. */
  function reglerPiste() {
    if (!piste || !piste.getCapabilities) return;
    var possibilites = piste.getCapabilities();
    if (possibilites.focusMode && possibilites.focusMode.indexOf('continuous') >= 0) {
      piste.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {});
    }
    lampe.hidden = !possibilites.torch;
  }

  function arreterCamera() {
    clearTimeout(minuterie);
    if (flux) flux.getTracks().forEach(function (p) { p.stop(); });
    flux = null;
    piste = null;
    video.srcObject = null;
    lampe.setAttribute('aria-pressed', 'false');
    if (verrouEcran) {
      verrouEcran.release().catch(function () {});
      verrouEcran = null;
    }
  }

  /** L'écran reste allumé pendant qu'on scanne une pile de livres. */
  function garderEcranAllume() {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(function (v) { verrouEcran = v; }).catch(function () {});
    }
  }

  // Page cachée (écran verrouillé, autre appli) : la caméra est rendue, puis reprise au retour.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (flux) arreterCamera();
    } else if (cameraVoulue && !flux) {
      demarrerCamera();
    }
  });

  lampe.addEventListener('click', function () {
    if (!piste) return;
    var allumer = lampe.getAttribute('aria-pressed') !== 'true';
    piste
      .applyConstraints({ advanced: [{ torch: allumer }] })
      .then(function () {
        lampe.setAttribute('aria-pressed', String(allumer));
        lampe.setAttribute('aria-label', allumer ? 'Éteindre la lampe' : 'Allumer la lampe');
      })
      .catch(function () { lampe.hidden = true; });
  });

  // ---------- Détection automatique dans le viseur ----------

  function planifier(delaiMs) {
    clearTimeout(minuterie);
    minuterie = setTimeout(analyser, delaiMs);
  }

  function rectangleViseur() {
    var v = viseur.getBoundingClientRect();
    var e = video.getBoundingClientRect();
    return { x: v.left - e.left, y: v.top - e.top, largeur: v.width, hauteur: v.height };
  }

  function analyser() {
    if (!flux) return;
    var intervalle = detecteurNatif ? INTERVALLE_NATIF_MS : INTERVALLE_ZXING_MS;
    if (Date.now() < pauseJusqua || video.readyState < 2 || !video.videoWidth) {
      planifier(intervalle);
      return;
    }
    var zone = D.zoneAnalyse({
      largeurVideo: video.videoWidth,
      hauteurVideo: video.videoHeight,
      largeurElement: video.clientWidth,
      hauteurElement: video.clientHeight,
      viseur: rectangleViseur(),
      marge: 0.15,
    });
    var echelle = Math.min(1, LARGEUR_ANALYSE / zone.largeur);
    canevas.width = Math.max(1, Math.round(zone.largeur * echelle));
    canevas.height = Math.max(1, Math.round(zone.hauteur * echelle));
    ctx.drawImage(video, zone.x, zone.y, zone.largeur, zone.hauteur, 0, 0, canevas.width, canevas.height);

    lireImage()
      .then(function (texte) { if (texte) traiterLecture(texte); })
      .catch(function () {})
      .then(function () { if (flux) planifier(intervalle); });
  }

  function lireImage() {
    if (detecteurNatif) {
      return detecteurNatif.detect(canevas).then(function (codes) { return codes.length > 0 ? codes[0].rawValue : null; });
    }
    var gris = D.niveauxDeGris(ctx.getImageData(0, 0, canevas.width, canevas.height).data, canevas.width, canevas.height);
    return Promise.resolve(D.decoder(window.ZXing, gris, canevas.width, canevas.height, { rapide: true }));
  }

  function traiterLecture(texte) {
    var maintenant = Date.now();
    var verdict = confirmateur.proposer(texte, maintenant);
    if (verdict === 'confirme') {
      var isbn = String(texte).replace(/[\s-]/g, '').toUpperCase();
      signalerLecture();
      pauseJusqua = maintenant + PAUSE_APRES_LECTURE_MS;
      changerConsigne('Livre lu ! Visez le suivant', false, 2000);
      envoyer(isbn);
    } else if (verdict === 'pas-un-isbn' && maintenant - dernierAvis > 2500) {
      dernierAvis = maintenant;
      changerConsigne('Ce code-barres n’est pas celui d’un livre (il doit commencer par 978 ou 979)', true, 2200);
    } else if (verdict === 'deja-envoye' && maintenant - dernierAvis > 2500) {
      dernierAvis = maintenant;
      changerConsigne('Déjà envoyé : passez au livre suivant', false, 1800);
    }
  }

  /** Lecteur natif (Chrome Android) s'il sait lire les EAN-13 ; sinon ZXing. */
  function preparerDetecteurNatif() {
    if (!('BarcodeDetector' in window)) return Promise.resolve();
    var formats = window.BarcodeDetector.getSupportedFormats ? window.BarcodeDetector.getSupportedFormats() : Promise.resolve(['ean_13']);
    return Promise.resolve(formats)
      .then(function (liste) {
        if (liste.indexOf('ean_13') >= 0) detecteurNatif = new window.BarcodeDetector({ formats: ['ean_13'] });
      })
      .catch(function () { detecteurNatif = null; });
  }

  // ---------- Secours : photo ou saisie ----------

  function decoderPhoto(fichier) {
    return new Promise(function (resoudre, rejeter) {
      var url = URL.createObjectURL(fichier);
      var image = new Image();
      image.onload = function () {
        var echelle = Math.min(1, TAILLE_MAX_PHOTO / Math.max(image.naturalWidth, image.naturalHeight));
        var largeur = Math.round(image.naturalWidth * echelle);
        var hauteur = Math.round(image.naturalHeight * echelle);
        var c = document.createElement('canvas');
        c.width = largeur;
        c.height = hauteur;
        var cx = c.getContext('2d');
        cx.drawImage(image, 0, 0, largeur, hauteur);
        URL.revokeObjectURL(url);
        resoudre(D.decoder(window.ZXing, D.niveauxDeGris(cx.getImageData(0, 0, largeur, hauteur).data, largeur, hauteur), largeur, hauteur));
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        rejeter(new Error('image illisible'));
      };
      image.src = url;
    });
  }

  photo.addEventListener('change', function () {
    var fichier = photo.files && photo.files[0];
    photo.value = '';
    if (!fichier) return;
    afficherMessage('Lecture du code-barres…');
    decoderPhoto(fichier)
      .then(function (texte) {
        if (texte && D.estIsbn(texte)) {
          message.hidden = true;
          envoyer(String(texte).replace(/[\s-]/g, '').toUpperCase());
        } else {
          afficherMessage('Code-barres illisible. Rapprochez-vous, évitez les reflets, ou saisissez l’ISBN.', 'erreur');
          saisie.hidden = false;
          champIsbn.focus();
        }
      })
      .catch(function () { afficherMessage('Impossible de lire la photo. Réessayez ou saisissez l’ISBN.', 'erreur'); });
  });

  ouvrirSaisie.addEventListener('click', function () {
    saisie.hidden = false;
    saisie.scrollIntoView({ behavior: 'smooth', block: 'center' });
    champIsbn.focus();
  });

  saisie.addEventListener('submit', function (evenement) {
    evenement.preventDefault();
    var propre = champIsbn.value.replace(/[\s-]/g, '').toUpperCase();
    if (!propre) return;
    if (!D.estIsbn(propre)) {
      afficherMessage('« ' + champIsbn.value + ' » n’est pas un ISBN (10 ou 13 chiffres, commençant par 978 ou 979).', 'erreur');
      return;
    }
    champIsbn.value = '';
    envoyer(propre);
  });

  // ---------- Démarrage ----------

  // Le son ne peut démarrer qu'après un geste de l'utilisateur (règle des navigateurs mobiles).
  document.addEventListener('pointerdown', debloquerSon, { once: true });
  boutonDemarrer.addEventListener('click', function () {
    debloquerSon();
    demarrerCamera();
  });

  preparerDetecteurNatif().then(function () {
    if (!window.isSecureContext || !navigator.mediaDevices) {
      montrerProbleme('Ce navigateur bloque la caméra en direct sur cette connexion. Prenez une photo du code-barres, ou saisissez l’ISBN.');
      return;
    }
    // Caméra déjà autorisée pour ce site : on l'ouvre sans attendre un geste.
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' })
        .then(function (statut) { if (statut.state === 'granted') demarrerCamera(); })
        .catch(function () {});
    }
  });
})();
