import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ResultApp from './ResultApp';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResultApp />
  </StrictMode>,
);
