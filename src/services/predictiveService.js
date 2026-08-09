/**
 * Predictive maintenance — revisit pattern → эрсдэлтэй хаяг.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';

function normalizeKey(call) {
  const phone = String(call.phone || '')
    .replace(/\s+/g, '')
    .slice(-8);
  const addr = String(call.address || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (phone && phone.length >= 6) return `p:${phone}`;
  if (addr.length >= 6) return `a:${addr}`;
  return null;
}

/**
 * @param {Array} calls — historical service calls
 */
export function analyzeRevisitRisk(calls = []) {
  if (!isFlagOn('predictive')) return [];
  const buckets = {};
  (calls || []).forEach((c) => {
    const key = normalizeKey(c);
    if (!key) return;
    if (!buckets[key]) {
      buckets[key] = {
        key,
        phone: c.phone || '',
        address: c.address || '',
        customer: c.customer || '',
        visits: [],
        types: {},
      };
    }
    buckets[key].visits.push({
      id: c.id,
      at: c.created_at || c.updated_at,
      status: c.status,
      type: c.type || c.call_type,
      problem: c.problem,
    });
    const t = c.type || c.call_type || 'other';
    buckets[key].types[t] = (buckets[key].types[t] || 0) + 1;
  });

  return Object.values(buckets)
    .map((b) => {
      b.visits.sort((a, c) => new Date(c.at) - new Date(a.at));
      const count = b.visits.length;
      const last90 = b.visits.filter((v) => {
        const t = new Date(v.at).getTime();
        return Date.now() - t < 90 * 86400000;
      }).length;
      const repairish = b.visits.filter((v) =>
        ['repair', 'gombol', 'засвар'].includes(String(v.type || '').toLowerCase())
      ).length;
      // risk score 0-100
      let risk = Math.min(100, count * 12 + last90 * 18 + repairish * 10);
      if (count >= 3 && last90 >= 2) risk = Math.min(100, risk + 15);
      return {
        ...b,
        visitCount: count,
        last90,
        repairish,
        risk,
        lastVisit: b.visits[0]?.at || null,
        riskLevel: risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low',
      };
    })
    .filter((b) => b.visitCount >= 2)
    .sort((a, b) => b.risk - a.risk);
}

export async function fetchPredictiveSites({ limit = 500 } = {}) {
  if (!supabase || !isFlagOn('predictive')) return [];
  const { data, error } = await supabase
    .from('service_calls')
    .select('id, customer, phone, address, problem, call_type, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const mapped = (data || []).map((r) => ({
    ...r,
    type: r.call_type,
  }));
  return analyzeRevisitRisk(mapped);
}
