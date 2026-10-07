import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createAdminClient, sendPushAudience } from '../_shared/push.ts';

type Vehicle = { id: string; plate_number: string };
type ComplianceKind = 'inspection' | 'insurance';
type DueNotification = {
  vehicle: Vehicle;
  kind: ComplianceKind;
  expiry: string;
  threshold: 'expired' | 'warning_14';
  remaining: number;
  attemptCount: number;
  insuranceType: string;
  sentParts: Record<string, string>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function diagnosisRows(html: string) {
  const tabStart = html.indexOf('id="diagnosisTab"');
  if (tabStart < 0) return [] as string[][];
  const tableEnd = html.indexOf('</table>', tabStart);
  if (tableEnd < 0) return [] as string[][];
  const table = html.slice(tabStart, tableEnd);
  const rows: string[][] = [];
  for (const match of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => stripTags(cell[1]));
    if (cells.length >= 4 && !/огноо/i.test(cells.join(' '))) rows.push(cells);
  }
  return rows;
}

function dateKey(value: unknown): string | null {
  const match = String(value || '').match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addOneYear(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year + 1, month - 1, day));
  // 2/29 + 1 жил нь дараа жилийн 3/1 болохоос сэргийлж 2/28 болгоно.
  if (month === 2 && day === 29 && date.getUTCMonth() !== 1) return `${year + 1}-02-28`;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function inspectionFromHtml(html: string) {
  const passed = diagnosisRows(html)
    .map((row) => {
      const inspectedAt = dateKey(row[2]);
      const passedStatus = /тэнцсэн|passed/i.test(row[5] || '');
      const expiry = dateKey(row[3]) || (inspectedAt && passedStatus ? addOneYear(inspectedAt) : null);
      return { inspectedAt, expiry, passedStatus, serialNumber: String(row[1] || '').trim() };
    })
    .filter((row) => row.inspectedAt && row.expiry && row.passedStatus)
    .sort((a, b) => String(b.inspectedAt).localeCompare(String(a.inspectedAt)));
  return passed[0] || { inspectedAt: null, expiry: null, serialNumber: '' };
}

function todayInUlaanbaatar(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function daysUntil(expiry: string, today = todayInUlaanbaatar()) {
  const toUtc = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(expiry) - toUtc(today)) / 86_400_000);
}

async function fetchCompliance(plate: string) {
  const normalized = plate.replace(/[\s\u00a0-]+/g, '');
  const pageUrl = `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(normalized)}`;
  const insuranceUrl = `https://www.autobox.mn/api/services/app/Xyp/GetAutoboxInsurance?plateNo=${encodeURIComponent(normalized)}`;
  const headers = { 'User-Agent': 'GennetexERP/1.0', Accept: '*/*' };
  const [pageResponse, insuranceResponse] = await Promise.all([
    fetch(pageUrl, { headers }),
    fetch(insuranceUrl, { headers }),
  ]);
  if (!pageResponse.ok) throw new Error(`Autobox ${pageResponse.status}`);
  const html = await pageResponse.text();
  const inspection = inspectionFromHtml(html);

  let insuranceExpiry: string | null = null;
  let insuranceType = '';
  if (insuranceResponse.ok) {
    const payload = await insuranceResponse.json().catch(() => ({}));
    const items = Array.isArray(payload?.result?.items) ? payload.result.items : [];
    const latest = items
      .map((item: Record<string, unknown>) => ({ item, expiry: dateKey(item.endDate) }))
      .filter((entry: { expiry: string | null }) => Boolean(entry.expiry))
      .sort((a: { expiry: string | null }, b: { expiry: string | null }) => String(b.expiry).localeCompare(String(a.expiry)))[0];
    insuranceExpiry = latest?.expiry || null;
    insuranceType = String(latest?.item?.policyType || latest?.item?.insuranceCompany || '').trim();
  }
  return {
    plate: normalized,
    inspectionDate: inspection.inspectedAt,
    inspectionExpiry: inspection.expiry,
    serialNumber: inspection.serialNumber,
    insuranceExpiry,
    insuranceType,
  };
}

