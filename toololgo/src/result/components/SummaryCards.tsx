import { CheckCircle2, Filter, Layers, XCircle } from 'lucide-react';

interface Props {
  total: number;
  present: number;
  missing: number;
  filtered: number;
}

const num = (n: number) => n.toLocaleString('mn-MN');

function Card({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{num(value)}</div>
    </div>
  );
}

export function SummaryCards({ total, present, missing, filtered }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Нийт мөр"
        value={total}
        icon={<Layers size={16} />}
        accent="bg-slate-100 text-slate-600"
      />
      <Card
        label="БАЙНА"
        value={present}
        icon={<CheckCircle2 size={16} />}
        accent="bg-emerald-50 text-emerald-600"
      />
      <Card
        label="БАЙХГҮЙ"
        value={missing}
        icon={<XCircle size={16} />}
        accent="bg-red-50 text-red-600"
      />
      <Card
        label="Шүүгдсэн мөр"
        value={filtered}
        icon={<Filter size={16} />}
        accent="bg-blue-50 text-blue-600"
      />
    </div>
  );
}
