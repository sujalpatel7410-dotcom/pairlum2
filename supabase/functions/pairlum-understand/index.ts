// Pairlum "understanding" service — implements the exact contract app.js
// already expects (see app.js's sendToService/pollService/askServiceSearch,
// around line 7925 onward):
//
//   POST   {this function's URL}/v1/recordings         -> { status: "pending" } (202)
//   GET    {this function's URL}/v1/recordings/{id}     -> { status, transcript, title, feeling, language, topics, people, events, keywords }
//   DELETE {this function's URL}/v1/recordings/{id}     -> 204 (best-effort, fire-and-forget on the client)
//   POST   {this function's URL}/v1/search              -> { results: [{ recordingId, score }] }
//
// Deploy: supabase functions deploy pairlum-understand
// Secrets: supabase secrets set OPENAI_API_KEY=sk-...
// Then set pairlum-config.js's understand.url to this function's invoke URL
// (see supabase/SETUP.md, "Voice understanding" section). understand.token
// is only a fallback for demo/no-session setups — app.js sends the real
// signed-in user's session token whenever one exists (see serviceHeaders()
// in app.js), and every route below checks that token's owner is actually a
// member of the space being touched (authenticate() + isSpaceMember()).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Auto-injected by the Supabase runtime alongside the two above — used only
// to validate a caller's own access token (see authenticate() below), never
// to read/write data (that's what SERVICE_ROLE_KEY is for).
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Only Pairlum's own sites may call this from a browser. Override with the
// ALLOWED_ORIGINS secret (comma-separated) once the real domain is known:
//   supabase secrets set ALLOWED_ORIGINS=https://pairlum.com,https://www.pairlum.com
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8743,https://pairlum.com,https://www.pairlum.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
const CORS = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Vary": "Origin",
};
function withAllowedOrigin(req: Request, res: Response): Response {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) res.headers.set("Access-Control-Allow-Origin", origin);
  return res;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Who is actually calling? This function runs with the service-role key
// (it bypasses RLS by design, to reach auth.users and write recordings), so
// unlike every other table access in this app, NOTHING here is enforced by
// Postgres row-level security — this function is the only thing standing
// between "any request with the public anon key" and another couple's voice
// transcripts. The platform's own JWT check only confirms the Authorization
// header is *some* validly-signed Supabase token (the public anon key
// qualifies), not that it belongs to a specific person — so every route
// below must independently check that the caller is actually a member of
// the space it's touching. Returns the caller's user id, or null if the
// token is missing/invalid/just the anon key with no attached user.
async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Reading or erasing write-ups: any member (history stays readable after
// stepping away). Creating one — which spends OpenAI credit and writes — needs
// an ACTIVE member, the same rule the database applies to every other write.
async function isSpaceMember(userId: string, spaceId: string, activeOnly = false): Promise<boolean> {
  let q = db.from("space_members").select("space_id").eq("space_id", spaceId).eq("user_id", userId);
  if (activeOnly) q = q.eq("status", "active");
  const { data } = await q.limit(1).maybeSingle();
  return !!data;
}

const FEELINGS = ["happy", "calm", "loving", "missing", "playful", "excited", "tired", "worried", "rough"];

Deno.serve(async (req) => withAllowedOrigin(req, await route(req)));

async function route(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // app.js calls "<url>/v1/recordings[/id]" or "<url>/v1/search" — <url> is
  // this function's own invoke URL, so everything after the function name in
  // the path is the route we dispatch on.
  // Supabase's own invoke URL already contains "/functions/v1/" before the
  // function name, so this path has "v1" twice — the LAST one is where our
  // own route starts (lastIndexOf, not indexOf, is the point here).
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const vIdx = parts.lastIndexOf("v1");
  const route = vIdx >= 0 ? parts.slice(vIdx) : [];

  try {
    if (route[0] === "v1" && route[1] === "recordings" && req.method === "POST" && !route[2]) {
      return await handleCreate(req);
    }
    if (route[0] === "v1" && route[1] === "recordings" && req.method === "GET" && route[2]) {
      return await handleGet(req, route[2]);
    }
    if (route[0] === "v1" && route[1] === "recordings" && req.method === "DELETE" && route[2]) {
      return await handleDelete(req, route[2]);
    }
    if (route[0] === "v1" && route[1] === "search" && req.method === "POST") {
      return await handleSearch(req);
    }
    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
}

async function handleCreate(req: Request): Promise<Response> {
  if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not set" }, 500);
  const userId = await authenticate(req);
  if (!userId) return json({ error: "sign in required" }, 401);
  const form = await req.formData();
  const audio = form.get("audio");
  const metaRaw = form.get("meta");
  if (!(audio instanceof File) || typeof metaRaw !== "string") return json({ error: "expected audio + meta" }, 400);
  let meta: any = {};
  try { meta = JSON.parse(metaRaw); } catch { /* ignore, validated below */ }
  const recordingId = String(meta.recordingId || "");
  const spaceId = String(meta.spaceId || "");
  if (!recordingId || !/^[0-9a-f-]{36}$/i.test(spaceId)) return json({ error: "invalid meta" }, 400);

  // Before spending OpenAI credits (or writing anything): the caller must
  // actually belong to this space. is_space_member's own check already
  // implies the space exists, so there's no separate existence check to
  // bypass here — a nonexistent space can't have a member row either.
  if (!(await isSpaceMember(userId, spaceId, true))) return json({ error: "not an active member of this space" }, 403);

  await db.from("recordings").upsert({ id: recordingId, space_id: spaceId, status: "pending", error: null });

  const audioBytes = await audio.arrayBuffer();
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(
    process(recordingId, audioBytes, audio.type || "audio/webm", meta).catch(async (err) => {
      console.error("understand failed", recordingId, err);
      await db.from("recordings").update({ status: "failed", error: String(err) }).eq("id", recordingId);
    }),
  );

  return json({ status: "pending" }, 202);
}

async function process(recordingId: string, audioBytes: ArrayBuffer, mime: string, meta: any) {
  const transcript = await transcribe(audioBytes, mime);
  const extracted = await extract(transcript, meta);
  await db.from("recordings").update({
    status: "ready",
    transcript,
    title: extracted.title || null,
    feeling: FEELINGS.includes(extracted.feeling) ? extracted.feeling : null,
    language: extracted.language || null,
    topics: extracted.topics || [],
    people: extracted.people || [],
    events: extracted.events || [],
    keywords: extracted.keywords || [],
    updated_at: new Date().toISOString(),
  }).eq("id", recordingId);
}

async function transcribe(audioBytes: ArrayBuffer, mime: string): Promise<string> {
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
  const fd = new FormData();
  fd.append("file", new Blob([audioBytes], { type: mime }), "recording." + ext);
  fd.append("model", "whisper-1");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + OPENAI_API_KEY },
    body: fd,
  });
  if (!r.ok) throw new Error("whisper " + r.status + " " + (await r.text()).slice(0, 300));
  const data = await r.json();
  return String(data.text || "").trim();
}