function latinizeMongolian(value: string) {
  const map: Record<string, string> = {
    А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'Yo', Ж: 'J', З: 'Z', И: 'I', Й: 'I',
    К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', Ө: 'U', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U',
    Ү: 'U', Ф: 'F', Х: 'H', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Sh', Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
  };
  return [...String(value || '')].map((char) => {
    const upper = char.toUpperCase();
    const converted = map[upper];
    if (converted == null) return char.codePointAt(0)! < 128 ? char : '';
    return char === upper ? converted : converted.toLowerCase();
  }).join('').replace(/\s+/g, ' ').trim();
}

function smsLengthLimit(value: string) {
  return /^[\x0A\x0D\x20-\x7E]*$/.test(value) ? 159 : 70;
}

function packSmsLines(lines: string[]) {
  const parts: string[] = [];
  let current = '';
  for (const rawLine of lines) {
    const line = String(rawLine || '').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (Array.from(line).length > smsLengthLimit(line)) throw new Error(`SMS line exceeds provider limit: ${line.slice(0, 40)}`);
    const candidate = current ? `${current}\n${line}` : line;
    if (Array.from(candidate).length <= smsLengthLimit(candidate)) current = candidate;
    else {
      if (current) parts.push(current);
      current = line;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function notificationMessages(item: DueNotification) {
  const expired = item.remaining < 0;
  const plate = item.vehicle.plate_number.replace(/\s+/g, ' ').trim();
  const dayLine = `${expired ? 'Hetersen' : 'Uldsen'} honog: ${Math.abs(item.remaining)}`;
  if (item.kind === 'inspection') {
    return packSmsLines([
      `Tanii avtomashinii uzlegiin hugatsaa ${expired ? 'duussan baina' : 'duusah duhoj baina'}!`,
      `Ulsiin dugaar: ${plate}`,
      `Uzleg duusah ognoo: ${item.expiry}`,
      dayLine,
      'Ta avtomashinaa tehnikiin hyanaltiin uzlegt hugatsaand ni hamruulna uu.',
    ]);
  }
  return packSmsLines([
    `Tanii avtomashinii daatgaliin hugatsaa ${expired ? 'duussan baina' : 'duusah duhoj baina'}!`,
    `Ulsiin dugaar: ${plate}`,
    `Daatgaliin turul: ${latinizeMongolian(item.insuranceType) || 'medeelel oldsongui'}`,
    `Daatgal duusah ognoo: ${item.expiry}`,
    dayLine,
    'Ta avtomashinii daatgalaa hugatsaand ni sunguulna uu.',
  ]);
}

function parseSentParts(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

async function sendSendsms(recipients: string[], message: string) {
  const apiUrl = Deno.env.get('SMS_API_URL') || 'https://api.sendsms.mn/api/user/send';
  const apiKey = Deno.env.get('SMS_API_KEY') || '';
  const apiToken = Deno.env.get('SMS_API_TOKEN') || '';
  if (!apiKey || !apiToken || Deno.env.get('SMS_ENABLED') !== 'true') throw new Error('SMS provider disabled or missing secrets');
  const maxLength = smsLengthLimit(message);
  if (Array.from(message).length > maxLength) throw new Error(`SMS message exceeds ${maxLength} characters`);
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiToken, phone: recipients.join(','), message }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false || data?.status === false || String(data?.status || '').toLowerCase() === 'error') {
    throw new Error(String(data?.message || data?.error || `sendsms.mn ${response.status}`));
  }
  return String(data?.messageId || data?.message_id || data?.data?.messageId || data?.data?.id || 'accepted');
}

async function findDueNotification(
  db: ReturnType<typeof createAdminClient>,
  vehicle: Vehicle,
  kind: ComplianceKind,
  expiry: string | null,
  details: { insuranceType?: string },
) {
  if (!expiry) return { due: null, reason: 'no_expiry' };
  const remaining = daysUntil(expiry);
  if (remaining > 14) return { due: null, reason: 'not_due' };
  const threshold = remaining < 0 ? 'expired' as const : 'warning_14' as const;
  const { data: existing } = await db
    .from('vehicle_compliance_notifications')
    .select('id,status,attempt_count,updated_at,provider_message_id')
    .eq('vehicle_id', vehicle.id)
    .eq('kind', kind)
    .eq('expiry_date', expiry)
    .eq('threshold', threshold)
    .maybeSingle();
  const processingRecently = existing?.status === 'processing'
    && Date.now() - new Date(existing.updated_at).getTime() < 10 * 60 * 1000;
  if (existing?.status === 'sent' || Number(existing?.attempt_count || 0) >= 3) {
    return { due: null, reason: existing?.status === 'sent' ? 'duplicate' : 'retry_limit' };
  }
  if (processingRecently) return { due: null, reason: 'processing' };
  return {
    due: {
      vehicle,
      kind,
      expiry,
      threshold,
      remaining,
      attemptCount: Number(existing?.attempt_count || 0),
      insuranceType: String(details.insuranceType || ''),
      sentParts: parseSentParts(existing?.provider_message_id),
    } satisfies DueNotification,
    reason: 'due',
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const expected = Deno.env.get('CRON_SECRET') || '';
  const authorization = req.headers.get('Authorization') || '';
  if (!expected || authorization !== `Bearer ${expected}`) return json({ error: 'Unauthorized' }, 401);
  const requestBody = await req.json().catch(() => ({}));
  const dryRun = requestBody?.dryRun === true;
  const testPhone = String(requestBody?.testPhone || '').replace(/\D/g, '');
  if (testPhone && !/^\d{8}$/.test(testPhone)) return json({ error: 'testPhone must be 8 digits' }, 400);

  const recipients = (Deno.env.get('VEHICLE_ALERT_PHONE_NUMBERS') || '')
    .split(',').map((value) => value.replace(/\D/g, '')).filter((value) => /^\d{8}$/.test(value));
  if (!recipients.length) return json({ error: 'VEHICLE_ALERT_PHONE_NUMBERS missing' }, 500);

  const db = createAdminClient();
  const { data: vehicles, error } = await db.from('vehicles').select('id,plate_number').eq('active', true);
  if (error) return json({ error: error.message }, 500);

  const result = {
    dryRun,
    testMode: Boolean(testPhone),
    checked: 0,
    sent: 0,
    sentEvents: 0,
    skipped: 0,
    failed: 0,
    candidates: [] as Array<{ vehicleId: string; plate: string; kind: ComplianceKind; expiry: string; threshold: string; remaining: number }>,
    errors: [] as string[],
    previewMessages: [] as Array<{ plate: string; kind: ComplianceKind; parts: string[] }>,
  };
  const dueNotifications: DueNotification[] = [];
  for (const vehicle of (vehicles || []) as Vehicle[]) {
    try {
      const compliance = await fetchCompliance(vehicle.plate_number);
      await db.from('vehicle_compliance_snapshots').upsert({
        vehicle_id: vehicle.id,
        plate_number: vehicle.plate_number,
        inspection_date: compliance.inspectionDate,
        inspection_expiry: compliance.inspectionExpiry,
        insurance_expiry: compliance.insuranceExpiry,
        checked_at: new Date().toISOString(),
        last_error: null,
      });
      result.checked += 1;
      for (const [kind, expiry] of [
        ['inspection', compliance.inspectionExpiry],
        ['insurance', compliance.insuranceExpiry],
      ] as [ComplianceKind, string | null][]) {
        const outcome = await findDueNotification(db, vehicle, kind, expiry, {
          insuranceType: kind === 'insurance' ? compliance.insuranceType : '',
        });
        if (outcome.due) {
          dueNotifications.push(outcome.due);
          result.candidates.push({
            vehicleId: vehicle.id,
            plate: vehicle.plate_number,
            kind,
            expiry: outcome.due.expiry,
            threshold: outcome.due.threshold,
            remaining: outcome.due.remaining,
          });
        }
        if (!outcome.due) result.skipped += 1;
      }
    } catch (vehicleError) {
      const message = vehicleError instanceof Error ? vehicleError.message : String(vehicleError);
      result.failed += 1;
      result.errors.push(`${vehicle.id}:${message}`.slice(0, 300));
      await db.from('vehicle_compliance_snapshots').upsert({
        vehicle_id: vehicle.id,
        plate_number: vehicle.plate_number,
        checked_at: new Date().toISOString(),
        last_error: message.slice(0, 500),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!dryRun && dueNotifications.length) {
    const actualRecipients = testPhone ? [testPhone] : recipients;
    for (const item of dueNotifications) {
      const messages = notificationMessages(item);
      result.previewMessages.push({ plate: item.vehicle.plate_number, kind: item.kind, parts: messages });
      let claimedId = '';
      const sentParts = testPhone ? {} as Record<string, string> : { ...item.sentParts };
      try {
        if (!testPhone) {
          const { data: claimed, error: claimError } = await db
            .from('vehicle_compliance_notifications')
            .upsert({
              vehicle_id: item.vehicle.id,
              plate_number: item.vehicle.plate_number,
              kind: item.kind,
              expiry_date: item.expiry,
              threshold: item.threshold,
              status: 'processing',
              recipients_count: actualRecipients.length,
              attempt_count: item.attemptCount + 1,
              provider_message_id: JSON.stringify(sentParts),
              error_message: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'vehicle_id,kind,expiry_date,threshold' })
            .select('id')
            .single();
          if (claimError) throw claimError;
          claimedId = claimed.id;
        }
        for (let partIndex = 0; partIndex < messages.length; partIndex += 1) {
          if (sentParts[String(partIndex)]) continue;
          const providerMessageId = await sendSendsms(actualRecipients, messages[partIndex]);
          sentParts[String(partIndex)] = providerMessageId;
          result.sent += 1;
          if (claimedId) {
            await db.from('vehicle_compliance_notifications').update({
              provider_message_id: JSON.stringify(sentParts), updated_at: new Date().toISOString(),
            }).eq('id', claimedId);
          }
        }
        if (claimedId) {
          await db.from('vehicle_compliance_notifications').update({
            status: 'sent', provider_message_id: JSON.stringify(sentParts),
            sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq('id', claimedId);
        }
        result.sentEvents += 1;
        if (!testPhone) {
          await sendPushAudience(db, { kind: 'role', role: 'admin' }, {
            title: item.kind === 'inspection' ? 'Машины үзлэгийн сануулга' : 'Машины даатгалын сануулга',
            body: messages.join(' '),
            type: 'vehicle_compliance',
            data: { vehicleId: item.vehicle.id, kind: item.kind, expiry: item.expiry },
            channelId: 'general_v2',
          }).catch((pushError) => console.error('[vehicle-compliance] push failed', pushError instanceof Error ? pushError.message : String(pushError)));
        }
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : String(sendError);
        if (claimedId) {
          await db.from('vehicle_compliance_notifications').update({
            status: 'failed', provider_message_id: JSON.stringify(sentParts),
            error_message: message.slice(0, 500), updated_at: new Date().toISOString(),
          }).eq('id', claimedId);
        }
        result.failed += 1;
        result.errors.push(`${item.vehicle.id}:${item.kind}:${message}`.slice(0, 300));
      }
    }
  }
  if (dryRun) {
    result.previewMessages = dueNotifications.map((item) => ({
      plate: item.vehicle.plate_number,
      kind: item.kind,
      parts: notificationMessages(item),
    }));
  }
  return json({ ok: result.failed === 0, ...result }, result.failed === 0 ? 200 : 207);
});
