import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, History, MessageSquareText, Send, XCircle } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Textarea } from '../components/ui';
import { supabase } from '../lib/supabase';

type SmsRow = {
  id: string;
  phone: string;
  message: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  segments: number | null;
  encoding: string | null;
  error_message: string | null;
  created_at: string;
};

function badge(status: SmsRow['status']) {
  if (status === 'delivered') return <Badge tone="success">Хүрсэн</Badge>;
  if (status === 'sent') return <Badge tone="brand">Provider хүлээн авсан</Badge>;
  if (status === 'failed') return <Badge tone="danger">Алдаа</Badge>;
  return <Badge tone="warning">Илгээж байна</Badge>;
}

export default function OutboundSmsPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<SmsRow[]>([]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('sms_messages')
      .select('id, phone, message, status, segments, encoding, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setHistory((data || []) as SmsRow[]);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Админ эрхээр дахин нэвтэрнэ үү.');
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ phone, message, consentConfirmed: consent }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || `Алдаа (${response.status})`);
      if (result.mocked) throw new Error('Mock provider ажилласан тул бодит SMS илгээгдээгүй.');
      setSuccess(`${phone} дугаарын SMS-ийг provider амжилттай хүлээн авлаа.`);
      setMessage('');
      setConsent(false);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SMS илгээж чадсангүй.');
      await loadHistory();
    } finally {
      setSending(false);
    }
  };

  const charCount = Array.from(message).length;
  const messageLimit = /^[\x20-\x7E]*$/.test(message) ? 159 : 70;

  return (
    <>
      <PageHeader title="SMS илгээх" crumb="Дотоод · sendsms.mn" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.9fr)]">
        <Card title="Шууд мессеж" icon={<MessageSquareText size={17} />}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[12px] font-semibold text-muted">Хүлээн авах дугаар</label>
              <Input
                inputMode="tel"
                autoComplete="tel"
                placeholder="83021181 эсвэл +976 83021181"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={sending}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-[12px] font-semibold text-muted">Мессеж</label>
                <span className={`text-[11px] ${charCount > messageLimit ? 'text-danger' : 'text-subtle'}`}>
                  {charCount}/{messageLimit}
                </span>
              </div>
              <Textarea
                rows={6}
                maxLength={messageLimit}
                placeholder="Илгээх мессежээ бичнэ үү…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
              />
              <p className="mt-2 text-[11px] leading-5 text-subtle">
                sendsms.mn: латин/ASCII 159, кирилл/Unicode мессеж 70 хүртэл тэмдэгттэй байна.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card2 p-4">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-[12px] leading-5 text-muted">
                Энэ дугаар SMS хүлээн авах зөвшөөрөлтэй бөгөөд мессеж илгээхэд байгууллагын багцаас төлбөр хасагдахыг баталгаажуулж байна.
              </span>
            </label>
            {error ? (
              <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-[12px] text-danger">
                <XCircle size={16} className="shrink-0" /> {error}
              </div>
            ) : null}
            {success ? (
              <div className="flex gap-2 rounded-xl bg-success-soft p-3 text-[12px] text-success">
                <CheckCircle2 size={16} className="shrink-0" /> {success}
              </div>
            ) : null}
            <Button
              onClick={send}
              disabled={sending || !phone.trim() || !message.trim() || !consent || charCount > messageLimit}
              icon={<Send size={15} />}
            >
              {sending ? 'Илгээж байна…' : 'SMS шууд илгээх'}
            </Button>
          </div>
        </Card>

        <Card title="Илгээлтийн түүх" icon={<History size={17} />} bodyClassName="p-0">
          {history.length === 0 ? <EmptyState text="SMS илгээлтийн түүх алга." /> : (
            <ul className="max-h-[660px] divide-y divide-line overflow-y-auto">
              {history.map((row) => (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[13px] font-semibold text-ink">{row.phone}</p>
                      <p className="mt-1 text-[11px] text-subtle">
                        {new Intl.DateTimeFormat('mn-MN', {
                          timeZone: 'Asia/Ulaanbaatar', dateStyle: 'medium', timeStyle: 'short',
                        }).format(new Date(row.created_at))}
                      </p>
                    </div>
                    {badge(row.status)}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[12px] leading-5 text-muted">{row.message}</p>
                  {row.error_message ? <p className="mt-2 text-[11px] text-danger">{row.error_message}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
