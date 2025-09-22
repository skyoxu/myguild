import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
// Observability: initialize Sentry (renderer) only in production (free SaaS safe defaults)
if (import.meta.env && import.meta.env.PROD) {
  import('./shared/observability/metrics-integration')
    .then(m => {
      const rate = Number((import.meta as any).env?.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0);
      return m.initializeRendererProcessMonitoring({
        tracesSampleRate: rate,
        enableRendererProcess: true,
        enableGameMetrics: true,
      });
    })
    .catch(() => {/* no-op: observability is best-effort in renderer */});
}
import App from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
