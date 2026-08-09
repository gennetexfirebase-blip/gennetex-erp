import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

const TABLE = 'live_streams';

function roomNameFor(hostId) {
  return `gennetexlive${String(hostId || 'x').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}${Date.now()}`;
}

export function mapLiveRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    host_id: r.host_id,
    host_name: r.host_name,
    title: r.title || 'Live',
    room_name: r.room_name,
    status: r.status,
    started_at: r.started_at,
    ended_at: r.ended_at,
  };
}

export async function fetchActiveLives() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapLiveRow);
}

export async function fetchAllLives(limit = 100) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapLiveRow);
}

export async function startLive({ hostId, hostName, title }) {
  // Нэг хүн нэг л live
  await supabase
    .from(TABLE)
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('host_id', hostId)
    .eq('status', 'live');

  const room = roomNameFor(hostId);
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      host_id: hostId,
      host_name: hostName,
      title: title || `${hostName || 'Ажилтан'} Live`,
      room_name: room,
      status: 'live',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    if (String(error.message).includes('live_streams')) {
      throw new Error('Live хүснэгт байхгүй. migration_live_streams.sql ажиллуулна уу.');
    }
    throw error;
  }

  const live = mapLiveRow(data);
  try {
    const { data: profiles } = await supabase.from('profiles').select('id');
    const recipients = (profiles || [])
      .map((p) => p.id)
      .filter((id) => id && id !== hostId);
    await notifyApi.notifyUsers(recipients, {
      title: 'Live эхэллээ',
      body: `${hostName || 'Ажилтан'} live хийж эхэллээ`,
      data: { type: 'live', liveId: live.id, room: live.room_name, hostName, hostId },
      channelId: 'feed',
      priority: 'high',
    });
  } catch (e) {}

  return live;
}

export async function endLive(liveId, hostId) {
  let q = supabase
    .from(TABLE)
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', liveId)
    .eq('status', 'live');
  if (hostId) q = q.eq('host_id', hostId);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return mapLiveRow(data);
}

export function subscribeLives(onChange) {
  const channel = supabase
    .channel('live-streams')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
