// Receives tracking events from the landing page (navigator.sendBeacon, text/plain JSON)
// and stores them via public.gdg_track. Public endpoint: no JWT, but strict validation
// and only our own origins are accepted.
import { createClient } from "npm:@supabase/supabase-js@2";

const NAMES = new Set(["page_view", "register_click", "more_event_click", "more_link_click"]);
const ALLOWED_ORIGIN = /^(https:\/\/frederikernst27-byte\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const str = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

function reply(status: number, origin: string | null) {
  return new Response(null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin && ALLOWED_ORIGIN.test(origin) ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      Vary: "Origin",
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return reply(204, origin);
  if (req.method !== "POST") return reply(405, origin);
  if (origin && !ALLOWED_ORIGIN.test(origin)) return reply(403, origin);

  const raw = await req.text();
  if (raw.length > 4000) return reply(413, origin);

  let p: Record<string, unknown>;
  try {
    p = JSON.parse(raw);
  } catch {
    return reply(400, origin);
  }
  if (!p || typeof p !== "object" || !NAMES.has(p.name as string)) return reply(400, origin);

  const row = {
    name: p.name,
    event_id: Number.isSafeInteger(p.event_id) ? p.event_id : null,
    mode: str(p.mode, 20),
    target: str(p.target, 40),
    src: str(p.src, 60)?.toLowerCase() ?? null,
    path: str(p.path, 300),
    referrer: str(p.referrer, 300),
    session: str(p.session, 64),
  };

  const { error } = await db.rpc("gdg_track", { p: row });
  if (error) {
    console.error("gdg_track failed", error);
    return reply(500, origin);
  }
  return reply(204, origin);
});
