import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "server configuration error" }, { status: 500 });
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const missionId = body?.missionId;
  const eventId = body?.eventId;
  if (!missionId || !eventId) return NextResponse.json({ error: "missionId and eventId are required" }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: mission } = await admin.from("missions").select("*, matches!inner(event_id,user_a,user_b)").eq("id", missionId).eq("matches.event_id", eventId).maybeSingle();
  if (!mission) return NextResponse.json({ error: "mission not found" }, { status: 404 });
  if (mission.status !== "complete") return NextResponse.json({ error: "mission is not complete" }, { status: 409 });
  const match = mission.matches;
  if (match.user_a !== user.id && match.user_b !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: existing } = await admin.from("rewards").select("*").eq("mission_id", missionId).eq("user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ data: existing });

  const { data, error } = await admin.from("rewards").insert({
    user_id: user.id,
    event_id: eventId,
    mission_id: missionId,
    title: mission.reward_title || "Event Reward",
    description: body.description || null,
    xp: mission.reward_xp || 0,
  }).select().single();

  if (error) return NextResponse.json({ error: "reward creation failed" }, { status: 500 });
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
