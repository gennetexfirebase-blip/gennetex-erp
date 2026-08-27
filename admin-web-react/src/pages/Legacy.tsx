import { ExternalLink, LayoutGrid } from 'lucide-react';
import { PageHeader, Card, Button } from '../components/ui';

const LEGACY_URL = '/gennetex/admin-legacy/';

/** Хуучин панелд үлдсэн модулиуд — шинэ панел руу шилжүүлэх хүртэл. */
const MODULES = [
  'Агуулах, бараа материал',
  'Багаж хэрэгсэл, олголт',
  'Үйлчилгээний дуудлага',
  'Аялал, тээвэр',
  'Түлш, шатахуун',
  'Санал хүсэлт, гомдол',
  'Ажлын байрны анкет',
  'Гэрээ',
  'Хэрэглэгчийн эрх',
];

export default function LegacyPage() {
  return (
    <>
      <PageHeader
        title="Хуучин панел"
        crumb="Хуучин панел"
        actions={
          <Button
            icon={<ExternalLink size={15} />}
            onClick={() => window.open(LEGACY_URL, '_blank', 'noopener')}
          >
            Шинэ цонхонд нээх
          </Button>
        }
      />

      <Card title="Энд байгаа модулиуд" icon={<LayoutGrid size={17} />}>
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          Доорх модулиуд хуучин панел дээр бүрэн ажиллаж байгаа бөгөөд шинэ
          загварт хараахан шилжүүлээгүй байна. Ажил зогсохгүйн тулд тэндээс
          үргэлжлүүлэн ашиглана уу — өгөгдөл нь ижил, нэг л сан.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li
              key={m}
              className="rounded-[var(--radius-sm)] border border-line bg-card2 px-3 py-2.5 text-[13px] text-ink"
            >
              {m}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-5 overflow-hidden rounded-[var(--radius)] border border-line">
        <iframe
          title="Хуучин админ панел"
          src={LEGACY_URL}
          className="h-[70vh] w-full border-0 bg-white"
        />
      </div>
    </>
  );
}
