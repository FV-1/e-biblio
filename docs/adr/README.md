# Décisions d'architecture (ADR)

Chaque ADR cite le scénario de qualité ou la contrainte qui le motive (voir [scénarios de qualité](../scenarios-qualite.md)). Un ADR n'est jamais réécrit : une décision remplacée reçoit le statut « remplacée par ADR-00X ».

Ces ADR ont été rédigés le 28/10/2026 à partir du code et de l'historique Git. Ils tracent les décisions prises le 01/10/2026.

| ADR | Décision | Scénarios |
| --- | --- | --- |
| [ADR-001](ADR-001-architecture-hexagonale.md) | Architecture hexagonale, vérifiée par un test | S2, S3 |
| [ADR-002](ADR-002-catalogue-externe-tolerant-aux-pannes.md) | Catalogue externe tolérant aux pannes, repli sur la saisie manuelle | S1 |
| [ADR-003](ADR-003-sqlite-embarque.md) | Base SQLite embarquée, migrations versionnées | S2, contrainte de coût |
| [ADR-004](ADR-004-lecture-ecriture-separees.md) | Modèle de lecture séparé pour la vue « base de données » | S5 |
| [ADR-005](ADR-005-telephone-lecteur-codes-barres.md) | Le téléphone comme lecteur de codes-barres, appairé au poste | S4 |
| [ADR-006](ADR-006-isbn-facultatif.md) | Livre identifié par un identifiant interne, ISBN facultatif | besoin métier |
| [ADR-007](ADR-007-plan-3d-et-suivi.md) | Plan 3D dans le client, suivi de l'exemplaire toutes les 3 s | demande du client |
| [ADR-008](ADR-008-scanner-video-https.md) | Caméra en direct sur le téléphone, HTTPS local auto-signé (remplace la photo de l'ADR-005) | demande du client, S4 |

Les deux décisions majeures présentées en soutenance sont **ADR-001** et **ADR-002**.
