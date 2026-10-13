import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import App from './App';
import './index.css';

// Шинэ хувилбар байршсаны дараа нээлттэй хуудас хуучин chunk-ийг (жишээ нь
// Excel/PDF модуль) татах гэвэл 404 болдог. Тэр үед хуудсыг нэг удаа
// шинэчилж шинэ хувилбарыг ачаална (давтагдахгүйн тулд 1 минутын хамгаалалттай).
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('gx_chunk_reload') || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('gx_chunk_reload', String(Date.now()));
  } catch {
    /* sessionStorage хаалттай бол ч шинэчилнэ */
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
