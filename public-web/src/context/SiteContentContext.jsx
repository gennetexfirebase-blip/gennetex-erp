import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_SITE_CONTENT } from '../lib/siteContentDefaults';
import { fetchSiteContent } from '../lib/siteContent';

const SiteContentContext = createContext({
  ...DEFAULT_SITE_CONTENT,
  updatedAt: null,
  reload: () => {},
});

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(DEFAULT_SITE_CONTENT);
  const [updatedAt, setUpdatedAt] = useState(null);

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
    <SiteContentContext.Provider value={{ ...content, updatedAt, reload }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
