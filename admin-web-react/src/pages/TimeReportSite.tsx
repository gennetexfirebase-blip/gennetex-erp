import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import AdminGate, { adminGateLogout } from '../components/AdminGate';
import { useParams } from 'react-router-dom';
import TimeReport from './TimeReport';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';
import {
  STATUS_LABEL,
  WDAY,
  buildModel,
  fetchWarning,
  fmtDate,
  fmtDateY,
  h1,
  parse,
  readAccessKey,
  type WarningPage,
} from '../lib/timeReport';
import './time-report.css';

/**
 * tailan.gennetex.com — Цагийн тайлан.
 *
 *   ?k=<түлхүүр>  → апп-ын админы «Тайлан» жагсаалтаас (WebView) нэвтрэлтгүй
 *   эсвэл Google-ээр нэвтэрсэн админ.
 */
export default function TimeReportSite() {
  const key = useMemo(() => readAccessKey(), []);
  const [user, setUser] = useState<{ email: string; admin: boolean } | null | undefined>(key ? null : undefined);
  const [gateOk, setGateOk] = useState(false);
  const pass = useCallback(() => setGateOk(true), []);

  useEffect(() => {
    if (key || !isSupabaseConfigured) return setUser(null);
    const read = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return setUser(null);
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      setUser({ email: String(data.user.email || ''), admin: ['admin', 'superadmin'].includes(String(p?.role || '')) });
    };
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => sub?.subscription?.unsubscribe();
  }, [key]);

  const signIn = async () => {
    const returnTo = window.location.href;
    rememberAuthReturn(returnTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo, queryParams: { prompt: 'select_account' } } });
  };
  const signOut = () => adminGateLogout().then(() => supabase.auth.signOut()).then(() => window.location.reload());

  if (key) return <TimeReport variant="standalone" accessKey={key} />;
  if (user === undefined) return <Gate title="Түр хүлээнэ үү…" />;
  // Админ нэвтрэлт — 4 шат (утас → Google → код → Gmail код). Апп-ын түлхүүрээр (?k=) орвол алгасна.
  if (user === null) return <AdminGate signedIn={false} onPass={pass} title="Цагийн тайлан" />;
  if (!user.admin)
    return (
      <Gate title="Эрх алга" text={`${user.email} дансаар цагийн тайлан харах эрхгүй байна. Зөвхөн админ харна.`}>
        <button className="btn" onClick={signOut}>Өөр дансаар нэвтрэх</button>
      </Gate>
    );
  if (!gateOk) return <AdminGate signedIn onPass={pass} title="Цагийн тайлан" />;
  return (
    <TimeReport
      variant="standalone"
      headerRight={
        <span className="who-me no-print">
          {user.email}
          <button onClick={signOut}>Гарах</button>
        </span>
      }
    />
  );
}

function Gate({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="tr standalone">
      <div className="panel gate">
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
        {children}
      </div>
    </div>
  );
}

/** tailan.gennetex.com/w/<token> — ажилтанд илгээсэн ирцийн сануулга. */
export function AttendanceWarningPage() {
  const { token = '' } = useParams();
  const [page, setPage] = useState<WarningPage | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchWarning(token).then(setPage).catch((e) => setError(e?.message || 'Ачаалж чадсангүй.'));
  }, [token]);

  const model = useMemo(() => {
    if (!page) return null;
    const emp = page.data.employee;
    return buildModel({ ...page.data, employees: [{ ...emp, email: null, role: null }], shifts: [] }, page.warning.period_from, page.warning.period_to);
  }, [page]);

  if (error) return <Gate title="Алдаа" text={error} />;
  if (page === undefined) return <Gate title="Түр хүлээнэ үү…" />;
  if (!page || !model) return <Gate title="Сануулга олдсонгүй" text="Холбоос буруу эсвэл хүчингүй болсон байна." />;
  const w = page.warning;
  const emp = model.emps[0];
  const s = emp ? model.sum.get(emp.id)! : null;
  const rows = s ? s.days.filter((x) => x.status !== 'future' && x.status !== 'na' && (x.status !== 'off' || x.checkIn)) : [];
  return (
    <div className="tr standalone">
      <main>
        <div className="letter">
          <section className="panel mb">
            <div className="panel-h">
              <div>
                <h2 style={{ color: 'var(--absent)' }}>{w.title}</h2>
                <p>
                  {w.employee_name} · {fmtDateY(w.period_from)} – {fmtDateY(w.period_to)} · Илгээсэн {w.created_by_name || 'Админ'}, {new Date(w.created_at).toLocaleDateString('mn-MN')}
                </p>
              </div>
            </div>
            <div className="msg">{w.message}</div>
          </section>
          {s ? (
            <>
              <section className="panel strip" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                <div className="stat"><div className="k">Ирц</div><div className="v">{s.rate}<small>%</small></div><div className="n">Ирсэн {s.present}/{s.work}</div></div>
                <div className="stat"><div className="k">Хоцорсон</div><div className="v">{s.late}<small>удаа</small></div><div className="n">Нийт {s.lateMin} минут</div></div>
                <div className="stat"><div className="k">Тасалсан</div><div className="v">{s.absent}<small>өдөр</small></div><div className="n">Чөлөөтэй {s.leave}</div></div>
                <div className="stat"><div className="k">Ажилласан</div><div className="v">{h1(s.hours)}<small>цаг</small></div><div className="n">Ажил эхлэх {model.settings.workStart}</div></div>
              </section>
              <section className="panel">
                <div className="panel-h"><div><h2>Өдөр бүрийн ирц</h2><p>{fmtDate(w.period_from)} – {fmtDate(w.period_to)}</p></div></div>
                <table className="days">
                  <thead><tr><th>Огноо</th><th>Ирсэн</th><th>Явсан</th><th>Ажилласан</th><th>Төлөв</th></tr></thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.date} className={x.status === 'off' ? 'we' : ''}>
                        <td><span className="d1">{parse(x.date).getDate()}</span><span className="d2">{WDAY[parse(x.date).getDay()]}</span></td>
                        <td>{x.checkIn || '—'}</td>
                        <td>{x.checkOut || (x.open ? 'бүртгээгүй' : '—')}</td>
                        <td>{x.hours ? `${h1(x.hours)} ц` : '—'}</td>
                        <td><span className={`tag t-${x.status}`}>{STATUS_LABEL[x.status]}{x.status === 'late' ? ` ${x.lateMin} мин` : ''}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
