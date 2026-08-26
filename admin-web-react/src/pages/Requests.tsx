import { useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import {
  PageHeader,
  Card,
  Button,
  Select,
  Avatar,
  EmptyState,
  Loading,
  ErrorState,
  Badge,
} from '../components/ui';
import { fetchAttendanceRequests, decideAttendanceRequest, useAsync } from '../lib/data';

const TYPE_LABEL: Record<string, string> = {
  remote_check_in: 'Зайнаас цаг бүртгүүлэх (Ирэх)',
  remote_check_out: 'Зайнаас цаг бүртгүүлэх (Явах)',
  makeup_check_in: 'Ирсэн цаг нөхөж бүртгүүлэх',
  makeup_check_out: 'Явсан цаг нөхөж бүртгүүлэх',
  attendance_correction: 'Ирц засуулах',
  late_explanation: 'Хоцролт тайлбарлах',
  business_trip: 'Томилолт',
  remote_work: 'Зайнаас ажиллах',
  telecommute: 'Цахимаар ажиллах',
};

const STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'Хүлээгдэж буй', tone: 'warning' },
  approved: { label: 'Зөвшөөрсөн', tone: 'success' },
  rejected: { label: 'Татгалзсан', tone: 'danger' },
  cancelled: { label: 'Цуцалсан', tone: 'neutral' },
};

export default function RequestsPage() {
  const [status, setStatus] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: rows, loading, error, reload } = useAsync<any[]>(
    () => fetchAttendanceRequests(status),
    [status],
    []
  );

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    let reason: string | null = null;
    if (decision === 'rejected') {
      reason = window.prompt('Татгалзах шалтгаан (заавал биш):') ?? null;
    }
    setBusyId(id);
    try {
      await decideAttendanceRequest(id, decision, reason);
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Цагийн хүсэлт"
        crumb="Цагийн хүсэлт"
        actions={
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Хүлээгдэж буй</option>
            <option value="all">Бүгд</option>
            <option value="approved">Зөвшөөрсөн</option>
            <option value="rejected">Татгалзсан</option>
          </Select>
        }
      />

      <Card title="Хүсэлтүүд" icon={<Clock size={17} />} bodyClassName="p-0">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorState text={error} onRetry={reload} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState text="Хүлээгдэж буй хүсэлт байхгүй." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-subtle">
                  <th className="px-4 py-3 font-semibold">Ажилтан</th>
                  <th className="px-4 py-3 font-semibold">Хүсэлтийн төрөл</th>
                  <th className="px-4 py-3 font-semibold">Огноо</th>
                  <th className="px-4 py-3 font-semibold">Тайлбар</th>
                  <th className="px-4 py-3 font-semibold">Төлөв</th>
                  <th className="px-4 py-3 font-semibold">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line text-[13px] hover:bg-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.employee_name} size={30} />
                        <span className="font-medium text-ink">{r.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{TYPE_LABEL[r.type] || r.type}</td>
                    <td className="px-4 py-3 text-muted">
                      {r.requested_date}
                      {r.requested_time ? ` ${r.requested_time}` : ''}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted">{r.reason || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[r.status]?.tone || 'neutral'}>
                        {STATUS[r.status]?.label || r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <Button
                            variant="success"
                            className="!px-2.5 !py-1.5"
                            disabled={busyId === r.id}
                            onClick={() => decide(r.id, 'approved')}
                            icon={<Check size={14} />}
                          >
                            Зөвшөөрөх
                          </Button>
                          <Button
                            variant="danger"
                            className="!px-2.5 !py-1.5"
                            disabled={busyId === r.id}
                            onClick={() => decide(r.id, 'rejected')}
                            icon={<X size={14} />}
                          >
                            Татгалзах
                          </Button>
                        </div>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
