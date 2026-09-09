import { ExternalLink } from 'lucide-react';
import { PageHeader, Button } from '../components/ui';

/**
 * Хуучин панелийн нэг модулийг ШИНЭ панел дотор шууд ажиллуулна.
 *
 * Хуучин `admin-web/index.html` нь `?embed=1` үед өөрийн хажуугийн цэс,
 * дээд мөрөө нуудаг тул зөвхөн модулийн агуулга харагдана. `#<view>`
 * hash-аар аль модулийг нээхийг заана.
 *
 * Ингэснээр өмнө нь зөвхөн хуучин панел дээр байсан бүх зүйл (агуулах,
 * дуудлага, аялал, түлш, гэрээ, лог…) шинэ панелийн цэснээс нэг дор
 * гарч ирнэ — өгөгдөл нь ижил, нэг л Supabase сан.
 */
export default function LegacyModule({ view, title }: { view: string; title: string }) {
  const src = `/gennetex/admin-legacy/?embed=1#${view}`;

  return (
    <>
      <PageHeader
        title={title}
        crumb={title}
        actions={
          <Button
            icon={<ExternalLink size={15} />}
            onClick={() => window.open(`/gennetex/admin-legacy/#${view}`, '_blank', 'noopener')}
          >
            Шинэ цонхонд нээх
          </Button>
        }
      />
      <div className="overflow-hidden rounded-[var(--radius)] border border-line">
        <iframe
          key={view}
          title={title}
          src={src}
          className="h-[calc(100vh-190px)] min-h-[520px] w-full border-0 bg-white"
        />
      </div>
    </>
  );
}
