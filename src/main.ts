import { ConsoleEventPublisher } from './adapters/events/console-event-publisher.js';
import { creerApplicationHttp } from './adapters/http/application-http.js';
import { OpenLibraryCatalogue } from './adapters/isbn/open-library-catalogue.js';
import { ouvrirBaseSqlite } from './adapters/persistence/connexion.js';
import { SqliteEmplacementRepository } from './adapters/persistence/sqlite-emplacement-repository.js';
import { SqliteExemplaireRepository } from './adapters/persistence/sqlite-exemplaire-repository.js';
import { SqliteInventaireLivres } from './adapters/persistence/sqlite-inventaire-livres.js';
import { SqliteLivreRepository } from './adapters/persistence/sqlite-livre-repository.js';
import { GenerateurUuid } from './adapters/systeme/generateur-uuid.js';
import { HorlogeSysteme } from './adapters/systeme/horloge-systeme.js';
import { EnregistrerDetection } from './application/detections/enregistrer-detection.js';
import { ConsulterEmplacement } from './application/emplacements/consulter-emplacement.js';
import { CreerEmplacement } from './application/emplacements/creer-emplacement.js';
import { ListerEmplacements } from './application/emplacements/lister-emplacements.js';
import { ModifierEmplacement } from './application/emplacements/modifier-emplacement.js';
import { SupprimerEmplacement } from './application/emplacements/supprimer-emplacement.js';
import { AjouterExemplaire } from './application/exemplaires/ajouter-exemplaire.js';
import { ConsulterExemplaire } from './application/exemplaires/consulter-exemplaire.js';
import { ListerExemplairesMalRanges } from './application/exemplaires/lister-exemplaires-mal-ranges.js';
import { RechercherExemplaires } from './application/exemplaires/rechercher-exemplaires.js';
import { ListerExemplairesDuLivre } from './application/exemplaires/lister-exemplaires-du-livre.js';
import { ConsulterNotice } from './application/livres/consulter-notice.js';
import { ListerLivres } from './application/livres/lister-livres.js';
import { chargerConfig } from './config.js';

/**
 * Composition root : SEUL endroit qui connaît les implémentations concrètes.
 * Remplacer une technologie (WebSocket pour les événements, autre base, autre
 * catalogue…) revient à changer une ligne ici, sans toucher au métier.
 */
function main(): void {
  const config = chargerConfig();

  // --- Adapters secondaires (sortants) ---
  const db = ouvrirBaseSqlite(config.DB_PATH);
  const emplacements = new SqliteEmplacementRepository(db);
  const livres = new SqliteLivreRepository(db);
  const exemplaires = new SqliteExemplaireRepository(db);
  const inventaire = new SqliteInventaireLivres(db); // modèle de lecture (vue « base de données »)
  const catalogue = new OpenLibraryCatalogue({
    urlBase: config.OPEN_LIBRARY_URL,
    delaiMaxMs: config.OPEN_LIBRARY_TIMEOUT_MS,
  });
  const publisher = new ConsoleEventPublisher();
  const horloge = new HorlogeSysteme();
  const generateurId = new GenerateurUuid();

  // --- Cas d'usage, avec injection manuelle des ports ---
  const app = creerApplicationHttp({
    emplacements: {
      creer: new CreerEmplacement(emplacements, generateurId),
      lister: new ListerEmplacements(emplacements),
      consulter: new ConsulterEmplacement(emplacements),
      modifier: new ModifierEmplacement(emplacements),
      supprimer: new SupprimerEmplacement(emplacements, exemplaires),
    },
    exemplaires: {
      ajouter: new AjouterExemplaire(exemplaires, livres, emplacements, catalogue, generateurId),
      rechercher: new RechercherExemplaires(exemplaires, livres, emplacements),
      consulter: new ConsulterExemplaire(exemplaires, livres, emplacements),
      listerMalRanges: new ListerExemplairesMalRanges(exemplaires, livres, emplacements),
      listerDuLivre: new ListerExemplairesDuLivre(exemplaires, livres, emplacements),
    },
    livres: {
      consulterNotice: new ConsulterNotice(livres, catalogue),
      lister: new ListerLivres(inventaire),
    },
    detections: {
      enregistrer: new EnregistrerDetection(exemplaires, livres, emplacements, publisher, horloge),
    },
  });

  // --- Adapter primaire (entrant) : serveur HTTP ---
  const serveur = app.listen(config.PORT, config.HOST, () => {
    console.log(`[e-biblio] API à l'écoute sur http://${config.HOST}:${config.PORT} (base : ${config.DB_PATH})`);
  });

  const arreter = (signal: string) => {
    console.log(`[e-biblio] ${signal} reçu, arrêt…`);
    serveur.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => arreter('SIGINT'));
  process.once('SIGTERM', () => arreter('SIGTERM'));
}

main();
