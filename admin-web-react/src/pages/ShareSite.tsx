import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, LogOut, Paperclip, Search, Send, Trash2, Upload, Users } from 'lucide-react';
import { Button, Input, Textarea, Loading, EmptyState, Avatar } from '../components/ui';
import LoginPage from './Login';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import brandMark from '../assets/report-logo.png';

/**
 * share.gennetex.com — ажилтнууд текст бичих эсвэл файл байршуулж хуваалцана.
 * Бүх нэвтэрсэн ажилтанд нээлттэй. «Бүгд» эсвэл сонгосон хүмүүст; хүлээн
 * авагчид апп-аар мэдэгдэл очно. Файл private bucket `shares` (50MB хүртэл).
 */

type Me = { id: string; name: string; email: string };
type Person = { id: string; name: string | null; last_name: string | null; email: string | null; avatar_url: string | null; department_id: string | null };
type Share = {
  id: string; owner_id: string; owner_name: string | null; kind: 'text' | 'file'; title: string | null; body: string | null;
  file_path: string | null; file_name: string | null; file_size: number | null; mime: string | null;
  audience: 'all' | 'users'; recipients: string[]; created_at: string;
};

const MAX_MB = 50;
const personName = (p: Pick<Person, 'name' | 'last_name' | 'email'>) => [p.last_name, p.name].filter(Boolean).join(' ') || p.email || 'Ажилтан';
const fmtSize = (n: number | null) => (!n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const fmtTime = (s: string) => new Date(s).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ShareSite() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    if (!isSupabaseConfigured) return setMe(null);
    const read = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return setMe(null);
      const { data: p } = await supabase.from('profiles').select('name, last_name, email').eq('id', data.user.id).maybeSingle();
      setMe({ id: data.user.id, name: personName({ name: p?.name ?? null, last_name: p?.last_name ?? null, email: p?.email ?? data.user.email ?? null }), email: data.user.email || '' });
    };
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => sub?.subscription?.unsubscribe();
  }, []);
  if (me === undefined) return <div className="flex min-h-screen items-center justify-center bg-app"><Loading /></div>;
  if (me === null) return <LoginPage />;
  return <Share me={me} />;
}

