import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMPLATES = [
  { title: "Find your match. Blue jacket. White shoes. Near bar.", clues: [{label:"Blue leather jacket",done:false},{label:"White sneakers",done:false},{label:"Near the main bar",done:false},{label:"Say hi",done:false}], reward_xp: 280, reward_title: "20% off drinks" },
  { title: "Locate them by the dance floor. Wearing black.", clues: [{label:"Black outfit",done:false},{label:"On the dance floor",done:false},{label:"Ask for a drink together",done:false},{label:"Take a selfie together",done:false}], reward_xp: 200, reward_title: "Free entry next event" },
  { title: "Spot them near the DJ booth. Give them a compliment.", clues: [{label:"Near DJ booth",done:false},{label:"Introduce yourself",done:false},{label:"Compliment their style",done:false},{label:"Exchange one story",done:false}], reward_xp: 220, reward_title: "1 free ride home" },
];

async function authUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const auth = createClient(url, anonKey, { auth: { persistSession:false, autoRefreshToken:false } });
  const { data: { user } } = await auth.auth.getUser(token);
  return user || null;
}

export async function POST(request) {
  if (!url || !anonKey || !serviceKey) return NextResponse.json({error:"server configuration error"},{status:500});
  const user = await authUser(request);
  if (!user) return NextResponse.json({error:"unauthorized"},{status:401});
  let body; try { body = await request.json(); } catch { return NextResponse.json({error:"invalid json"},{status:400}); }
  const matchId = body?.matchId;
  if (!matchId) return NextResponse.json({error:"matchId is required"},{status:400});
  const admin = createClient(url, serviceKey, { auth:{persistSession:false,autoRefreshToken:false} });
  const { data: match } = await admin.from("matches").select("*").eq("id",matchId).maybeSingle();
  if (!match || (match.user_a !== user.id && match.user_b !== user.id)) return NextResponse.json({error:"forbidden"},{status:403});
  const { data: existing } = await admin.from("missions").select("*").eq("match_id",matchId).maybeSingle();
  if (existing) return NextResponse.json({data:existing});
  const template = TEMPLATES[Math.floor(Math.random()*TEMPLATES.length)];
  const { data, error } = await admin.from("missions").insert({match_id:matchId,...template}).select().single();
  if (error) return NextResponse.json({error:"mission creation failed"},{status:500});
  return NextResponse.json({data});
}

export async function PATCH(request) {
  if (!url || !anonKey || !serviceKey) return NextResponse.json({error:"server configuration error"},{status:500});
  const user = await authUser(request);
  if (!user) return NextResponse.json({error:"unauthorized"},{status:401});
  let body; try { body = await request.json(); } catch { return NextResponse.json({error:"invalid json"},{status:400}); }
  const missionId = body?.missionId;
  if (!missionId) return NextResponse.json({error:"missionId is required"},{status:400});
  const admin = createClient(url, serviceKey, { auth:{persistSession:false,autoRefreshToken:false} });
  const { data: mission } = await admin.from("missions").select("*, matches!inner(user_a,user_b)").eq("id",missionId).maybeSingle();
  if (!mission || (mission.matches.user_a !== user.id && mission.matches.user_b !== user.id)) return NextResponse.json({error:"forbidden"},{status:403});
  const patch = body?.patch || {};
  const allowed = {};
  if (Array.isArray(patch.clues)) allowed.clues = patch.clues.map(c => ({label:String(c.label||"").slice(0,120),done:Boolean(c.done)}));
  const allDone = Array.isArray(allowed.clues) && allowed.clues.length > 0 && allowed.clues.every(c => c.done);
  if (patch.status === "complete") {
    const clues = allowed.clues || mission.clues || [];
    if (!Array.isArray(clues) || !clues.length || !clues.every(c => c.done)) return NextResponse.json({error:"all mission clues must be complete"},{status:409});
    allowed.status = "complete";
  } else if (allowed.clues) {
    allowed.status = allDone ? "complete" : "active";
  }
  if (!Object.keys(allowed).length) return NextResponse.json({error:"no allowed changes"},{status:400});
  const { data, error } = await admin.from("missions").update(allowed).eq("id",missionId).select().single();
  if (error) return NextResponse.json({error:"mission update failed"},{status:500});
  return NextResponse.json({data});
}
