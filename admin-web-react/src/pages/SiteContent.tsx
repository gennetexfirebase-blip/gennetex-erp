import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { DEFAULT_SITE_CONTENT } from '../../../public-web/src/lib/siteContentDefaults.js';
import { supabase } from '../lib/supabase';
import {
  Button,
  Card,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Textarea,
} from '../components/ui';

/**
 * Public вэбсайтын (gennetex.com) агуулгыг засах хуудас.
 *
 * Талбар бүрийг гараар жагсаахын оронд `DEFAULT_SITE_CONTENT` модны
 * БҮТЦЭЭР явж форм үүсгэнэ. Ингэснээр вэбсайтад шинэ текст нэмэхэд
 * энд ямар ч засвар хийхгүйгээр автоматаар гарч ирнэ.
 *
 * Хадгалахдаа `upsert_public_site_content` RPC-г эхэлж дуудна (хуучин
 * vanilla админ мөн үүнийг ашигладаг); байхгүй бол шууд upsert руу шилжинэ.
 */

type Json = unknown;

const SECTION_LABELS: Record<string, string> = {
  navbar: 'Дээд цэс',
  hero: 'Нүүрний баннер',
  home: 'Нүүр хуудас',
  about: 'Бидний тухай',
  services: 'Үйлчилгээ',
  projects: 'Төслүүд',
  contact: 'Холбоо барих',
  careers: 'Ажлын байр',
  footer: 'Хөл хэсэг',
};

const FIELD_LABELS: Record<string, string> = {
  brand: 'Нэр',
  title: 'Гарчиг',
  title1: 'Гарчиг 1',
  title2: 'Гарчиг 2',
  label: 'Шошго',
  text: 'Текст',
  description: 'Тайлбар',
  intro: 'Оршил',
  value: 'Утга',
  to: 'Холбоос',
  email: 'И-мэйл',
  phone: 'Утас',
  address: 'Хаяг',
  website: 'Вэб',
  copyright: 'Зохиогчийн эрх',
};

const labelFor = (key: string) => FIELD_LABELS[key] ?? key;

/** Урт текстийг textarea, богиныг input болгоно. */
function isLong(key: string, value: string) {
  return value.length > 70 || /text|description|intro|note|tagline/i.test(key);
}

function FieldRow({
  path,
  value,
  onChange,
}: {
  path: string[];
  value: string;
  onChange: (path: string[], next: string) => void;
}) {
  const key = path[path.length - 1];
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-subtle">
        {labelFor(key)}
      </span>
      {isLong(key, value) ? (
        <Textarea rows={3} value={value} onChange={(e) => onChange(path, e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(path, e.target.value)} />
      )}
    </label>
  );
}

