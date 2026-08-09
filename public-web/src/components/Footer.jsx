import { useSiteContent } from '../context/SiteContentContext';
import { formatCopyright } from '../lib/siteContent';

export default function Footer() {
  const { footer } = useSiteContent();

  return (
    <footer className="relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 py-8 sm:px-6 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Gennetex" className="h-7 w-auto opacity-90" />
          <span className="font-semibold tracking-tight">{footer.brand}</span>
        </div>
        <p className="text-sm text-gray-500">{formatCopyright(footer.copyright)}</p>
      </div>
    </footer>
  );
}
