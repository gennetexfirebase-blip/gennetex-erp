import { ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/ui';
import TimeReport from './TimeReport';
import { TIME_REPORT_URL } from '../lib/timeReport';

/** Админ самбар доторх Цагийн тайлан — tailan.gennetex.com-той ижил. */
export default function TimeReportAdminPage() {
  return (
    <>
      <PageHeader
        title="Цагийн тайлан"
        crumb="Тайлан / Цагийн тайлан"
        actions={
          <a href={TIME_REPORT_URL} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-[13px] text-muted hover:text-ink">
            <ExternalLink size={14} /> {TIME_REPORT_URL.replace('https://', '')}
          </a>
        }
      />
      <TimeReport variant="embedded" />
    </>
  );
}