/** Обьект/массивыг рекурсээр талбар болгон задлана. */
function Node({
  node,
  path,
  onChange,
  onArrayChange,
}: {
  node: Json;
  path: string[];
  onChange: (path: string[], next: string) => void;
  onArrayChange: (path: string[], next: unknown[]) => void;
}) {
  if (typeof node === 'string') {
    return <FieldRow path={path} value={node} onChange={onChange} />;
  }

  if (Array.isArray(node)) {
    const isStringList = node.every((x) => typeof x === 'string');
    return (
      <div className="rounded-[var(--radius-sm)] border border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-subtle">
            {labelFor(path[path.length - 1])} · {node.length}
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              const blank: unknown = isStringList
                ? ''
                : Object.fromEntries(
                    Object.keys((node[0] as object) ?? { title: '', text: '' }).map((k) => [k, '']),
                  );
              onArrayChange(path, [...node, blank]);
            }}
          >
            + Нэмэх
          </Button>
        </div>
        <div className="grid gap-3">
          {node.map((item, i) => (
            <div key={i} className="relative rounded-[var(--radius-sm)] bg-app p-3">
              <button
                className="absolute right-2 top-2 text-[11px] text-danger"
                onClick={() => onArrayChange(path, node.filter((_, j) => j !== i))}
              >
                Устгах
              </button>
              <div className="grid gap-3 pr-16">
                <Node
                  node={item}
                  path={[...path, String(i)]}
                  onChange={onChange}
                  onArrayChange={onArrayChange}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (node && typeof node === 'object') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(node as Record<string, Json>).map(([key, value]) => {
          const wide = Array.isArray(value) || (!!value && typeof value === 'object');
          return (
            <div key={key} className={wide ? 'md:col-span-2' : ''}>
              <Node
                node={value}
                path={[...path, key]}
                onChange={onChange}
                onArrayChange={onArrayChange}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

/** Замаар нь гүн хуулбарлаж утга солино (массивын индекс мөн дэмжинэ). */
function setIn(obj: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    const i = Number(head);
    copy[i] = setIn(copy[i], rest, value);
    return copy;
  }
  const base = (obj ?? {}) as Record<string, unknown>;
  return { ...base, [head]: setIn(base[head], rest, value) };
}

export default function SiteContentPage() {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('navbar');

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from('public_site_content')
      .select('content, updated_at')
      .eq('id', 'main')
      .maybeSingle();
    if (e) {
      setError(e.message);
      return;
    }
    setContent({ ...DEFAULT_SITE_CONTENT, ...((data?.content as object) ?? {}) });
    setSavedAt((data?.updated_at as string) ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useCallback((path: string[], next: string) => {
    setContent((c) => (c ? (setIn(c, path, next) as Record<string, unknown>) : c));
  }, []);

  const changeArray = useCallback((path: string[], next: unknown[]) => {
    setContent((c) => (c ? (setIn(c, path, next) as Record<string, unknown>) : c));
  }, []);

  const save = async () => {
    if (!content) return;
    setSaving(true);
    setError(null);
    try {
      const rpc = await supabase.rpc('upsert_public_site_content', { p_content: content });
      if (rpc.error) {
        const up = await supabase
          .from('public_site_content')
          .upsert({ id: 'main', content }, { onConflict: 'id' })
          .select('updated_at')
          .maybeSingle();
        if (up.error) throw up.error;
        setSavedAt((up.data?.updated_at as string) ?? new Date().toISOString());
      } else {
        setSavedAt(new Date().toISOString());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sections = useMemo(() => (content ? Object.keys(content) : []), [content]);

  if (error && !content) return <ErrorState text={error} onRetry={() => void load()} />;
  if (!content) return <Loading text="Вэбсайтын агуулга ачаалж байна…" />;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Вэбсайтын агуулга"
        crumb="Вэбсайтын агуулга"
        actions={
          <>
            <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => void load()}>
              Сэргээх
            </Button>
            <Button icon={<Save size={15} />} onClick={() => void save()} disabled={saving}>
              {saving ? 'Хадгалж байна…' : 'Хадгалах'}
            </Button>
          </>
        }
      />

      {error ? <ErrorState text={error} /> : null}

      <p className="text-[12px] text-muted">
        {savedAt
          ? `Сүүлд шинэчилсэн: ${new Date(savedAt).toLocaleString('mn-MN')}. `
          : ''}
        Хадгалсны дараа сайт дээр шууд шинэчлэгдэнэ. Хайлтын систем болон холбоос
        хуваалцах үеийн урьдчилсан харагдац дараагийн deploy дээр шинэчлэгдэнэ.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {sections.map((key) => (
          <button
            key={key}
            onClick={() => setOpenSection(key)}
            className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
              openSection === key
                ? 'bg-brand text-white'
                : 'border border-line text-muted hover:text-ink'
            }`}
          >
            {SECTION_LABELS[key] ?? key}
          </button>
        ))}
      </div>

      <Card title={SECTION_LABELS[openSection] ?? openSection}>
        <div className="grid gap-4 p-4">
          <Node
            node={content[openSection]}
            path={[openSection]}
            onChange={change}
            onArrayChange={changeArray}
          />
        </div>
      </Card>
    </div>
  );
}
