import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, RefreshCw, Trash2, UsersRound } from 'lucide-react';
import { PageHeader, Card, Button, Modal, Loading, ErrorState, EmptyState } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';

/** Хамт яваа багууд — жолооч + QR уншуулсан хамт явагчид (хуучин «companions»). */

type Passenger = { trip_id: string; passenger_name: string | null; scanned_at: string };
type Team = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  driver_name: string | null;
  plate_number: string | null;
  distance_km: number | null;
  liters: number | null;
  cost: number | null;
  passengers: Passenger[];
};

const dur = (t: Team) => {
  const end = t.ended_at ? new Date(t.ended_at) : t.status === 'active' ? new Date() : null;
  const sec = end ? Math.max(0, (end.getTime() - new Date(t.started_at).getTime()) / 1000) : 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} ц ${m} мин` : `${m} мин`;
};
const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

async function fetchTeams(tab: 'today' | 'archive') {
  let q = supabase.from('trips').select('id, started_at, ended_at, status, driver_name, plate_number, distance_km, liters, cost').order('started_at', { ascending: false });
  q = tab === 'today' ? q.gte('started_at', todayStart().toISOString()) : q.lt('started_at', todayStart().toISOString()).limit(500);
  const { data, error } = await q;
  if (error) throw error;
  const trips = (data || []) as Omit<Team, 'passengers'>[];
  const ids = trips.map((t) => t.id);
  let pass: Passenger[] = [];
  if (ids.length) {
    const r = await supabase.from('trip_passengers').select('trip_id, passenger_name, scanned_at').in('trip_id', ids).order('scanned_at');
    if (!r.error) pass = (r.data || []) as Passenger[];
  }
  return trips.map((t) => ({ ...t, passengers: pass.filter((p) => p.trip_id === t.id) }));
}

export default function CompanionsPage() {
  const { profile } = useOutletContext<{ profile: { role?: string | null } }>();
  const isSuper = profile?.role === 'superadmin';
  const [tab, setTab] = useState<'today' | 'archive'>('today');
  const { data, loading, error, reload } = useAsync(() => fetchTeams(tab), [tab], []);
  const [open, setOpen] = useState<Team | null>(null);
  const totalKm = data.reduce((s, t) => s + Number(t.distance_km || 0), 0);

  const remove = async (t: Team) => {
    if (!window.confirm(`«${t.driver_name || 'баг'}» багийг бүрмөсөн устгах уу?\n\nАялал, хамт явагчдын бүртгэл устгагдана.`)) return;
    const { error } = await supabase.rpc('admin_delete_trip_team', { target_trip_id: t.id });
    if (error) return window.alert(error.message);
    setOpen(null);
    reload();
  };
  const exportExcel = () => {
    const rows: (string | number)[][] = [['Огноо', 'Жолооч', 'Машин', 'Км', 'Хугацаа', 'Хамт явагч', 'Төлөв']];
    data.forEach((t) => rows.push([new Date(t.started_at).toLocaleString('mn-MN'), t.driver_name || '', t.plate_number || '', Number(t.distance_km || 0), dur(t), t.passengers.map((p) => p.passenger_name).join(', ') || 'Ганцаараа', t.status === 'active' ? 'Идэвхтэй' : 'Дууссан']));
    void downloadSheets(`gennetex_hamt_yvaa_bag_${tab}.xlsx`, [{ name: 'Хамт яваа баг', rows }]);
  };

  return (
    <>
      <PageHeader
        title="Хамт яваа багууд"
        crumb="Машин"
        description="Нэг баг = нэг жолооч + (заавал биш) QR уншуулсан хамт явагч. Ганцаараа аялал ч бүртгэгдэнэ."
        actions={
          <>
            <div className="inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
              {([['today', 'Өнөөдөр'], ['archive', 'Архив']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${tab === k ? 'bg-brand text-white' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
            <Button icon={<Download size={15} />} disabled={!data.length} onClick={exportExcel}>Excel</Button>
          </>
        }
      />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <Card title={`${tab === 'today' ? 'Өнөөдөр' : 'Архив'} — ${data.length} баг · ${totalKm.toFixed(1)} км`} icon={<UsersRound size={17} />} bodyClassName="p-0">
          {!data.length ? <EmptyState text={tab === 'today' ? 'Өнөөдрийн баг алга.' : 'Архив хоосон.'} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="bg-card2 text-left text-[12px] text-muted">
                  <tr>{['Огноо', 'Жолооч', 'Машин', 'Зам', 'Хугацаа', 'Хамт явагч', 'Төлөв'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.map((t) => (
                    <tr key={t.id} className="cursor-pointer hover:bg-hover" onClick={() => setOpen(t)}>
                      <td className="px-3 py-2 text-muted">{new Date(t.started_at).toLocaleString('mn-MN')}</td>
                      <td className="px-3 py-2 font-medium text-ink">{t.driver_name || '—'}</td>
                      <td className="px-3 py-2 text-ink">{t.plate_number || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{Number(t.distance_km || 0).toFixed(2)} км</td>
                      <td className="px-3 py-2 text-muted">{dur(t)}{t.status === 'active' && !t.ended_at ? '*' : ''}</td>
                      <td className="px-3 py-2 text-muted">{t.passengers.map((p) => p.passenger_name).join(', ') || 'Ганцаараа'}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[12px] ${t.status === 'active' ? 'bg-success-soft text-success' : 'bg-card2 text-muted'}`}>{t.status === 'active' ? 'Идэвхтэй' : 'Дууссан'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {open ? (
        <Modal title="Хамт яваа баг" onClose={() => setOpen(null)}>
          <dl className="space-y-1.5 text-[13px]">
            {([['Жолооч', open.driver_name || '—'], ['Машин', open.plate_number || '—'], ['Явсан зам', `${Number(open.distance_km || 0).toFixed(2)} км`], ['Хугацаа', dur(open)], ['Төлөв', open.status === 'active' ? 'Явж байна' : 'Дууссан'], ['Эхэлсэн', new Date(open.started_at).toLocaleString('mn-MN')], ...(open.ended_at ? [['Дууссан', new Date(open.ended_at).toLocaleString('mn-MN')]] : []), ...(Number(open.liters) > 0 ? [['Түлш', `${Number(open.liters).toFixed(2)} л`]] : [])] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-muted">{k}</dt><dd className="text-ink">{v}</dd></div>
            ))}
          </dl>
          <p className="mb-1 mt-4 text-[13px] font-semibold text-ink">Хамт яваа хүмүүс</p>
          <ul className="list-disc pl-5 text-[13px] text-ink">
            {open.passengers.length ? open.passengers.map((p, i) => <li key={i}>{p.passenger_name} <span className="text-muted">{new Date(p.scanned_at).toLocaleString('mn-MN')}</span></li>) : <li className="text-muted">Ганцаараа явж байна</li>}
          </ul>
          {isSuper ? <Button variant="danger" className="mt-4" icon={<Trash2 size={14} />} onClick={() => remove(open)}>Баг устгах</Button> : null}
        </Modal>
      ) : null}
    </>
  );
}
