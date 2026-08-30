import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './lib/ToastContext';
import { ConfirmProvider } from './lib/ConfirmContext';
import { PickListsProvider } from './lib/PickListsContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <PickListsProvider>
            <App />
          </PickListsProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Enregistrement du service worker (PWA installable) : ne met en cache que la
// coquille d'interface (JS/CSS/icônes), jamais les données du CRM — voir
// public/sw.js. Uniquement en production, une fois la page chargée.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
