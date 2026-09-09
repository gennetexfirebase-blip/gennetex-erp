import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth/AuthGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      {(session) => <App userEmail={session.user.email ?? ''} />}
    </AuthGate>
  </StrictMode>,
);
