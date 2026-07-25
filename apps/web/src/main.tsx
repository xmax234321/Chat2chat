import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initMobileBridge } from './lib/mobile-bridge';
import { initStateStorage } from './lib/state-storage';
import './styles/global.css';

initMobileBridge();

void initStateStorage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
