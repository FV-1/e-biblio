# ADR-007 : Plan 3D dans le client, suivi de l'exemplaire par interrogation toutes les 3 s

Statut : acceptée - 29/10/2026, complétée le même jour (meubles, vue « étagère », points 4 et 5)

## Contexte

- Demande du client : voir sur un plan en 3D où se trouve un livre, et suivre sa position « en temps réel ».
- Le serveur connaît déjà la position (x, y) de chaque emplacement et, pour chaque exemplaire, sa place prévue et sa dernière détection. Il ne connaît ni la taille ni l'orientation des meubles.
- Chaque scan produit un événement `ExemplaireDetecte`, publié par le port `EventPublisher` (aujourd'hui vers la console).
- « Temps réel » veut dire ici : la position affichée change dès qu'un scan arrive. Suivre un livre en continu demanderait du matériel (RFID, antennes).
- La fonctionnalité est livrée juste avant la soutenance : elle ne doit ni toucher au domaine, ni fragiliser la démonstration existante.

## Décision

1. **Rendu dans le client desktop**, avec Three.js, à partir de `GET /emplacements` : étagères en volumes, sols des salles, étages empilés. Les dimensions des meubles sont une convention d'affichage (8 × 1,5 × 3,2 unités), pas une donnée du serveur.
2. Le calcul de la scène (`plan/disposition.ts`) est une **fonction pure**, testée sans carte graphique. Seul le composant `ScenePlan` dépend de WebGL ; il est remplacé par un double dans les tests et affiche un message clair si WebGL manque.
3. **Suivi par interrogation** : quand un exemplaire est sélectionné et l'onglet visible, le client appelle `GET /exemplaires?livreId=…` toutes les 3 s et déplace les repères si la position a changé. Rien ne tourne quand l'onglet est caché.
4. **Contenu des étagères** : une route de lecture, `GET /exemplaires?emplacementId=…`, renvoie les exemplaires rangés sur une étagère ou vus dessus en dernier. Elle passe par une nouvelle méthode du port `ExemplaireRepository` (`trouverParEmplacement`), vérifiée par les tests de contrat contre la mémoire et SQLite.
5. **Planches** : chaque meuble est dessiné avec 4 planches ; les livres y sont répartis par ordre alphabétique (`plan/contenu-etagere.ts`). La vue 3D et la vue « étagère » utilisent la même répartition, et le statut d'un livre est calculé par rapport à l'étagère regardée : à sa place, intrus (vu ici, rangé ailleurs) ou absent (rangé ici, vu ailleurs).

## Alternatives écartées

- **Flux Server-Sent Events** (`GET /evenements`, nouvel adapter de `EventPublisher`, relais par IPC vers la page) : vrai temps réel, sans requêtes inutiles. C'est la cible, mais elle touche le serveur, le processus main et la page : trop de risque à quelques heures de la soutenance. Le port `EventPublisher` rend ce passage possible sans toucher au domaine (ADR-001).
- **WebSocket** : bidirectionnel, alors que le flux ne va que du serveur vers le client ; une dépendance de plus.
- **Plan 2D en SVG** : plus simple et plus léger, mais moins lisible dès qu'il y a plusieurs étages, et la demande portait sur la 3D.
- **Stocker la taille et l'orientation des meubles côté serveur** : plan fidèle, mais migration, API et saisie à prévoir. Reporté tant que le plan sert à localiser et non à mesurer.

## Conséquences

- \+ Le domaine ne change pas ; côté serveur, une seule route de lecture s'ajoute, par un port existant. La démonstration et les tests existants sont intacts.
- \+ La scène se teste sans WebGL : la disposition et la répartition sur les planches sont des fonctions pures, et les écrans sont testés avec un double de la scène.
- − Jusqu'à 3 s entre un scan et son affichage, au lieu d'un affichage immédiat.
- − Une requête toutes les 3 s par poste qui suit un livre. Acceptable pour quelques postes, à remplacer par SSE au-delà.
- − Le plan n'est pas à l'échelle réelle des meubles, seulement aux positions saisies.
- − La planche et l'ordre d'un livre sur son étagère sont une convention d'affichage : le système sait sur quelle étagère est un livre, pas à quelle hauteur. Les emplacements de type « niveau » le permettraient, mais le domaine n'autorise le rangement que sur une étagère.
- − Ouvrir le plan charge le contenu de toutes les étagères (une requête par étagère) : à regrouper en une seule route si le fonds grandit.
- − L'application pèse environ 1,9 Mo de plus (Three.js) et demande WebGL.
