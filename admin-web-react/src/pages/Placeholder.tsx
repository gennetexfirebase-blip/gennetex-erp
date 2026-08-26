import { PageHeader, Card, EmptyState } from '../components/ui';

/**
 * Хараахан хэрэгжүүлээгүй хуудсуудын нийтлэг хувилбар.
 *
 * ⚠️ ЗОРИУД хуурамч (mock) тоо ХАРУУЛАХГҮЙ — тоо харагдвал ажилладаг мэт
 * ойлгогдож, дараа нь бодит өгөгдөлтэй зөрөх эрсдэлтэй. Оронд нь route,
 * layout, гарчиг нь бэлэн байгааг харуулж, агуулгыг нь дараа бодит
 * өгөгдлөөр дүүргэнэ.
 */
export default function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <PageHeader title={title} crumb={title} />
      <Card title={title}>
        <EmptyState text={note || `"${title}" хэсэг бэлтгэгдэж байна.`} />
      </Card>
    </>
  );
}
