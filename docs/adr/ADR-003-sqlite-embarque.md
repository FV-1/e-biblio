# ADR-003 : Base SQLite embarquée, avec migrations versionnées

Statut : acceptée - 01/10/2026

## Contexte

- Une seule bibliothèque, un seul serveur, quelques postes : peu d'écritures simultanées.
- Le budget d'exploitation est faible et personne n'administre de serveur de base de données.
- S2 (H,M) : la base pourra changer si la bibliothèque grandit.

## Décision

- SQLite, via better-sqlite3, dans un seul fichier (`DB_PATH`, `./data/biblio.db` par défaut), en mode WAL et avec les clés étrangères activées.
- Le schéma évolue par **migrations numérotées** (`PRAGMA user_version`), jamais modifiées une fois écrites. Une migration est du SQL, ou une fonction quand elle doit recalculer des données avec les règles du domaine.
- L'accès passe uniquement par les ports (ADR-001).

## Alternatives écartées

- **PostgreSQL** : meilleur en écritures concurrentes et en multi-sites, mais un serveur à installer, sauvegarder et mettre à jour. Surdimensionné pour une bibliothèque.
- **Fichiers JSON** : aucune dépendance, mais pas de requêtes, pas de contraintes d'intégrité ni de transactions.

## Conséquences

- \+ Installation en une commande, aucun serveur de base, sauvegarde = copier un fichier.
- \+ Les tests d'intégration utilisent une vraie base, en mémoire (`:memory:`).
- \+ Les migrations sont testées sur des données réelles (passage à l'ISBN facultatif).
- − Une seule écriture à la fois : limite si plusieurs sites écrivent en même temps.
- − Le serveur API et la base sont sur la même machine : pas de réplication.
- − Passer à PostgreSQL demandera de réécrire les adapters de persistance (mais pas le métier, cf. S2).
