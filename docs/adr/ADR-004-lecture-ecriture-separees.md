# ADR-004 : Modèle de lecture séparé pour la vue « base de données »

Statut : acceptée - 01/10/2026

## Contexte

- La vue « base de données » liste toutes les œuvres avec, pour chacune, le nombre d'exemplaires et le nombre d'exemplaires mal rangés. Elle filtre, trie et pagine.
- S5 (M,M) : l'interface doit rester fluide quand le fonds grandit.
- Avec les seuls repositories, il faudrait charger toutes les œuvres et tous les exemplaires, puis compter et trier en mémoire à chaque page.

## Décision

Séparer lecture et écriture (CQRS léger, sur la même base) :

- Les **repositories** restent réservés aux écritures : ils chargent et enregistrent des entités.
- Un port de lecture, `InventaireLivres`, renvoie directement des vues prêtes à afficher. Son adapter SQLite filtre, trie, pagine et compte en **une seule requête agrégée**.
- Les clés de tri (titre, premier auteur, sans casse ni accents) sont calculées par le domaine et stockées en colonnes indexées.

## Alternatives écartées

- **Agréger en mémoire à partir des repositories** : une seule source de vérité, mais le coût grandit avec tout le fonds à chaque affichage.
- **Deux bases distinctes (lecture / écriture) synchronisées par événements** : utile à grande échelle, mais introduit une cohérence différée sans besoin réel ici.

## Conséquences

- \+ Une page de la vue = une requête, quelle que soit la taille du fonds.
- − La règle « mal rangé » existe deux fois : dans le domaine (`Exemplaire.estMalRange`) et en SQL. Parade : un test de contrat vérifie que les deux comptent exactement pareil.
- − Les règles de tri doivent rester identiques entre le domaine et la base : elles sont donc exportées par le domaine et réutilisées par l'adapter.
