import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FournisseurService } from './service/contexte-service';
import './styles.css';

/**
 * Composition root de l'interface : injecte l'implémentation réelle du port
 * (window.biblio, exposée par le preload). Les tests injectent un fake à la place.
 */
createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <FournisseurService service={window.biblio}>
      <App />
    </FournisseurService>
  </StrictMode>,
);
