# ADR-007 : Plan 3D dans le client, suivi de l'exemplaire par interrogation toutes les 3 s

Statut : acceptée - 29/10/2026

## Contexte

- Demande du client : voir sur un plan en 3D où se trouve un livre, et suivre sa position « en temps réel ».
- Le serveur connaît déjà la position (x, y) de chaque emplacement et, pour chaque exemplaire, sa place prévue et sa dernière détection. Il ne connaît ni la taille ni l'orientation des meubles.
- Chaque scan produit un événement `ExemplaireDetecte`, publié par le port `EventPublisher` (aujourd'hui vers la console).
- « Temps réel » veut dire ici : la position affichée change dès qu'un scan arrive. Suivre un livre en continu demanderait du matériel (RFID, antennes).
- La fonctionnalité est livrée juste avant la soutenance : elle ne doit ni modifier le serveur, ni fragiliser la démonstration existante.

## Décision

1. **Rendu dans le client desktop**, avec Three.js, à partir de `GET /emplacements` : étagères en volumes, sols des salles, étages empilés. Les dimensions des meubles sont une convention d'affichage (8 × 1,6 × 2,4 unités), pas une donnée du serveur.
2. Le calcul de la scène (`plan/disposition.ts`) est une **fonction pure**, testée sans carte graphique. Seul le composant `ScenePlan` dépend de WebGL ; il est remplacé par un double dans les tests et affiche un message clair si WebGL manque.
3. **Suivi par interrogation** : quand un exemplaire est sélectionné et l'onglet visible, le client appelle `GET /exemplaires?livreId=…` toutes les 3 s et déplace les repères si la position a changé. Rien ne tourne quand l'onglet est caché.

## Alternatives écartées

- **Flux Server-Sent Events** (`GET /evenements`, nouvel adapter de `EventPublisher`, relais par IPC vers la page) : vrai temps réel, sans requêtes inutiles. C'est la cible, mais elle touche le serveur, le processus main et la page : trop de risque à quelques heures de la soutenance. Le port `EventPublisher` rend ce passage possible sans toucher au domaine (ADR-001).
- **WebSocket** : bidirectionnel, alors que le flux ne va que du serveur vers le client ; une dépendance de plus.
- **Plan 2D en SVG** : plus simple et plus léger, mais moins lisible dès qu'il y a plusieurs étages, et la demande portait sur la 3D.
- **Stocker la taille et l'orientation des meubles côté serveur** : plan fidèle, mais migration, API et saisie à prévoir. Reporté tant que le plan sert à localiser et non à mesurer.

## Conséquences

- \+ Aucun changement du serveur ni du domaine : la démonstration et les tests existants sont intacts.
- \+ La scène se teste sans WebGL (7 tests de disposition, 7 tests d'écran avec un double de la scène).
- − Jusqu'à 3 s entre un scan et son affichage, au lieu d'un affichage immédiat.
- − Une requête toutes les 3 s par poste qui suit un livre. Acceptable pour quelques postes, à remplacer par SSE au-delà.
- − Le plan n'est pas à l'échelle réelle des meubles, seulement aux positions saisies.
- − L'application pèse environ 1,9 Mo de plus (Three.js) et demande WebGL.
