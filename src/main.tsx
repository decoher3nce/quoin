import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { applyIncomingScenario } from './state/scenario';

// If the URL carries a shared scenario, adopt it into localStorage before React
// mounts so the normal state hooks initialize from it.
applyIncomingScenario();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
