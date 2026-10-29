# Architecture : vues C4 et déploiement

Vues du système tel qu'il est codé (version du 28/10/2026). Les noms sont ceux du code. Les écarts avec les vues du 01/10 sont listés à la fin.

Légende : `[Personne]`, `[Système]`, `[Conteneur]`, `[Composant]` ; les flèches portent l'action et, entre crochets, le protocole. Le cadre en pointillés délimite le système ou le conteneur zoomé.

## Niveau 1 · Contexte

```text
        +---------------------------+
        | [Personne]                |
        | Bibliothécaire            |
        | Range, retrouve et ajoute |
        | les livres                |
        +---------------------------+
                     |
                     | Cherche, localise, ajoute des livres,
                     | repère les exemplaires mal rangés
                     v
        +---------------------------+            +--------------------------+
        | [Système]                 |  Récupère  | [Système externe]        |
        | e-biblio                  |  la notice | Open Library             |
        | Inventaire et localisation|----------->| Titre, auteurs,          |
        | physique des exemplaires  |[HTTPS/JSON]| couverture par ISBN      |
        +---------------------------+            +--------------------------+
```

## Niveau 2 · Conteneurs

```text
   +----------------------+
   | [Personne]           |
   | Bibliothécaire       |
   +----------------------+
       |              |
       | Utilise      | Vise le code-barres (caméra en direct)
       |              | (après avoir scanné le QR code)
.......|..............|..............................................................
:      v              v                                                             :
:  +-------------------------+   ISBN [HTTPS local,  +---------------------------+  :
:  | [Conteneur]             |   jeton 128 bits]     | [Conteneur]               |  :
:  | Client desktop          |<----------------------| Page mobile d'appairage   |  :
:  | Electron + React        |                       | HTML/JS, sur le téléphone |  :
:  | Recherche, plan 3D,     |---------------------->| Lit le code-barres        |  :
:  | base, ajout             |  Sert la page         | (BarcodeDetector / ZXing) |  :
:  +-------------------------+                       +---------------------------+  :
:      |                                                                            :
:      | Appelle l'API [HTTP/JSON]                                                  :
:      v                                                                            :
:  +-------------------------+                                                      :
:  | [Conteneur]             |   Récupère la notice [HTTPS/JSON]                    :
:  | Serveur API             |------------------------------------------------------+---> Open Library
:  | Node.js, Express 5, zod |                                                      :
:  | Règles métier, API REST |                                                      :
:  +-------------------------+                                                      :
:      |                                                                            :
:      | Lit et écrit [SQL, better-sqlite3]                                         :
:      v                                                                            :
:  +-------------------------+                                                      :
:  | [Conteneur]             |                                                      :
:  | Base SQLite (fichier)   |                                                      :
:  | Emplacements, livres,   |                                                      :
:  | exemplaires, détections |                                                      :
:  +-------------------------+                                                      :
: [Système e-biblio]                                                                :
:...................................................................................:
```

- Le client desktop et la page mobile ne parlent **jamais** directement à la base ni à Open Library : tout passe par l'API.
- La page mobile ne parle qu'au poste qui a affiché le QR code (ADR-005).
- Les scans de détection arrivent par `POST /detections`. Aujourd'hui, ils sont envoyés par requête HTTP ; un lecteur QR ou RFID utilisera la même route.

## Niveau 3 · Composants du serveur API

