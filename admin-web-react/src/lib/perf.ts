import { supabase } from './supabase';

/**
 * Гүйцэтгэл — Google Sheet-ийн ажлууд (perf_jobs), латин нэр → ажилтан (perf_aliases),
 * төрөл бүрийн үнэлгээ (perf_rates). guitsetgel.gennetex.com ба sanhuu-ийн цалинд.
 * Хамт ч, ганцаараа ч хийсэн ажил оролцсон инженер бүрт бүтэн 1 ажил.
 */

export type PerfPerson = {
  user_id: string;
  name: string;
  department: string | null;
  aliases: string[] | null;
  jobs: number;
  days: number;
  cable: number;
  solo: number;
  pair: number;
  kinds: Record<string, number> | null;
  amount: number;
};
export type PerfRate = { kind: string; label: string | null; amount: number };
export type PerfSummary = { people: PerfPerson[]; unmapped: { alias: string; jobs: number }[]; jobs: number; rates: PerfRate[]; last_sync_at: string | null };
export type PerfJob = { id: number; work_date: string; kind: string; engineers: string[]; job_time: string | null; cable: boolean };
export type PerfAlias = { alias: string; user_id: string | null; ignored: boolean };

/** Төрлийн монгол нэр. */
export const KIND_LABEL: Record<string, string> = {
  complain: 'Гомдол',
  'new customer': 'Шинэ хэрэглэгч',
  reinstallation: 'Дахин суурилуулалт',
  'add additional box': 'Нэмэлт бокс',
  cable: 'Кабель татсан (нэмэгдэл)',
};
export const kindLabel = (k: string) => KIND_LABEL[k] || k;

const err = (e: { message: string } | null) => {
  if (!e) return;
  if (/forbidden|permission denied/.test(e.message)) throw new Error('Зөвхөн админ.');
  if (/does not exist|Could not find/.test(e.message)) throw new Error('Гүйцэтгэлийн хүснэгт серверт хараахан үүсээгүй (migration).');
  throw new Error(e.message);
};

export async function fetchPerfSummary(from: string, to: string): Promise<PerfSummary> {
  const { data, error } = await supabase.rpc('perf_summary', { p_from: from, p_to: to });
  err(error);
  const d = data as PerfSummary;
  return { ...d, people: (d.people || []).map((p) => ({ ...p, amount: Number(p.amount) || 0 })), rates: (d.rates || []).map((r) => ({ ...r, amount: Number(r.amount) || 0 })) };
}

export async function fetchPerfJobs(from: string, to: string): Promise<PerfJob[]> {
  const { data, error } = await supabase.from('perf_jobs').select('id, work_date, kind, engineers, job_time, cable').gte('work_date', from).lte('work_date', to).order('work_date').limit(20000);
  err(error);
  return (data || []) as PerfJob[];
}

export async function fetchAliases(): Promise<PerfAlias[]> {
  const { data, error } = await supabase.from('perf_aliases').select('alias, user_id, ignored').order('alias');
  err(error);
  return (data || []) as PerfAlias[];
}

export async function setAlias(alias: string, userId: string | null, ignored = false) {
  const { error } = await supabase.from('perf_aliases').upsert({ alias, user_id: userId, ignored, updated_at: new Date().toISOString() });
  err(error);
}

export async function setRate(kind: string, amount: number) {
  const { error } = await supabase.from('perf_rates').update({ amount, updated_at: new Date().toISOString() }).eq('kind', kind);
  err(error);
}

/** Google Sheet-ийг дахин татна (edge function perf-sync). */
export async function syncSheet(): Promise<{ rows: number; from: string | null; to: string | null }> {
  const { data, error } = await supabase.functions.invoke('perf-sync', { body: {} });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return data;
}
