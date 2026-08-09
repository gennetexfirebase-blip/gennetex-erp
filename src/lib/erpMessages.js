/** Хайлт/шүүлтүүрээр олдсонгүй үед харуулах нэгдсэн мессеж */
export const ERP_NOT_FOUND = 'ERP-аас олдсонгүй';

export function searchEmptyText(query, defaultText = ERP_NOT_FOUND) {
  return String(query || '').trim() ? ERP_NOT_FOUND : defaultText;
}
