import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { getSessions } from './models.ts';
import {
  decodeJpeg,
  detectLargestFace,
  alignFace,
  embedFace,
  cosineSimilarity,
  lastDetectDebug,
} from './image.ts';

/**
 * Царай таних Edge Function — Expo Go дээр ажиллана.
 *
 * ЯАГААД:
 *   Утсан дээрх ML Kit + ONNX нь native модуль тул Expo Go-д ачаалагдахгүй.
 *   Энэ функц ижил SFace загварыг СЕРВЕР дээр ажиллуулна. Гаралт нь ижил
 *   128 хэмжээст embedding тул `face_templates`-д хадгалсан утгуудтай
 *   ХООРОНДОО НИЙЦНЭ — APK дээр бүртгүүлээд Expo Go дээр танилт хийж болно.
 *
 * ХАМГААЛАЛТ:
 *   • Хэрэглэгчийн JWT-г шалгаж, ЗӨВХӨН өөрийнх нь царайг бүртгэнэ/таана.
 *     Клиентээс ирсэн userId-д итгэхгүй — токеноос гаргаж авна.
 *   • Embedding нь service role-оор бичигдэнэ (RLS тойрохгүйн тулд
 *     хэрэглэгчийн ID-г серверээс тодорхойлно).
 *
 * ДУУДАХ:
 *   POST { mode: 'enroll' | 'verify', imageBase64, pose? }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Клиент талтай ижил босго (faceService.js). */
const MATCH_THRESHOLD = 0.43;
const TOP_AVERAGE_THRESHOLD = 0.36;
const MODEL_VERSION = 'opencv-sface-2021dec-align-v2';

const ALLOWED_POSES = ['center', 'side_a', 'side_b', 'tilt_a', 'tilt_b', 'smile', 'center_2'];

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/\w+;base64,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Оношилгооны тайлан — загвар ачаалагдаж байгаа эсэх, хаана унасныг хэлнэ.
 * Хувийн мэдээлэл агуулахгүй тул нэвтрэлт шаардахгүй.
 */
