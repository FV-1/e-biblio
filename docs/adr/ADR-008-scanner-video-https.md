# ADR-008 : Caméra en direct sur le téléphone, grâce à un HTTPS local auto-signé

Statut : acceptée - 29/10/2026. Remplace la partie « lecture par photo » de l'ADR-005.

## Contexte

- ADR-005 : le téléphone sert de lecteur de codes-barres via une page servie par le client desktop. Faute de HTTPS, la page passait par une **photo** : ouvrir l'appareil photo, déclencher, valider, pour chaque livre.
- Demande du client : une caméra intégrée à la page, qui **détecte seule** le code-barres dès qu'il est visible, pour enchaîner une pile de livres.
- Les navigateurs mobiles n'ouvrent la caméra en direct (`getUserMedia`) que dans un **contexte sécurisé** : HTTPS, ou `localhost`. La page est servie sur l'adresse du poste dans le réseau local.
- S4 (M,L) : seul le téléphone qui a scanné le QR code peut envoyer un ISBN. Cette règle ne doit pas changer.

## Décision

1. Le serveur d'appairage passe en **HTTPS**, avec un **certificat auto-signé** créé par le client desktop au premier appairage, conservé dans son dossier de données et réutilisé (`certificat-local.ts`). Il est renouvelé 30 jours avant son échéance (validité : 1 an).
2. La première fois, le téléphone affiche « Connexion non privée ». L'utilisateur l'accepte une fois ; le poste explique la manipulation, pour Android et pour iPhone.
3. La page filme en continu et analyse **seulement la zone du viseur**, plusieurs fois par seconde : lecteur natif du navigateur s'il lit les EAN-13 (Chrome Android), sinon ZXing (iPhone et autres).
4. Un ISBN n'est envoyé qu'après **deux lectures identiques** rapprochées. Un livre resté devant l'objectif n'est jamais renvoyé ; le même ISBN redevient envoyable après 2,5 s sans être vu (deuxième exemplaire). Cette logique est pure et testée (`decodeur.js`).
5. La photo et la saisie de l'ISBN restent disponibles en secours (caméra refusée, navigateur ancien).

## Alternatives écartées

- **Garder la photo** : aucune configuration, mais trois gestes par livre et aucune détection automatique.
- **Certificat d'une autorité reconnue** (Let's Encrypt) : aucun avertissement, mais il faut un nom de domaine public pointant vers une adresse du réseau local, et le renouveler. Disproportionné pour une bibliothèque.
- **Installer notre propre autorité de certification sur chaque téléphone** : plus d'avertissement ensuite, mais une manipulation technique dans les réglages de chaque appareil, différente selon le système.
- **Application native** : meilleure lecture et pas d'avertissement, mais deux applications à publier et à installer (déjà écarté par l'ADR-005).

## Conséquences

- \+ Scanner une pile de livres sans toucher l'écran : le code est lu, le cadre passe au vert, le téléphone vibre et l'ISBN part tout seul.
- \+ La communication entre le téléphone et le poste est chiffrée. Le jeton de 128 bits (S4) ne circule plus en clair sur le Wi-Fi.
- \+ Vérifié de bout en bout avec Chrome et une caméra simulée filmant un EAN-13 : détection, envoi unique, notice affichée sur le poste.
- − Un avertissement de sécurité à accepter une fois par téléphone, qui peut inquiéter : il faut l'expliquer.
- − Le navigateur retient l'exception pour une adresse : si l'adresse IP du poste change, l'avertissement revient une fois.
- − Une clé privée est stockée sur le poste (dossier de données d'Electron, lisible par son seul utilisateur).
- − La lecture vidéo consomme plus de batterie que la photo. La caméra est donc rendue dès que la page est cachée.
