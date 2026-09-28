import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_SITE_CONTENT } from '../lib/siteContentDefaults';
import { fetchSiteContent } from '../lib/siteContent';

const SiteContentContext = createContext({
  ...DEFAULT_SITE_CONTENT,
  updatedAt: null,
  reload: () => {},
  language: 'mn',
  setLanguage: () => {},
});

/**
 * `initial` — build үед (prerender) Supabase-аас татсан агуулга. Байвал
 * анхны зураалт нь шууд зөв агуулгатай гарч, "хоосон -> дүүрэн" анивчилт
 * үүсэхгүй. Браузерт ачаалсны дараа шинэчилж дахин уншсаар байна.
 */
export function SiteContentProvider({ children, initial }) {
  const [content, setContent] = useState(initial || DEFAULT_SITE_CONTENT);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [language, setLanguage] = useState('mn');
  useEffect(() => {
    try {
      if (localStorage.getItem('gennetex-language') === 'en') setLanguage('en');
    } catch { /* Optional persistence. */ }
  }, []);
  const changeLanguage = useCallback((next) => {
    if (next !== 'mn' && next !== 'en') return;
    setLanguage(next);
    try { localStorage.setItem('gennetex-language', next); } catch { /* Optional persistence. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const reload = useCallback(async () => {
    const { content: next, updatedAt: at } = await fetchSiteContent();
    setContent(next);
    setUpdatedAt(at);
  }, []);

  useEffect(() => {
    let alive = true;
    reload().then(() => {
      if (!alive) return;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  return (
    <SiteContentContext.Provider value={{ ...content, updatedAt, reload, language, setLanguage: changeLanguage }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
