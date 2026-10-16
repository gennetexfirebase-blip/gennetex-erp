import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, Input, Select, Button, Avatar, Loading, ErrorState, EmptyState } from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { supabase } from '../lib/supabase';

/**
 * bairshil.gennetex.com — ажилчдын одоогийн байршил.
 *
 * Хэн юуг харахыг сервер (`staff_locations`, `location_scope`) шийднэ:
 * sysadmin ба түүний оноосон хүмүүс бүгдийг, хэлтэст оноогдсон админ зөвхөн
 * өөрийн хэлтсийг харна.
 */

type Staff = {
  id: string;
  name: string | null;
  last_name: string | null;
  position: string | null;
  avatar_url: string | null;
  department_id: string | null;
  department: string | null;
  lat: number | null;
  lng: number | null;
  seen: string | null;
};
type Payload = { scope: 'all' | 'dept'; department: string | null; staff: Staff[] };

const ONLINE_MIN = 15;
const PAL = ['#24614F', '#3B6A87', '#6A5A8E', '#A6453B', '#94660F', '#2F7D5B', '#5E5A52', '#7A4E8C', '#B5652B', '#45607A'];
const fullName = (s: { last_name: string | null; name: string | null }) => [s.last_name, s.name].filter(Boolean).join(' ') || 'Ажилтан';

function ago(iso: string | null) {
  if (!iso) return 'Байршил ирээгүй';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Дөнгөж сая';
  if (m < 60) return `${m} мин өмнө`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} цагийн өмнө`;
  return `${Math.floor(m / 1440)} өдрийн өмнө`;
}
const online = (s: Staff) => !!s.seen && Date.now() - new Date(s.seen).getTime() < ONLINE_MIN * 60000;
const hasPos = (s: Staff) => s.lat != null && s.lng != null;

async function fetchStaffLocations(): Promise<Payload> {
  const { data, error } = await supabase.rpc('staff_locations');
  if (error) throw new Error(/forbidden/.test(error.message) ? 'forbidden' : error.message);
  return data as Payload;
}

export default function StaffLocationsPage() {
  const { profile } = useOutletContext<{ profile: { role?: string | null } }>();
  const isSuper = String(profile?.role || '') === 'superadmin';
  const { data, loading, error, reload } = useAsync<Payload | null>(fetchStaffLocations, [], null);
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<string | null>(null);

  // Минут тутам шинэчилнэ.
  useEffect(() => {
    const id = setInterval(() => reload(), 60000);
    return () => clearInterval(id);
  }, [reload]);

  const staff = data?.staff || [];
  const depts = useMemo(() => [...new Set(staff.map((s) => s.department || 'Хэлтэсгүй'))].sort((a, b) => a.localeCompare(b, 'mn')), [staff]);
  const color = useMemo(() => new Map(depts.map((d, i) => [d, PAL[i % PAL.length]])), [depts]);
  const visible = staff.filter((s) => (!dept || (s.department || 'Хэлтэсгүй') === dept) && fullName(s).toLowerCase().includes(q.trim().toLowerCase()));
  const groups = useMemo(() => {
    const g = new Map<string, Staff[]>();
    visible.forEach((s) => {
      const k = s.department || 'Хэлтэсгүй';
      (g.get(k) || g.set(k, []).get(k)!).push(s);
    });
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'mn'));
  }, [visible]);

  if (error === 'forbidden') {
    return (
      <>
        <PageHeader title="Ажилчдын байршил" crumb="Байршил" />
        <EmptyState text="Байршил харах эрхгүй байна. Хэлтэст оноогдсон админ эсвэл sysadmin-ий эрх олгосон хүн л харна." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ажилчдын байршил"
        crumb="Байршил"
        description={
          data
            ? data.scope === 'all'
              ? 'Бүх ажилтны апп-аас ирсэн сүүлийн байршил.'
              : `Зөвхөн ${data.department || 'таны'} хэлтсийн ажилтнууд.`
            : undefined
        }
        actions={<Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>}
      />

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          <Card title={`Ажилтан (${visible.length})`} icon={<MapPin size={17} />} bodyClassName="p-0">
            <div className="space-y-2 border-b border-line p-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <Input placeholder="Нэрээр хайх" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              {depts.length > 1 ? (
                <Select className="w-full" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Хэлтэс">
                  <option value="">Бүх хэлтэс</option>
                  {depts.map((d) => <option key={d}>{d}</option>)}
                </Select>
              ) : null}
            </div>
            {!groups.length ? (
              <EmptyState text="Ажилтан олдсонгүй." />
            ) : (
              <div className="max-h-[620px] overflow-y-auto">
                {groups.map(([d, list]) => (
                  <div key={d}>
                    <p className="sticky top-0 flex items-center gap-2 bg-card2 px-4 py-2 text-[12px] font-semibold text-muted">
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: color.get(d) }} />
                      {d} <span className="font-normal text-subtle">· {list.filter(online).length}/{list.length} идэвхтэй</span>
                    </p>
                    <ul className="divide-y divide-line">
                      {list.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            disabled={!hasPos(s)}
                            onClick={() => setFocus(s.id)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-hover disabled:cursor-default disabled:opacity-60 ${focus === s.id ? 'bg-brand-soft' : ''}`}
                          >
                            <Avatar name={fullName(s)} src={s.avatar_url} size={30} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-ink">{fullName(s)}</span>
                              <span className="block truncate text-[12px] text-muted">{s.position || '—'}</span>
                            </span>
                            <span className={`shrink-0 text-[11px] ${online(s) ? 'font-semibold text-success' : 'text-subtle'}`}>{ago(s.seen)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Газрын зураг" bodyClassName="p-0">
            <StaffMap staff={visible} color={color} focus={focus} />
          </Card>
        </div>
      )}

      {isSuper ? <GrantsPanel /> : null}
    </>
  );
}

