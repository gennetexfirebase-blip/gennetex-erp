/**
 * share.gennetex.com — нэвтрэлтгүй хуваалцах.
 *
 *   create   {kind:'text', title?, body, days}                  → {id}
 *   create   {kind:'file', title?, body?, file_name, file_size, mime, days} → {id, path, token} (signed upload)
 *   done     {id}                                               → файл байршсан эсэхийг баталгаажуулна
 *   get      {id}                                               → текст эсвэл файлын signed URL
 *
 * Хязгаар: IP тутам цагт 30, файл 50MB, хугацаа 1/7/30 хоног. Хугацаа дууссаныг
 * create бүрт цэвэрлэнэ (Storage-оос ч устгана).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/push.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "public-shares";
const MAX_BYTES = 50 * 1024 * 1024;
const PER_HOUR = 30;
const DAYS = new Set([1, 7, 30]);

class ShareError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
const db = createAdminClient();
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const newId = () => [...crypto.getRandomValues(new Uint8Array(10))].map((b) => ALPHABET[b % ALPHABET.length]).join("");
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function cleanup() {
  const { data } = await db.from("public_shares").select("id, file_path").lt("expires_at", new Date().toISOString()).limit(100);
  if (!data?.length) return;
  const paths = data.map((r) => r.file_path).filter(Boolean) as string[];
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  await db.from("public_shares").delete().in("id", data.map((r) => r.id));
}

async function handle(req: Request, body: Record<string, unknown>) {
  switch (body.action) {
    case "create": {
      await cleanup().catch(() => null);
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
      const ipHash = await sha256(ip + (Deno.env.get("SUPABASE_URL") || ""));
      const { count } = await db.from("public_shares").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600000).toISOString());
      if ((count || 0) >= PER_HOUR) throw new ShareError("Хэт олон удаа хуваалцлаа. Нэг цагийн дараа дахин оролдоно уу.", 429);

      const days = DAYS.has(Number(body.days)) ? Number(body.days) : 7;
      const title = String(body.title || "").trim().slice(0, 200) || null;
      const text = String(body.body || "").trim();
      const id = newId();
      const expires_at = new Date(Date.now() + days * 86400000).toISOString();

      if (body.kind === "text") {
        if (!text) throw new ShareError("Текстээ бичнэ үү.");
        if (text.length > 50000) throw new ShareError("Текст хэт урт (50,000 тэмдэгт хүртэл).");
        const { error } = await db.from("public_shares").insert({ id, kind: "text", title, body: text, ip_hash: ipHash, expires_at, uploaded: true });
        if (error) throw new ShareError(error.message, 500);
        return { id, expiresAt: expires_at };
      }
      if (body.kind === "file") {
        const size = Number(body.file_size) || 0;
        if (size <= 0) throw new ShareError("Файл хоосон байна.");
        if (size > MAX_BYTES) throw new ShareError("Файл 50MB-аас том байна.");
        const name = String(body.file_name || "file").slice(-150);
        const safe = name.replace(/[^\p{L}\p{N}._-]+/gu, "_") || "file";
        const path = `${id}/${safe}`;
        const { data: up, error: ue } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
        if (ue || !up) throw new ShareError(ue?.message || "Байршуулах холбоос үүсгэж чадсангүй.", 500);
        const { error } = await db.from("public_shares").insert({
          id, kind: "file", title, body: text.slice(0, 5000) || null, file_path: path, file_name: name, file_size: size,
          mime: String(body.mime || "").slice(0, 120) || null, ip_hash: ipHash, expires_at,
        });
        if (error) throw new ShareError(error.message, 500);
        return { id, path, token: up.token, expiresAt: expires_at };
      }
      throw new ShareError("Төрөл буруу.");
    }

    case "done": {
      const { data } = await db.from("public_shares").select("id, file_path").eq("id", String(body.id || "")).maybeSingle();
      if (!data?.file_path) throw new ShareError("Олдсонгүй.", 404);
      const folder = data.file_path.split("/")[0];
      const { data: files } = await db.storage.from(BUCKET).list(folder);
      if (!files?.length) throw new ShareError("Файл байршаагүй байна.", 409);
      await db.from("public_shares").update({ uploaded: true }).eq("id", data.id);
      return { ok: true };
    }

    case "get": {
      const id = String(body.id || "");
      if (!/^[a-z0-9]{6,20}$/.test(id)) throw new ShareError("Холбоос буруу.", 404);
      const { data: s } = await db.from("public_shares").select("*").eq("id", id).maybeSingle();
      if (!s || !s.uploaded || new Date(s.expires_at) < new Date()) throw new ShareError("Энэ холбоос олдсонгүй эсвэл хугацаа нь дууссан.", 404);
      await db.from("public_shares").update({ views: (s.views || 0) + 1 }).eq("id", id);
      let url: string | null = null;
      let download: string | null = null;
      if (s.kind === "file") {
        url = (await db.storage.from(BUCKET).createSignedUrl(s.file_path, 3600)).data?.signedUrl || null;
        download = (await db.storage.from(BUCKET).createSignedUrl(s.file_path, 3600, { download: s.file_name || true })).data?.signedUrl || null;
      }
      return {
        id: s.id, kind: s.kind, title: s.title, body: s.body, file_name: s.file_name, file_size: s.file_size, mime: s.mime,
        created_at: s.created_at, expires_at: s.expires_at, views: (s.views || 0) + 1, url, download,
      };
    }
  }
  throw new ShareError("Үйлдэл буруу.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...headers, "Content-Type": "application/json" } });
  try {
    return reply(await handle(req, await req.json().catch(() => ({}))));
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : String(e) }, e instanceof ShareError ? e.status : 500);
  }
});
