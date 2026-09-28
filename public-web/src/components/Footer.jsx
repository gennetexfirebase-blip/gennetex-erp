import { Link } from 'react-router-dom';
import { useSiteContent } from '../context/SiteContentContext';
import { formatCopyright } from '../lib/siteContent';

export default function Footer() {
  const { footer, language } = useSiteContent();
  const isEn = language === 'en';

  return (
    <footer className="relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 py-8 sm:px-6 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Gennetex" className="h-7 w-auto opacity-90" />
          <span className="font-semibold tracking-tight">{footer.brand}</span>
        </div>
        {/* Нууцлал, нөхцөл — Microsoft Teams App-ын шаардлагаар нээлттэй байх ёстой */}
        <nav className="flex items-center gap-4 text-sm text-zinc-500">
          <Link to="/privacy" className="transition-colors hover:text-graphite-200">
            {isEn ? 'Privacy' : 'Нууцлал'}
          </Link>
          <span aria-hidden className="h-3 w-px bg-graphite-800" />
          <Link to="/terms" className="transition-colors hover:text-graphite-200">
            {isEn ? 'Terms' : 'Үйлчилгээний нөхцөл'}
          </Link>
          {/* Google Play Data safety — устгах зам олдоц сайтай байх ёстой */}
          <span aria-hidden className="h-3 w-px bg-graphite-800" />
          <Link to="/delete-account" className="transition-colors hover:text-graphite-200">
            {isEn ? 'Delete account' : 'Бүртгэл устгах'}
          </Link>
        </nav>
        <p className="text-sm text-zinc-500">{formatCopyright(isEn ? '© {year} Gennetex. All rights reserved.' : footer.copyright)}</p>
      </div>
    </footer>
  );
}
