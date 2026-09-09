import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
  fileName: string | null;
  sheetName: string | null;
  compact?: boolean;
}

export function ExcelUploader({ onFile, loading, fileName, sheetName, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-medium text-slate-800">{fileName}</div>
          <div className="truncate text-xs text-slate-500">Sheet: {sheetName}</div>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Шинэ файл
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        {loading ? <Loader2 size={26} className="animate-spin" /> : <FileSpreadsheet size={26} />}
      </div>
      <h2 className="text-lg font-semibold text-slate-800">
        {loading ? 'Excel файл уншиж байна...' : 'Excel файлаа энд чирж оруулна уу'}
      </h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        <span className="font-medium">RESULT</span> нэртэй хуудсыг автоматаар сонгоно. Байхгүй бол
        эхний хуудсыг уншина. (.xlsx, .xls)
      </p>
      <button
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        <Upload size={16} /> Файл сонгох
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