```text
                Client desktop
                      |
                      | [HTTP/JSON]
......................|.....................................................................
:                     v                                                                    :
:   +-------------------------------+                                                      :
:   | [Composant] Adapter entrant   |                                                      :
:   | adapters/http                 |                                                      :
:   | Routes Express, schémas zod,  |                                                      :
:   | gestion d'erreurs centralisée |                                                      :
:   +-------------------------------+                                                      :
:                     | Invoque                                                            :
:                     v                                                                    :
:   +-------------------------------+        +-------------------------------+             :
:   | [Composant] Cas d'usage       |        | [Composant] Domaine           |             :
:   | application/                  |------->| domain/                       |             :
:   | AjouterExemplaire,            | Utilise| Isbn, Emplacement, Livre,     |             :
:   | RechercherExemplaires,        |        | Exemplaire (estMalRange),     |             :
:   | EnregistrerDetection,         |        | localisation,                 |             :
:   | ListerLivres, ...             |        | événement ExemplaireDetecte   |             :
:   +-------------------------------+        +-------------------------------+             :
:                     |                                                                    :
:                     | Appelle via les ports (ports/)                                     :
:                     v                                                                    :
:   +----------------+  +------------------+  +-----------------+  +-------------------+   :
:   | [Composant]    |  | [Composant]      |  | [Composant]     |  | [Composant]       |   :
:   | Persistance    |  | Catalogue        |  | Événements      |  | Système           |   :
:   | adapters/      |  | adapters/isbn    |  | adapters/events |  | adapters/systeme  |   :
:   | persistence    |  | OpenLibrary-     |  | ConsoleEvent-   |  | HorlogeSysteme,   |   :
:   | Sqlite*Repo,   |  | Catalogue        |  | Publisher       |  | GenerateurUuid    |   :
:   | SqliteInven-   |  | (délai 5 s)      |  |                 |  |                   |   :
:   | taireLivres    |  |                  |  |                 |  |                   |   :
:   +----------------+  +------------------+  +-----------------+  +-------------------+   :
:          |                     |                                                         :
: [Conteneur : Serveur API]      |     main.ts instancie les adapters et les injecte       :
:..........|.....................|.........................................................:
           v                     v
     Base SQLite           Open Library
```

Règle de dépendance (ADR-001), vérifiée par `tests/unit/architecture.test.ts` : `adapters → application → ports → domain`. Le domaine n'importe aucune bibliothèque ; un adapter n'importe jamais un autre adapter.

## Déploiement

```text
  +----------------------------------+        +----------------------------------+
  | Poste de la bibliothécaire       |        | Serveur de la bibliothèque       |
  | (Windows, macOS ou Linux)        |        | (n'importe quel poste du réseau) |
  |                                  |  HTTP  |                                  |
  |  Client desktop (Electron)       |------->|  Serveur API (Node.js 20+)       |
  |  + serveur d'appairage :47800    | :3000  |  + fichier SQLite ./data/biblio.db|
  +----------------------------------+        +----------------------------------+
        ^                                                  |
        | HTTPS local (même Wi-Fi)                         | HTTPS (Internet)
        |                                                  v
  +----------------------+                      +----------------------+
  | Téléphone            |                      | Open Library         |
  | navigateur, aucune   |                      | openlibrary.org      |
  | installation         |                      |                      |
  +----------------------+                      +----------------------+
```

Tout tourne sur le réseau local de la bibliothèque : seul l'appel à Open Library sort sur Internet, et sa panne est prévue (ADR-002).

## Écarts avec les vues du 01/10/2026

| Vue du 01/10 | Code actuel | Raison |
| --- | --- | --- |
| Conteneur « PWA mobile » relié au serveur API | Page mobile servie par le client desktop, en HTTPS auto-signé | Rien à installer (ADR-005) ; caméra en direct grâce au HTTPS local (ADR-008) |
| WebSocket (temps réel) entre serveur et clients | Interrogation toutes les 3 s par le plan 3D | Pas de changement serveur avant la soutenance ; un flux SSE via le port `EventPublisher` est la cible (ADR-007) |
| Prêts, emprunts, personne « Lecteur » | Non réalisés | Hors périmètre de cette version |
| Composant « Sources de localisation QR / RFID » | Route `POST /detections` | Un seul point d'entrée pour toutes les sources de scan |
| Plan interactif SVG | Plan 3D (Three.js) dans le client desktop | Demande du client ; calculé à partir des coordonnées de l'API (ADR-007) |
