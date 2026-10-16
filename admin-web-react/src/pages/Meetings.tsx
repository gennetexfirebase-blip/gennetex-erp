import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MonitorUp, RefreshCw, Video } from 'lucide-react';
import { PageHeader, Card, Button, Loading, ErrorState, EmptyState } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';

/**
 * meet.gennetex.com — Админ хурал (хуучин «meetings»).
 *
 * Хурал эхлүүлэхэд бүх ажилтанд push ба чатаар урилга очно; ажилтан апп-ын
 * Нүүр → Хурал → «Хуралд орох»-оор холбогдоно. Дэлгэц хуваалцах хөтлөгчийн
 * хуудас (WebRTC) нь meeting.html — шинэ цонхонд нээгдэнэ.
 */

type Meeting = { id: string; host_id: string | null; host_name: string | null; title: string | null; kind: string | null; status: string | null; started_at: string | null; ended_at: string | null };
type Me = { id?: string; name?: string | null };

const isMeeting = (m: Meeting) => (m.kind === 'meeting' ? true : m.kind === 'live' ? false : /хурал/i.test(m.title || ''));
const openHost = (m: Meeting, name: string) =>
  window.open(`/gennetex/admin-v1/meeting.html?id=${encodeURIComponent(m.id)}&role=host&name=${encodeURIComponent(name)}`, '_blank', 'noopener');

async function inviteByChat(me: Me, meetingId: string, hostName: string) {
  const { data: people } = await supabase.from('profiles').select('id, name').neq('id', me.id!);
  const text = `📢 Хурал эхэллээ!\n\n${hostName} хурал эхлүүллээ.\n\n➡️ Орох: Нүүр цэс → Хурал → «Хуралд орох»\n\n#meeting:${meetingId}`;
  let n = 0;
  for (const p of (people || []) as { id: string; name: string | null }[]) {
    try {
      const key = ['dm', ...[me.id!, p.id].sort()].join('_');
      let { data: conv } = await supabase.from('conversations').select('id').eq('dm_key', key).maybeSingle();
      if (!conv) {
        const ins = await supabase.from('conversations').insert({ is_group: false, dm_key: key, created_by: me.id }).select('id').single();
        if (ins.error) continue;
        conv = ins.data;
        await supabase.from('conversation_members').insert([
          { conversation_id: conv!.id, user_id: me.id, user_name: hostName },
          { conversation_id: conv!.id, user_id: p.id, user_name: p.name || 'Ажилтан' },
        ]);
      }
      const msg = await supabase.from('messages').insert({ room: conv!.id, sender_id: me.id, sender_name: hostName, content: text });
      if (!msg.error) n++;
    } catch {
      /* нэг хүнд очихгүй байсан ч бусдад үргэлжлүүлнэ */
    }
  }
  return n;
}

export default function MeetingsPage() {
  const { profile } = useOutletContext<{ profile: Me }>();
  const hostName = profile?.name || 'Админ';
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('meetings').select('*').order('started_at', { ascending: false }).limit(200);
    if (error) throw error;
    return ((data || []) as Meeting[]).filter(isMeeting);
  }, [], []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const active = data.filter((m) => m.status === 'active');
  const past = data.filter((m) => m.status === 'ended').slice(0, 50);

  const start = async () => {
    if (!profile?.id) return;
    setBusy(true);
    setMsg('');
    try {
      await supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('status', 'active').eq('kind', 'meeting');
      const { data: row, error } = await supabase.from('meetings').insert({ host_id: profile.id, host_name: hostName, title: 'Админ хурал', kind: 'meeting', status: 'active', started_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      openHost(row as Meeting, hostName);
      const push = await supabase.functions.invoke('send-push', {
        body: {
          audience: { kind: 'all' },
          notification: { type: 'meeting', title: 'Хурал эхэллээ', body: `${hostName} хурал эхлүүллээ — Нүүр → Хурал дээр дарж орно уу`, data: { type: 'meeting', kind: 'meeting', meetingId: String(row.id), hostName, hostId: String(profile.id), screen: 'Meeting' } },
        },
      });
      const chats = await inviteByChat(profile, row.id, hostName);
      setMsg(`Хурал эхэллээ — ${push.error ? 'push илгээж чадсангүй' : 'push илгээгдлээ'}, чат: ${chats}`);
      reload();
    } catch (e) {
      setMsg((e as Error).message || 'Алдаа');
    } finally {
      setBusy(false);
    }
  };
  const end = async (m: Meeting) => {
    if (!window.confirm('Хурал дуусгах уу?')) return;
    const { error } = await supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', m.id).eq('status', 'active');
    if (error) window.alert(error.message);
    else reload();
  };

  return (
    <>
      <PageHeader
        title="Хурал"
        crumb="Хурал"
        description="Өөрийн вэб дээр хурал эхлүүлнэ. Дэлгэц share хийгээд бүх ажилтан апп дээрээс «Хуралд орох» дарж холбогдоно. Гадны meet сервис ашиглахгүй."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
            <Button icon={<Video size={15} />} disabled={busy} onClick={start}>{busy ? 'Эхлүүлж байна…' : 'Хурал эхлүүлэх'}</Button>
          </>
        }
      />
      {msg ? <p className="mb-3 text-[13px] text-ink" role="status">{msg}</p> : null}
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <>
          <Card className="mb-5" title={`Идэвхтэй хурал (${active.length})`} icon={<Video size={17} />} bodyClassName="p-0">
            {!active.length ? <EmptyState text="Идэвхтэй хурал алга." /> : (
              <ul className="divide-y divide-line">
                {active.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">ИДЭВХТЭЙ</span>
                    <span className="min-w-0 flex-1 text-[13px]"><b className="text-ink">{m.host_name || 'Админ'}</b> · {m.title || 'Админ хурал'} <span className="text-muted">· {m.started_at ? new Date(m.started_at).toLocaleString('mn-MN') : ''}</span></span>
                    <Button icon={<MonitorUp size={15} />} onClick={() => openHost(m, m.host_name || hostName)}>Нээх / Share</Button>
                    <Button variant="outline" onClick={() => end(m)}>Дуусгах</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Хурлын түүх" bodyClassName="p-0">
            {!past.length ? <EmptyState text="Түүх алга." /> : (
              <table className="w-full text-[13px]">
                <thead className="bg-card2 text-left text-[12px] text-muted"><tr>{['Эхэлсэн', 'Хэн', 'Гарчиг', 'Дууссан'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {past.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 text-muted">{m.started_at ? new Date(m.started_at).toLocaleString('mn-MN') : '—'}</td>
                      <td className="px-4 py-2 text-ink">{m.host_name || '—'}</td>
                      <td className="px-4 py-2 text-ink">{m.title || 'Хурал'}</td>
                      <td className="px-4 py-2 text-muted">{m.ended_at ? new Date(m.ended_at).toLocaleString('mn-MN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
