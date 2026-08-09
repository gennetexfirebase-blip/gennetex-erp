import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const toEmail = Deno.env.get("DEVELOPER_EMAIL")?.trim();
    const fromEmail = Deno.env.get("EMAIL_FROM") || "Gennetex ERP <onboarding@resend.dev>";

    const { userName, userEmail, subject, body, messageId } = await req.json();
    const text = String(body || "").trim();
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: "empty_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY || !toEmail) {
      return new Response(
        JSON.stringify({
          ok: true,
          emailSent: false,
          skipped: !RESEND_API_KEY ? "no_resend_key" : "no_developer_email",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subj = String(subject || "").trim() || `Gennetex ERP — ${userName || "Хэрэглэгч"}`;
    const mailBody = [
      `Илгээгч: ${userName || "—"}`,
      `Имэйл: ${userEmail || "—"}`,
      messageId ? `Мэдээний ID: ${messageId}` : "",
      "",
      text,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: userEmail || undefined,
        subject: subj,
        text: mailBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ ok: false, emailSent: false, error: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, emailSent: true, to: toEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
