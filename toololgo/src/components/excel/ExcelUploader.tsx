import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, FlaskConical, Lock, Upload } from 'lucide-react';

interface Props {
  onFiles: (files: FileList | File[]) => void;
  onTestData: () => void;
}

export function ExcelUploader({ onFiles, onTestData }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[560px]">
        <div className="mb-6 text-center">
          <h1 className="text-[26px] font-normal" style={{ color: 'var(--text)' }}>
            Excel Comparison
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Excel файлаа оруулаад <b>SERIAL</b> болон <b>DEVC_NO</b>-г автоматаар харьцуулна.
            <br />
            Мөрийн байрлалаас үл хамааран бүх баганыг бүтнээр нь хайна.
          </p>
        </div>

        <div
          className="rounded-lg border-2 border-dashed transition-colors"
          style={{
            borderColor: dragging ? 'var(--accent)' : 'var(--grid-line-strong)',
            background: dragging ? 'var(--accent-soft)' : 'var(--bg-chrome)',
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            depth.current++;
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            depth.current--;
            if (depth.current <= 0) setDragging(false);
          }}
          onDrop={onDrop}
        >
          <button
            className="flex w-full flex-col items-center gap-3 px-6 py-12"
            onClick={() => inputRef.current?.click()}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-chip)', color: 'var(--accent)' }}
            >
              <Upload size={24} />
            </div>
            <div className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
              Excel файлаа энд чирж тавина уу
            </div>
            <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              эсвэл дарж сонгоно уу
            </div>
            <div
              className="mt-1 flex items-center gap-2 text-[12px]"
              style={{ color: 'var(--text-faint)' }}
            >
              <FileSpreadsheet size={13} /> .xlsx · .xls · .csv &nbsp;•&nbsp; 100,000+ мөр дэмжинэ
            </div>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button className="ec-btn ec-btn-primary" onClick={() => inputRef.current?.click()}>
            <Upload size={14} /> Excel файл оруулах
          </button>
          <button
            className="ec-btn ec-btn-outline"
            onClick={onTestData}
            title="100,000 мөр туршилтын өгөгдөл үүсгэж гүйцэтгэлийг шалгана"
          >
            <FlaskConical size={14} /> Туршилтын өгөгдөл (100,000 мөр)
          </button>
        </div>

        <div
          className="mt-6 flex items-center justify-center gap-1.5 text-[11px]"
          style={{ color: 'var(--text-faint)' }}
        >
          <Lock size={11} />
          Таны Excel файл браузер дотор боловсруулагдана. Хаана ч илгээгдэхгүй.
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
