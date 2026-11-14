// Math Land Explorers · land-upload
// 학생 화면에서 미션 완성 화면·테셀레이션 그림·PDF를 받아 비공개 보관함(land-files)에 저장합니다.
// 학생 로그인 표(token)와 운영 상태(마감·기한)를 land_file_check 로 확인한 뒤에만 저장합니다.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// 받을 수 있는 이름: 미션 1~7 완성 화면, 테셀레이션 그림·데이터, 보고서 PDF
const KEY = /^(m[1-7]|tess|tess_json|report)$/;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf", "application/json": "json",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "method" }, 405);
  try {
    const { token, run_id, key, data, action } = await req.json();

    // 학생이 자기 파일만 다시 볼 때(보고서 PDF 만들기용): 10분짜리 주소를 돌려줌
    if (action === "list") {
      if (typeof token !== "string" || !Number.isFinite(+run_id)) return json({ ok: false, code: "bad_request" }, 400);
      const { data: chk, error: e0 } = await admin.rpc("land_file_check", { p_token: token, p_run_id: +run_id });
      if (e0) throw e0;
      if (!chk?.ok) return json({ ok: false, code: chk?.code || "denied" });
      const dir = `${chk.slug}/${chk.year}/run${chk.run_id}/${chk.no}`;
      const { data: files, error: e3 } = await admin.storage.from("land-files").list(dir, { limit: 50 });
      if (e3) throw e3;
      const names = (files || []).map((f) => f.name).filter((n) => /^(m[1-7]|tess)\.(jpg|png)$/.test(n));
      const urls: Record<string, string> = {};
      if (names.length) {
        const { data: signed, error: e4 } = await admin.storage.from("land-files")
          .createSignedUrls(names.map((n) => `${dir}/${n}`), 600);
        if (e4) throw e4;
        (signed || []).forEach((s, i) => { if (s.signedUrl) urls[names[i].replace(/\.\w+$/, "")] = s.signedUrl; });
      }
      return json({ ok: true, urls });
    }

    if (typeof token !== "string" || !Number.isFinite(+run_id) || typeof key !== "string" || !KEY.test(key) ||
        typeof data !== "string") return json({ ok: false, code: "bad_request" }, 400);

    const m = data.match(/^data:([a-z]+\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!m || !TYPES[m[1]]) return json({ ok: false, code: "bad_type" }, 400);
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    if (bytes.length > 9 * 1024 * 1024) return json({ ok: false, code: "too_big" }, 413);

    const { data: chk, error: e1 } = await admin.rpc("land_file_check", { p_token: token, p_run_id: +run_id });
    if (e1) throw e1;
    if (!chk?.ok) return json({ ok: false, code: chk?.code || "denied" });

    // 예: treasure/2026/run3/1305/m1.jpg
    const path = `${chk.slug}/${chk.year}/run${chk.run_id}/${chk.no}/${key}.${TYPES[m[1]]}`;
    const { error: e2 } = await admin.storage.from("land-files").upload(path, bytes, {
      contentType: m[1], upsert: true, cacheControl: "60",
    });
    if (e2) throw e2;
    return json({ ok: true, path, saved_at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return json({ ok: false, code: "server_error" }, 500);
  }
});
