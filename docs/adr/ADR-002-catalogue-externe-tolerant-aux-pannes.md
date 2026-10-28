# ADR-002 : Catalogue externe tolérant aux pannes, avec repli sur la saisie manuelle

Statut : acceptée - 01/10/2026

## Contexte

- S1 (H,H) : Open Library est gratuit et sans engagement de disponibilité. Sa panne ne doit pas empêcher la bibliothécaire d'ajouter des livres, ni bloquer l'interface plus de 6 s.
- La notice (titre, auteurs, couverture) n'est utile qu'à l'ajout d'un livre inconnu. La recherche et la localisation n'en ont pas besoin.

## Décision

1. Le catalogue est derrière un port, `CatalogueExterne`. Il renvoie un **résultat explicite** : `trouve`, `introuvable` ou `indisponible`. L'adapter Open Library convertit toute défaillance technique (réseau, délai, 5xx, réponse illisible) en `indisponible` et ne lève jamais d'exception.
2. Chaque appel a un **délai maximal** (5 s par défaut, `OPEN_LIBRARY_TIMEOUT_MS`).
3. Le catalogue n'est appelé **qu'en dernier recours** : livre déjà en base, puis saisie manuelle fournie, puis seulement Open Library. Tout ce qui peut être validé localement (ISBN, étagère) l'est avant l'appel.
4. En cas de panne, l'API répond `422 CATALOGUE_INDISPONIBLE` et le client propose la **saisie manuelle** en gardant l'ISBN.
5. Les notices récupérées sont enregistrées en base : un second exemplaire du même livre ne rappelle jamais le catalogue.

## Alternatives écartées

- **Laisser remonter l'exception et réessayer** : une panne de 30 min bloquerait l'ajout pendant 30 min, et chaque essai ferait attendre l'utilisateur.
- **Ajouter le livre tout de suite et compléter la notice plus tard (file asynchrone)** : aucune attente, mais il faut un worker, une file et un état « notice incomplète » dans tout le client. Trop coûteux pour une seule source externe et un usage ponctuel.
- **Importer tout le catalogue en local** : supprime la dépendance, mais représente des millions de notices à stocker et à mettre à jour.

## Conséquences

- \+ La panne n'affecte que l'ajout d'un livre inconnu ; tout le reste fonctionne (mesuré : recherche en 0,21 s pendant la panne).
- \+ La panne est un cas normal du code, testé comme les autres (`tests/unit/application/exemplaires.test.ts`).
- − Pendant une panne, la bibliothécaire tape le titre et les auteurs : plus lent, risque de fautes, pas de couverture.
- − Le délai est un **point de sensibilité** : trop court, on abandonne un catalogue simplement lent ; trop long, l'interface attend.
- − Une notice enregistrée n'est jamais rafraîchie depuis le catalogue.
