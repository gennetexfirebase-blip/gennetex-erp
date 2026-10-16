import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, Link2, Paperclip, Send, Upload } from 'lucide-react';
import { Button, Input, Textarea, Loading } from '../components/ui';
import { supabase } from '../lib/supabase';
import brandMark from '../assets/report-logo.png';

/**
 * share.gennetex.com — нэвтрэлтгүй, нийтэд нээлттэй хуваалцах.
 *
 *   /        — текст бичих эсвэл файл байршуулж холбоос авах
 *   /s/<id>  — холбоостой хүн харна / татна
 *
 * Сервер: edge function `share-public` (IP тутам цагт 30, 50MB, 1/7/30 хоног).
 * Энэ хөтөч дээрх өөрийн хуваалцсан холбоосууд localStorage-д (зөвхөн тав тух).
 */

const BUCKET = 'public-shares';
const MAX_MB = 50;
const HISTORY = 'gx_share_history';
type Hist = { id: string; label: string; at: string; expires: string };

const fmtSize = (n: number | null | undefined) => (!n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const fmtDate = (s: string) => new Date(s).toLocaleString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const linkOf = (id: string) => `${window.location.origin}/s/${id}`;
const history = {
  read: (): Hist[] => {
    try {
      return (JSON.parse(localStorage.getItem(HISTORY) || '[]') as Hist[]).filter((h) => new Date(h.expires) > new Date());
    } catch {
      return [];
    }
  },
  add: (h: Hist) => {
    try {
      localStorage.setItem(HISTORY, JSON.stringify([h, ...history.read()].slice(0, 30)));
    } catch {
      /* хувийн цонх */
    }
  },
};

async function call<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('share-public', { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as any).context?.json?.();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-3">
            <img src={brandMark} alt="" width="32" height="32" className="h-8 w-8 rounded object-contain" />
            <span>
              <span className="block text-[16px] font-semibold text-ink">Gennetex Share</span>
              <span className="block text-[12px] text-muted">Текст, файлаа холбоосоор хуваалцана</span>
            </span>
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function ShareSite() {
  const id = window.location.pathname.match(/^\/(?:sharing\/)?s\/([a-z0-9]+)/)?.[1];
  return <Shell>{id ? <View id={id} /> : <Compose />}</Shell>;
}

function CopyLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-[13px]" />
      <Button
        icon={ok ? <Check size={15} /> : <Copy size={15} />}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
      >
        {ok ? 'Хуулсан' : 'Хуулах'}
      </Button>
    </div>
  );
}

