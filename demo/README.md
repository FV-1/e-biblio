# Démonstration de soutenance (5 min)

Trois preuves, dans l'ordre : la tranche verticale, le scénario de qualité S1 (panne d'Open Library) et le test d'architecture. Chaque étape a été répétée le 28/10/2026.

## Avant de passer (hors chrono)

Trois terminaux PowerShell à la racine du dépôt :

| Terminal | Commande | Rôle |
| --- | --- | --- |
| 1 · Serveur | `npm run seed:demo` puis `npm run dev` | Base remise à zéro (35 œuvres, 49 exemplaires, 7 mal rangés), API sur le port 3000 |
| 2 · Client | `cd desktop` puis `npm run dev` | Fenêtre e-biblio |
| 3 · Commandes | (vide) | Scan simulé et tests |

Vérifier dans l'app : onglet **Base de données**, 35 œuvres. Agrandir la police des terminaux. Sans Internet, les couvertures sont remplacées par des initiales : ce n'est pas gênant.

## 1. Tranche verticale (≈ 1 min 45)

1. **Rechercher** (`Ctrl+K`), taper `emile` : les livres de Zola s'affichent, accents ignorés. Ouvrir *Germinal*, exemplaire n°2 : rangé en *Étage 1 › Salle A › Rayon Romans › Étagère Romans 3*.
2. **Scan simulé** dans le terminal 3 (un lecteur QR ou RFID enverrait la même requête) :

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/detections -ContentType 'application/json' -Body '{"exemplaireId":"ex-germinal-2","emplacementId":"etagere-2-1-1"}'
   ```

3. Montrer le terminal 1 : `[evenement] ExemplaireDetecte … "malRange":true`.
4. Dans l'app, relancer la recherche `germinal` : l'exemplaire n°2 est **mal rangé**, vu en *Salle B › Rayon Sciences*. Le filtre « Mal rangés » en montre maintenant 8.

À dire : « Le scan traverse toutes les couches : route Express, cas d'usage `EnregistrerDetection`, règle du domaine `estMalRange`, enregistrement SQLite, puis publication de l'événement par le port `EventPublisher`. »

## 2. Scénario de qualité S1 : Open Library en panne (≈ 1 min 30)

1. Terminal 1 : `Ctrl+C`, puis `npm run dev:panne`. Open Library pointe maintenant vers une adresse qui ne répond jamais.
2. Dans l'app, **Ajouter un livre › Par ISBN**, taper `978-2-07-036822-8` (*Le Petit Prince*, absent de la base), puis **Chercher la notice**.
3. Après environ 3 s : « Le catalogue est indisponible (délai de réponse dépassé) » et le bouton **Saisir la notice à la main**. Cliquer : l'ISBN est conservé.
4. Saisir *Le Petit Prince*, *Antoine de Saint-Exupéry*, choisir une étagère, ajouter : l'exemplaire est créé.
5. Pendant la panne, `Ctrl+K` puis `zola` : la recherche répond normalement.
6. Terminal 1 : `Ctrl+C`, puis `npm run dev` pour revenir à la normale.

À dire : « Mesure du scénario : réponse en moins de 4 s, avant que le client abandonne à 5 s ; 100 % des ajouts aboutissent par la saisie manuelle ; rien d'autre n'est touché. Mesuré : 3,2 s. »

## 3. Test d'architecture (≈ 1 min 15)

1. Terminal 3 : `npx vitest run --project unit tests/unit/architecture.test.ts` → 2 tests au vert.
2. Créer `src/domain/violation.ts` :

   ```ts
   import { SqliteLivreRepository } from '../adapters/persistence/sqlite-livre-repository.js';

   export const triche = SqliteLivreRepository;
   ```

3. Relancer le test → **rouge** : `domain\violation.ts (domain) ne doit pas importer ../adapters/persistence/sqlite-livre-repository.js (adapters/persistence)`.
4. Supprimer le fichier, relancer → vert.

Le fichier n'est importé par personne : le serveur qui tourne n'est pas affecté.

## 4. Pour finir (≈ 30 s)

`npm test` : 194 tests unitaires en environ 1,5 s, sans base ni réseau (scénario S3).

## Plans de secours

| Problème | Solution |
| --- | --- |
| La fenêtre Electron ne s'ouvre pas | Montrer l'API avec `requests.http`, ou `Invoke-RestMethod http://localhost:3000/exemplaires?q=zola` |
| Le scénario S1 ne se déclenche pas en direct | `npx vitest run --project unit tests/unit/application/exemplaires.test.ts -t "catalogue hors ligne"` : 2 tests qui prouvent le même comportement |
| La base est dans un état inattendu | `npm run seed:demo` (le serveur peut rester démarré) |
| Le port 3000 est déjà pris | `$env:PORT=4000; npm run dev`, puis régler l'adresse dans le panneau **Serveur** de l'app |