async function extract(transcript: string, meta: any): Promise<any> {
  if (!transcript) return {};
  const names = Array.isArray(meta.names) ? meta.names.filter(Boolean) : [];
  const prompt =
    "A voice note between two partners in a long-distance relationship app. " +
    (names.length ? "Their names: " + names.join(" and ") + ". " : "") +
    "Transcript:\n\"\"\"\n" + transcript.slice(0, 4000) + "\n\"\"\"\n\n" +
    "Return a JSON object with these fields only:\n" +
    '- "title": a short (max 6 words) title for this moment\n' +
    '- "feeling": exactly one of ' + JSON.stringify(FEELINGS) + ' that best matches the tone, or "" if unclear\n' +
    '- "language": the transcript\'s language as a short code, e.g. "en"\n' +
    '- "topics": up to 4 short topic words/phrases\n' +
    '- "people": up to 4 names of people mentioned (besides the two partners)\n' +
    '- "events": up to 4 short event/plan mentions\n' +
    '- "keywords": up to 8 standout words or short phrases for search';
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You extract short, structured metadata from a personal voice note transcript. Reply with JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!r.ok) throw new Error("extract " + r.status + " " + (await r.text()).slice(0, 300));
  const data = await r.json();
  try { return JSON.parse(data.choices[0].message.content); } catch { return {}; }
}

async function handleGet(req: Request, id: string): Promise<Response> {
  const userId = await authenticate(req);
  if (!userId) return json({ error: "sign in required" }, 401);
  const { data, error } = await db.from("recordings").select("*").eq("id", id).maybeSingle();
  if (error) return json({ error: String(error.message) }, 500);
  // Same response for "doesn't exist" and "exists but isn't yours" — a 404
  // here would otherwise confirm to a caller guessing ids that one of their
  // guesses hit a real recording, even though they can't read it.
  if (!data || !(await isSpaceMember(userId, data.space_id))) return json({ error: "not found" }, 404);
  return json(data);
}

async function handleDelete(req: Request, id: string): Promise<Response> {
  const userId = await authenticate(req);
  if (!userId) return json({ error: "sign in required" }, 401);
  const { data } = await db.from("recordings").select("space_id").eq("id", id).maybeSingle();
  if (!data) return new Response(null, { status: 204, headers: CORS }); // already gone: same no-op either way
  if (!(await isSpaceMember(userId, data.space_id))) return json({ error: "not found" }, 404);
  await db.from("recordings").delete().eq("id", id);
  return new Response(null, { status: 204, headers: CORS });
}

// Simple keyword overlap search over stored transcripts/keywords — a
// reasonable v1 "matching by meaning" without a vector DB. Swap for pgvector
// + embeddings later if you want true semantic search.
async function handleSearch(req: Request): Promise<Response> {
  const userId = await authenticate(req);
  if (!userId) return json({ error: "sign in required" }, 401);
  const body = await req.json().catch(() => ({}));
  const spaceId = String(body.spaceId || "");
  const query = String(body.query || "").toLowerCase().trim();
  const limit = Math.min(20, Number(body.limit) || 20);
  if (!spaceId || query.length < 3) return json({ results: [] });
  if (!(await isSpaceMember(userId, spaceId))) return json({ error: "not a member of this space" }, 403);
  const { data } = await db.from("recordings").select("id, transcript, title, topics, keywords")
    .eq("space_id", spaceId).eq("status", "ready").limit(200);
  const terms = query.split(/\s+/).filter(Boolean);
  const results = (data || []).map((rec: any) => {
    const hay = [rec.transcript, rec.title, ...(rec.topics || []), ...(rec.keywords || [])].join(" ").toLowerCase();
    const hits = terms.filter((t) => hay.includes(t)).length;
    return { recordingId: rec.id, score: hits / Math.max(1, terms.length) };
  }).filter((r: any) => r.score > 0).sort((a: any, b: any) => b.score - a.score).slice(0, limit);
  return json({ results });
}