function StaffMap({ staff, color, focus }: { staff: Staff[]; color: Map<string, string>; focus: string | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([47.918, 106.917], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const pts: L.LatLngExpression[] = [];
    staff.filter(hasPos).forEach((s) => {
      const c = color.get(s.department || 'Хэлтэсгүй') || PAL[0];
      const on = online(s);
      const mk = L.circleMarker([s.lat!, s.lng!], {
        radius: on ? 9 : 7,
        color: '#fff',
        weight: 2,
        fillColor: c,
        fillOpacity: on ? 0.95 : 0.45,
      })
        .bindTooltip(`${fullName(s)} · ${s.department || 'Хэлтэсгүй'}<br>${ago(s.seen)}`)
        .addTo(g);
      markers.current.set(s.id, mk);
      pts.push([s.lat!, s.lng!]);
    });
    if (pts.length && !fitted.current) {
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [staff, color]);

  useEffect(() => {
    const mk = focus ? markers.current.get(focus) : null;
    if (!mk || !map.current) return;
    map.current.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 15));
    mk.openTooltip();
  }, [focus]);

  return <div ref={el} className="h-[520px] w-full lg:h-[700px]" style={{ zIndex: 0 }} role="region" aria-label="Ажилчдын байршлын газрын зураг" />;
}

/** Sysadmin — бүх хэлтсийн байршлыг харах эрх олгох. */
function GrantsPanel() {
  const { data: emps } = useAsync<Employee[]>(() => fetchEmployees().catch(() => []), [], []);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.rpc('location_grants_list').then(({ data, error }) => {
      if (error) setErr(error.message);
      else setGranted(new Set(((data || []) as { user_id: string }[]).map((g) => g.user_id)));
    });
  }, []);

  const toggle = async (id: string, on: boolean) => {
    setBusy(id);
    setErr('');
    const { error } = await supabase.rpc('location_grant_set', { p_user: id, p_on: on });
    if (error) setErr(error.message);
    else
      setGranted((s) => {
        const n = new Set(s);
        if (on) n.add(id);
        else n.delete(id);
        return n;
      });
    setBusy(null);
  };

  const people = emps
    .filter((e) => e.user_id && e.role !== 'superadmin')
    .filter((e) => fullName(e).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(granted.has(b.user_id!)) - Number(granted.has(a.user_id!)) || fullName(a).localeCompare(fullName(b), 'mn'));

  return (
    <Card className="mt-5" title="Бүх хэлтсийг харах эрх" icon={<ShieldCheck size={17} />}>
      <p className="mb-3 text-[13px] text-muted">
        Энд сонгосон хүмүүс бүх ажилтны байршлыг харна. Бусад админ зөвхөн өөрийн хэлтсийг харна. Зөвхөн sysadmin өөрчилнө.
      </p>
      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <Input placeholder="Хүн хайх" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      {err ? <p className="mb-2 text-[13px] text-danger" role="alert">{err}</p> : null}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((e) => {
          const on = granted.has(e.user_id!);
          return (
            <li key={e.user_id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-card2 px-3 py-2">
              <Avatar name={fullName(e)} src={e.avatar_url} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{fullName(e)}</span>
                <span className="block truncate text-[12px] text-muted">{e.department_name || 'Хэлтэсгүй'}</span>
              </span>
              <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink">
                <input type="checkbox" checked={on} disabled={busy === e.user_id} onChange={(ev) => toggle(e.user_id!, ev.target.checked)} />
                Бүгдийг
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