function Share({ me }: { me: Me }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Share[] | null>(null);
  const [tab, setTab] = useState<'inbox' | 'mine'>('inbox');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('shares').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) setErr(error.message);
    else setItems((data || []) as Share[]);
  }, []);
  useEffect(() => {
    load();
    supabase.from('profiles').select('id, name, last_name, email, avatar_url, department_id').neq('role', 'superadmin').order('name').then(({ data }) => setPeople((data || []) as Person[]));
    const ch = supabase.channel(`shares-${me.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'shares' }, () => load()).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, me.id]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const needle = q.trim().toLowerCase();
  const list = (items || []).filter((s) => (tab === 'mine' ? s.owner_id === me.id : s.owner_id !== me.id)).filter((s) => !needle || `${s.title} ${s.body} ${s.file_name} ${s.owner_name}`.toLowerCase().includes(needle));

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src={brandMark} alt="" width="32" height="32" className="h-8 w-8 rounded object-contain" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-semibold text-ink">Хуваалцах</h1>
            <p className="truncate text-[12px] text-muted">{me.name}</p>
          </div>
          <Button variant="ghost" icon={<LogOut size={15} />} onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>Гарах</Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[380px_1fr]">
        <Compose me={me} people={people} onSent={load} />
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
              {([['inbox', 'Надад ирсэн'], ['mine', 'Миний илгээсэн']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${tab === k ? 'bg-brand text-white' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-56">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
              <Input placeholder="Хайх" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
          </div>
          {err ? <p className="mb-2 text-[13px] text-danger" role="alert">{err}</p> : null}
          {!items ? <Loading /> : !list.length ? <EmptyState text={tab === 'mine' ? 'Та одоогоор юу ч хуваалцаагүй байна.' : 'Танд хуваалцсан зүйл алга.'} /> : (
            <ul className="space-y-3">
              {list.map((s) => <Item key={s.id} s={s} me={me} byId={byId} onDeleted={load} />)}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Compose({ me, people, onSent }: { me: Me; people: Person[]; onSent: () => void }) {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [audience, setAudience] = useState<'all' | 'users'>('all');
  const [to, setTo] = useState<Set<string>>(new Set());
  const [pq, setPq] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const others = people.filter((p) => p.id !== me.id);
  const matches = others.filter((p) => personName(p).toLowerCase().includes(pq.trim().toLowerCase())).slice(0, 50);

  const notify = async (title: string, ids: string[] | 'all') => {
    const recipients = ids === 'all' ? others.map((p) => p.id) : ids;
    for (let i = 0; i < recipients.length; i += 100) {
      await supabase.functions.invoke('send-push', {
        body: { audience: { kind: 'users', userIds: recipients.slice(i, i + 100) }, notification: { type: 'share', title: `${me.name} хуваалцлаа`, body: title.slice(0, 200), data: { type: 'share', url: 'https://share.gennetex.com' } } },
      }).catch(() => null);
    }
  };

  const send = async () => {
    setMsg(null);
    if (audience === 'users' && !to.size) return setMsg({ ok: false, text: 'Хүлээн авах хүнээ сонгоно уу.' });
    if (mode === 'text' && !body.trim()) return setMsg({ ok: false, text: 'Текстээ бичнэ үү.' });
    if (mode === 'file' && !files.length) return setMsg({ ok: false, text: 'Файл сонгоно уу.' });
    const big = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (mode === 'file' && big) return setMsg({ ok: false, text: `${big.name} нь ${MAX_MB}MB-аас том байна.` });
    setBusy(true);
    try {
      const base = { owner_id: me.id, owner_name: me.name, audience, recipients: audience === 'users' ? [...to] : [], title: title.trim() || null };
      if (mode === 'text') {
        const { error } = await supabase.from('shares').insert({ ...base, kind: 'text', body: body.trim() });
        if (error) throw error;
      } else {
        for (const f of files) {
          const safe = f.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-120) || 'file';
          const path = `${me.id}/${crypto.randomUUID()}-${safe}`;
          const up = await supabase.storage.from('shares').upload(path, f, { contentType: f.type || 'application/octet-stream' });
          if (up.error) throw up.error;
          const { error } = await supabase.from('shares').insert({ ...base, kind: 'file', body: body.trim() || null, file_path: path, file_name: f.name, file_size: f.size, mime: f.type || null });
          if (error) throw error;
        }
      }
      await notify(title.trim() || (mode === 'text' ? body.trim() : files.map((f) => f.name).join(', ')), audience === 'all' ? 'all' : [...to]);
      setTitle('');
      setBody('');
      setFiles([]);
      setTo(new Set());
      if (fileInput.current) fileInput.current.value = '';
      setMsg({ ok: true, text: 'Хуваалцлаа.' });
      onSent();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'Илгээж чадсангүй.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface h-fit p-4 lg:sticky lg:top-20">
      <div className="mb-3 inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
        {([['text', 'Текст', FileText], ['file', 'Файл', Paperclip]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${mode === k ? 'bg-brand text-white' : 'text-muted'}`}><I size={14} />{l}</button>
        ))}
      </div>
      <div className="space-y-3">
        <Input placeholder="Гарчиг (заавал биш)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        {mode === 'file' ? (
          <div
            className="rounded-[var(--radius-sm)] border-2 border-dashed border-line bg-card2 p-4 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
            }}
          >
            <Upload size={20} className="mx-auto text-subtle" />
            <p className="mt-1 text-[13px] text-muted">Файлаа энд чирж оруулах эсвэл</p>
            <Button variant="outline" className="mt-2" onClick={() => fileInput.current?.click()}>Файл сонгох</Button>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files || [])])} />
            <p className="mt-2 text-[11px] text-subtle">Нэг файл {MAX_MB}MB хүртэл</p>
            {files.length ? (
              <ul className="mt-3 space-y-1 text-left text-[12px]">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded bg-card px-2 py-1">
                    <Paperclip size={12} className="shrink-0 text-subtle" />
                    <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                    <span className="text-muted">{fmtSize(f.size)}</span>
                    <button type="button" className="text-muted hover:text-danger" aria-label="Хасах" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>×</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Textarea rows={mode === 'text' ? 6 : 2} placeholder={mode === 'text' ? 'Хуваалцах текстээ бичнэ үү…' : 'Тайлбар (заавал биш)'} value={body} onChange={(e) => setBody(e.target.value)} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Хэнд</legend>
          <div className="flex gap-2">
            {([['all', 'Бүх ажилтанд'], ['users', 'Сонгосон хүмүүст']] as const).map(([k, l]) => (
              <label key={k} className={`flex-1 cursor-pointer rounded-[var(--radius-sm)] border px-3 py-2 text-center text-[13px] ${audience === k ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'}`}>
                <input type="radio" name="aud" className="sr-only" checked={audience === k} onChange={() => setAudience(k)} />
                {l}
              </label>
            ))}
          </div>
          {audience === 'users' ? (
            <div className="mt-2 rounded-[var(--radius-sm)] border border-line">
              <Input placeholder="Нэрээр хайх" value={pq} onChange={(e) => setPq(e.target.value)} className="rounded-b-none border-0 border-b" />
              <ul className="max-h-48 overflow-y-auto">
                {matches.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-hover">
                      <input type="checkbox" checked={to.has(p.id)} onChange={(e) => setTo((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} />
                      <Avatar name={personName(p)} src={p.avatar_url} size={22} />
                      <span className="truncate text-ink">{personName(p)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {to.size ? <p className="border-t border-line px-3 py-1.5 text-[12px] text-muted">{to.size} хүн сонгосон</p> : null}
            </div>
          ) : null}
        </fieldset>
        {msg ? <p className={`text-[13px] ${msg.ok ? 'text-success' : 'text-danger'}`} role="status">{msg.text}</p> : null}
        <Button className="w-full" icon={<Send size={15} />} disabled={busy} onClick={send}>{busy ? 'Илгээж байна…' : 'Хуваалцах'}</Button>
      </div>
    </section>
  );
}

function Item({ s, me, byId, onDeleted }: { s: Share; me: Me; byId: Map<string, Person>; onDeleted: () => void }) {
  const [copied, setCopied] = useState(false);
  const owner = byId.get(s.owner_id);
  const copy = async () => {
    await navigator.clipboard.writeText(s.body || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = async () => {
    const { data, error } = await supabase.storage.from('shares').createSignedUrl(s.file_path!, 300, { download: s.file_name || true });
    if (error) return window.alert(error.message);
    window.location.href = data.signedUrl;
  };
  const preview = async () => {
    const { data } = await supabase.storage.from('shares').createSignedUrl(s.file_path!, 300);
    if (data) window.open(data.signedUrl, '_blank', 'noopener');
  };
  const remove = async () => {
    if (!window.confirm('Устгах уу?')) return;
    if (s.file_path) await supabase.storage.from('shares').remove([s.file_path]);
    const { error } = await supabase.from('shares').delete().eq('id', s.id);
    if (error) window.alert(error.message);
    else onDeleted();
  };
  const toNames = s.audience === 'all' ? 'Бүх ажилтан' : s.recipients.map((id) => (byId.get(id) ? personName(byId.get(id)!) : 'Ажилтан')).join(', ');
  const isImage = (s.mime || '').startsWith('image/');

  return (
    <li className="surface p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <Avatar name={s.owner_name || ''} src={owner?.avatar_url} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{s.owner_id === me.id ? 'Та' : s.owner_name || 'Ажилтан'}</p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted"><Users size={11} /> {toNames} · {fmtTime(s.created_at)}</p>
        </div>
        {s.owner_id === me.id ? <Button variant="ghost" className="!min-h-8 !px-2 hover:!text-danger" aria-label="Устгах" onClick={remove}><Trash2 size={15} /></Button> : null}
      </div>
      {s.title ? <p className="mb-1 text-[15px] font-semibold text-ink">{s.title}</p> : null}
      {s.kind === 'file' ? (
        <>
          {s.body ? <p className="mb-2 whitespace-pre-wrap text-[14px] text-ink">{s.body}</p> : null}
          <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-card2 p-3">
            <Paperclip size={18} className="shrink-0 text-brand" />
            <button type="button" onClick={preview} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-ink underline-offset-2 hover:underline">{s.file_name}</span>
              <span className="block text-[12px] text-muted">{fmtSize(s.file_size)}{isImage ? ' · зураг' : ''}</span>
            </button>
            <Button variant="outline" icon={<Download size={14} />} onClick={download}>Татах</Button>
          </div>
        </>
      ) : (
        <div className="relative">
          <p className="whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-card2 p-3 pr-10 text-[14px] leading-6 text-ink">{s.body}</p>
          <button type="button" onClick={copy} className="absolute right-2 top-2 rounded p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Хуулах" title="Хуулах">
            {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
          </button>
        </div>
      )}
    </li>
  );
}
