import { useEffect, useMemo, useRef, useState } from 'react';
import { createEphemeralClient, supabase } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';
import { downloadSheets } from '../lib/attendanceExport';
import './owner.css';

/**
 * adiyasuren.gennetex.com — хувийн хаяг, хаана ч холбоосгүй.
 *
 *   /               → Vaporwave «Энэ хуудас байхгүй»
 *   /games          → 100 жижиг төсөл (монгол), Terminal CLI
 *   /system/admin/  → verify.mn орлого, Terminal CLI — зөвхөн adiyasuren1003@gmail.com
 *                     (сервер `owner_verify_income` ч шалгана; бусдад 404)
 */

export const OWNER_HOST = 'adiyasuren.gennetex.com';
export const OWNER_PATH = '/system/admin';
const OWNER_EMAIL = 'adiyasuren1003@gmail.com';
const SESSION_MS = 60 * 60 * 1000; // 1 цагийн дараа автоматаар гарна
// /system/admin — сесс хадгалдаггүй клиент: refresh эсвэл дахин ороход заавал нэвтэрнэ.
const owner = window.location.hostname === OWNER_HOST && window.location.pathname.startsWith(OWNER_PATH) ? createEphemeralClient() : supabase;
const FONTS = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap';

function useHead() {
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = FONTS;
    document.head.append(robots, font);
    return () => {
      robots.remove();
      font.remove();
    };
  }, []);
}

export default function OwnerSite() {
  useHead();
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === OWNER_PATH) return <OwnerAdmin />;
  if (path === '/games') return <Games />;
  return <Vapor404 />;
}

