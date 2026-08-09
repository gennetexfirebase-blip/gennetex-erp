/**
 * Дуудлагын бүрэн workflow — алхам бүр.
 * Strict mode (feature flag) үед хаахын өмнө бүх required алхмыг шалгана.
 */

export const WORKFLOW_STEPS = [
  { key: 'assigned', label: 'Оноогдсон', required: true },
  { key: 'accepted', label: 'Зөвшөөрсөн', required: true },
  { key: 'en_route', label: 'Замд гарсан', required: false },
  { key: 'on_site', label: 'Айл дээр (GPS)', required: false },
  { key: 'work_photos', label: 'Ажлын зураг', required: false },
  { key: 'materials', label: 'Бараа бүртгэл', required: false },
  { key: 'customer_informed', label: 'Харилцагчид мэдэгдсэн', required: true },
  { key: 'program_done', label: 'Програм/тест хийсэн', required: true },
  { key: 'signature', label: 'Гарын үсэг', required: false },
  { key: 'closed', label: 'Хаасан', required: true },
];

export function getWorkflowFromCall(call) {
  const meta = call?.close_meta || {};
  const wf = meta.workflow || {};
  const status = call?.status || '';

  return {
    assigned: !!(call?.engineer_id || call?.engineer),
    accepted: status === 'Хийгдэж буй' || status === 'Дууссан' || !!wf.accepted_at,
    en_route: !!wf.en_route_at,
    on_site: !!wf.on_site_at || !!meta.site_visit,
    work_photos: !!(wf.photos?.length || meta.photos?.length),
    materials: !!(meta.materials?.length || wf.materials?.length),
    customer_informed: !!meta.customer_informed || !!wf.customer_informed,
    program_done: !!meta.program_done || !!wf.program_done,
    signature: !!(meta.signature || wf.signature),
    closed: status === 'Дууссан',
    raw: wf,
  };
}

export function workflowProgress(call) {
  const state = getWorkflowFromCall(call);
  const total = WORKFLOW_STEPS.length;
  const done = WORKFLOW_STEPS.filter((s) => state[s.key]).length;
  return { done, total, percent: Math.round((done / total) * 100), state };
}

/**
 * Strict close validation
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateCloseWorkflow(call, closePayload = {}, { strict = false } = {}) {
  if (!strict) return { ok: true, missing: [] };
  const missing = [];
  if (!closePayload.programDone && !closePayload.program_done) {
    missing.push('Програм/тест');
  }
  if (!closePayload.customerInformed && !closePayload.customer_informed) {
    missing.push('Харилцагчид мэдэгдсэн');
  }
  if (!closePayload.closeType && !closePayload.close_type) {
    missing.push('Хаах төрөл');
  }
  // Optional but recommended in strict+
  const photos = closePayload.photos || call?.close_meta?.workflow?.photos;
  if (strict && process.env.EXPO_PUBLIC_REQUIRE_CLOSE_PHOTOS === '1') {
    if (!photos?.length) missing.push('Ажлын зураг');
  }
  return { ok: missing.length === 0, missing };
}

export function patchWorkflow(existingMeta, stepKey, extra = {}) {
  const meta = { ...(existingMeta || {}) };
  const workflow = { ...(meta.workflow || {}) };
  const atKey = `${stepKey}_at`;
  workflow[atKey] = new Date().toISOString();
  workflow[stepKey] = true;
  Object.assign(workflow, extra);
  meta.workflow = workflow;
  return meta;
}
