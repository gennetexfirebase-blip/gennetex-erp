import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import * as chatApi from './chatService';

const TABLE = 'meetings';

export const KIND_LIVE = 'live';
export const KIND_MEETING = 'meeting';

/**
 * Төрөл тодорхойлох.
 * Анхаар: kind баганын default='live' тул "Админ хурал" мөр буруу live болсон байж болно —
 * title-д "хурал" байвал үргэлж meeting.
 */
export function resolveKind(r) {
  if (!r) return null;
  const title = String(r.title || '');
  if (/хурал/i.test(title)) return KIND_MEETING;
  if (r.kind === KIND_MEETING) return KIND_MEETING;
  if (r.kind === KIND_LIVE) return KIND_LIVE;
  if (/\sLive$/i.test(title) || /^live$/i.test(title.trim())) return KIND_LIVE;
  return KIND_LIVE;
}

export function mapMeeting(r) {
  if (!r) return null;
  const kind = resolveKind(r);
  return {
    id: r.id,
    host_id: r.host_id,
    host_name: r.host_name,
    title: r.title || (kind === KIND_MEETING ? 'Админ хурал' : 'Live'),
    kind,
    status: r.status,
    started_at: r.started_at,
    ended_at: r.ended_at,
  };
}

/**
 * Идэвхтэй хурал эсвэл live.
 * Бүх active мөрийг авч client дээр шүүнэ (kind default алдааг засна).
 */
export async function fetchActiveMeeting(kind = KIND_MEETING) {
  const want = kind === KIND_MEETING ? KIND_MEETING : KIND_LIVE;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(30);

  if (error) {
    if (String(error.message).includes('meetings')) {
      throw new Error('Хурал хүснэгт байхгүй. migration_meetings.sql ажиллуулна уу.');
    }
    throw error;
  }

  const rows = (data || [])
    .map(mapMeeting)
    .filter((r) => r && r.kind === want);

  return rows[0] || null;
}

function meetingInviteText(hostName, meetingId) {
  return (
    `📢 Хурал эхэллээ!\n\n` +
    `${hostName || 'Админ'} хурал эхлүүллээ.\n\n` +
    `➡️ Орох: Нүүр цэс → Хурал → «Хуралд орох»\n\n` +
    `эсвэл энэ мессеж дээр дарж Хурал цэс рүү орно уу.\n` +
    `#meeting:${meetingId}`
  );
}

async function notifyMeetingStarted(meeting, { hostId, hostName, isMeeting }) {
  const { data: profiles } = await supabase.from('profiles').select('id, name, role');
  const recipients = (profiles || []).filter((p) => p.id && p.id !== hostId);
  if (!recipients.length) return;

  const title = isMeeting ? 'Хурал эхэллээ' : 'Live эхэллээ';
  const body = isMeeting
    ? `${hostName || 'Админ'} хурал эхлүүллээ — Нүүр → Хурал дээр дарж орно уу`
    : `${hostName || 'Ажилтан'} live хийж эхэллээ — Пост цэсээр үзнэ үү`;

  const data = {
    type: isMeeting ? 'meeting' : 'live',
    kind: isMeeting ? KIND_MEETING : KIND_LIVE,
    meetingId: meeting.id,
    hostName: hostName || 'Админ',
    hostId: hostId || '',
    screen: isMeeting ? 'Meeting' : 'Feed',
  };

  await notifyApi.notifyUsers(
    recipients.map((p) => p.id),
    {
      title,
      body,
      data,
      channelId: 'chat',
      priority: 'high',
    }
  );

  if (!isMeeting) return;
  const invite = meetingInviteText(hostName, meeting.id);
  for (const p of recipients) {
    try {
      const conv = await chatApi.getOrCreateDirect(
        { id: hostId, name: hostName || 'Админ' },
        { id: p.id, name: p.name || 'Ажилтан' }
      );
      await chatApi.sendMessage({
        room: conv.id,
        senderId: hostId,
        senderName: hostName || 'Админ',
        content: invite,
      });
    } catch (e) {}
  }
}

async function endSessionsOfKind(sessionKind) {
  // kind баганаар
  const byKind = await supabase
    .from(TABLE)
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('status', 'active')
    .eq('kind', sessionKind);

  if (!byKind.error) return;

  // kind алдаатай эсвэл буруу default — бүгдийг авч шүүнэ
  const { data: actives } = await supabase.from(TABLE).select('*').eq('status', 'active');
  const ids = (actives || [])
    .filter((r) => resolveKind(r) === sessionKind)
    .map((r) => r.id);
  if (ids.length) {
    await supabase
      .from(TABLE)
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .in('id', ids);
  }
}

export async function startMeeting({ hostId, hostName, title, kind = KIND_MEETING }) {
  if (!hostId) throw new Error('Host байхгүй');
  const sessionKind = kind === KIND_MEETING ? KIND_MEETING : KIND_LIVE;
  const isMeeting = sessionKind === KIND_MEETING;

  await endSessionsOfKind(sessionKind);

  // Title заавал ялгаатай — resolveKind title-аар зөв танина
  const safeTitle = isMeeting
    ? title && /хурал/i.test(title)
      ? title
      : 'Админ хурал'
    : title && /\blive\b/i.test(title)
      ? title
      : `${hostName || 'Ажилтан'} Live`;

  const payload = {
    host_id: hostId,
    host_name: hostName || 'Ажилтан',
    title: safeTitle,
    status: 'active',
    started_at: new Date().toISOString(),
    kind: sessionKind,
  };

  let { data, error } = await supabase.from(TABLE).insert(payload).select().single();

  if (error && String(error.message).includes('kind')) {
    const { kind: _k, ...withoutKind } = payload;
    const retry = await supabase.from(TABLE).insert(withoutKind).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (String(error.message).includes('meetings')) {
      throw new Error('Хурал хүснэгт байхгүй. migration_meetings.sql ажиллуулна уу.');
    }
    throw error;
  }

  // Хэрэв DB default-оор kind=live болсон бол засна
  if (data?.id && isMeeting && data.kind !== KIND_MEETING) {
    const fix = await supabase
      .from(TABLE)
      .update({ kind: KIND_MEETING, title: safeTitle })
      .eq('id', data.id)
      .select()
      .single();
    if (!fix.error && fix.data) data = fix.data;
  }

  const meeting = mapMeeting({ ...data, kind: sessionKind, title: safeTitle });

  try {
    await notifyMeetingStarted(meeting, { hostId, hostName, isMeeting });
  } catch (e) {}

  return meeting;
}

export async function endMeeting(meetingId, hostId) {
  if (!meetingId) return null;
  let q = supabase
    .from(TABLE)
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', meetingId)
    .eq('status', 'active');
  if (hostId) q = q.eq('host_id', hostId);
  const { data, error } = await q.select().maybeSingle();
  if (error) throw error;
  return mapMeeting(data);
}

export function subscribeMeetings(onChange) {
  const channel = supabase
    .channel(`meetings-feed-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
