import { useMemo, useState } from 'react';
import { AlertTriangle, BellRing, RotateCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, PageHeader, StatCard } from '../components/ui';
import { fetchOperationalAlerts, useAsync, type OperationalAlert } from '../lib/data';

const TYPE_LABEL: Record<OperationalAlert['alert_type'], string> = {
  low_stock: 'Агуулах',
  training: 'Сургалт',
  vehicle_inspection: 'Техникийн үзлэг',
  vehicle_insurance: 'Даатгал',
};

export default function OperationalAlertsPage() {
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning'>('all');
  const { data, loading, error, reload } = useAsync(fetchOperationalAlerts, [], [] as OperationalAlert[]);
  const danger = data.filter((item) => item.severity === 'danger').length;
  const visible = useMemo(
    () => filter === 'all' ? data : data.filter((item) => item.severity === filter),
    [data, filter]
  );
  const totalValue = loading ? '…' : error ? '—' : data.length;
  const dangerValue = loading ? '…' : error ? '—' : danger;
  const warningValue = loading ? '…' : error ? '—' : Math.max(0, data.length - danger);

  return (
    <>
      <PageHeader
        title="Анхааруулгын төв"
        crumb="Өдөр тутмын хяналт"
        actions={<Button variant="outline" icon={<RotateCw size={15} />} onClick={reload}>Шинэчлэх</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Нийт" value={totalValue} note="Анхаарах бүх зүйл" />
        <StatCard label="Яаралтай" value={dangerValue} note="Хэтэрсэн эсвэл өнөөдөр дуусах" />
        <StatCard label="Урьдчилан сануулах" value={warningValue} note="Тохируулсан хугацаанд багтсан" />
      </div>
      <Card
        title="Нэгдсэн жагсаалт"
        icon={<BellRing size={17} />}
        actions={
          <div className="flex gap-1.5">
            {(['all', 'danger', 'warning'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`focus-ring rounded-full px-3 py-1.5 text-[12px] font-semibold ${filter === key ? 'bg-brand-soft text-brand' : 'bg-card2 text-muted'}`}
              >
                {key === 'all' ? 'Бүгд' : key === 'danger' ? 'Яаралтай' : 'Сануулах'}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        {loading ? <Loading /> : error ? (
          <div className="p-5"><ErrorState text={error} onRetry={reload} /></div>
        ) : visible.length === 0 ? <EmptyState text="Одоогоор анхаарах зүйл алга." /> : (
          <div className="divide-y divide-line">
            {visible.map((item) => (
              <div key={`${item.alert_type}:${item.entity_id}:${item.due_date || ''}`} className="flex items-start gap-3 px-5 py-4">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.severity === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>
                  <AlertTriangle size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{item.title}</p>
                    <Badge tone={item.severity}>{TYPE_LABEL[item.alert_type]}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{item.detail}</p>
                  {item.days_remaining != null ? (
                    <p className={`mt-1.5 text-[12px] font-semibold ${item.severity === 'danger' ? 'text-danger' : 'text-warning'}`}>
                      {item.days_remaining < 0 ? `${Math.abs(item.days_remaining)} хоног хэтэрсэн` : item.days_remaining === 0 ? 'Өнөөдөр дуусна' : `${item.days_remaining} хоног үлдсэн`}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
