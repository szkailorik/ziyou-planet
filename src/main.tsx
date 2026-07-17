import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import './learning-optimizations.css';
import './tts.css';

const hadActiveServiceWorker = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let reloadingForServiceWorkerUpdate = false;
if (hadActiveServiceWorker) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForServiceWorkerUpdate) return;
    reloadingForServiceWorkerUpdate = true;
    window.location.reload();
  });
}

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
