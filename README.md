# e-biblio

Gestion d'inventaire d'une bibliothèque, centrée sur la **localisation physique des exemplaires**
(étage › salle › rayon › étagère › niveau) et la détection des **exemplaires mal rangés**.

Le dépôt contient deux applications indépendantes, qui ne communiquent que par l'API REST :

| Dossier | Contenu |
|---|---|
| `/` (racine) | **Serveur** : API REST en TypeScript, Node.js, Express 5, zod et SQLite (better-sqlite3), en architecture hexagonale |
| `desktop/` | **Client desktop** : application Electron et React pour rechercher un exemplaire, afficher sa localisation et ajouter des livres (par ISBN, avec un téléphone servant de lecteur de codes-barres, ou par saisie manuelle) |

---

## Prérequis

- **Node.js 20 ou plus récent** (développé avec Node 24 LTS) et npm.
- Windows, macOS ou Linux. better-sqlite3 et Electron fournissent des binaires précompilés : aucune compilation native n'est nécessaire.
- Une connexion Internet pour récupérer les notices sur Open Library. Elle est facultative : la saisie manuelle prend le relais.

## Installation

```bash
# Serveur (à la racine)
npm install

# Client desktop
cd desktop
npm install
```

## Lancement

### 1. Serveur

```bash
npm run seed   # crée la base et la hiérarchie d'emplacements de démonstration
npm run dev    # démarre l'API sur http://localhost:3000, redémarre à chaque modification
```

> ⚠️ `npm run seed` **vide entièrement la base** avant de la recréer.

Le seed crée 1 étage, 2 salles (A, B), 4 rayons (Romans, Policiers, Sciences, Histoire) et 3 étagères par rayon, soit 19 emplacements. Leurs identifiants sont lisibles : `etage-1`, `salle-1`, `rayon-1-2`, `etagere-1-2-3`. Le seed ne crée **aucun exemplaire**. Pour partir d'un fonds déjà rempli, utilisez `npm run seed:demo` (voir ci-dessous). Sinon, ajoutez-en avec `requests.http` (voir plus bas) ou `POST /exemplaires`.

`npm run seed:demo` fait la même chose (il vide aussi la base), puis ajoute un **fonds de démonstration** : 35 œuvres et 49 exemplaires répartis dans les quatre rayons.
- Œuvres : éditions réelles (ISBN et couverture Open Library), plusieurs auteurs, accents, et quelques œuvres sans ISBN, sans couverture ou sans auteur.
- Exemplaires : jamais détectés, bien rangés, et 7 mal rangés (dans la même salle ou dans l'autre).
- Identifiants lisibles : `livre-germinal`, `ex-germinal-2`. Ils sont pratiques pour essayer `POST /detections`.

En production : `npm run build`, puis `npm start`.

| Variable d'environnement | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute. Le serveur écoute sur toutes les interfaces. |
| `HOST` | `0.0.0.0` | Interface d'écoute |
| `DB_PATH` | `./data/biblio.db` | Fichier SQLite (créé automatiquement) |
| `OPEN_LIBRARY_URL` | `https://openlibrary.org` | Adresse du catalogue externe |
| `OPEN_LIBRARY_TIMEOUT_MS` | `3000` | Délai maximal de toute la recherche dans le catalogue. Doit rester inférieur au délai du client desktop (5 s) |

Exemple sous PowerShell : `$env:PORT=4000; npm run dev`. Sous bash : `PORT=4000 npm run dev`.

### 2. Client desktop

Le serveur doit être démarré. Puis :

```bash
cd desktop
npm run dev    # ouvre la fenêtre Electron (rechargement à chaud)
```

Pour une version compilée : `npm run build`, puis `npm start`.

L'adresse du serveur se règle de trois façons, par ordre de priorité :

1. Le panneau **Serveur** en haut à droite de l'application. Le réglage est mémorisé entre deux lancements ; le bouton « Revenir à… » l'annule.
2. La variable d'environnement `BIBLIO_API_URL`, par exemple `BIBLIO_API_URL=http://192.168.1.20:3000`.
3. Sinon, `http://localhost:3000`.

> Si la fenêtre Electron ne s'ouvre pas, la variable `ELECTRON_RUN_AS_NODE` est probablement définie (c'est le cas dans certains terminaux intégrés). Avec elle, Electron démarre comme un simple Node.js. Les scripts npm du dossier `desktop/` la retirent automatiquement ; si vous lancez `electron` vous-même, supprimez-la d'abord.

