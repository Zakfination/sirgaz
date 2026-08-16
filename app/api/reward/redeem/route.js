import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "server configuration error" }, { status: 500 });
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return NextResponse.json({ error: "venue authentication required" }, { status: 401 });

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const code = String(body?.code || "").trim();
  if (!code || code.length > 64) return NextResponse.json({ error: "invalid reward code" }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: reward } = await admin.from("rewards").select("*").eq("code", code).maybeSingle();
  if (!reward) return NextResponse.json({ error: "reward not found" }, { status: 404 });
  if (reward.redeemed_at) return NextResponse.json({ error: "reward already redeemed", redeemed_at: reward.redeemed_at }, { status: 409 });

  const { data: event } = await admin.from("events").select("venue_id, venues(owner_id)").eq("id", reward.event_id).maybeSingle();
  if (!event || event.venues?.owner_id !== user.id) return NextResponse.json({ error: "forbidden: not this venue" }, { status: 403 });

  const redeemedAt = new Date().toISOString();
  const { data, error } = await admin.from("rewards").update({ redeemed_at: redeemedAt }).eq("id", reward.id).is("redeemed_at", null).select().maybeSingle();
  if (error) return NextResponse.json({ error: "redemption failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "reward already redeemed" }, { status: 409 });
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
