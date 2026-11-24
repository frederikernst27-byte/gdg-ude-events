// Aggregated click statistics for the dashboard and the QR tool.
// Returns counts only (public.gdg_stats) – no raw events, no personal data.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=30",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return new Response(null, { status: 405, headers });

  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const { data, error } = await db.rpc("gdg_stats", { p_days: Number.isFinite(days) ? Math.round(days) : 30 });
  if (error) {
    console.error("gdg_stats failed", error);
    return new Response(JSON.stringify({ error: "stats unavailable" }), { status: 500, headers });
  }
  return new Response(JSON.stringify(data), { headers });
});