### 3. Utiliser l'application

- **Rechercher** (`Ctrl+K`) : les résultats s'affichent pendant la frappe (titre, auteur ou ISBN, sans tenir compte des accents). Les filtres permettent d'isoler les exemplaires mal rangés ou jamais détectés. Chaque carte propose d'**ajouter un exemplaire** du même livre.
- **Base de données** : un tableau de **toutes les œuvres** de la bibliothèque.
  - Colonnes : couverture, titre, auteurs, ISBN, nombre d'exemplaires et nombre d'exemplaires mal rangés.
  - Filtre texte, filtres « avec / sans ISBN » et « avec / sans couverture » (pratique pour repérer les notices à compléter).
  - Tri en cliquant sur les en-têtes, pagination par 25, 50 ou 100.
  - Un clic sur une ligne la **déplie** pour afficher chaque exemplaire, sa localisation et l'endroit où il a été vu s'il est mal rangé.
- **Ajouter un livre**, de trois façons :
  1. **Par ISBN** : la notice (titre, auteurs, couverture) est affichée pour vérification avant l'ajout. Si l'ISBN est inconnu ou si Open Library ne répond pas, un bouton bascule vers la saisie manuelle en conservant l'ISBN.
  2. **Avec le téléphone** : l'application affiche un QR code. Scannez-le avec l'appareil photo du téléphone, puis photographiez le code-barres du livre ; la notice s'affiche aussitôt sur l'ordinateur. Il n'y a rien à installer sur le téléphone, et la session reste active pour scanner plusieurs livres à la suite.
  3. **Saisie manuelle** : titre obligatoire ; auteurs, couverture et **ISBN facultatifs** (ouvrages anciens, documents internes…).

  Il faut ensuite choisir l'étagère (salle › rayon › étagère). La dernière étagère utilisée est proposée par défaut.

**Prérequis pour le téléphone** :
- Il doit être sur le **même réseau Wi-Fi** que l'ordinateur.
- L'application ouvre un petit serveur local (port `47800`, ou un port libre s'il est occupé). Au premier lancement, Windows peut demander d'autoriser e-biblio sur le réseau : acceptez pour les réseaux privés.
- Si le QR code ne fonctionne pas, l'application propose les autres cartes réseau du poste.

---

## API REST

Toutes les requêtes et réponses sont au format JSON. Le fichier [`requests.http`](requests.http) contient une requête prête à l'emploi pour chaque endpoint et chaque cas d'erreur. Il s'utilise avec l'extension VS Code *REST Client* ou le client HTTP de JetBrains ; exécutez les requêtes dans l'ordre, car certaines réutilisent les identifiants renvoyés par les précédentes.

### Endpoints

| Méthode | Route | Description | Succès |
|---|---|---|---|
| `GET` | `/sante` | Vérifie que le serveur répond | 200 |
| `GET` | `/emplacements` | Liste les emplacements. Filtres facultatifs : `?type=etagere`, `?parentId=salle-1` | 200 |
| `GET` | `/emplacements/:id` | Détail : localisation complète (chemin et coordonnées) et enfants directs | 200 |
| `POST` | `/emplacements` | Crée un emplacement | 201 |
| `PATCH` | `/emplacements/:id` | Modifie le nom, le parent ou les coordonnées (`null` retire les coordonnées) | 200 |
| `DELETE` | `/emplacements/:id` | Supprime un emplacement vide | 204 |
| `POST` | `/exemplaires` | Ajoute un exemplaire : par ISBN (Open Library), par saisie manuelle (ISBN facultatif) ou pour un livre existant (`livreId`) | 201 |
| `GET` | `/livres/:isbn` | Aperçu de la notice d'un ISBN (base ou Open Library), **sans rien enregistrer** | 200 |
| `GET` | `/exemplaires?q=…` | Recherche par titre, auteur ou ISBN, avec la localisation complète | 200 |
| `GET` | `/exemplaires?livreId=…` | Tous les exemplaires d'une œuvre, avec leur localisation | 200 |
| `GET` | `/livres` | Toutes les œuvres, avec leurs compteurs (vue « base de données »), voir les paramètres ci-dessous | 200 |
| `GET` | `/exemplaires/mal-ranges` | Exemplaires dont la position constatée diffère de la position théorique | 200 |
| `GET` | `/exemplaires/:id` | Détail et localisation d'un exemplaire | 200 |
| `POST` | `/detections` | Enregistre un scan et publie l'événement `ExemplaireDetecte` | 201 |

