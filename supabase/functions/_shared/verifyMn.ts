/**
 * verify.mn — Mobile-Originated SMS утас баталгаажуулалт (Монгол).
 *
 *   1. createSession(phone) → 6 оронтой шинэ код, sessionId, smsUri, displayInstruction
 *   2. Хэрэглэгч өөрийн утаснаас 144773 руу кодыг илгээнэ (150₮)
 *   3. getSession(id).sessionStatus === "VERIFIED" бол баталгаажсан
 *
 * Callback ашиглахгүй — 3 секунд тутам polling (verifyPhone). API key-г
 * VERIFY_MN_API_KEY env-ээс уншина, хэзээ ч log-д бичихгүй.
 */

export const VERIFY_MN_URL = "https://api.verify.mn";

export class VerifyMnError extends Error {
  constructor(message: string, public status = 500, public code = "VERIFY_MN_ERROR") {
    super(message);
  }
}

export type VerifySession = {
  sessionId: string;
  phone: string;
  shortcode: string;
  text: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
};
export type SessionStatus = { sessionId: string; sessionStatus: "PENDING" | "VERIFIED" | "EXPIRED"; verifiedAt?: string | null; expiresAt: string };

type Fetch = typeof fetch;

export function normalizePhone(input: unknown) {
  let d = String(input || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00976") && d.length === 13) d = d.slice(5);
  if (d.startsWith("976") && d.length === 11) d = d.slice(3);
  if (!/^\d{8,16}$/.test(d)) throw new VerifyMnError("Утасны дугаар 8–16 оронтой байх ёстой.", 400, "INVALID_PHONE");
  return d;
}

/** Сесс бүрт шинэ, санамсаргүй 6 оронтой код — дахин ашиглахгүй. */
export function newCode() {
  return String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
}

export function requireApiKey(env: (k: string) => string | undefined = (k) => Deno.env.get(k)) {
  const key = (env("VERIFY_MN_API_KEY") || "").trim();
  if (!key) throw new VerifyMnError("VERIFY_MN_API_KEY тохируулаагүй байна.", 500, "VERIFY_MN_API_KEY_MISSING");
  return key;
}

async function readJson(r: Response) {
  const data = await r.json().catch(() => ({}));
  if (r.ok) return data;
  if (r.status === 401) throw new VerifyMnError("verify.mn API key хүчингүй байна.", 401, "VERIFY_MN_UNAUTHORIZED");
  if (r.status === 404) throw new VerifyMnError("verify.mn сесс олдсонгүй.", 404, "VERIFY_MN_NOT_FOUND");
  throw new VerifyMnError(r.status >= 500 ? "verify.mn үйлчилгээ түр алдаатай байна." : String(data?.message || `verify.mn алдаа (${r.status})`), r.status, "VERIFY_MN_UPSTREAM");
}

export async function createSession(phone: string, opts: { apiKey?: string; fetchImpl?: Fetch; code?: string } = {}): Promise<VerifySession> {
  const apiKey = opts.apiKey ?? requireApiKey();
  const f = opts.fetchImpl ?? fetch;
  const r = await f(`${VERIFY_MN_URL}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    // callback-гүй: polling хийнэ (зохиомол URL бүртгэвэл verify.mn олон удаа дахин оролддог).
    body: JSON.stringify({ phone: normalizePhone(phone), text: opts.code ?? newCode() }),
  });
  const data = await readJson(r);
  if (!data?.sessionId || !data?.displayInstruction || !data?.expiresAt) {
    throw new VerifyMnError("verify.mn бүрэн бус хариу буцаалаа.", 502, "VERIFY_MN_INVALID_RESPONSE");
  }
  return data as VerifySession;
}

export async function getSession(sessionId: string, opts: { fetchImpl?: Fetch } = {}): Promise<SessionStatus> {
  if (!sessionId) throw new VerifyMnError("sessionId шаардлагатай.", 400, "SESSION_ID_REQUIRED");
  const r = await (opts.fetchImpl ?? fetch)(`${VERIFY_MN_URL}/sessions/${encodeURIComponent(sessionId)}`, { headers: { Accept: "application/json" } });
  return (await readJson(r)) as SessionStatus;
}

/**
 * Сессийг VERIFIED болтол 3 секунд тутам шалгана. EXPIRED эсвэл expiresAt
 * өнгөрвөл false. (Edge function-д хүсэлт бүр нэг удаа getSession дууддаг;
 * энэ нь серверийн/тестийн бүрэн хувилбар.)
 */
export async function verifyPhone(
  sessionId: string,
  expiresAt: string,
  opts: { fetchImpl?: Fetch; intervalMs?: number; now?: () => number; wait?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const now = opts.now ?? Date.now;
  const wait = opts.wait ?? ((ms) => new Promise((res) => setTimeout(res, ms)));
  const deadline = Math.min(new Date(expiresAt).getTime(), now() + 310_000);
  while (now() < deadline) {
    const s = await getSession(sessionId, { fetchImpl: opts.fetchImpl });
    if (s.sessionStatus === "VERIFIED") return true;
    if (s.sessionStatus === "EXPIRED") return false;
    await wait(Math.min(opts.intervalMs ?? 3000, Math.max(0, deadline - now())));
  }
  return false;
}