function Compose() {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [made, setMade] = useState<{ id: string; expires: string } | null>(null);
  const [hist, setHist] = useState<Hist[]>(() => history.read());
  const input = useRef<HTMLInputElement>(null);

  const send = async () => {
    setErr('');
    if (mode === 'text' && !body.trim()) return setErr('Текстээ бичнэ үү.');
    if (mode === 'file' && !file) return setErr('Файл сонгоно уу.');
    if (file && file.size > MAX_MB * 1024 * 1024) return setErr(`Файл ${MAX_MB}MB-аас том байна.`);
    setBusy(true);
    try {
      let id: string;
      let expires: string;
      if (mode === 'text') {
        const r = await call<{ id: string; expiresAt: string }>({ action: 'create', kind: 'text', title, body, days });
        id = r.id;
        expires = r.expiresAt;
      } else {
        const r = await call<{ id: string; path: string; token: string; expiresAt: string }>({ action: 'create', kind: 'file', title, body, days, file_name: file!.name, file_size: file!.size, mime: file!.type });
        const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(r.path, r.token, file!, { contentType: file!.type || 'application/octet-stream' });
        if (up.error) throw up.error;
        await call({ action: 'done', id: r.id });
        id = r.id;
        expires = r.expiresAt;
      }
      const h = { id, label: title.trim() || (mode === 'text' ? body.trim().slice(0, 60) : file!.name), at: new Date().toISOString(), expires };
      history.add(h);
      setHist(history.read());
      setMade({ id, expires });
      setTitle('');
      setBody('');
      setFile(null);
      if (input.current) input.current.value = '';
    } catch (e) {
      setErr((e as Error).message || 'Хуваалцаж чадсангүй.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {made ? (
        <section className="surface mb-5 border-success p-4">
          <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-success"><Link2 size={16} /> Холбоос бэлэн боллоо</p>
          <CopyLink url={linkOf(made.id)} />
          <p className="mt-2 text-[12px] text-muted">Энэ холбоосыг хүнд илгээнэ. {fmtDate(made.expires)} хүртэл хүчинтэй.</p>
        </section>
      ) : null}

      <section className="surface p-4">
        <div className="mb-3 inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
          {([['text', 'Текст', FileText], ['file', 'Файл', Paperclip]] as const).map(([k, l, I]) => (
            <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold ${mode === k ? 'bg-brand text-white' : 'text-muted'}`}><I size={14} />{l}</button>
          ))}
        </div>
        <div className="space-y-3">
          <Input placeholder="Гарчиг (заавал биш)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          {mode === 'file' ? (
            <div
              className="rounded-[var(--radius-sm)] border-2 border-dashed border-line bg-card2 p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={22} className="mx-auto text-subtle" />
              {file ? (
                <p className="mt-2 text-[14px] text-ink"><b>{file.name}</b> <span className="text-muted">· {fmtSize(file.size)}</span></p>
              ) : (
                <p className="mt-2 text-[13px] text-muted">Файлаа энд чирж оруулах эсвэл</p>
              )}
              <Button variant="outline" className="mt-2" onClick={() => input.current?.click()}>{file ? 'Өөр файл' : 'Файл сонгох'}</Button>
              <input ref={input} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <p className="mt-2 text-[11px] text-subtle">{MAX_MB}MB хүртэл</p>
            </div>
          ) : null}
          <Textarea rows={mode === 'text' ? 8 : 2} placeholder={mode === 'text' ? 'Хуваалцах текстээ бичнэ үү…' : 'Тайлбар (заавал биш)'} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Хугацаа:</span>
            {[1, 7, 30].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1 text-[13px] ${days === d ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'}`}>{d} хоног</button>
            ))}
          </div>
          {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
          <Button className="w-full" icon={<Send size={15} />} disabled={busy} onClick={send}>{busy ? (mode === 'file' ? 'Байршуулж байна…' : 'Илгээж байна…') : 'Холбоос авах'}</Button>
          <p className="text-[11px] text-subtle">Холбоостой хэн ч харж чадна. Нууц мэдээлэл бүү хуваалцаарай.</p>
        </div>
      </section>

      {hist.length ? (
        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">Энэ төхөөрөмжөөс хуваалцсан</h2>
          <ul className="surface divide-y divide-line">
            {hist.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                <a href={`/s/${h.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{h.label}</span>
                  <span className="block text-[11px] text-muted">{fmtDate(h.at)} · {fmtDate(h.expires)} хүртэл</span>
                </a>
                <Button variant="ghost" className="!min-h-8 !px-2" aria-label="Холбоос хуулах" onClick={() => navigator.clipboard.writeText(linkOf(h.id))}><Copy size={14} /></Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

type Shared = {
  id: string; kind: 'text' | 'file'; title: string | null; body: string | null; file_name: string | null; file_size: number | null; mime: string | null;
  created_at: string; expires_at: string; views: number; url: string | null; download: string | null;
};

function View({ id }: { id: string }) {
  const [s, setS] = useState<Shared | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    call<Shared>({ action: 'get', id }).then(setS).catch((e) => setErr(e.message));
  }, [id]);
  if (err) {
    return (
      <section className="surface p-6 text-center">
        <p className="text-[15px] font-semibold text-ink">{err}</p>
        <a href="/" className="mt-3 inline-block text-[13px] text-brand underline">Шинээр хуваалцах</a>
      </section>
    );
  }
  if (!s) return <Loading />;
  const mime = s.mime || '';
  return (
    <section className="surface p-5">
      {s.title ? <h1 className="mb-1 text-[20px] font-semibold text-ink">{s.title}</h1> : null}
      <p className="mb-4 text-[12px] text-muted">{fmtDate(s.created_at)} · {fmtDate(s.expires_at)} хүртэл · {s.views} удаа үзсэн</p>
      {s.kind === 'text' ? (
        <div className="relative">
          <pre className="whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-card2 p-4 pr-12 font-sans text-[14px] leading-6 text-ink">{s.body}</pre>
          <button
            type="button"
            className="absolute right-2 top-2 rounded p-2 text-muted hover:bg-hover hover:text-ink"
            aria-label="Текст хуулах"
            onClick={async () => {
              await navigator.clipboard.writeText(s.body || '');
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          </button>
        </div>
      ) : (
        <>
          {s.body ? <p className="mb-3 whitespace-pre-wrap text-[14px] text-ink">{s.body}</p> : null}
          {mime.startsWith('image/') && s.url ? <img src={s.url} alt={s.file_name || ''} className="mb-3 max-h-[70vh] w-auto rounded-[var(--radius-sm)] border border-line object-contain" /> : null}
          {mime.startsWith('video/') && s.url ? <video src={s.url} controls className="mb-3 max-h-[70vh] w-full rounded-[var(--radius-sm)] bg-black" /> : null}
          {mime === 'application/pdf' && s.url ? <iframe title={s.file_name || 'PDF'} src={s.url} className="mb-3 h-[70vh] w-full rounded-[var(--radius-sm)] border border-line" /> : null}
          <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-card2 p-3">
            <Paperclip size={18} className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-ink">{s.file_name}</span>
              <span className="block text-[12px] text-muted">{fmtSize(s.file_size)}</span>
            </span>
            {s.download ? <a href={s.download} className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] bg-brand px-4 text-[13px] font-semibold text-white"><Download size={15} /> Татах</a> : null}
          </div>
        </>
      )}
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-[12px] text-muted">Энэ хуудасны холбоос</p>
        <CopyLink url={linkOf(s.id)} />
      </div>
    </section>
  );
}