### Paramètres de `GET /livres`

Tous les paramètres sont facultatifs :

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `q` | Texte cherché dans le titre, les auteurs ou l'ISBN | aucun filtre |
| `isbn` | `avec` ou `sans` | toutes les œuvres |
| `couverture` | `avec` ou `sans` | toutes les œuvres |
| `tri` | `titre`, `auteur`, `exemplaires`, `malRanges` | `titre` |
| `ordre` | `asc` ou `desc` | `asc` |
| `page`, `parPage` | page à partir de 1 ; de 1 à 100 œuvres par page | `1`, `25` |

Réponse : `{ "livres": [...], "total": 132, "page": 1, "parPage": 25, "pages": 6 }`. Chaque œuvre contient sa notice plus `nombreExemplaires` et `nombreMalRanges`. Les œuvres sans exemplaire sont incluses.

### Corps des requêtes

```jsonc
// POST /emplacements
{ "type": "etagere", "nom": "Étagère BD 1", "parentId": "rayon-1-1", "coordonnees": { "x": 15, "y": 50 } }
// type : etage | salle | rayon | etagere | niveau
// parentId et coordonnees sont facultatifs (null par défaut)

// POST /exemplaires : notice récupérée sur Open Library
{ "isbn": "978-2-07-036822-8", "emplacementId": "etagere-1-1-1" }

// POST /exemplaires : saisie manuelle (le catalogue n'est pas interrogé)
{ "isbn": "9780306406157", "emplacementId": "etagere-2-1-1",
  "titre": "Les Misérables", "auteurs": ["Victor Hugo"], "couverture": null }

// POST /exemplaires : saisie manuelle SANS ISBN
{ "emplacementId": "etagere-2-2-1", "titre": "Registre paroissial de 1789", "auteurs": ["Anonyme"] }

// POST /exemplaires : nouvel exemplaire d'un livre déjà enregistré (avec ou sans ISBN)
{ "emplacementId": "etagere-2-2-2", "livreId": "…" }

// POST /detections
{ "exemplaireId": "…", "emplacementId": "etagere-1-2-3" }
```

### Règles métier

- **Hiérarchie stricte** : le parent d'une salle est un étage, celui d'un rayon une salle, et ainsi de suite. Un étage n'a pas de parent.
- Un exemplaire ne peut être **rangé ou détecté que sur une étagère**.
- Un exemplaire est **mal rangé** si sa dernière position constatée diffère de sa position théorique. Un exemplaire jamais détecté n'est pas considéré comme mal rangé.
- Un emplacement qui a des enfants, ou sur lequel un exemplaire est rangé ou a été détecté, **ne peut pas être supprimé** (réponse 409).
- **ISBN** : un ISBN-10 ou un ISBN-13 est accepté, avec ou sans tirets. La clé de contrôle est vérifiée, et l'ISBN est toujours enregistré au format ISBN-13.
- **Numéro d'exemplaire** : chaque exemplaire reçoit à sa création un numéro lisible propre à son œuvre (1, 2, 3…), qui ne change jamais et n'est jamais réutilisé. L'identifiant technique (UUID) reste celui qu'utilisent l'API et les scans ; l'interface affiche « Exemplaire n°2 » et permet de copier l'identifiant.
- **ISBN facultatif** : un livre est identifié par un identifiant interne ; l'ISBN, quand il existe, est unique et sert à retrouver la notice. Un livre sans ISBN reste trouvable par son titre et ses auteurs.
- **Coordonnées** : elles sont facultatives. Un emplacement qui n'en a pas prend celles de son ancêtre le plus proche qui en a.
- **Ajout d'un exemplaire** : si le livre est déjà en base, aucun appel externe n'est fait. Sinon, on utilise la saisie manuelle si elle est fournie, et à défaut Open Library. Si Open Library ne répond pas, ou ne connaît pas l'ISBN, la réponse est une erreur 422 (`CATALOGUE_INDISPONIBLE` ou `LIVRE_INCONNU_DU_CATALOGUE`). Il suffit alors de renvoyer la requête avec `titre` et `auteurs`.

### Erreurs

Toutes les erreurs ont le même format :

```json
{ "erreur": { "code": "HIERARCHIE_INVALIDE", "message": "…", "details": [] } }
```

