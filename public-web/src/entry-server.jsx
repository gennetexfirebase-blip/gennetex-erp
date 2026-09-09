import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppRoutes } from './App';
import { SiteContentProvider } from './context/SiteContentContext';

/** Build үед нэг замыг HTML болгож зурна. */
export function render(url, content) {
  return renderToString(
    <StrictMode>
      <SiteContentProvider initial={content}>
        <StaticRouter location={url}>
          <AppRoutes />
        </StaticRouter>
      </SiteContentProvider>
    </StrictMode>,
  );
}

export { mergeSiteContent } from './lib/siteContent';
export { DEFAULT_SITE_CONTENT } from './lib/siteContentDefaults';
