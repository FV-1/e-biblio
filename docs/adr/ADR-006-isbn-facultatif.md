# ADR-006 : Livre identifié par un identifiant interne, ISBN facultatif

Statut : acceptée - 01/10/2026. Remplace le choix initial « l'ISBN est la clé du livre ».

## Contexte

- Le premier schéma utilisait l'ISBN comme clé primaire des livres.
- Une bibliothèque possède des ouvrages sans ISBN : livres antérieurs à 1970, documents internes, archives. Il était impossible de les enregistrer.

## Décision

- Un livre a un **identifiant interne**. L'ISBN devient un attribut facultatif, unique quand il existe, qui sert à retrouver la notice.
- L'ISBN est validé (clé de contrôle) et toujours stocké en ISBN-13 : un livre saisi en ISBN-10 puis en ISBN-13 reste un seul livre.
- La migration v2 convertit les données existantes : chaque livre reçoit l'identifiant `livre-<isbn>`.

## Alternatives écartées

- **Fabriquer un faux ISBN pour les ouvrages qui n'en ont pas** : garde le schéma, mais mélange de vrais et de faux ISBN, qui pourraient un jour entrer en collision avec de vrais.
- **Une table séparée pour les ouvrages sans ISBN** : deux modèles pour le même concept, et toutes les requêtes en double.

## Conséquences

- \+ Tous les ouvrages peuvent être inventoriés.
- \+ Les règles de recherche et de localisation ne changent pas.
- − Deux saisies manuelles du même ouvrage sans ISBN créent deux notices : aucun doublon n'est détecté.
- − L'API accepte trois façons de désigner un livre (ISBN, saisie manuelle, `livreId`) : plus de cas à valider et à tester.
