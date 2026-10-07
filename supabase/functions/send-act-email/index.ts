import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("EMAIL_FROM") || "Gennetex ERP <onboarding@resend.dev>";
    if (!apiKey) throw new Error("RESEND_API_KEY тохируулаагүй байна.");

    const body = await req.json();
    const to = String(body.to || "").trim().toLowerCase();
    const publicUrl = String(body.publicUrl || "").trim();
    const pdfUrl = String(body.pdfUrl || "").trim();
    const actNumber = String(body.actNumber || "Акт").trim();
    const projectName = String(body.projectName || "").trim();
    const pdfFilename = String(body.pdfFilename || `${actNumber}.pdf`).replace(/[^\p{L}\p{N}._-]+/gu, "_");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("И-мэйл хаяг буруу байна.");
    if (!/^https:\/\//i.test(publicUrl) || !/^https:\/\//i.test(pdfUrl)) throw new Error("Илгээх холбоос буруу байна.");

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) throw new Error("PDF attachment татаж чадсангүй.");
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    if (pdfBytes.byteLength > 30 * 1024 * 1024) throw new Error("PDF файл 30MB-аас их байна.");

    const safeAct = escapeHtml(actNumber);
    const safeProject = escapeHtml(projectName);
    const safeUrl = escapeHtml(publicUrl);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `${actNumber} — ${projectName || "Ажил гүйцэтгэлийн акт"}`,
        html: `<!doctype html><html><body style="margin:0;background:#f5f3f1;font-family:Arial,sans-serif;color:#211d1b"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e5dfda;border-radius:12px;padding:28px"><h1 style="margin:0 0 8px;color:#7f1d1d;font-size:22px">${safeAct}</h1><p style="margin:0 0 22px;color:#5f5753">${safeProject}</p><p>Ажил гүйцэтгэлийн актын PDF файлыг хавсаргав.</p><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#7f1d1d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Актыг онлайнаар харах</a></p><p style="font-size:12px;color:#766e69;word-break:break-all">${safeUrl}</p><p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee8e4;font-size:12px;color:#8a817c">Энэ имэйл автомат системээс илгээгдсэн.</p></div></div></body></html>`,
        text: `${actNumber}\n${projectName}\n\nАктыг онлайнаар харах: ${publicUrl}\n\nЭнэ имэйл автомат системээс илгээгдсэн.`,
        attachments: [{ filename: pdfFilename, content: bytesToBase64(pdfBytes) }],
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    return new Response(JSON.stringify({ ok: true, id: result.id, to }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String((error as Error)?.message || error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
