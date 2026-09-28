import { FormEvent, useState } from 'react';
import { BellRing, CheckCircle2, History, RotateCw, Send } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui';
import {
  fetchNotificationCampaigns,
  sendNotificationToAll,
  useAsync,
  type NotificationCampaign,
  type PushDelivery,
} from '../lib/data';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'default' | 'high'>('default');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<PushDelivery | null>(null);
  const { data, loading, error, reload } = useAsync(
    () => fetchNotificationCampaigns(50),
    [],
    [] as NotificationCampaign[]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setSendError('Гарчиг болон мэдэгдлийн текстийг оруулна уу.');
      return;
    }
    if (!window.confirm('Энэ push мэдэгдлийг бүх ажилтанд илгээх үү?')) return;

    setSending(true);
    setSendError(null);
    setDelivery(null);
    try {
      const result = await sendNotificationToAll({
        title: cleanTitle,
        body: cleanBody,
        priority,
      });
      setDelivery(result.delivery);
      setTitle('');
      setBody('');
      await reload();
    } catch (sendFailure) {
      setSendError((sendFailure as Error)?.message || 'Мэдэгдэл илгээж чадсангүй.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Мэдэгдэл илгээх"
        crumb="Дотоод харилцаа"
        actions={
          <Button variant="outline" icon={<RotateCw size={15} />} onClick={reload}>
            Түүх шинэчлэх
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card title="Бүх ажилтанд push илгээх" icon={<BellRing size={17} />}>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="push-title">
                Гарчиг
              </label>
              <Input
                id="push-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                placeholder="Жишээ: Өнөөдрийн мэдээлэл"
                disabled={sending}
              />
              <p className="mt-1 text-right text-[11px] text-subtle">{title.length}/160</p>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="push-body">
                Мэдэгдлийн текст
              </label>
              <Textarea
                id="push-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={1000}
                rows={7}
                placeholder="Ажилтнуудад хүргэх мэдээллээ бичнэ үү."
                disabled={sending}
              />
              <p className="mt-1 text-right text-[11px] text-subtle">{body.length}/1000</p>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="push-priority">
                Ач холбогдол
              </label>
              <Select
                id="push-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as 'default' | 'high')}
                className="w-full"
                disabled={sending}
              >
                <option value="default">Энгийн</option>
                <option value="high">Яаралтай</option>
              </Select>
            </div>

            <div className="rounded-[var(--radius-sm)] bg-brand-soft px-4 py-3 text-[12px] leading-5 text-brand">
              Мэдэгдэл бүх бүртгэлтэй ажилтны “Мэдэгдэл” хэсэгт хадгалагдаж, push зөвшөөрөлтэй төхөөрөмжүүдэд шууд хүрнэ.
            </div>

            {sendError ? <ErrorState text={sendError} /> : null}
            {delivery ? (
              <div className="rounded-[var(--radius-sm)] border border-success/25 bg-success-soft px-4 py-3 text-[13px] text-success">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} /> Амжилттай илгээгдлээ
                </div>
                <p className="mt-1 text-[12px]">
                  {delivery.recipients} хүлээн авагч · {delivery.sent} төхөөрөмжид хүрсэн
                  {delivery.failed ? ` · ${delivery.failed} амжилтгүй` : ''}
                </p>
              </div>
            ) : null}

            <Button
              type="submit"
              icon={<Send size={15} />}
              className="w-full"
              disabled={sending || !title.trim() || !body.trim()}
            >
              {sending ? 'Илгээж байна…' : 'Бүх ажилтанд илгээх'}
            </Button>
          </form>
        </Card>

        <Card title="Илгээсэн мэдэгдлийн түүх" icon={<History size={17} />} bodyClassName="p-0">
          {loading ? (
            <Loading />
          ) : error ? (
            <div className="p-5"><ErrorState text={error} onRetry={reload} /></div>
          ) : data.length === 0 ? (
            <EmptyState text="Илгээсэн мэдэгдэл одоогоор алга." />
          ) : (
            <div className="divide-y divide-line">
              {data.map((campaign) => (
                <article key={campaign.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{campaign.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-muted">{campaign.body}</p>
                    </div>
                    <Badge tone={campaign.priority === 'high' ? 'danger' : 'brand'}>
                      {campaign.priority === 'high' ? 'Яаралтай' : 'Бүх ажилтан'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle">
                    <span>{formatDate(campaign.created_at)}</span>
                    <span>{campaign.sent_by_name || 'Админ'}</span>
                    {campaign.recipient_count > 0 ? <span>{campaign.recipient_count} хүлээн авагч</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
