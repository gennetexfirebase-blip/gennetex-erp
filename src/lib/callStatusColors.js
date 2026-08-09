import { isCallCancelled, isCallRescheduled } from './callPermissions';

/** UService status өнгө (IMG_7524) */
export const US_GREEN = '#7cb342';
export const US_SELECT_BG = '#eef6e8';

export const STATUS_FILTERS = [
  { key: 'all', label: 'Бүгд', code: 'A', color: US_GREEN, fill: '#f1f8e9' },
  { key: 'cancel', label: 'Татгалзсан', code: 'CA', color: '#e53935', fill: '#ffebee' },
  { key: 'dahimdah', label: 'Дахимдах', code: 'RSC', color: '#fb8c00', fill: '#fff3e0' },
  { key: 'done', label: 'Хийж дуусан', code: 'CL', color: '#424242', fill: '#f5f5f5' },
  { key: 'progress', label: 'Явж байгаа', code: 'IP', color: '#fbc02d', fill: '#fffde7' },
  { key: 'pending', label: 'Хүлээгдэж буй', code: 'Op', color: '#9ccc65', fill: '#f1f8e9' },
];

export const CUSTOMER_FILTERS = [
  { key: 'all', label: 'Бүгд', code: 'A' },
  { key: 'corporate', label: 'Байгууллага', code: 'C' },
  { key: 'consumer', label: 'Айл', code: 'N' },
];

export const ZONE_FILTERS = [
  { key: 'all', label: 'Бүгд', code: 'A' },
  { key: 'B3', label: 'B3', code: 'B3' },
  { key: 'T7', label: 'T7', code: 'T7' },
  { key: 'T6', label: 'T6', code: 'T6' },
  { key: 'T5', label: 'T5', code: 'T5' },
];

export const JOB_TYPE_FILTERS = [
  { key: 'all', label: 'Бүгд', code: 'A', types: null },
  { key: 'complain', label: 'Гомдол', code: 'Cp', types: ['repair', 'gombol', 'other'] },
  { key: 'new', label: 'Шинэ хэрэглэгч', code: 'NC', types: ['new'] },
  { key: 'reinstall', label: 'Дахин суулгалт', code: 'RI', types: ['t30', 't100'] },
  { key: 'addbox', label: 'Нэмэлт хайрцаг', code: 'AB', types: ['other'] },
];

export function getCallStatusKey(call) {
  if (!call) return 'pending';
  if (isCallCancelled(call)) return 'cancel';
  if (isCallRescheduled(call)) return 'dahimdah';
  if (call.status === 'Дууссан') return 'done';
  if (call.status === 'Явж байгаа') return 'progress';
  return 'pending';
}

export function getCallStatusMeta(call) {
  const key = getCallStatusKey(call);
  return STATUS_FILTERS.find((s) => s.key === key) || STATUS_FILTERS[STATUS_FILTERS.length - 1];
}

export function callBadgeColor(call) {
  return getCallStatusMeta(call).color;
}

export function applyCallFilters(list, filters = {}) {
  const f = { customerType: 'all', zone: 'all', status: 'all', jobType: 'all', ...filters };
  return (list || []).filter((c) => {
    if (f.customerType === 'corporate' && (c.site_kind || 'ail') !== 'baiguulga') return false;
    if (f.customerType === 'consumer' && (c.site_kind || 'ail') !== 'ail') return false;
    if (f.zone !== 'all') {
      const hay = `${c.address || ''} ${c.problem || ''} ${c.customer || ''}`.toUpperCase();
      if (!hay.includes(String(f.zone).toUpperCase())) return false;
    }
    if (f.status !== 'all' && getCallStatusKey(c) !== f.status) return false;
    if (f.jobType !== 'all') {
      const jf = JOB_TYPE_FILTERS.find((j) => j.key === f.jobType);
      if (jf?.types && !jf.types.includes(c.type)) return false;
    }
    return true;
  });
}

export function filterLabel(items, key) {
  return items.find((i) => i.key === key)?.label || 'Бүгд';
}

export function filterCode(items, key) {
  return items.find((i) => i.key === key)?.code || 'A';
}

export function callStatusLabelMn(call) {
  const key = getCallStatusKey(call);
  const meta = STATUS_FILTERS.find((s) => s.key === key);
  if (meta && key !== 'all') return meta.label;
  return call?.status || 'Хүлээгдэж буй';
}

export function siteKindSummary(list) {
  const ail = (list || []).filter((c) => (c.site_kind || 'ail') === 'ail').length;
  const bg = (list || []).filter((c) => c.site_kind === 'baiguulga').length;
  const parts = [];
  if (ail) parts.push(`${ail} айл`);
  if (bg) parts.push(`${bg} байгууллага`);
  return parts.join(', ');
}
