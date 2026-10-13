import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { Button, Loading } from './ui';
import { contractPdfBlob, contractFilename, type ContractImages } from '../lib/contractPdf';
import type { Contract } from '../lib/contracts';

/**
 * Гэрээг жинхэнэ PDF хэлбэрээр харуулна (pdfmake → blob → iframe).
 * Утасны хөтөч iframe дотор PDF-ийг бүрэн харуулдаггүй тул «Томоор нээх»
 * товч мөн бий.
 */
export default function ContractPdfView({ contract, images, height = 760 }: { contract: Contract; images?: ContractImages; height?: number }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setUrl('');
    setError('');
    contractPdfBlob(contract, images || {})
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => alive && setError(e?.message || 'PDF үүсгэж чадсангүй.'));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contract, images]);

  if (error) return <p className="text-[13px] text-danger">{error}</p>;
  if (!url) return <Loading text="Гэрээг бэлтгэж байна…" />;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noreferrer">
          <Button variant="outline" icon={<ExternalLink size={15} />}>Томоор нээх</Button>
        </a>
        <a href={url} download={contractFilename(contract)}>
          <Button variant="outline" icon={<Download size={15} />}>PDF татах</Button>
        </a>
      </div>
      <iframe title="Гэрээ" src={`${url}#view=FitH`} className="w-full rounded-[var(--radius)] border border-line bg-white" style={{ height }} />
    </div>
  );
}
