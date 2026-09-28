import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Clock3, History, MessageSquareText, Phone, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, PageHeader } from '../components/ui';
import { supabase } from '../lib/supabase';
import {
  getPhoneVerificationStatus,
  startPhoneVerification,
  type VerificationSession,
  type VerificationStatus,
} from '../lib/phoneVerification';

type HistoryRow = {
  id: string;
  phone: string;
  session_status: VerificationStatus;
  created_at: string;
  expires_at: string;
  verified_at: string | null;
};

const statusText: Record<VerificationStatus, string> = {
  PENDING: 'Хүлээж байна',
  VERIFIED: 'Баталгаажсан',
  EXPIRED: 'Хугацаа дууссан',
};

function statusTone(status: VerificationStatus): 'warning' | 'success' | 'danger' {
  if (status === 'VERIFIED') return 'success';
  if (status === 'EXPIRED') return 'danger';
  return 'warning';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function PhoneVerificationPage() {
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('phone_verification_sessions')
      .select('id, phone, session_status, created_at, expires_at, verified_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data || []) as HistoryRow[]);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const checkNow = useCallback(async () => {
    if (!session?.sessionId || status !== 'PENDING') return;
    setChecking(true);
    try {
      const current = await getPhoneVerificationStatus(session.sessionId);
      setSession((old) => old ? { ...old, ...current } : current);
      setStatus(current.sessionStatus);
      setError('');
      if (current.sessionStatus !== 'PENDING') loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Төлөв шалгахад алдаа гарлаа.');
    } finally {
      setChecking(false);
    }
  }, [session?.sessionId, status, loadHistory]);

  useEffect(() => {
    if (!session || status !== 'PENDING') return;
    const updateCountdown = () => {
      const left = Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus('EXPIRED');
    };
    updateCountdown();
    const countdown = window.setInterval(updateCountdown, 1000);
    const polling = window.setInterval(checkNow, 3000);
    return () => {
      window.clearInterval(countdown);
      window.clearInterval(polling);
    };
  }, [session?.sessionId, session?.expiresAt, status, checkNow]);

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      const created = await startPhoneVerification(phone);
      setSession(created);
      setStatus('PENDING');
      setSecondsLeft(Math.max(0, Math.ceil((new Date(created.expiresAt).getTime() - Date.now()) / 1000)));
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Баталгаажуулалт эхлүүлж чадсангүй.');
    } finally {
      setStarting(false);
    }
  };

  const safeSmsUri = useMemo(() => {
    const value = session?.smsUri || '';
    return /^sms:144773(?:\?|$)/i.test(value) ? value : '';
  }, [session?.smsUri]);

  return (
    <>
      <PageHeader title="Утас баталгаажуулах" crumb="Дотоод · verify.mn" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
        <div className="space-y-5">
          <Card title="Дугаар оруулах" icon={<Phone size={17} />}>
            <label className="mb-2 block text-[12px] font-semibold text-muted">Монгол утасны дугаар</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                inputMode="tel"
                autoComplete="tel"
                placeholder="99112233 эсвэл +976 99112233"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={starting || status === 'PENDING'}
              />
              <Button onClick={start} disabled={starting || status === 'PENDING' || !phone.trim()}>
                {starting ? 'Үүсгэж байна…' : status === 'EXPIRED' ? 'Шинэ код авах' : 'Баталгаажуулах'}
              </Button>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-subtle">
              Энэ нь OTP илгээх үйлчилгээ биш. Дугаарын эзэмшигч өөрийн SIM-ээс 144773 руу
              6 оронтой код илгээнэ. Нэг SMS 150₮ бөгөөд буруу код илгээсэн ч төлбөртэй.
            </p>
            {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p> : null}
          </Card>

          {session ? (
            <Card
              title="Баталгаажуулах заавар"
              icon={<MessageSquareText size={17} />}
              actions={status ? <Badge tone={statusTone(status)}>{statusText[status]}</Badge> : null}
            >
              {status === 'VERIFIED' ? (
                <div className="rounded-xl border border-success/30 bg-success-soft p-5 text-center">
                  <BadgeCheck className="mx-auto text-success" size={34} />
                  <p className="mt-3 text-[18px] font-semibold text-ink">Утас амжилттай баталгаажлаа</p>
                  <p className="mt-1 text-[13px] text-muted">{session.phone} · {formatDate(session.verifiedAt)}</p>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap rounded-xl border border-line bg-card2 p-4 text-[15px] leading-7 text-ink">
                    {session.displayInstruction}
                  </p>
                  {status === 'PENDING' ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {safeSmsUri ? (
                        <a
                          href={safeSmsUri}
                          className="focus-ring inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-600"
                        >
                          <MessageSquareText size={16} /> SMS апп нээх · 150₮
                        </a>
                      ) : null}
                      <Button variant="outline" onClick={checkNow} disabled={checking} icon={<RefreshCw size={15} className={checking ? 'animate-spin' : ''} />}>
                        Одоо шалгах
                      </Button>
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                        <Clock3 size={14} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-danger-soft p-4">
                      <p className="text-[13px] font-semibold text-danger">Хуучин кодын хугацаа дууссан, дахин ашиглах боломжгүй.</p>
                      <Button className="mt-3" onClick={start}>Шинэ код авах</Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          ) : null}
        </div>

        <Card title="Сүүлийн оролдлогууд" icon={<History size={17} />} bodyClassName="p-0">
          {history.length === 0 ? (
            <EmptyState text="Баталгаажуулалтын түүх алга." />
          ) : (
            <ul className="divide-y divide-line">
              {history.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[14px] font-semibold text-ink">{row.phone}</p>
                    <p className="mt-1 text-[11px] text-subtle">{formatDate(row.created_at)}</p>
                  </div>
                  <Badge tone={statusTone(row.session_status)}>{statusText[row.session_status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

