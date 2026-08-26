import { useState } from 'react';
import { MapPin, Search, Radius } from 'lucide-react';
import { PageHeader, Card, Input, EmptyState, Loading, ErrorState } from '../components/ui';
import { fetchAttendanceLocations, useAsync } from '../lib/data';

type Loc = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
};

export default function LocationsPage() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Loc | null>(null);
  const { data: locations, loading, error, reload } = useAsync<Loc[]>(
    fetchAttendanceLocations as any,
    [],
    []
  );

  const filtered = locations.filter((l) =>
    query ? l.name.toLowerCase().includes(query.toLowerCase()) : true
  );
  const active = selected || filtered[0] || null;

  return (
    <>
      <PageHeader title="Байршил" crumb="Байршил" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        {/* Зүүн — жагсаалт */}
        <Card title="Байршлууд" icon={<MapPin size={17} />} bodyClassName="p-0">
          <div className="border-b border-line p-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <Input
                placeholder="Байршил хайх"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <Loading />
          ) : error ? (
            <div className="p-4">
              <ErrorState text={error} onRetry={reload} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState text="Байршил бүртгэгдээгүй байна." />
          ) : (
            <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setSelected(l)}
                    className={`w-full px-4 py-3.5 text-left transition ${
                      active?.id === l.id ? 'bg-brand-soft' : 'hover:bg-hover'
                    }`}
                  >
                    <p
                      className={`text-[14px] font-semibold ${
                        active?.id === l.id ? 'text-brand' : 'text-ink'
                      }`}
                    >
                      {l.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                      <Radius size={12} /> Радиус: {l.radius_m}м
                    </p>
                    <p className="mt-0.5 text-[11px] text-subtle">
                      {Number(l.latitude).toFixed(5)}, {Number(l.longitude).toFixed(5)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Баруун — газрын зураг */}
        <Card title={active ? active.name : 'Газрын зураг'} icon={<MapPin size={17} />} bodyClassName="p-0">
          {active ? (
            <iframe
              title="map"
              className="h-[560px] w-full rounded-b-[var(--radius)] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                active.longitude - 0.006
              }%2C${active.latitude - 0.004}%2C${active.longitude + 0.006}%2C${
                active.latitude + 0.004
              }&layer=mapnik&marker=${active.latitude}%2C${active.longitude}`}
            />
          ) : (
            <EmptyState text="Байршил сонгоно уу." />
          )}
        </Card>
      </div>
    </>
  );
}
