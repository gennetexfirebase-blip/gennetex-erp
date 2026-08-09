/** Жишээ/туршилтын нэрс — UI болон локал кэшээс шүүх */
export const SAMPLE_NAMES = ['Бат-Эрдэнэ', 'Бат Эрдэнэ', 'Оюунчимэг', 'Ганбаатар'];

const SAMPLE_NAME_SET = new Set(SAMPLE_NAMES);

export function isSampleName(name) {
  return SAMPLE_NAME_SET.has(String(name || '').trim());
}

export function withoutSampleByName(items, field = 'name') {
  return (items || []).filter((it) => !isSampleName(it[field]));
}

export function withoutSampleCalls(calls) {
  return (calls || []).filter((c) => !isSampleName(c.customer) && !isSampleName(c.engineer));
}

export function withoutSampleVisits(visits) {
  return (visits || []).filter((v) => !isSampleName(v.customer) && !isSampleName(v.user_name));
}
