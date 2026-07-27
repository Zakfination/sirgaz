"use client";

import { getSupabase } from "@/lib/supabaseClient";

// ---------------- PROFILES ----------------
export const upsertProfile = async (userId, patch) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const { data, error } = await sb
    .from("profiles")
    .upsert({ id: userId, ...patch })
    .select()
    .single();
  return { data, error: error?.message };
};
export const getProfile = async (userId) => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
};

// ---------------- VENUES ----------------
export const HEVN_DEFAULTS = {
  name: "Hevn Station",
  category: "Night Club",
  description: "New Light Hevn 4.0",
  instagram: "@thehevn",
  address: "",
  logo_url: "",
};

export const getMyVenue = async (userId) => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("venues")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
};
export const createVenue = async (userId, patch) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const { data, error } = await sb
    .from("venues")
    .insert({ owner_id: userId, ...patch })
    .select()
    .single();
  return { data, error: error?.message };
};
export const updateVenue = async (venueId, patch) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const { data, error } = await sb
    .from("venues")
    .update(patch)
    .eq("id", venueId)
    .select()
    .single();
  return { data, error: error?.message };
};

/**
 * Returns the user's venue. Does NOT auto-create anymore.
 * Callers check `isVenueConfigured(v)` and redirect to setup if false.
 */
export const isVenueConfigured = (v) => {
  if (!v) return false;
  if (!v.name) return false;
  const generic = ["my venue", ""];
  if (generic.includes(String(v.name).trim().toLowerCase())) return false;
  return true;
};

/** Legacy shim — callers pass defaults; keeps prior signature working */
export const ensureVenue = async (userId, defaults = HEVN_DEFAULTS) => {
  const existing = await getMyVenue(userId);
  if (existing) return existing;
  const { data } = await createVenue(userId, defaults);
  return data;
};

// ---------------- EVENTS ----------------
export const listEvents = async (venueId) => {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("events")
    .select("*")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  return data || [];
};
export const listPublishedEvents = async () => {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("events")
    .select("*, venues(name)")
    .in("status", ["published", "live"])
    .order("starts_at", { ascending: true });
  return data || [];
};
export const getEvent = async (id) => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("events")
    .select("*, venues(name, address)")
    .eq("id", id)
    .maybeSingle();
  return data;
};
export const createEvent = async (venueId, patch) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const { data, error } = await sb
    .from("events")
    .insert({ venue_id: venueId, ...patch })
    .select()
    .single();
  return { data, error: error?.message };
};
export const updateEvent = async (id, patch) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const { data, error } = await sb
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  return { data, error: error?.message };
};
export const deleteEvent = async (id) => {
  const sb = getSupabase();
  await sb.from("events").delete().eq("id", id);
};

// ---------------- PARTICIPANTS ----------------
export const joinEvent = async (eventId, userId) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const { data, error } = await sb
    .from("event_participants")
    .upsert(
      { event_id: eventId, user_id: userId, status: "waiting" },
      { onConflict: "event_id,user_id" },
    )
    .select()
    .single();
  return { data, error: error?.message };
};
export const listParticipants = async (eventId) => {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: parts, error } = await sb
    .from("event_participants")
    .select("*")
    .eq("event_id", eventId)
    .order("joined_at", { ascending: true });
  if (error || !parts) return [];

  const userIds = parts.map((p) => p.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await sb
    .from("profiles")
    .select("*")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  return parts.map((p) => ({
    ...p,
    profiles: profileMap.get(p.user_id) || null,
  }));
};
export const countParticipants = async (eventId) => {
  const sb = getSupabase();
  if (!sb) return 0;
  const { count } = await sb
    .from("event_participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count || 0;
};

import { computeVibeMatch } from "@/lib/vibe";

// ---------------- MATCHING ----------------
// Delegates to vibe.js computeVibeMatch (interest overlap + energy + goal + music + zodiac bonus)
export const computeCompat = (a, b) => {
  const r = computeVibeMatch(a, b);
  return { score: r.score, breakdown: { ...r.breakdown, reasons: r.reasons } };
};

export const findOrCreateMatch = async (eventId, meId) => {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: existing } = await sb
    .from("matches")
    .select("*")
    .eq("event_id", eventId)
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  // Ambil semua user yang SUDAH matched di event ini
  const { data: existingMatches } = await sb
    .from("matches")
    .select("user_a, user_b")
    .eq("event_id", eventId);
  const matchedIds = new Set(
    (existingMatches || []).flatMap((m) => [m.user_a, m.user_b]),
  );

  const parts = await listParticipants(eventId);
  const me = parts.find((p) => p.user_id === meId);
  if (!me) return null;

  const candidates = parts.filter(
    (p) => p.user_id !== meId && !matchedIds.has(p.user_id),
  );
  if (candidates.length === 0) return null;

  let best = null;
  for (const c of candidates) {
    const r = computeVibeMatch(me.profiles, c.profiles);
    if (!best || r.score > best.score) {
      best = {
        score: r.score,
        breakdown: { ...r.breakdown, reasons: r.reasons },
        user_b: c.user_id,
      };
    }
  }

  const { data: created, error } = await sb
    .from("matches")
    .insert({
      event_id: eventId,
      user_a: meId,
      user_b: best.user_b,
      score: best.score,
      breakdown: best.breakdown,
    })
    .select()
    .single();

  if (error) {
    console.error("match insert failed:", error.message);
    // kemungkinan race condition — coba re-check existing match
    const { data: retry } = await sb
      .from("matches")
      .select("*")
      .eq("event_id", eventId)
      .or(`user_a.eq.${meId},user_b.eq.${meId}`)
      .limit(1)
      .maybeSingle();
    return retry || null;
  }

  // Tandai kedua user sebagai 'matched'
  await sb
    .from("event_participants")
    .update({ status: "matched" })
    .eq("event_id", eventId)
    .in("user_id", [meId, best.user_b]);

  return created;
};

