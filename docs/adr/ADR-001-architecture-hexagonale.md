# ADR-001 : Architecture hexagonale, vérifiée par un test

Statut : acceptée - 01/10/2026

## Contexte

- S2 (H,M) : la bibliothèque n'a pas choisi sa base ni son catalogue définitifs ; en changer ne doit toucher aucune règle métier.
- S3 (M,L) : les règles métier (localisation, « mal rangé », ISBN) doivent se tester sans base ni réseau.
- L'équipe est petite : la structure doit rester simple et ne pas reposer sur un framework lourd.

## Décision

Le serveur est découpé en quatre couches, avec un seul sens de dépendance :
`adapters → application → ports → domain`.

- `domain/` : entités et règles pures (Isbn, Emplacement, Livre, Exemplaire). Aucune bibliothèque.
- `ports/` : interfaces définies par le métier (repositories, CatalogueExterne, EventPublisher, Horloge, GenerateurId).
- `application/` : un cas d'usage par classe.
- `adapters/` : SQLite, Express, Open Library, console. Un adapter n'importe jamais un autre adapter.
- `main.ts` est le seul endroit qui instancie les adapters et les injecte (injection manuelle).

La règle est vérifiée par une fonction de conformité : `tests/unit/architecture.test.ts` analyse les imports de `src/` et échoue dès qu'une couche importe une couche interdite. Le test vérifie aussi qu'il sait détecter une violation.

## Alternatives écartées

- **MVC en couches classique** (routes → services → base) : plus court à écrire, mais les services dépendent de SQLite. Changer de base touche le métier, et tester le métier exige une base.
- **Framework à injection (NestJS)** : apporte la structure, mais le domaine dépendrait des décorateurs du framework, et le test d'architecture serait plus difficile à écrire.

## Conséquences

- \+ Changer de base ou de catalogue = un nouvel adapter et une ligne dans `main.ts` (S2).
- \+ 194 tests unitaires en 1,5 s, avec des fakes en mémoire (S3).
- \+ La règle ne s'érode pas : toute violation fait échouer les tests.
- − Plus de fichiers et d'indirections qu'un MVC : une fonctionnalité traverse 4 couches.
- − Chaque entité a un « snapshot » pour passer entre domaine et persistance : code de conversion à maintenir.
- − Les fakes peuvent diverger des vrais adapters. Parade : les tests de contrat (`tests/contrats/`) s'exécutent contre les deux.