/* ═══════════════════ / — Vaporwave 404 ═══════════════════ */
function Vapor404({ intruder }: { intruder?: string }) {
  const root = useRef<HTMLElement>(null);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const on = () => setLocked(document.pointerLockElement === root.current);
    document.addEventListener('pointerlockchange', on);
    return () => document.removeEventListener('pointerlockchange', on);
  }, []);
  useEffect(() => {
    document.title = 'Энэ хуудас байхгүй';
  }, []);
  // Хошигнол: курсор алга, товшвол хулганыг таб дотор түгжинэ (Esc-ээр гарна — хөтчийн дүрэм).
  const lock = () => root.current?.requestPointerLock?.();
  return (
    <main
      ref={root}
      className="vapor"
      style={{ cursor: 'none', userSelect: 'none' }}
      onClick={lock}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="v-sun" aria-hidden="true" />
      <div className="v-grid" aria-hidden="true" />
      <div className="v-content">
        <div className="v-win">
          <div className="v-win-bar">
            <span className="v-dot" style={{ background: '#FF00FF' }} />
            <span className="v-dot" style={{ background: '#00FFFF' }} />
            <span className="v-dot" style={{ background: '#FF9900' }} />
            <span style={{ marginLeft: 8 }}>&gt; error.exe</span>
          </div>
          <div className="v-win-body">
            <p className="v-code" aria-hidden="true">404</p>
            <h1 className="v-title">Энэ хуудас байхгүй</h1>
            <p className="v-sub">brony jems</p>
            {intruder ? (
              <>
                <p className="v-p" style={{ color: '#FF00FF' }}>&gt; ACCESS DENIED: {intruder}</p>
                <p className="v-p">&gt; {locked ? 'хулгана түгжигдлээ 🔒 — Esc дараад табаа хаа_' : 'нэвтрэх оролдлого бүртгэгдлээ. Хаана ч дарж болно_'}</p>
              </>
            ) : (
              <p className="v-p">&gt; Хаяг буруу эсвэл хуудас устсан байна_</p>
            )}
            <span className="v-btn" role="presentation"><span>Нүүр хуудас</span></span>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════ Matrix бороо (canvas) ═══════════════════ */
function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789АБВГДЕЖЗИЙКЛМНӨҮХЦЧШЭЮЯ$#@%&*+=<>';
    const size = 16;
    let cols = 0;
    let drops: number[] = [];
    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      cols = Math.ceil(c.width / size);
      drops = Array.from({ length: cols }, () => Math.floor((Math.random() * c.height) / size));
    };
    resize();
    window.addEventListener('resize', resize);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const draw = () => {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `${size}px 'JetBrains Mono', monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const y = drops[i] * size;
        ctx.fillStyle = Math.random() > 0.975 ? '#d8ffcc' : '#33ff00';
        ctx.fillText(ch, i * size, y);
        if (y > c.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    const id = reduce ? 0 : window.setInterval(draw, 50);
    if (reduce) draw();
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', opacity: 0.35, pointerEvents: 'none' }} />;
}

/* ═══════════════════ Terminal CLI бүрхүүл ═══════════════════ */
function Typed({ text }: { text: string }) {
  return (
    <span className="t-typed" style={{ animationTimingFunction: `steps(${text.length}, end)` }}>
      {text}
    </span>
  );
}
const SEP = '='.repeat(160);

/* ═══════════════════ /games ═══════════════════ */
type Game = { n: number; slug: string; en: string; mn: string; game: boolean; entry: string; pages: string[] };
const pagePath = (g: Game, page: string) => `/games/${g.slug}/${page.split('/').map(encodeURIComponent).join('/')}`;

function Games() {
  const [list, setList] = useState<Game[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [onlyGames, setOnlyGames] = useState(false);
  const [open, setOpen] = useState<{ g: Game; page: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'games — adiyasuren';
    fetch('/games/index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Game[]) => {
        setList(d);
        const p = new URLSearchParams(window.location.search).get('p');
        const g = p && d.find((x) => x.slug === p);
        if (g) setOpen({ g, page: g.entry });
      })
      .catch((e) => setErr(String(e.message || e)));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) close();
      if (e.key === '/' && !open && document.activeElement !== input.current) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const show = (g: Game) => {
    setOpen({ g, page: g.entry });
    window.history.pushState(null, '', `/games?p=${g.slug}`);
    window.scrollTo(0, 0);
  };
  const close = () => {
    setOpen(null);
    window.history.pushState(null, '', '/games');
  };
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search).get('p');
      const g = p && list?.find((x) => x.slug === p);
      setOpen(g ? { g, page: g.entry } : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [list]);

  const needle = q.trim().toLowerCase();
  const shown = (list || []).filter((g) => (!onlyGames || g.game) && (!needle || `${g.n} ${g.mn} ${g.en}`.toLowerCase().includes(needle)));
  const pct = list ? Math.round((shown.length / list.length) * 20) : 0;

  return (
    <main className="term">
      <div className="t-wrap">
        <pre className="t-dim" aria-hidden="true" style={{ fontSize: 11, lineHeight: 1.15, margin: '0 0 12px', overflow: 'hidden' }}>{` ██████╗  █████╗ ███╗   ███╗███████╗███████╗
██╔════╝ ██╔══██╗████╗ ████║██╔════╝██╔════╝
██║  ███╗███████║██╔████╔██║█████╗  ███████╗
██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ╚════██║
╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗███████║
 ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝`}</pre>
        <h1 style={{ fontSize: 18, margin: 0 }}>
          <Typed text="> 100 ТӨСӨЛ // HTML · CSS · JAVASCRIPT" />
          <span className="t-cursor" aria-hidden="true" />
        </h1>
        <p className="t-dim" style={{ margin: '4px 0 0' }}>
          [OK] {list ? list.length : '…'} төсөл ачааллаа · бүгд монгол хэлээр · <kbd>/</kbd> хайх · <kbd>ESC</kbd> буцах
        </p>
        <div className="t-sep" aria-hidden="true">{SEP}</div>

        {err ? <p className="t-err">[ERR] жагсаалт ачаалж чадсангүй: {err}</p> : null}

        {open ? (
          <section className="t-pane" aria-label={open.g.mn}>
            <div className="t-bar">
              <span>+--- #{String(open.g.n).padStart(3, '0')} {open.g.mn} ---+</span>
              <span className="t-right">{open.g.en}</span>
            </div>
            <div className="t-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button className="t-btn" onClick={close}>[ ESC ] Буцах</button>
              {open.g.pages.length > 1
                ? open.g.pages.map((p) => (
                    <button key={p} className="t-btn" aria-pressed={open.page === p} onClick={() => setOpen({ g: open.g, page: p })}>
                      {p.replace(/\/?index\.html$/, '') || 'үндсэн'}
                    </button>
                  ))
                : null}
              <a className="t-btn" href={pagePath(open.g, open.page)} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>[ ↗ ] Шинэ цонх</a>
            </div>
            <iframe key={open.page} title={open.g.mn} className="t-frame" src={pagePath(open.g, open.page)} />
          </section>
        ) : (
          <section className="t-pane">
            <div className="t-bar">
              <span>+--- ЖАГСААЛТ ---+</span>
              <span className="t-right">
                [{'|'.repeat(pct)}{'.'.repeat(20 - pct)}] {shown.length}/{list?.length || 0}
              </span>
            </div>
            <div className="t-body">
              <label className="t-prompt">
                <span className="t-amber">adiyasuren@games:~$</span>
                <span className="t-dim">grep</span>
                <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="хайх үг…" aria-label="Төсөл хайх" />
              </label>
              <div style={{ display: 'flex', gap: 8, margin: '10px 0 12px', flexWrap: 'wrap' }}>
                <button className="t-btn" aria-pressed={!onlyGames} onClick={() => setOnlyGames(false)}>[ БҮГД ]</button>
                <button className="t-btn" aria-pressed={onlyGames} onClick={() => setOnlyGames(true)}>[ ТОГЛООМ ]</button>
              </div>
              {!list ? (
                <p>Ачаалж байна<span className="t-cursor" aria-hidden="true" /></p>
              ) : !shown.length ? (
                <p className="t-err">[ERR] «{q}» олдсонгүй</p>
              ) : (
                <nav className="t-list" aria-label="Төслүүд">
                  {shown.map((g) => (
                    <a
                      key={g.slug}
                      href={`/games?p=${g.slug}`}
                      className="t-glitch"
                      onClick={(e) => {
                        e.preventDefault();
                        show(g);
                      }}
                    >
                      <span className="t-dim">{String(g.n).padStart(3, '0')}</span>
                      <span>
                        {g.game ? <span className="t-amber">[GAME] </span> : null}
                        {g.mn}
                      </span>
                      <span className="t-dim" style={{ fontSize: 12 }}>{g.en}</span>
                    </a>
                  ))}
                </nav>
              )}
            </div>
          </section>
        )}
        <p className="t-dim" style={{ fontSize: 11, marginTop: 14 }}>
          // эх: HuXn WebDev — «HTML, CSS & JavaScript 100+ Projects» (github.com/HuXn-WebDev). Монгол орчуулга.
        </p>
      </div>
    </main>
  );
}

/* ═══════════════════ /system/admin — орлого ═══════════════════ */
type Row = { phone: string; at: string; source: string | null; name: string | null };
type Income = { per_verify: number; earlier: number; verified: Row[]; pending: number; expired: number };
const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const SOURCE: Record<string, string> = { admin_gate: 'admin', data_gate: 'data' };
/** Аль сайтаас — «admin_gate:hr.gennetex.com» → «hr.gennetex.com»; хуучин бичлэгт хост байхгүй. */
function siteOf(source: string | null) {
  const s = source || '';
  const [kind, host] = s.split(':');
  if (host) return kind === 'admin_reset' ? `${host} (код сэргээх)` : host;
  if (kind === 'data_gate') return 'data.gennetex.com';
  if (kind === 'admin_gate') return 'admin (хост тэмдэглээгүй)';
  return SOURCE[s] || s || 'verify';
}
/** Улаанбаатарын цагаар «2026-10-19 15:42». */
const ubTime = (iso: string) =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

function NotFound() {
  return <Vapor404 />;
}

type Me = { email: string; name: string; since: number };

function OwnerAdmin() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  // Өөрийн байнгын код — сесс бүрт (refresh-д дахин) асууна.
  const [codeOk, setCodeOk] = useState(false);
  useEffect(() => {
    document.title = 'Gennetex';
    // Ердийн (хадгалдаг) клиентийн хуучин сессийг цэвэрлэнэ — энд ашиглахгүй.
    void supabase.auth.signOut({ scope: 'local' }).catch(() => null);
    let live = true;
    const read = async () => {
      const { data } = await owner.auth.getSession();
      const u = data.session?.user;
      if (!live) return;
      if (!u?.email) return setMe(null);
      window.history.replaceState(null, '', window.location.pathname);
      setMe((prev) => ({
        email: u.email!.toLowerCase(),
        name: String(u.user_metadata?.full_name || u.user_metadata?.name || u.email!.split('@')[0]),
        since: prev?.since || Date.now(),
      }));
    };
    void read();
    const { data: sub } = owner.auth.onAuthStateChange(() => void read());
    return () => {
      live = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const logout = () => owner.auth.signOut().finally(() => {
    setCodeOk(false);
    setMe(null);
  });

  // 1 цагийн дараа автоматаар гарна.
  useEffect(() => {
    if (!me) return;
    const t = window.setTimeout(logout, Math.max(0, me.since + SESSION_MS - Date.now()));
    return () => window.clearTimeout(t);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me === undefined) {
    return (
      <main className="term"><div className="t-wrap"><p>&gt; шалгаж байна<span className="t-cursor" aria-hidden="true" /></p></div></main>
    );
  }
  if (me === null) {
    const signIn = async () => {
      const to = `${window.location.origin}${OWNER_PATH}/`;
      rememberAuthReturn(to);
      await owner.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: to, queryParams: { prompt: 'select_account' } } });
    };
    return (
      <main className="term" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <MatrixRain />
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 640 }}>
          <pre className="t-dim" aria-hidden="true" style={{ fontSize: 11, lineHeight: 1.15, margin: 0, overflow: 'hidden' }}>{`┌──────────────────────────────────────────┐
│  ADIYASUREN // SYSTEM ADMIN              │
│  secure shell v1.0                       │
└──────────────────────────────────────────┘`}</pre>
          <section className="t-pane" style={{ marginTop: 16 }}>
            <div className="t-bar"><span>+--- LOGIN ---+</span><span className="t-right">tty1</span></div>
            <div className="t-body">
              <p style={{ margin: '0 0 4px' }}><span className="t-amber">guest@gennetex:~$</span> ssh system/admin</p>
              <p className="t-dim" style={{ margin: '0 0 4px' }}>[..] сесс олдсонгүй</p>
              <p className="t-dim" style={{ margin: '0 0 14px' }}>[..] нэвтрэх аргаа сонгоно уу · сесс 1 цаг</p>
              <button className="t-btn" onClick={signIn} autoFocus>[ login --google ]</button>
              <p style={{ margin: '14px 0 0' }}>
                <span className="t-amber">$</span> <span className="t-cursor" aria-hidden="true" />
              </p>
            </div>
          </section>
          <p className="t-dim" style={{ fontSize: 11, marginTop: 10 }}>// зөвхөн эрх бүхий хэрэглэгч. Бусад бүх оролдлого бүртгэгдэнэ.</p>
        </div>
      </main>
    );
  }
  if (me.email !== OWNER_EMAIL) return <Vapor404 intruder={me.email} />;
  if (!codeOk) return <OwnerCode me={me} onOk={() => setCodeOk(true)} onLogout={logout} />;
  return <Dashboard me={me} onLogout={logout} />;
}

/** Google-ийн дараах өөрийн код (admin-gate `owner_code`) — SMS илгээхгүй. */
function OwnerCode({ me, onOk, onLogout }: { me: Me; onOk: () => void; onLogout: () => void }) {
  const [setup, setSetup] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await owner.functions.invoke('admin-gate', { body: { action: 'owner_code', ...body } });
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
    return data;
  };
  useEffect(() => {
    call({ check: true }).then((r) => setSetup(!!r.setup)).catch((e) => setErr((e as Error).message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setup && pw !== pw2) return setErr('код таарахгүй байна');
    setBusy(true);
    setErr('');
    try {
      await call({ password: pw });
      onOk();
    } catch (x) {
      setErr((x as Error).message);
      setPw('');
    } finally {
      setBusy(false);
    }
  };
  const user = me.email.split('@')[0];
  return (
    <main className="term" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <MatrixRain />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 640 }}>
        <section className="t-pane">
          <div className="t-bar"><span>+--- AUTH ---+</span><span className="t-right">2/2</span></div>
          <form className="t-body" onSubmit={submit}>
            <p style={{ margin: '0 0 4px' }}><span className="t-amber">{user}@gennetex:~$</span> sudo system/admin</p>
            <p className="t-dim" style={{ margin: '0 0 4px' }}>[OK] google: {me.email}</p>
            <p className="t-dim" style={{ margin: '0 0 14px' }}>{setup === null ? '[..] шалгаж байна' : setup ? '[..] өөрийн байнгын код тохируулна уу (6+ тэмдэгт)' : '[..] өөрийн байнгын кодоо оруулна уу'}</p>
            <label className="t-prompt">
              <span className="t-amber">[sudo] code:</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete={setup ? 'new-password' : 'current-password'} aria-label="Өөрийн код" />
            </label>
            {setup ? (
              <label className="t-prompt" style={{ marginTop: 8 }}>
                <span className="t-amber">[sudo] repeat:</span>
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" aria-label="Кодоо давтах" />
              </label>
            ) : null}
            {err ? <p className="t-err" style={{ margin: '10px 0 0' }}>[ERR] {err}</p> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="t-btn" type="submit" disabled={busy || setup === null || pw.length < (setup ? 6 : 1)}>{busy ? '[ .... ]' : '[ ENTER ]'}</button>
              <button className="t-btn" type="button" onClick={onLogout}>[ ГАРАХ ]</button>
            </div>
          </form>
        </section>
        <p className="t-dim" style={{ fontSize: 11, marginTop: 10 }}>// verify.mn SMS илгээхгүй. 5 буруу оролдлогод 30 минут түгжинэ.</p>
      </div>
    </main>
  );
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, until - now);
  const m = Math.floor(left / 60000);
  const s2 = Math.floor((left % 60000) / 1000);
  return <span className={left < 5 * 60000 ? 't-err' : 't-amber'}>{String(m).padStart(2, '0')}:{String(s2).padStart(2, '0')}</span>;
}

function Bar({ value, max, width = 24 }: { value: number; max: number; width?: number }) {
  const n = max ? Math.round((value / max) * width) : 0;
  return <span aria-hidden="true">[{'|'.repeat(n)}{'.'.repeat(width - n)}]</span>;
}

function Dashboard({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [data, setData] = useState<Income | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const load = () => {
    setErr('');
    owner.rpc('owner_verify_income').then(({ data, error }) => (error ? setErr(error.message) : setData(data as Income)));
  };
  useEffect(load, []);

  const months = useMemo(() => {
    const m = new Map<string, number>();
    (data?.verified || []).forEach((r) => {
      const k = r.at?.slice(0, 7) || '—';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  if (err) return <main className="term"><div className="t-wrap"><p className="t-err">[ERR] {err}</p></div></main>;
  if (!data) return <main className="term"><div className="t-wrap"><p>&gt; ачаалж байна<span className="t-cursor" aria-hidden="true" /></p></div></main>;

  const per = data.per_verify;
  const total = data.verified.length + data.earlier;
  const unique = new Set(data.verified.map((r) => r.phone)).size;
  const list = data.verified.filter((r) => !q.trim() || `${r.phone} ${r.name || ''}`.includes(q.trim()));
  const maxMonth = Math.max(1, ...months.map(([, n]) => n));
  const siteMap = new Map<string, { n: number; last: string }>();
  data.verified.forEach((r) => {
    const k = siteOf(r.source);
    const cur = siteMap.get(k) || { n: 0, last: '' };
    siteMap.set(k, { n: cur.n + 1, last: r.at && r.at > cur.last ? r.at : cur.last });
  });
  const sites = [...siteMap.entries()].sort((a, b) => b[1].n - a[1].n);
  const maxSite = Math.max(1, ...sites.map(([, v]) => v.n));
  const exportExcel = () => {
    const rows: (string | number)[][] = [['Огноо, цаг', 'Утас', 'Хэн', 'Сайт', 'Орлого (₮)']];
    data.verified.forEach((r) => rows.push([ubTime(r.at), r.phone, r.name || '', siteOf(r.source), per]));
    void downloadSheets('verify_orlogo.xlsx', [{ name: 'Орлого', rows }]);
  };

  return (
    <main className="term">
      <div className="t-wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <h1 style={{ fontSize: 18, margin: 0, flex: 1 }}>
            <Typed text={`${me.email.split('@')[0]}@gennetex:~$ orlogo --source verify.mn`} />
            <span className="t-cursor" aria-hidden="true" />
          </h1>
          <button className="t-btn" onClick={load}>[ ШИНЭЧЛЭХ ]</button>
          <button className="t-btn" onClick={exportExcel} disabled={!data.verified.length}>[ EXCEL ]</button>
          <button className="t-btn" onClick={onLogout}>[ ГАРАХ ]</button>
        </div>
        <p style={{ margin: '8px 0 0' }}>
          <span className="t-amber">{me.email.split('@')[0]}@gennetex:~$</span> whoami
          <br />
          <span>{me.name}</span> <span className="t-dim">&lt;{me.email}&gt;</span>
          <span className="t-dim"> · сесс дуусах: </span><Countdown until={me.since + SESSION_MS} />
        </p>
        <div className="t-sep" aria-hidden="true">{SEP}</div>

        <section className="t-pane" style={{ marginBottom: 16 }}>
          <div className="t-bar"><span>+--- SYSTEM STATUS ---+</span></div>
          <div className="t-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div><div className="t-dim">НИЙТ ОРЛОГО</div><div className="t-amber" style={{ fontSize: 26, fontWeight: 700 }}>{money(total * per)}</div></div>
            <div><div className="t-dim">АМЖИЛТТАЙ</div><div style={{ fontSize: 26, fontWeight: 700 }}>{total}</div></div>
            <div><div className="t-dim">ЯЛГААТАЙ ДУГААР</div><div style={{ fontSize: 26, fontWeight: 700 }}>{unique}</div></div>
            <div><div className="t-dim">ХҮЛЭЭГДЭЖ / ДУУССАН</div><div style={{ fontSize: 26, fontWeight: 700 }}>{data.pending} / {data.expired}</div></div>
          </div>
          <div className="t-body t-dim" style={{ paddingTop: 0, fontSize: 12 }}>
            // баталгаажсан дугаар бүрт {per}₮ (хэрэглэгч 150₮ төлнө) · орлого verify.mn dashboard-д хуримтлагдана
            {data.earlier ? ` · бүртгэлээс өмнөх ${data.earlier} (дугааргүй) орсон` : ''}
          </div>
        </section>

        {sites.length ? (
          <section className="t-pane" style={{ marginBottom: 16 }}>
            <div className="t-bar"><span>+--- САЙТААР ---+</span><span className="t-right">хаанаас · хэдэн удаа · сүүлд</span></div>
            <div className="t-body">
              {sites.map(([site, v]) => (
                <div key={site} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="t-amber" style={{ minWidth: 220 }}>{site}</span>
                  <Bar value={v.n} max={maxSite} />
                  <span>{v.n} · <span className="t-amber">{money(v.n * per)}</span></span>
                  <span className="t-dim">сүүлд {ubTime(v.last)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {months.length ? (
          <section className="t-pane" style={{ marginBottom: 16 }}>
            <div className="t-bar"><span>+--- САРААР ---+</span></div>
            <div className="t-body">
              {months.map(([m, n]) => (
                <div key={m} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span className="t-dim">{m}</span>
                  <Bar value={n} max={maxMonth} />
                  <span>{n} · <span className="t-amber">{money(n * per)}</span></span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="t-pane">
          <div className="t-bar"><span>+--- АМЖИЛТТАЙ БАТАЛГААЖСАН ДУГААР ---+</span><span className="t-right">{data.verified.length}</span></div>
          <div className="t-body">
            <label className="t-prompt" style={{ marginBottom: 10 }}>
              <span className="t-amber">root@verify:~$</span>
              <span className="t-dim">grep</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="дугаар, нэр…" aria-label="Хайх" />
            </label>
            {!list.length ? (
              <p className="t-dim">[--] бүртгэл алга</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>Огноо, цаг</th><th>Утас</th><th>Хэн</th><th>Сайт</th><th style={{ textAlign: 'right' }}>₮</th></tr></thead>
                  <tbody>
                    {list.map((r, i) => (
                      <tr key={i}>
                        <td className="t-dim">{ubTime(r.at)}</td>
                        <td>{r.phone}</td>
                        <td>{r.name || '—'}</td>
                        <td className="t-amber">{siteOf(r.source)}</td>
                        <td style={{ textAlign: 'right' }} className="t-amber">{per}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <AccessPanel />
      </div>
    </main>
  );
}

/* ═══════════════════ ЭРХ — бүх домэйны хандах эрх ═══════════════════ */
type AUser = { id: string; name: string; email: string | null; phone: string | null; role: string; department: string | null; data: boolean; location: boolean };
const ROLES: [string, string][] = [['employee', 'ажилтан'], ['ahlah', 'ахлах'], ['menejer', 'менежер'], ['admin', 'АДМИН'], ['superadmin', 'SUPERADMIN']];
/** Эрх тус бүр аль домэйныг нээдэг (Layout, data-gate, admin-gate-ийн дүрэм). */
const ROLE_SITES: Record<string, string> = {
  employee: 'akt (өөрийн акт), app',
  ahlah: 'akt (өөрийн акт), app',
  menejer: 'akt (акт үүсгэх), app',
  admin: 'admin · hr · irts · sanhuu · aguulah · bairshil · habea · haab · surgalt · meet · noft · arhiv · link · tailan · guitsetgel · akt',
  superadmin: 'admin-ийн бүгд + data (бүрэн) + төхөөрөмж зөвшөөрөл',
};

async function ownerCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await owner.functions.invoke('admin-gate', { body });
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

const inputStyle = { background: 'transparent', color: 'inherit', border: '1px solid currentColor', padding: '2px 4px', font: 'inherit' } as const;

function AccessPanel() {
  const [users, setUsers] = useState<AUser[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [phoneEdit, setPhoneEdit] = useState<{ id: string; value: string } | null>(null);
  const load = () => ownerCall<{ users: AUser[] }>({ action: 'owner_users' }).then((r) => setUsers(r.users)).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    void load();
  }, []);
  const set = async (u: AUser, patch: Record<string, unknown>) => {
    setBusy(u.id);
    setErr('');
    try {
      await ownerCall({ action: 'owner_set', user_id: u.id, ...patch });
      await load();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };
  const needle = q.trim().toLowerCase();
  const list = (users || []).filter((u) => !needle || [u.name, u.email || '', u.phone || '', u.department || ''].join(' ').toLowerCase().includes(needle));
  const admins = (users || []).filter((u) => ['admin', 'superadmin'].includes(u.role)).length;

  return (
    <section className="t-pane" style={{ marginTop: 16 }}>
      <div className="t-bar"><span>+--- ЭРХ · БҮХ ДОМЭЙН ---+</span><span className="t-right">{users ? users.length + ' хэрэглэгч · ' + admins + ' админ' : '…'}</span></div>
      <div className="t-body">
        <p className="t-dim" style={{ margin: '0 0 10px', fontSize: 12 }}>
          // АДМИН — бүх ERP домэйн (3 шаттай нэвтрэлтээр) · DATA — data.gennetex.com (харах) · БАЙРШИЛ — bairshil-д бүх ажилтныг харах · УТАС — нэвтрэлтийн SMS очих дугаар (профайлд утасгүй бол нэвтэрч чадахгүй)
        </p>
        <label className="t-prompt" style={{ marginBottom: 10 }}>
          <span className="t-amber">root@access:~$</span>
          <span className="t-dim">grep</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="нэр, имэйл, утас…" aria-label="Хэрэглэгч хайх" />
        </label>
        {err ? <p className="t-err">[ERR] {err}</p> : null}
        {!users ? <p>&gt; ачаалж байна<span className="t-cursor" aria-hidden="true" /></p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Хэрэглэгч</th><th>Утас</th><th>Эрх</th><th>Data</th><th>Байршил</th><th>Нээгдэх домэйн</th></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} style={{ opacity: busy === u.id ? 0.5 : 1 }}>
                    <td>
                      <div>{u.name}</div>
                      <div className="t-dim" style={{ fontSize: 11 }}>{u.email || '—'}{u.department ? ' · ' + u.department : ''}</div>
                    </td>
                    <td>
                      {phoneEdit?.id === u.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); void set(u, { phone: phoneEdit.value }).then((ok) => ok && setPhoneEdit(null)); }} style={{ display: 'flex', gap: 4 }}>
                          <input value={phoneEdit.value} onChange={(e) => setPhoneEdit({ id: u.id, value: e.target.value })} inputMode="numeric" autoFocus style={{ ...inputStyle, width: 96 }} aria-label="Утас" />
                          <button className="t-btn" type="submit">OK</button>
                        </form>
                      ) : (
                        <button className="t-btn" type="button" onClick={() => setPhoneEdit({ id: u.id, value: u.phone || '' })} title="Утас засах">{u.phone || '— нэмэх'}</button>
                      )}
                    </td>
                    <td>
                      <select
                        value={u.role}
                        disabled={busy === u.id}
                        onChange={(e) => {
                          const role = e.target.value;
                          if (role === 'superadmin' && !window.confirm(u.name + '-д SUPERADMIN эрх өгөх үү? Бүх зүйлд бүрэн эрхтэй болно.')) return;
                          void set(u, { role });
                        }}
                        style={inputStyle}
                        aria-label={u.name + ' — эрх'}
                      >
                        {ROLES.map(([k, l]) => <option key={k} value={k} style={{ color: '#000' }}>{l}</option>)}
                      </select>
                    </td>
                    <td><button className="t-btn" type="button" aria-pressed={u.data} disabled={busy === u.id} onClick={() => set(u, { data: !u.data })}>{u.data ? '[x]' : '[ ]'}</button></td>
                    <td><button className="t-btn" type="button" aria-pressed={u.location} disabled={busy === u.id} onClick={() => set(u, { location: !u.location })}>{u.location ? '[x]' : '[ ]'}</button></td>
                    <td className="t-dim" style={{ fontSize: 11, maxWidth: 360 }}>
                      {ROLE_SITES[u.role] || ROLE_SITES.employee}
                      {u.data && u.role !== 'superadmin' ? ' · data (харах)' : ''}
                      {u.location && !['admin', 'superadmin'].includes(u.role) ? ' · bairshil' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="t-dim" style={{ fontSize: 11, marginTop: 10 }}>// Шинэ хүн: эхлээд Gennetex апп эсвэл аль нэг домэйнд Google-ээр нэг удаа нэвтэрнэ — тэгээд энд гарч ирнэ, эрх ба утсыг нь тохируулна.</p>
      </div>
    </section>
  );
}

