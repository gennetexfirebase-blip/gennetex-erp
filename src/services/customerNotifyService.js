/**
 * Харилцагчид SMS / Telegram мэдэгдэл (webhook эсвэл Supabase edge).
 * Ключ байхгүй бол queue-д хадгалж, UI-д "илгээгдсэн (local)" тэмдэглэнэ.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';
import { enqueue } from './offlineQueueService';

const TEMPLATES = {
  assigned: (p) =>
    `Сайн байна уу, ${p.customer || 'харилцагч'}! Таны дуудлагыг инженер ${p.engineer || ''} хүлээн авлаа. Утас: ${p.engineerPhone || '—'}`,
  en_route: (p) =>
    `Сайн байна уу! Инженер ${p.engineer || ''} замд гарлаа. Ойролцоогоор ${p.etaMin || 15} минутын дараа ирнэ.`,
  on_site: (p) => `Инженер ${p.engineer || ''} таны хаягт ирлээ.`,
  closed: (p) =>
    `Таны үйлчилгээ (${p.customer || ''}) амжилттай хаагдлаа. Баярлалаа! Gennetex`,
  delayed: (p) =>
    `Уучлаарай, таны дуудлага хойшлогдож магадгүй. Шинэ цаг: ${p.scheduledAt || 'удахгүй мэдэгдэнэ'}.`,
};

export function buildCustomerMessage(templateKey, params = {}) {
  const fn = TEMPLATES[templateKey] || TEMPLATES.assigned;
  return fn(params);
}

/**
 * @param {{ phone?: string, telegramChatId?: string, template: string, params: object, callId?: string }} opts
 */
export async function notifyCustomer(opts) {
  if (!isFlagOn('customerNotify')) {
    return { sent: false, reason: 'flag_off' };
  }
  const message = buildCustomerMessage(opts.template, opts.params || {});
  const payload = {
    phone: opts.phone || opts.params?.phone || null,
    telegramChatId: opts.telegramChatId || null,
    message,
    template: opts.template,
    callId: opts.callId || null,
    at: new Date().toISOString(),
  };

  // Edge function (optional)
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('customer-notify', {
        body: payload,
      });
      if (!error) return { sent: true, via: 'edge', data, message };
    } catch {
      // fall through
    }
  }

  // Webhook URL env
  const webhook = process.env.EXPO_PUBLIC_CUSTOMER_NOTIFY_WEBHOOK;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { sent: true, via: 'webhook', message };
    } catch {
      await enqueue({ type: 'customer_notify', payload });
      return { sent: false, queued: true, message };
    }
  }

  // Local log (no provider) — still record for audit
  if (supabase) {
    try {
      await supabase.from('customer_notify_log').insert({
        call_id: payload.callId,
        phone: payload.phone,
        template: payload.template,
        message: payload.message,
        status: 'logged_only',
      });
    } catch {}
  }

  return { sent: false, logged: true, message, reason: 'no_provider' };
}

export async function notifyCustomerEnRoute(call, engineerName, etaMin = 15) {
  return notifyCustomer({
    phone: call?.phone,
    callId: call?.id,
    template: 'en_route',
    params: {
      customer: call?.customer,
      engineer: engineerName || call?.engineer,
      etaMin,
      phone: call?.phone,
    },
  });
}

export async function notifyCustomerClosed(call, engineerName) {
  return notifyCustomer({
    phone: call?.phone,
    callId: call?.id,
    template: 'closed',
    params: {
      customer: call?.customer,
      engineer: engineerName || call?.engineer,
      phone: call?.phone,
    },
  });
}
