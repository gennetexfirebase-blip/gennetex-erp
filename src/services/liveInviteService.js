import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import { CALLS_CHANNEL } from './notificationService';
import { resolveKind, KIND_LIVE } from './meetingService';

export async function fetchActiveLives() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || [])
    .filter((r) => resolveKind(r) === KIND_LIVE)
    .map((r) => ({
      id: r.id,
      host_id: r.host_id,
      host_name: r.host_name,
      title: r.title,
      started_at: r.started_at,
    }));
}

export async function fetchLiveComments(liveId, limit = 100) {
  if (!liveId) return [];
  const { data, error } = await supabase
    .from('live_comments')
    .select('*')
    .eq('live_id', liveId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    if (String(error.message).includes('live_comments')) return [];
    throw error;
  }
  return data || [];
}

export async function postLiveComment({ liveId, userId, userName, content }) {
  const text = String(content || '').trim();
  if (!liveId || !text) throw new Error('Сэтгэгдэл хоосон');
  const { data, error } = await supabase
    .from('live_comments')
    .insert({
      live_id: liveId,
      user_id: userId || null,
      user_name: userName || 'Ажилтан',
      content: text,
    })
    .select()
    .single();
  if (error) {
    if (String(error.message).includes('live_comments')) {
      throw new Error('migration_live_comments_invites.sql ажиллуулна уу');
    }
    throw error;
  }
  return data;
}

export function subscribeLiveComments(liveId, onInsert) {
  if (!liveId) return () => {};
  const channel = supabase
    .channel(`live-comments-db-${liveId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'live_comments', filter: `live_id=eq.${liveId}` },
      (payload) => onInsert?.(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function isJoinRequest(text) {
  const t = String(text || '').toLowerCase().trim();
  return (
    /би\s*орж/.test(t) ||
    /оръя/.test(t) ||
    /оруул/.test(t) ||
    /оруулж\s*өг/.test(t) ||
    /join/.test(t) ||
    /оруулах/.test(t)
  );
}

/** Live хийж буй хүн ажилтныг урина — ringtone-той push */
export async function inviteToLive({
  liveId,
  hostId,
  hostName,
  inviteeId,
  inviteeName,
}) {
  if (!liveId || !inviteeId) throw new Error('Урилга дутуу');
  if (inviteeId === hostId) throw new Error('Өөрийгөө урих боломжгүй');

  // Хуучин pending урилгыг хаана
  await supabase
    .from('live_invites')
    .update({ status: 'expired' })
    .eq('invitee_id', inviteeId)
    .eq('status', 'pending');

  const { data, error } = await supabase
    .from('live_invites')
    .insert({
      live_id: liveId,
      host_id: hostId,
      host_name: hostName || 'Ажилтан',
      invitee_id: inviteeId,
      invitee_name: inviteeName || 'Ажилтан',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    if (String(error.message).includes('live_invites')) {
      throw new Error('migration_live_comments_invites.sql ажиллуулна уу');
    }
    throw error;
  }

  const phrase = `таныг ${hostName || 'Ажилтан'} live-д урьж байна`;
  try {
    await notifyApi.notifyUsers([inviteeId], {
      title: 'Live урилга',
      body: phrase,
      data: {
        type: 'live_invite',
        liveId: String(liveId),
        inviteId: String(data.id),
        hostName: String(hostName || 'Ажилтан'),
        hostId: String(hostId || ''),
      },
      channelId: CALLS_CHANNEL,
      priority: 'high',
    });
  } catch (e) {}

  return data;
}

export async function respondLiveInvite(inviteId, status) {
  const { data, error } = await supabase
    .from('live_invites')
    .update({ status })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeLiveInvites(userId, onInvite) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`live-invites-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'live_invites',
        filter: `invitee_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new?.status === 'pending') onInvite?.(payload.new);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