export const getMatch = async (id) => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("matches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
};

export const getMatchPeer = async (match, meId) => {
  if (!match) return null;
  const sb = getSupabase();
  const peerId = match.user_a === meId ? match.user_b : match.user_a;
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", peerId)
    .maybeSingle();
  return data;
};

// ---------------- MISSIONS ----------------
const MISSION_TEMPLATES = [
  {
    title: "Find your match. Blue jacket. White shoes. Near bar.",
    clues: [
      { label: "Blue leather jacket", done: false },
      { label: "White sneakers", done: false },
      { label: "Near the main bar", done: false },
      { label: "Say hi", done: false },
    ],
    reward_xp: 280,
    reward_title: "20% off drinks",
  },
  {
    title: "Locate them by the dance floor. Wearing black.",
    clues: [
      { label: "Black outfit", done: false },
      { label: "On the dance floor", done: false },
      { label: "Ask for a drink together", done: false },
      { label: "Take a selfie together", done: false },
    ],
    reward_xp: 200,
    reward_title: "Free entry next event",
  },
  {
    title: "Spot them near the DJ booth. Give them a compliment.",
    clues: [
      { label: "Near DJ booth", done: false },
      { label: "Introduce yourself", done: false },
      { label: "Compliment their style", done: false },
      { label: "Exchange one story", done: false },
    ],
    reward_xp: 220,
    reward_title: "1 free ride home",
  },
];

export const getOrCreateMission = async (matchId) => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: existing } = await sb
    .from("missions")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (existing) return existing;
  const tmpl =
    MISSION_TEMPLATES[Math.floor(Math.random() * MISSION_TEMPLATES.length)];
  const { data } = await sb
    .from("missions")
    .insert({ match_id: matchId, ...tmpl })
    .select()
    .single();
  return data;
};

export const updateMission = async (id, patch) => {
  const sb = getSupabase();
  const { data } = await sb
    .from("missions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  return data;
};

// ---------------- MESSAGES ----------------
export const listMessages = async (matchId) => {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  return data || [];
};

export const sendMessage = async (matchId, senderId, content) => {
  const sb = getSupabase();
  if (!sb) return { error: "no client" };
  const trimmed = (content || "").trim();
  if (!trimmed) return { error: "empty message" };
  const { data, error } = await sb
    .from("messages")
    .insert({ match_id: matchId, sender_id: senderId, content: trimmed })
    .select()
    .single();
  return { data, error: error?.message };
};

export const subscribeMessages = (matchId, onInsert) => {
  const sb = getSupabase();
  if (!sb) return null;
  const channel = sb
    .channel(`messages:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
  return channel; // caller must call sb.removeChannel(channel) on unmount
};

// ---------------- REWARDS ----------------
export const createReward = async (userId, eventId, missionId, patch) => {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("rewards")
    .insert({
      user_id: userId,
      event_id: eventId,
      mission_id: missionId,
      ...patch,
    })
    .select()
    .single();
  return { data, error: error?.message };
};
export const listMyRewards = async (userId) => {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("rewards")
    .select("*, events(title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
};
export const redeemReward = async (code) => {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("rewards")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("code", code)
    .select()
    .single();
  return { data, error: error?.message };
};

// ---------------- URLS ----------------
export const eventPublicUrl = (eventId) => {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/e/${eventId}`;
};
export const rewardRedeemUrl = (code) => {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/r/${code}`;
};
