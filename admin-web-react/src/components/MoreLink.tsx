import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** Картын баруун дээд «Бүгдийг харах →» холбоос. */
export default function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-brand hover:bg-brand-soft">
      {children} <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}
