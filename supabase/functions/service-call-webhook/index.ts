import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickString(obj: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function normalizePayload(raw: Record<string, unknown>) {
  const nested =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw.call && typeof raw.call === "object"
      ? (raw.call as Record<string, unknown>)
      : {};

  const src = { ...nested, ...raw };
  delete src.secret;
  delete src.data;
  delete src.call;

  const siteRaw = String(
    pickString(src, "site_kind", "siteKind", "customer_type", "type_site") || "ail"
  ).toLowerCase();
  const site_kind =
    siteRaw.includes("baiguul") || siteRaw.includes("corp") || siteRaw === "c"
      ? "baiguulga"
      : "ail";

  const statusMap: Record<string, string> = {
    open: "Хүлээгдэж буй",
    pending: "Хүлээгдэж буй",
    new: "Хүлээгдэж буй",
    progress: "Явж байгаа",
    "in progress": "Явж байгаа",
    in_progress: "Явж байгаа",
    closed: "Дууссан",
    done: "Дууссан",
    cancel: "Татгалзсан",
    cancelled: "Татгалзсан",
    reschedule: "Дахимдах",
  };

  const statusRaw = String(pickString(src, "status", "state") || "").toLowerCase();
  const status = statusMap[statusRaw] || pickString(src, "status") || "Хүлээгдэж буй";

  return {
    external_source: pickString(src, "source", "external_source", "provider") || "uservice",
    external_id: pickString(src, "external_id", "externalId", "ticket_id", "ticketId", "order_id", "id"),
    customer: pickString(src, "customer", "customer_name", "client_name", "name") || "Захиалагч",
    phone: pickString(src, "phone", "mobile", "tel", "phone_number"),
    address: pickString(src, "address", "location", "site_address"),
    problem: pickString(src, "problem", "description", "issue", "note", "comment"),
    call_type: pickString(src, "call_type", "callType", "service_type", "type") || "other",
    site_kind,
    engineer_id: pickString(src, "engineer_id", "engineerId", "assignee_id"),
    engineer_name: pickString(src, "engineer_name", "engineerName", "assignee_name", "engineer"),
    latitude: pickNumber(src, "latitude", "lat"),
    longitude: pickNumber(src, "longitude", "lng", "lon"),
    status,
    created_by_name: pickString(src, "created_by_name", "createdByName", "sender") || "U-Service",
    raw_payload: src,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const WEBHOOK_SECRET = Deno.env.get("SERVICE_CALL_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: "webhook_not_configured" }, 503);
  }

  const headerSecret = req.headers.get("x-webhook-secret");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const secret = headerSecret || String(body.secret || "");
  if (secret !== WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const row = normalizePayload(body);
  if (!row.customer) {
    return jsonResponse({ ok: false, error: "customer_required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const insertRow = {
    customer: row.customer,
    phone: row.phone,
    address: row.address,
    problem: row.problem,
    call_type: row.call_type,
    site_kind: row.site_kind,
    engineer_id: row.engineer_id,
    engineer_name: row.engineer_name,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    created_by_name: row.created_by_name,
    external_source: row.external_source,
    external_id: row.external_id,
    raw_payload: row.raw_payload,
    updated_at: new Date().toISOString(),
  };

  let data;
  let error;

  if (row.external_id) {
    const existing = await sb
      .from("service_calls")
      .select("id")
      .eq("external_source", row.external_source)
      .eq("external_id", row.external_id)
      .maybeSingle();

    if (existing.data?.id) {
      const upd = await sb
        .from("service_calls")
        .update(insertRow)
        .eq("id", existing.data.id)
        .select()
        .single();
      data = upd.data;
      error = upd.error;
    } else {
      const ins = await sb.from("service_calls").insert(insertRow).select().single();
      data = ins.data;
      error = ins.error;
    }
  } else {
    const ins = await sb.from("service_calls").insert(insertRow).select().single();
    data = ins.data;
    error = ins.error;
  }

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 502);
  }

  if (data.engineer_id) {
    try {
      const { data: tokenRows } = await sb
        .from("push_tokens")
        .select("token")
        .eq("user_id", data.engineer_id);
      const tokens = [
        ...new Set((tokenRows || []).map((r: { token: string }) => r.token).filter(Boolean)),
      ];
      if (tokens.length) {
        const kind = data.site_kind === "baiguulga" ? "Байгууллага" : "Айл";
        const details = [data.customer, data.problem, data.phone].filter(Boolean).join(" · ");
        const title = `${data.engineer_name || "Ажилтан"}, танд шинээр дуудлага ирлээ`;
        const body = details ? `${kind}: ${details}` : `${kind} дээрх шинэ дуудлага`;
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            tokens.map((to) => ({
              to,
              title,
              body,
              sound: "default",
              priority: "high",
              channelId: "service_calls",
              data: {
                type: "service_call",
                callId: String(data.id),
                siteKind: String(data.site_kind || "ail"),
              },
            }))
          ),
        });
      }
    } catch (_e) {
      // push алдааг webhook амжилтгүй болгохгүй
    }
  }

  return jsonResponse({
    ok: true,
    id: data.id,
    external_id: row.external_id,
    action: row.external_id ? "upserted" : "created",
  });
});
