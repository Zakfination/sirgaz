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

  const { data: profiles, error: profileError } = await admin.from("profiles").select("*").in("id", [user.id, ...ids]);
  if (profileError) return json({ error: "could not load profiles" }, 500);
  const me = (profiles || []).find(p => p.id === user.id);
  if (!me) return json({ error: "profile incomplete" }, 400);

  const candidates = (profiles || []).filter(p => ids.includes(p.id));
  candidates.sort((a, b) => computeServerVibeMatch(me, b).score - computeServerVibeMatch(me, a).score);

  // The database function serializes the event and rechecks both users while locked.
  // If a concurrent request claimed this candidate, try the next candidate.
  for (const candidate of candidates) {
    const result = computeServerVibeMatch(me, candidate);
    const { data: created, error: atomicError } = await admin.rpc("create_match_atomic", {
      p_event_id: eventId,
      p_user_id: user.id,
      p_candidate_id: candidate.id,
      p_score: result.score,
      p_breakdown: result.breakdown,
    });

    if (!atomicError && created) return json({ match: created });
    if (atomicError?.code === "40001" || atomicError?.code === "42501") continue;
    if (atomicError?.code === "22023") return json({ error: "invalid match request" }, 400);
  }

  const { data: retry } = await admin.from("matches").select("*").eq("event_id", eventId).or(`user_a.eq.${user.id},user_b.eq.${user.id}`).limit(1).maybeSingle();
  return retry ? json({ match: retry }) : json({ match: null });
}
