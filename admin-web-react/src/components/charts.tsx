import { useState, type ReactNode } from 'react';
import {
  PieChart, Pie, Cell, Sector, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer, type TooltipProps,
} from 'recharts';
import { EmptyState } from './ui';

/*
 * Нийтлэг графикууд — бүх хуудсанд нэг хэв маяг:
 *  • нимгэн тэмдэг, 4px бөөрөнхий үзүүр, сегмент хооронд 2px цагаан зай;
 *  • тор нь 1px, тасархайгүй, бүдэг; тэнхлэгийн шугамгүй;
 *  • текст нь өгөгдлийн өнгө биш, текстийн token-оор;
 *  • hover бүрт карт хэлбэрийн tooltip.
 */

/** Төлөвийн өнгө — зөвхөн төлөв (сайн / анхаар / ноцтой / мэдээлэл / хоосон). */
export const STATUS_COLORS = {
  good: '#16a06e',
  warning: '#e0a018',
  critical: '#e5484d',
  info: '#2f7fd6',
  muted: '#64748b',
  none: '#cbd5e1',
} as const;

export type Slice = { key: string; name: string; value: number; color: string };

function TooltipCard({ title, rows }: { title?: ReactNode; rows: { color: string; name: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="pop-in min-w-[140px] rounded-[12px] border border-line bg-card px-3 py-2.5 text-[12px] shadow-[var(--shadow-pop)]">
      {title ? <p className="mb-1.5 font-semibold text-ink">{title}</p> : null}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
          <span className="text-muted">{r.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);

/**
 * Донат — төвд гол тоо, доор нь хувь бүхий тайлбар.
 * Тайлбар дээр hover хийхэд тухайн сегмент тодорно (мөн эсрэгээрээ).
 */
export function DonutChart({
  slices,
  center,
  sub,
  format = (n) => String(n),
}: {
  slices: Slice[];
  center?: ReactNode;
  sub?: string;
  format?: (n: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <EmptyState text="Мэдээлэл алга." />;
  const focus = active !== null ? shown[active] : null;

  return (
    <div>
      <div className="relative mx-auto h-[210px] max-w-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              innerRadius="70%"
              outerRadius="92%"
              paddingAngle={shown.length > 1 ? 2 : 0}
              cornerRadius={4}
              startAngle={90}
              endAngle={-270}
              stroke="var(--bg-card)"
              strokeWidth={2}
              activeIndex={active ?? undefined}
              activeShape={(p: any) => <Sector {...p} outerRadius={p.outerRadius + 5} />}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              isAnimationActive
              animationDuration={600}
            >
              {shown.map((s, i) => (
                <Cell
                  key={s.key}
                  fill={s.color}
                  opacity={active === null || active === i ? 1 : 0.35}
                  style={{ transition: 'opacity 150ms ease', cursor: 'pointer', outline: 'none' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">
            {focus ? format(focus.value) : center ?? format(total)}
          </span>
          <span className="mt-1.5 max-w-[120px] text-[11px] leading-4 text-subtle">
            {focus ? `${focus.name} · ${pct(focus.value, total)}%` : sub}
          </span>
        </div>
      </div>

      {/* Хувиар хуваасан нэг мөр — бүтцийг шууд харуулна */}
      <div className="mt-4 flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
        {shown.map((s) => (
          <span key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>

      <ul className="mt-4 space-y-1">
        {slices.map((s) => {
          const i = shown.indexOf(s);
          return (
            <li
              key={s.key}
              onMouseEnter={() => i >= 0 && setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[12px] transition-colors ${
                active !== null && active === i ? 'bg-hover' : ''
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="text-muted">{s.name}</span>
              <span className="ml-auto font-semibold tabular-nums text-ink">{format(s.value)}</span>
              <span className="w-10 text-right tabular-nums text-subtle">{pct(s.value, total)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Хэвтээ багана — ангилал бүрийн хэмжээ, үзүүрт нь утга. */
export function HBarChart({
  data,
  unit = '',
  color = 'var(--brand)',
  labelWidth = 130,
}: {
  data: { name: string; value: number }[];
  unit?: string;
  color?: string;
  labelWidth?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return <EmptyState text="Мэдээлэл алга." />;
  const height = Math.max(180, data.length * 40 + 24);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
          barCategoryGap={8}
          onMouseMove={(s: any) => setActive(s?.activeTooltipIndex ?? null)}
          onMouseLeave={() => setActive(null)}
        >
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-hover)', radius: 8 } as any}
            content={({ active: on, payload }: TooltipProps<number, string>) =>
              on && payload?.length ? (
                <TooltipCard
                  title={payload[0].payload.name}
                  rows={[{ color, name: 'Тоо', value: `${payload[0].value}${unit ? ` ${unit}` : ''}` }]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} animationDuration={600}>
            {data.map((d, i) => (
              <Cell
                key={d.name}
                fill={color}
                opacity={active === null || active === i ? 1 : 0.45}
                style={{ transition: 'opacity 150ms ease' }}
              />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              style={{ fill: 'var(--text)', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