| Statut | Cas | Exemples de codes |
|---|---|---|
| 400 | Requête mal formée (validation zod, JSON illisible) | `REQUETE_INVALIDE`, `JSON_INVALIDE` |
| 404 | Ressource ou route inexistante | `EMPLACEMENT_INTROUVABLE`, `EXEMPLAIRE_INTROUVABLE`, `LIVRE_INTROUVABLE`, `ROUTE_INCONNUE` |
| 409 | Conflit avec l'état actuel | `EMPLACEMENT_NON_VIDE` |
| 422 | Règle métier violée | `ISBN_INVALIDE`, `HIERARCHIE_INVALIDE`, `EMPLACEMENT_NON_RANGEABLE`, `CATALOGUE_INDISPONIBLE` |
| 500 | Erreur inattendue (détail visible dans la console du serveur) | `ERREUR_INTERNE` |

---

## Architecture

Documentation d'architecture : [vues C4 et déploiement](docs/architecture-c4.md), [scénarios de qualité](docs/scenarios-qualite.md) et [décisions (ADR)](docs/adr/README.md).

### Serveur : architecture hexagonale

```
src/
├── domain/        Entités et règles métier pures : Isbn, Emplacement, Livre, Exemplaire,
│                  calcul de localisation, événement ExemplaireDetecte. Aucune dépendance externe.
├── ports/         Interfaces : EmplacementRepository, ExemplaireRepository, LivreRepository,
│                  InventaireLivres (lecture), CatalogueExterne, EventPublisher, Horloge, GenerateurId
├── application/   Cas d'usage (une classe par cas) qui renvoient des « vues » sérialisables
├── adapters/
│   ├── persistence/   SQLite : migrations versionnées, repositories
│   ├── http/          Express : routes, schémas zod, gestion d'erreurs centralisée
│   ├── isbn/          Client Open Library
│   ├── events/        EventPublisher écrivant dans la console
│   └── systeme/       Horloge système, générateur d'UUID
├── main.ts        Composition root : seul fichier qui instancie les adapters et les injecte
└── seed.ts        Second point d'entrée (npm run seed, npm run seed:demo)
```

**Sens des dépendances** : `adapters → application → ports → domain`.
- Le domaine n'importe rien de l'extérieur : ni Express, ni SQLite, ni zod.
- Un test (`tests/unit/architecture.test.ts`) **analyse les imports** et échoue si cette règle est violée.

Principaux choix :

- **Injection manuelle** dans `main.ts`. Remplacer une technologie revient à changer une ligne : par exemple, passer de `ConsoleEventPublisher` à un publisher WebSocket pour les fronts en temps réel.
- **Les entités vérifient leurs invariants.** Par exemple, `Exemplaire.creer` reçoit l'objet `Emplacement` complet, et non un simple identifiant, pour pouvoir refuser lui-même tout ce qui n'est pas une étagère.
- **Les événements sont produits par le domaine.** `enregistrerDetection()` renvoie l'événement ; le cas d'usage l'enregistre en base, *puis* le publie.
- **Le catalogue externe renvoie un résultat explicite** (`trouve`, `introuvable` ou `indisponible`) au lieu de lever une exception. La panne d'Open Library est ainsi traitée comme un cas normal.
- **Une seule règle de recherche.** Insensibilité à la casse et aux accents, recherche par ISBN-10 : tout est défini dans le domaine. L'adapter SQLite réutilise les mêmes fonctions, via une colonne de recherche normalisée.
- **`Horloge` et `GenerateurId` sont des ports**, ce qui rend les tests déterministes.
- **Lecture et écriture séparées pour la vue « base de données »** (principe CQRS) :
  - Les repositories servent à charger et enregistrer des entités.
  - Le port `InventaireLivres` est un **modèle de lecture** : il liste, filtre, trie, pagine et compte en une seule requête SQL agrégée.
  - La règle « mal rangé » y est traduite en SQL. Un test de contrat vérifie qu'elle donne les mêmes résultats que `Exemplaire.estMalRange` du domaine.
- **Migrations versionnées** : soit du SQL, soit une fonction quand des données doivent être recalculées. Par exemple, la migration v3 remplit les clés de tri avec la règle de normalisation du domaine.

### Client desktop : même principe, côté interface

