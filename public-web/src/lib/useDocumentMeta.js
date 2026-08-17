/**
 * Хуудасны SEO metadata (title, description, canonical, OG).
 *
 * Энэ төсөл нь SPA (Vite + React Router) тул серверийн талд metadata
 * үүсгэдэггүй. Хуудас солигдох бүрд `document`-ийг шинэчилж, буцахад
 * ӨМНӨХ утгыг сэргээнэ — ингэснээр нэг хуудсын гарчиг нөгөө дээр
 * наалдан үлдэхгүй.
 */
import { useEffect } from 'react';

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  let created = false;
  if (!el) {
    el = document.createElement(attrs.tag || 'meta');
    created = true;
  }
  const previous = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'tag') continue;
    previous[key] = el.getAttribute(key);
    el.setAttribute(key, value);
  }
  if (created) document.head.appendChild(el);
  return () => {
    if (created) {
      el.remove();
      return;
    }
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) el.removeAttribute(key);
      else el.setAttribute(key, value);
    }
  };
}

export default function useDocumentMeta({ title, description, canonical }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const restores = [];
    if (description) {
      restores.push(
        upsertMeta('meta[name="description"]', { tag: 'meta', name: 'description', content: description })
      );
      restores.push(
        upsertMeta('meta[property="og:description"]', {
          tag: 'meta',
          property: 'og:description',
          content: description,
        })
      );
    }
    if (title) {
      restores.push(
        upsertMeta('meta[property="og:title"]', { tag: 'meta', property: 'og:title', content: title })
      );
    }
    if (canonical) {
      restores.push(
        upsertMeta('link[rel="canonical"]', { tag: 'link', rel: 'canonical', href: canonical })
      );
      restores.push(
        upsertMeta('meta[property="og:url"]', { tag: 'meta', property: 'og:url', content: canonical })
      );
    }

    return () => {
      document.title = prevTitle;
      restores.forEach((restore) => restore());
    };
  }, [title, description, canonical]);
}
