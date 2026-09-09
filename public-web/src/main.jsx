import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');

/**
 * Build үед prerender хийсэн агуулга — `window.__SITE_CONTENT__` дотор
 * ирнэ. Байвал зурсан HTML дээр нь hydrate хийж, дахин зурахгүй.
 */
const initialContent = window.__SITE_CONTENT__ || undefined;
const tree = (
  <StrictMode>
    <App initialContent={initialContent} />
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, tree);
else createRoot(root).render(tree);