```
desktop/src/
├── commun/     Contrat partagé : schémas de l'API (zod), port ServiceBibliotheque, canaux IPC
├── main/       Processus Node d'Electron (composition root) : client HTTP, stockage de
│   │           configuration, IPC
│   └── appairage/  Serveur local du téléphone, adresses réseau, page mobile (HTML/JS)
├── preload/    Pont sécurisé : expose window.biblio, qui relaie chaque appel au processus main par IPC
└── renderer/   React : les composants ne dépendent que du port, fourni par un contexte React
    ├── recherche/  Écran de recherche, cartes, filtres
    ├── base/       Vue « base de données » : tableau des œuvres, tri, pagination
    ├── ajout/      Écran d'ajout : ISBN, saisie manuelle, choix de l'étagère
    └── telephone/  Session d'appairage, QR code
```

- **Le port est découpé en trois interfaces** (`ServiceRecherche`, `ServiceConfiguration`, `ServiceAppairage`), chacune implémentée par son propre adapter dans le processus main. `ServiceBibliotheque` les réunit pour la page.
- **Le front n'importe aucun code du serveur.** Le seul lien entre les deux est le contrat HTTP, que le processus main vérifie à chaque réponse avec zod.
- **Le téléphone ne parle qu'au poste qui affiche le QR code.** L'appairage est une affaire d'interface, pas de métier : le serveur API n'est pas concerné.
  - Le mini-serveur exige un **jeton aléatoire de 128 bits** présent dans l'URL du QR code, et n'accepte qu'un ISBN.
  - L'ISBN reçu est poussé vers la page par un **événement IPC** (main → page), sans scrutation répétée.
- **Lecture du code-barres** :
  - Sur un réseau local en HTTP, les navigateurs mobiles interdisent le flux vidéo en direct (il faudrait HTTPS). La page mobile passe donc par une **photo**, puis lit le code-barres dans l'image.
  - Elle utilise l'API `BarcodeDetector` du navigateur quand elle existe (Chrome Android), sinon **ZXing**, qui fonctionne partout, y compris sur iPhone.
- **La page n'a aucun accès réseau ni Node.js.** Isolation du contexte, sandbox et politique de sécurité (CSP) sont activées ; tous les appels passent par le processus main. Résultat : pas de CORS à configurer côté serveur.
- **Les erreurs sont renvoyées comme des valeurs** (`{ ok: false, erreur }`), parce que les exceptions traversent mal la frontière IPC d'Electron.

---

## Tests

```bash
# Serveur
npm test                   # tests unitaires : domaine et cas d'usage avec des fakes, sans SQLite ni réseau
npm run test:integration   # adapters réels : SQLite en mémoire, Open Library avec un fetch simulé
npm run test:all           # les deux
npm run typecheck

# Client desktop
cd desktop
npm test                   # client HTTP, IPC, configuration, appairage, écrans React avec un faux service
npm run typecheck
```

- **Tests de contrat** : une même série de cas (`tests/contrats/`) s'exécute contre les fakes en mémoire *et* contre SQLite. On garantit ainsi que les fakes utilisés pour tester les cas d'usage se comportent comme les vrais adapters.
- **Migrations** : la conversion du schéma v1 vers v2 (ISBN facultatif) est testée sur des données réelles.
- **Aucun test ne sort sur le réseau.**
  - Les clients HTTP reçoivent un `fetch` injecté.
  - Le serveur d'appairage est testé en écoutant uniquement sur `127.0.0.1`.
- **Lecture des codes-barres** : un test dessine un code-barres EAN-13 conforme à la norme, puis vérifie que le décodeur de la page mobile le lit, y compris tourné d'un quart de tour.

## Scripts npm

| Serveur (racine) | Client (`desktop/`) |
|---|---|
| `dev` : API avec rechargement automatique (tsx) | `dev` : Electron et Vite avec rechargement à chaud |
| `build` / `start` : compilation vers `dist/`, puis exécution | `build` / `start` : compilation vers `out/`, puis aperçu |
| `seed` : réinitialise la base et crée les emplacements | `test`, `typecheck` |
| `seed:demo` : idem, plus des livres et exemplaires de démonstration | |
| `dev:panne` : API avec Open Library injoignable, pour démontrer le scénario S1 ([déroulé de la démo](demo/README.md)) | |
| `test`, `test:integration`, `test:all`, `typecheck` | |

## Hors périmètre de cette version

Côté client mobile autonome, temps réel (WebSocket), prêts, réservations et comptes utilisateurs. Le client desktop couvre la recherche, la localisation, la consultation du fonds (base de données) et l'ajout de livres. L'API permet déjà la gestion des emplacements, la liste des exemplaires mal rangés et l'enregistrement des détections : ces écrans pourront être ajoutés au client sans modifier le serveur.
