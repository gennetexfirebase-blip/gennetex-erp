import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileDown, PenLine, Printer } from 'lucide-react';
import { Button, ErrorState, Loading } from '../components/ui';
import SiteShell from '../components/SiteShell';
import HaabSheet from '../components/HaabSheet';
import { downloadPdf, fetchShared, type HaabSheet as Sheet } from '../lib/haab';

/** haab.gennetex.com/haab/s/:token — нэвтрэлтгүй, зөвхөн харах/хэвлэх/PDF. */
export default function HaabPublicPage() {
  const { token = '' } = useParams();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'ХААБ гарын үсэг — Gennetex';
    let live = true;
    fetchShared(token)
      .then((s) => live && setSheet(s))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [token]);

  const pdf = async () => {
    if (!sheet) return;
    setBusy(true);
    try {
      await downloadPdf(sheet);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteShell
      title="ХААБ гарын үсэг"
      subtitle={sheet ? `${sheet.date} · ${sheet.instruction.title} · ${sheet.acks.length} ажилтан гарын үсэг зурсан` : 'Хөдөлмөрийн аюулгүй байдлын зааврын танилцуулга'}
      icon={<PenLine size={22} />}
      width="max-w-[1400px]"
      actions={
        sheet ? (
          <>
            <Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>Хэвлэх</Button>
            <Button icon={<FileDown size={15} />} disabled={busy} onClick={pdf}>{busy ? 'PDF…' : 'PDF'}</Button>
          </>
        ) : null
      }
    >
      {error ? <ErrorState text={error} /> : !sheet ? <Loading /> : <HaabSheet sheet={sheet} />}
    </SiteShell>
  );
}