async function healthReport(
  supabaseUrl: string,
  serviceKey: string,
  probeImage?: string
) {
  const report: Record<string, unknown> = { function: 'face-verify' };

  // 1) Storage-д загварууд байгаа эсэх
  try {
    const list = await fetch(`${supabaseUrl}/storage/v1/object/list/models`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: '', limit: 20, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
    });
    report.storageBucket = list.ok ? 'ok' : `алдаа ${list.status}`;
    if (list.ok) {
      const files = await list.json();
      report.storageFiles = (files || []).map(
        (f: { name: string; metadata?: { size?: number } }) =>
          `${f.name} (${Math.round((f.metadata?.size || 0) / 1024)} KB)`
      );
    }
  } catch (e) {
    report.storageBucket = `алдаа: ${String((e as Error)?.message || e)}`;
  }

  // 2) Загвар ачаалж, ONNX session үүсгэх
  try {
    const t0 = Date.now();
    const s = await getSessions(supabaseUrl, serviceKey);
    report.modelsLoaded = true;
    report.loadMs = Date.now() - t0;
    report.detectorInputs = s.detector.inputNames;
    report.detectorOutputs = s.detector.outputNames;
    report.recognizerInputs = s.recognizer.inputNames;
    report.recognizerOutputs = s.recognizer.outputNames;
  } catch (e) {
    report.modelsLoaded = false;
    report.stage = 'model-load';
    report.error = String((e as Error)?.message || e);
    report.stack = String((e as Error)?.stack || '')
      .split('\n')
      .slice(0, 5)
      .join(' | ');
    if (/wasm|fetch|import|module/i.test(report.error as string)) {
      report.hint =
        'onnxruntime-web-ийн WASM ачаалагдсангүй. models.ts доторх ORT_VERSION нь ' +
        'import хийсэн хувилбартай таарч байгаа эсэхийг шалгана уу.';
    }
    return report;
  }

  // 3) Зураг өгсөн бол бүтэн дамжуулалтыг туршина.
  //    Өгөгдлийн санд юу ч бичихгүй тул нэвтрэлт шаардахгүй — зөвхөн
  //    задлах → илрүүлэх → тэгшлэх → embedding гэсэн гинжийг шалгана.
  if (probeImage) {
    try {
      const t1 = Date.now();
      const s = await getSessions(supabaseUrl, serviceKey);
      const img = decodeJpeg(base64ToBytes(probeImage));
      report.imageSize = `${img.width}×${img.height}`;

      const face = await detectLargestFace(s.detector, img);
      report.faceFound = !!face;
      report.detect = lastDetectDebug;
      if (face) {
        report.faceScore = Number(face.score.toFixed(3));
        report.landmarks = face.landmarks.map(
          (p) => `${Math.round(p.x)},${Math.round(p.y)}`
        );
        const aligned = alignFace(img, face.landmarks);
        const emb = await embedFace(s.recognizer, aligned);
        report.embeddingLength = emb.length;
        // L2 нормчлол зөв ажилласан бол ~1.0 байх ёстой
        report.embeddingNorm = Number(
          Math.sqrt(emb.reduce((a, v) => a + v * v, 0)).toFixed(4)
        );
      }
      report.pipelineMs = Date.now() - t1;
      report.pipeline = 'ok';
    } catch (e) {
      report.pipeline = 'failed';
      report.pipelineError = String((e as Error)?.message || e);
      report.pipelineStack = String((e as Error)?.stack || '')
        .split('\n')
        .slice(0, 4)
        .join(' | ');
    }
  }

  return report;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));

    // --- Оношилгоо: нэвтрэлт шаардахгүй ---
    //
    // Энэ горим нь ЗӨВХӨН загвар ачаалагдаж байгаа эсэхийг хэлнэ — хувийн
    // мэдээлэл гаргахгүй. Нэвтрэлтгүй болгосон шалтгаан: асуудал гарахад
    // curl-ээр шууд шалгаж, жинхэнэ алдааг харах боломжтой байх ёстой.
    if (body?.mode === 'health') {
      return json(await healthReport(supabaseUrl, serviceKey, body?.imageBase64));
    }

    // --- Хэрэглэгчийг токеноор нь тодорхойлно ---
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'not_authenticated' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'not_authenticated' }, 401);

    const mode = body?.mode === 'enroll' ? 'enroll' : 'verify';
    const imageBase64 = body?.imageBase64;
    if (!imageBase64) return json({ error: 'missing_image' }, 400);

    // --- Загвар ачаалах ---
    // Алдааг үе шаттайгаар мэдээлнэ — эс бөгөөс "non-2xx" гэдэг ерөнхий
    // мессежээс юу болсныг мэдэх боломжгүй.
    let sessions;
    try {
      sessions = await getSessions(supabaseUrl, serviceKey);
    } catch (e) {
      return json(
        { error: `Загвар ачаалж чадсангүй: ${String((e as Error)?.message || e)}`, stage: 'model-load' },
        500
      );
    }
    const { detector, recognizer } = sessions;

    let img;
    try {
      img = decodeJpeg(base64ToBytes(imageBase64));
    } catch (e) {
      return json(
        { error: `Зураг задлаж чадсангүй: ${String((e as Error)?.message || e)}`, stage: 'decode' },
        400
      );
    }

    const face = await detectLargestFace(detector, img);
    if (!face) {
      return json({ ok: false, reason: 'no_face', message: 'Царай олдсонгүй. Гэрэл сайтай газар, камер руу эгц харна уу.' });
    }

    const aligned = alignFace(img, face.landmarks);
    const embedding = await embedFace(recognizer, aligned);

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Бүртгэх ---
    if (mode === 'enroll') {
      const pose = String(body?.pose || 'center');
      if (!ALLOWED_POSES.includes(pose)) return json({ error: 'invalid_pose' }, 400);

      const { data: profile } = await admin
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      // ⚠️ `upsert({ onConflict: 'user_id,pose' })` ашиглахгүй.
      //
      //    `face_templates` дээр (user_id, pose) unique constraint БАЙХГҮЙ
      //    тул PostgREST дараах алдааг өгдөг:
      //      "there is no unique or exclusion constraint matching the
      //       ON CONFLICT specification"
      //
      //    Constraint нэмэх migration бичсэн ч (migration_face_verify_edge.sql)
      //    түүнээс ХАМААРАХГҮЙ байх нь илүү найдвартай: хуучин мөрийг устгаад
      //    шинийг оруулна. Үр дүн нь ижил — нэг ажилтан, нэг өнцөг, нэг мөр.
      await admin
        .from('face_templates')
        .delete()
        .eq('user_id', user.id)
        .eq('pose', pose);

      const { error } = await admin.from('face_templates').insert({
        user_id: user.id,
        user_name: profile?.name || null,
        pose,
        embedding,
        // `quality` баганад check (0..1) байгаа. YuNet-ийн оноо хэвийн
        // үедээ энэ завсарт байдаг ч хязгаарыг давбал бүх бүртгэл унана.
        quality: Math.min(1, Math.max(0, face.score)),
        model_version: MODEL_VERSION,
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);

      const { count } = await admin
        .from('face_templates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      return json({ ok: true, mode, pose, enrolled: count || 0, quality: face.score });
    }

    // --- Таних ---
    const { data: templates, error: readError } = await admin
      .from('face_templates')
      .select('pose, embedding')
      .eq('user_id', user.id);
    if (readError) return json({ error: readError.message }, 500);
    if (!templates?.length) {
      return json({ ok: false, reason: 'not_enrolled', message: 'Царай бүртгэгдээгүй байна.' });
    }

    const scores = templates
      .map((t) => cosineSimilarity(embedding, t.embedding as number[]))
      .sort((a, b) => b - a);

    const best = scores[0] ?? 0;
    // Дээд гурвын дундаж — нэг өнцөг санамсаргүй таарахаас сэргийлнэ
    const top = scores.slice(0, 3);
    const topAvg = top.reduce((s, v) => s + v, 0) / (top.length || 1);
    const match = best >= MATCH_THRESHOLD && topAvg >= TOP_AVERAGE_THRESHOLD;

    return json({
      ok: true,
      mode,
      match,
      confidence: best,
      topAverage: topAvg,
      quality: face.score,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
