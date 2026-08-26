// "Цагийн хүсэлт" (attendance_requests) төрлүүдийн статик каталог.
//
// Хүснэгт биш энгийн массив байгаагийн шалтгаан: эдгээр төрлийг админ UI-аас
// нэмэх/засах шаардлага одоогоор алга (зөвхөн хөгжүүлэгч код өөрчлөхөд
// нэмэгддэг), тиймээс тусдаа lookup table нь илүүц abstraction болно.
// `key` утга бүр Supabase-ийн `attendance_requests.type` CHECK-тэй яг тохирно
// (supabase/migrations/20260826120000_attendance_requests.sql).
export const ATTENDANCE_REQUEST_CATEGORIES = {
  remote: 'Сүүлд илгээсэн',
  overtime_rest: 'Илүү цагийн амралт',
  worked: 'Ажилласан',
};

export const ATTENDANCE_REQUEST_TYPES = [
  {
    key: 'remote_check_in',
    label: 'Зайнаас цаг бүртгүүлэх (Ирэх)',
    category: 'remote',
    needsTimeRange: false,
    needsAttachment: false,
  },
  {
    key: 'remote_check_out',
    label: 'Зайнаас цаг бүртгүүлэх (Явах)',
    category: 'remote',
    needsTimeRange: false,
    needsAttachment: false,
  },
  {
    key: 'makeup_check_in',
    label: 'Ирсэн цаг нөхөж бүртгүүлэх',
    category: 'remote',
    needsTimeRange: true,
    needsAttachment: false,
  },
  {
    key: 'makeup_check_out',
    label: 'Явсан цаг нөхөж бүртгүүлэх',
    category: 'remote',
    needsTimeRange: true,
    needsAttachment: false,
  },
  {
    key: 'attendance_correction',
    label: 'Ирц засуулах',
    category: 'remote',
    needsTimeRange: true,
    needsAttachment: true,
    // Аль цагийг (ирсэн/явсан) засахыг заавал сонгуулна — эс бөгөөс
    // зөвшөөрөх үед аль мөрийг засахыг backend мэдэхгүй.
    needsDirection: true,
  },
  {
    key: 'late_explanation',
    label: 'Хоцролт тайлбарлах',
    category: 'remote',
    needsTimeRange: false,
    needsAttachment: false,
  },
  {
    key: 'business_trip',
    label: 'Томилолт',
    category: 'worked',
    needsTimeRange: false,
    needsAttachment: false,
  },
  {
    key: 'remote_work',
    label: 'Зайнаас ажиллах',
    category: 'worked',
    needsTimeRange: false,
    needsAttachment: false,
  },
  {
    key: 'telecommute',
    label: 'Цахимаар ажиллах',
    category: 'worked',
    needsTimeRange: false,
    needsAttachment: false,
  },
];

export function attendanceRequestTypeLabel(key) {
  return ATTENDANCE_REQUEST_TYPES.find((t) => t.key === key)?.label || key || '—';
}

export function attendanceRequestTypeMeta(key) {
  return ATTENDANCE_REQUEST_TYPES.find((t) => t.key === key) || null;
}

export const ATTENDANCE_REQUEST_STATUSES = {
  pending: 'Хүлээгдэж буй',
  approved: 'Зөвшөөрсөн',
  rejected: 'Татгалзсан',
  cancelled: 'Цуцалсан',
};

export function attendanceRequestStatusLabel(status) {
  return ATTENDANCE_REQUEST_STATUSES[status] || status || '—';
}
