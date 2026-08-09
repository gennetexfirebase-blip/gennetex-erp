import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

const TABLE = 'call_sessions';

// Дуудлага эхлүүлэх (ringing) — нөгөө хэрэглэгч рүү дохио явна
export async function startCall({ room, caller, callee }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      room,
      caller_id: caller.id,
      caller_name: caller.name,
      callee_id: callee.id,
      callee_name: callee.name,
      status: 'ringing',
    })
    .select()
    .single();
  if (error) throw error;
  try {
    await notifyApi.notifyIncomingCall(callee.id, {
      callerName: caller.name,
      room,
      callId: data.id,
    });
  } catch (e) {}
  return data;
}

export async function setCallStatus(id, status) {
  const { error } = await supabase.from(TABLE).update({ status }).eq('id', id);
  if (error) throw error;
}

// Над руу ирж буй дуудлагыг real-time сонсох
export function subscribeIncomingCalls(userId, onCall) {
  const channel = supabase
    .channel(`calls-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `callee_id=eq.${userId}` },
      (payload) => onCall(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Миний эхлүүлсэн дуудлагын төлөв өөрчлөгдөхийг сонсох (хариулсан/татгалзсан)
export function subscribeCallUpdates(callId, onUpdate) {
  const channel = supabase
    .channel(`call-${callId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${callId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
