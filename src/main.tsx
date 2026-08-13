import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import AccessGate from './access/AccessGate';
import './styles.css';

const ONE_HOUR = 60 * 60 * 1000;

const updateSW = registerSW({
  immediate: true,

  onNeedRefresh() {
    const shouldUpdate = window.confirm(
      'A new version of Document Toolkit is ready. Update now?\n\nYour current page will reload.'
    );

    if (shouldUpdate) {
      void updateSW(true);
    }
  },

  onOfflineReady() {
    console.info('Document Toolkit is ready to work offline.');
  },

  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine) {
        void registration.update().catch((error) => {
          console.warn('PWA update check failed:', error);
        });
      }
    };

    window.setTimeout(checkForUpdate, 10_000);
    window.setInterval(checkForUpdate, ONE_HOUR);
    window.addEventListener('online', checkForUpdate);
  },

  onRegisterError(error) {
    console.error('Service worker registration failed:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccessGate>
      <App />
    </AccessGate>
  </StrictMode>,
);
