import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeServerVibeMatch } from "@/lib/vibeMatchServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  if (!url || !anonKey || !serviceKey) return json({ error: "server configuration error" }, 500);

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json({ error: "unauthorized" }, 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
  const eventId = body?.eventId;
  if (!eventId) return json({ error: "eventId is required" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: mePart } = await admin.from("event_participants").select("*").eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  if (!mePart) return json({ error: "not an event participant" }, 403);

  const { data: existing } = await admin.from("matches").select("*").eq("event_id", eventId).or(`user_a.eq.${user.id},user_b.eq.${user.id}`).limit(1).maybeSingle();
  if (existing) return json({ match: existing });

  const { data: participants, error: participantsError } = await admin.from("event_participants").select("user_id,status").eq("event_id", eventId).eq("status", "waiting");
  if (participantsError) return json({ error: "could not load participants" }, 500);

  const ids = (participants || []).map(p => p.user_id).filter(id => id !== user.id);
  if (!ids.length) return json({ match: null });

  const { data: matches } = await admin.from("matches").select("user_a,user_b").eq("event_id", eventId);
  const matched = new Set((matches || []).flatMap(m => [m.user_a, m.user_b]));
  const candidateIds = ids.filter(id => !matched.has(id));
  if (!candidateIds.length) return json({ match: null });

  const { data: profiles, error: profileError } = await admin.from("profiles").select("*").in("id", [user.id, ...candidateIds]);
  if (profileError) return json({ error: "could not load profiles" }, 500);
  const me = (profiles || []).find(p => p.id === user.id);
  if (!me) return json({ error: "profile incomplete" }, 400);

  let best = null;
  for (const candidate of (profiles || []).filter(p => candidateIds.includes(p.id))) {
    const result = computeServerVibeMatch(me, candidate);
    if (!best || result.score > best.score) best = { candidate, result };
  }
  if (!best) return json({ match: null });

  const { data: created, error: insertError } = await admin.from("matches").insert({
    event_id: eventId,
    user_a: user.id,
    user_b: best.candidate.id,
    score: best.result.score,
    breakdown: best.result.breakdown,
  }).select().single();

  if (insertError) {
    const { data: retry } = await admin.from("matches").select("*").eq("event_id", eventId).or(`user_a.eq.${user.id},user_b.eq.${user.id}`).limit(1).maybeSingle();
    return retry ? json({ match: retry }) : json({ error: "match creation failed" }, 409);
  }

  await admin.from("event_participants").update({ status: "matched" }).eq("event_id", eventId).in("user_id", [user.id, best.candidate.id]);
  return json({ match: created });
}
