import { supabase } from './supabase';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED';

export type VerificationSession = {
  sessionId: string;
  phone: string;
  shortcode: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
  sessionStatus: VerificationStatus;
  callbackStatus?: 'PENDING' | 'SENT' | 'FAILED';
  verifiedAt?: string | null;
};

type VerifyPhoneOptions = {
  subjectType?: string;
  subjectId?: string;
  signal?: AbortSignal;
  onSession?: (session: VerificationSession) => void;
  onStatus?: (session: VerificationSession) => void;
  intervalMs?: number;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Админ эрхээр дахин нэвтэрнэ үү.');
  return token;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Алдаа (${response.status})`);
  return data as T;
}

export async function startPhoneVerification(
  phone: string,
  subject?: { type?: string; id?: string },
) {
  return apiRequest<VerificationSession>('/api/verify-phone', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      subjectType: subject?.type,
      subjectId: subject?.id,
    }),
  });
}

export async function getPhoneVerificationStatus(sessionId: string) {
  return apiRequest<VerificationSession>(
    `/api/verify-phone?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    }, { once: true });
  });
}

/**
 * verify.mn session нээгээд 3 секунд тутам баталгаажсан эсэхийг шалгана.
 * Зөвхөн provider `sessionStatus === VERIFIED` гэж буцаахад true болно.
 */
export async function verifyPhone(phone: string, options: VerifyPhoneOptions = {}): Promise<boolean> {
  const session = await startPhoneVerification(phone, {
    type: options.subjectType,
    id: options.subjectId,
  });
  options.onSession?.(session);

  const deadline = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(deadline)) throw new Error('verify.mn хугацааны утга буруу байна.');

  while (Date.now() < deadline) {
    await delay(Math.min(options.intervalMs || 3000, Math.max(0, deadline - Date.now())), options.signal);
    if (Date.now() >= deadline) return false;
    const current = await getPhoneVerificationStatus(session.sessionId);
    options.onStatus?.(current);
    if (current.sessionStatus === 'VERIFIED') return true;
    if (current.sessionStatus === 'EXPIRED') return false;
  }
  return false;
}

