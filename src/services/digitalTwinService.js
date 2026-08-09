/**
 * Field work digital twin — call close бүрийн түүх → PDF/report payload.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';
import { workflowProgress } from '../lib/callWorkflow';
import { computeCallCost } from './callCostService';
import { callDisplayId } from '../lib/callSla';

export function buildDigitalTwin(call, { catalogItems = [], trackingPoints = [] } = {}) {
  if (!isFlagOn('digitalTwin')) return null;
  const wf = workflowProgress(call);
  const cost = computeCallCost(call, { catalogItems });
  const meta = call?.close_meta || {};
  const photos = meta.photos || meta.workflow?.photos || [];
  const materials = meta.materials || [];

  return {
    id: call?.id,
    displayId: callDisplayId(call),
    customer: call?.customer,
    phone: call?.phone,
    address: call?.address,
    problem: call?.problem,
    type: call?.type || call?.call_type,
    engineer: call?.engineer || call?.engineer_name,
    status: call?.status,
    created_at: call?.created_at,
    closed_at: call?.status === 'Дууссан' ? call?.updated_at : null,
    workflow: wf,
    materials,
    photos,
    gpsPath: trackingPoints,
    cost,
    signature: meta.signature || null,
    closeType: meta.close_type || meta.closeType || null,
    site_kind: call?.site_kind,
    summaryText: [
      `Дуудлага: ${callDisplayId(call)}`,
      `Харилцагч: ${call?.customer || '—'}`,
      `Хаяг: ${call?.address || '—'}`,
      `Инженер: ${call?.engineer || call?.engineer_name || '—'}`,
      `Төлөв: ${call?.status || '—'}`,
      `Workflow: ${wf.percent}%`,
      `Материал өртөг: ${cost.materialCost}₮`,
      `Шатахуун: ${cost.fuelCost}₮`,
      `Нийт: ${cost.totalCost}₮`,
    ].join('\n'),
  };
}

export async function fetchCallDigitalTwin(callId) {
  if (!supabase || !callId) return null;
  const { data, error } = await supabase.from('service_calls').select('*').eq('id', callId).single();
  if (error) throw error;
  const call = {
    id: data.id,
    customer: data.customer,
    phone: data.phone,
    address: data.address,
    problem: data.problem,
    type: data.call_type,
    engineer: data.engineer_name,
    engineer_id: data.engineer_id,
    status: data.status,
    close_meta: data.close_meta,
    created_at: data.created_at,
    updated_at: data.updated_at,
    site_kind: data.site_kind,
    latitude: data.latitude,
    longitude: data.longitude,
  };
  let catalog = [];
  try {
    const { data: inv } = await supabase.from('inventory').select('id, name, price, unit');
    catalog = inv || [];
  } catch {}
  return buildDigitalTwin(call, { catalogItems: catalog });
}

export function twinToHtml(twin) {
  if (!twin) return '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${twin.displayId}</title>
  <style>body{font-family:sans-serif;padding:24px;color:#0f172a}h1{font-size:20px}
  .muted{color:#64748b}table{border-collapse:collapse;width:100%;margin-top:12px}
  td,th{border:1px solid #e2e8f0;padding:8px;text-align:left}pre{background:#f8fafc;padding:12px;border-radius:8px}</style>
  </head><body>
  <h1>Gennetex — Ажлын түүх ${twin.displayId}</h1>
  <p class="muted">${twin.customer || ''} · ${twin.address || ''}</p>
  <pre>${twin.summaryText || ''}</pre>
  <h2>Материал</h2>
  <table><tr><th>Нэр</th><th>Тоо</th></tr>
  ${(twin.materials || []).map((m) => `<tr><td>${m.name || m.item_name || ''}</td><td>${m.qty || m.quantity || 0}</td></tr>`).join('')}
  </table>
  <p class="muted">Workflow ${twin.workflow?.percent || 0}%</p>
  </body></html>`;
}
