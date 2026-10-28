# Scénarios de qualité

Les attributs de qualité qui guident l'architecture d'e-biblio, chacun rendu vérifiable par un scénario en six parties. La colonne « Preuve » indique ce qui le démontre aujourd'hui.

## Arbre d'utilité

Notes : (importance métier, difficulté technique), H / M / L.

```text
Utilité
+-- Disponibilité
|   +-- (H,H) S1  Open Library en panne : l'ajout de livres continue, aucune attente > 6 s
+-- Modifiabilité
|   +-- (H,M) S2  Changer de base ou de catalogue : 0 fichier du domaine ou des cas d'usage modifié
+-- Testabilité
|   +-- (M,L) S3  Toute la logique métier testée sans base ni réseau, en moins de 5 s
+-- Sécurité
|   +-- (M,L) S4  Seul le téléphone qui a scanné le QR code peut envoyer un ISBN au poste
+-- Performance
    +-- (M,M) S5  Recherche pendant la frappe : résultats en moins de 200 ms
```

S1 est le moteur de l'architecture : c'est le seul scénario (H,H). S2 vient ensuite, car la bibliothèque n'a pas encore choisi sa base ni son catalogue définitifs.

## S1 · Disponibilité : panne du catalogue externe (H,H)

| Partie | Valeur |
| --- | --- |
| Source | Open Library (service externe, gratuit, sans engagement de disponibilité) |
| Stimulus | Ne répond plus, ou répond après plus de 5 s |
| Artefact | Ajout d'un exemplaire par ISBN (`POST /exemplaires`) |
| Environnement | Fonctionnement normal, bibliothécaire en train de saisir des livres |
| Réponse | Erreur explicite `CATALOGUE_INDISPONIBLE` ; le client propose la saisie manuelle en gardant l'ISBN ; recherche, localisation et ajout d'un livre déjà connu ne sont pas touchés |
| Mesure | Réponse en moins de 6 s (délai de 5 s + marge) ; 100 % des ajouts aboutissent avec la saisie manuelle ; 0 erreur sur les autres opérations |

Preuve :
- Tests unitaires `tests/unit/application/exemplaires.test.ts` : « catalogue hors ligne sans saisie » et « catalogue hors ligne puis renvoi avec saisie manuelle ».
- Test d'intégration `tests/integration/isbn/open-library-catalogue.test.ts` : réseau coupé, délai dépassé, erreur 5xx et réponse illisible donnent tous « indisponible », sans exception.
- Mesure en direct (28/10/2026), catalogue injoignable et délai réglé à 2 s : erreur 422 en 2,8 s, ajout manuel en 0,23 s, recherche en 0,21 s.

Décision liée : [ADR-002](adr/ADR-002-catalogue-externe-tolerant-aux-pannes.md).

## S2 · Modifiabilité : changer une technologie d'infrastructure (H,M)

| Partie | Valeur |
| --- | --- |
| Source | La bibliothèque (DSI) |
| Stimulus | Demande de passer de SQLite à PostgreSQL, ou d'Open Library au catalogue de la BnF |
| Artefact | Serveur API |
| Environnement | En développement |
| Réponse | On écrit un nouvel adapter et on change une ligne dans `main.ts` |
| Mesure | 0 fichier modifié dans `domain/`, `ports/` et `application/` ; le nouvel adapter passe les tests de contrat existants |

Preuve : le test d'architecture `tests/unit/architecture.test.ts` interdit au domaine et aux cas d'usage d'importer un adapter ou une bibliothèque. Les tests de contrat (`tests/contrats/`) s'exécutent déjà contre deux implémentations (mémoire et SQLite).

Décision liée : [ADR-001](adr/ADR-001-architecture-hexagonale.md).

## S3 · Testabilité : tester le métier sans infrastructure (M,L)

| Partie | Valeur |
| --- | --- |
| Source | Développeur |
| Stimulus | Modifie une règle métier (par exemple la règle « mal rangé ») |
| Artefact | Domaine et cas d'usage |
| Environnement | Poste de développement, sans réseau ni base |
| Réponse | Les tests unitaires s'exécutent avec des fakes en mémoire |
| Mesure | Toute la suite unitaire en moins de 5 s ; aucun test ne sort sur le réseau |

Preuve : `npm test` exécute 194 tests en 1,5 s (28/10/2026). L'horloge et le générateur d'identifiants sont des ports, ce qui rend les tests déterministes.

Décision liée : [ADR-001](adr/ADR-001-architecture-hexagonale.md).

## S4 · Sécurité : appairage du téléphone (M,L)

| Partie | Valeur |
| --- | --- |
| Source | Un appareil du même réseau Wi-Fi qui n'a pas scanné le QR code |
| Stimulus | Envoie un ISBN au serveur local d'appairage du poste |
| Artefact | Serveur d'appairage du client desktop |
| Environnement | Session d'appairage ouverte |
| Réponse | Requête refusée, rien n'arrive dans l'application |
| Mesure | 100 % des requêtes sans le bon jeton refusées (404) ; jeton aléatoire de 128 bits, renouvelé à chaque session |

Preuve : `desktop/tests/main/serveur-appairage.test.ts`, « refuse un envoi avec un mauvais jeton (404) » et « une nouvelle session a un nouveau jeton ».

Décision liée : [ADR-005](adr/ADR-005-telephone-lecteur-codes-barres.md).

## S5 · Performance : recherche pendant la frappe (M,M)

| Partie | Valeur |
| --- | --- |
| Source | Bibliothécaire |
| Stimulus | Tape un titre, un auteur ou un ISBN dans la recherche |
| Artefact | `GET /exemplaires?q=…` |
| Environnement | Fonds de 10 000 exemplaires, réseau local |
| Réponse | Résultats affichés pendant la frappe, insensibles aux accents |
| Mesure | Moins de 200 ms au 95e percentile |

Preuve : partielle. Sur le fonds de démonstration (49 exemplaires), la requête répond en 0,21 s de bout en bout. **Non mesuré à 10 000 exemplaires.** La recherche s'appuie sur une colonne normalisée en base plutôt que sur un filtrage en mémoire.

Décision liée : [ADR-004](adr/ADR-004-lecture-ecriture-separees.md).
