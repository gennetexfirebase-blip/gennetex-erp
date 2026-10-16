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

// Шинэ хувилбар байршвал нээлттэй хуудсыг автоматаар шинэчилнэ: минут тутам
// index.html-ийн үндсэн bundle-ийн нэрийг шалгаж, өөрчлөгдсөн бол хэрэглэгч
// юм бичиж байхгүй үед (эсвэл таб нуугдсан үед) дахин ачаална.
(() => {
  if (import.meta.env.DEV) return;
  const bundle = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] || '';
  const current = bundle(document.documentElement.innerHTML);
  if (!current) return;
  let pending = false;
  const typing = () => {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  };
  const reloadSoon = () => {
    if (document.hidden || !typing()) window.location.reload();
    else pending = true;
  };
  const check = async () => {
    try {
      const html = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const next = bundle(html);
      if (next && next !== current) reloadSoon();
    } catch {
      /* сүлжээгүй — дараагийн удаа */
    }
  };
  setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  document.addEventListener('focusout', () => {
    if (pending && !typing()) window.location.reload();
  });
})();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
