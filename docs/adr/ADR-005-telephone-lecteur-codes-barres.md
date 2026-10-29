# ADR-005 : Le téléphone comme lecteur de codes-barres, appairé au poste

Statut : acceptée - 01/10/2026. Remplace la « PWA mobile » prévue dans le C4 initial. La lecture par photo est remplacée par ADR-008 (caméra en direct).

## Contexte

- Saisir un ISBN de 13 chiffres au clavier est lent et source d'erreurs. Une douchette USB coûte de l'argent et n'existe pas sur chaque poste.
- Le C4 initial prévoyait une PWA mobile reliée au serveur API. Or, sur un réseau local en HTTP, les navigateurs mobiles **interdisent l'accès à la caméra en direct** (il faut HTTPS, donc un certificat sur chaque installation).
- S4 (M,L) : un autre appareil du Wi-Fi ne doit pas pouvoir injecter d'ISBN.

## Décision

- Le **client desktop** ouvre un petit serveur local et affiche un QR code. Le téléphone le scanne avec son appareil photo : une page web s'ouvre, sans rien installer.
- La page lit le code-barres à partir d'une **photo** (et non d'un flux vidéo), avec `BarcodeDetector` quand il existe, sinon ZXing (fonctionne aussi sur iPhone).
- L'ISBN est envoyé au poste, qui l'affiche aussitôt. Le serveur API n'est pas concerné : l'appairage est une affaire d'interface.
- Le QR code contient un **jeton aléatoire de 128 bits**, renouvelé à chaque session ; sans lui, la requête est refusée. Le serveur n'accepte qu'un ISBN.

## Alternatives écartées

- **PWA en HTTPS** : flux vidéo en direct, mais il faut gérer des certificats sur un réseau local.
- **Application native** : meilleure lecture, mais deux applications à publier et à installer.
- **Douchette USB** : la plus rapide, mais du matériel à acheter pour chaque poste.

## Conséquences

- \+ Rien à installer sur le téléphone, aucun matériel à acheter.
- \+ Le serveur API reste inchangé : une seule voie d'entrée pour les ajouts.
- − Une photo par livre : plus lent qu'un scan vidéo continu.
- − Le téléphone doit être sur le même Wi-Fi, et le pare-feu doit autoriser le port local (47800).
- − L'écart avec le C4 initial doit être reporté dans les vues (le conteneur « PWA mobile » n'existe pas).
