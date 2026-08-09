import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import * as reportApi from './reportService';

const INSTRUCTION_TABLE = 'ohaab_instruction';
const ACK_TABLE = 'ohaab_daily_ack';

/** Өнөөдрийн огноо (Монгол цагийн бүс) */
export function todayAckDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
}

export async function fetchInstruction() {
  const { data, error } = await supabase.from(INSTRUCTION_TABLE).select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return (
    data || {
      id: 1,
      title: 'ХААБ заавар',
      body: '',
      updated_at: null,
      updated_by_name: null,
    }
  );
}

export async function saveInstruction({ title, body, userId, userName }) {
  const payload = {
    id: 1,
    title: (title || 'ХААБ заавар').trim(),
    body: (body || '').trim(),
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
    updated_by_name: userName || null,
  };
  const { data, error } = await supabase.from(INSTRUCTION_TABLE).upsert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function hasTodayAck(userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from(ACK_TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('ack_date', todayAckDate())
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchMyTodayAck(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from(ACK_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('ack_date', todayAckDate())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitDailyAck({ userId, userName, signatureSvg, instructionUpdatedAt }) {
  if (!userId) throw new Error('Нэвтэрнэ үү.');
  if (!signatureSvg?.trim()) throw new Error('Гарын үсэг зурна уу.');

  const ackDate = todayAckDate();
  const path = `${userId}/ohaab-${ackDate}.svg`;
  const signatureUrl = await reportApi.uploadSignatureSvg(signatureSvg, userId, path);

  const { data, error } = await supabase
    .from(ACK_TABLE)
    .upsert(
      {
        user_id: userId,
        user_name: userName || null,
        ack_date: ackDate,
        signature_url: signatureUrl,
        instruction_updated_at: instructionUpdatedAt || null,
        signed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,ack_date' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchTodayAcks(date = todayAckDate()) {
  const { data, error } = await supabase
    .from(ACK_TABLE)
    .select('*')
    .eq('ack_date', date)
    .order('signed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAckHistory({ limit = 60 } = {}) {
  const { data, error } = await supabase
    .from(ACK_TABLE)
    .select('*')
    .order('signed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Бараа/багаж шинээр бүртгэхээс өмнө шалгах */
export async function ensureTodayAck(userId) {
  return hasTodayAck(userId);
}

export function alertOhaabRequired(navigation) {
  Alert.alert(
    'ХААБ заавар шаардлагатай',
    'Өнөөдрийн ХААБ зааврыг бүрэн уншиж, гарын үсгээр баталгаажуулсны дараа бараа материал эсвэл багаж шинээр бүртгэнэ үү.',
    [
      { text: 'Болих', style: 'cancel' },
      { text: 'Заавар унших', onPress: () => navigation?.navigate?.('Ohaab') },
    ]
  );
}
