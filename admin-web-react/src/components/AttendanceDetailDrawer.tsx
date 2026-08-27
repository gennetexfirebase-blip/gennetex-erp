import { useEffect, useState } from 'react';
import { X, MapPin, LogIn, LogOut, ExternalLink } from 'lucide-react';
import { Avatar, Badge, Loading, EmptyState, ErrorState } from './ui';
import { fetchEmployeeDayAttendance } from '../lib/data';
import type { AttendanceRow } from '../lib/data';

type Rec = {
  id: string;
  type: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  distance_m: number | null;
  is_remote: boolean;
  photo_url: string | null;
  note: string | null;
  status: string;
};

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

/** Төлөвийг МОНГОЛООР — түүхий `on_time` гэх утга харуулахгүй. */
const STATUS_LABEL: Record<string, string> = {
  on_time: 'Цагтаа ирсэн',
  late: 'Хоцорсон',
  early_leave: 'Эрт явсан',
  absent: 'Тасалсан',
  leave: 'Чөлөөтэй',
  rest: 'Амралт',
  not_scheduled: 'Хуваарьгүй',
  upcoming: 'Ирээгүй',
};

/**
 * Ажилтны нэг өдрийн ирцийн дэлгэрэнгүй — ХЭЗЭЭ, ХААНААС бүртгүүлснийг
 * газрын зураг дээр харуулна.
 *
 * Газрын зургийг OpenStreetMap-ийн embed-ээр гаргана: түлхүүр (API key)
 * шаардахгүй тул нэмэлт тохиргоогүйгээр шууд ажиллана.
 */
export default function AttendanceDetailDrawer({
  row,
  date,
  onClose,
}: {
  row: AttendanceRow | null;
  date: string;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Rec | null>(null);

  useEffect(() => {
    if (!row) return;
    setLoading(true);
    setError(null);
    setActive(null);
    fetchEmployeeDayAttendance(row.employee_id, date)
      .then((data) => {
        setRecords(data as Rec[]);
        const withGeo = (data as Rec[]).find((r) => r.latitude != null);
        setActive(withGeo || (data as Rec[])[0] || null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [row, date]);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />

      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-app shadow-panel">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Avatar name={row.employee_name} src={row.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink">{row.employee_name}</p>
            <p className="text-[12px] text-subtle">{date}</p>
          </div>
          <Badge
            tone={
              row.status === 'late' || row.status === 'absent'
                ? 'danger'
                : row.status === 'on_time'
                  ? 'success'
                  : 'neutral'
            }
          >
            {STATUS_LABEL[row.status] || row.status}
          </Badge>
          <button
            onClick={onClose}
            className="focus-ring rounded-[var(--radius-sm)] p-2 text-muted hover:bg-hover hover:text-ink"
            aria-label="Хаах"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState text={error} />
          ) : records.length === 0 ? (
            <EmptyState text="Энэ өдөр ирцийн бүртгэл алга." />
          ) : (
            <>
              {/* Бүртгэлийн жагсаалт */}
              {/* Timeline — мөрүүдийг босоо шугамаар холбоно */}
              <div className="mb-5 rounded-[var(--radius)] border border-line bg-card p-4">
                {records.map((r, i) => {
                  const isIn = r.type === 'check_in';
                  const selected = active?.id === r.id;
                  const last = i === records.length - 1;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setActive(r)}
                      className="flex w-full gap-3 text-left"
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                            isIn ? 'bg-success' : 'bg-danger'
                          } ${selected ? 'ring-2 ring-brand ring-offset-2 ring-offset-[var(--bg-card)]' : ''}`}
                        >
                          {isIn ? <LogIn size={15} /> : <LogOut size={15} />}
                        </span>
                        {!last ? <span className="my-1 w-0.5 flex-1 bg-line" /> : null}
                      </div>
                      <div className={`min-w-0 flex-1 ${last ? '' : 'pb-4'}`}>
                        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                          {isIn ? 'Ирсэн' : 'Явсан'}
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${isIn ? 'bg-success' : 'bg-danger'}`}
                          />
                          {hhmm(r.created_at)}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {r.location_name
                            ? r.location_name
                            : r.latitude != null
                              ? `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`
                              : 'Байршил хадгалагдаагүй'}
                          {r.distance_m != null ? ` • ~${r.distance_m}м` : ''}
                          {r.is_remote ? ' • Зайнаас' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Газрын зураг */}
              {active?.latitude != null && active?.longitude != null ? (
                <div className="overflow-hidden rounded-[var(--radius)] border border-line">
                  <div className="flex items-center justify-between border-b border-line bg-card px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                      <MapPin size={14} className="text-brand" />
                      {active.type === 'check_in' ? 'Ирсэн' : 'Явсан'} байршил ·{' '}
                      {hhmm(active.created_at)}
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${active.latitude},${active.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
                    >
                      Google Maps <ExternalLink size={12} />
                    </a>
                  </div>
                  <iframe
                    title="Ирцийн байршил"
                    className="h-[320px] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      Number(active.longitude) - 0.004
                    }%2C${Number(active.latitude) - 0.0025}%2C${
                      Number(active.longitude) + 0.004
                    }%2C${Number(active.latitude) + 0.0025}&layer=mapnik&marker=${
                      active.latitude
                    }%2C${active.longitude}`}
                  />
                </div>
              ) : (
                <EmptyState text="Энэ бүртгэлд байршлын мэдээлэл хадгалагдаагүй байна." />
              )}

              {active?.photo_url ? (
                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-semibold text-muted">Бүртгэлийн зураг</p>
                  <img
                    src={active.photo_url}
                    alt="selfie"
                    className="max-h-[240px] rounded-[var(--radius)] border border-line object-cover"
                  />
                </div>
              ) : null}

              {active?.note ? (
                <p className="mt-4 rounded-[var(--radius-sm)] bg-card2 p-3 text-[12px] text-muted">
                  {active.note}
                </p>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
