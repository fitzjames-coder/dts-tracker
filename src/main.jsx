import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register the service worker for offline app-shell caching (production only).
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Warm the PDF chunk and its worker so the service worker caches them,
    // letting PDFs render offline even if none was ever opened online.
    import('./components/PdfPages.jsx')
      .then((m) => m.warm())
      .catch(() => {});
  });
}
