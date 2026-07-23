"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Users, Heart, Gift, Activity, TrendingUp, Clock,
  Sparkles, Radio, Search, Check, X, DollarSign, Award, Target, Zap, MoreHorizontal,
  BarChart3, Calendar, MapPin, QrCode, CheckCircle2
} from "lucide-react";
import { useAuth } from "./authContext";
import { getSupabase } from "@/lib/supabaseClient";
import { StatusBar, TopBar, BigButton } from "./screens_extra";
import { getMyVenue, listEvents, getEvent, listParticipants, countParticipants, redeemReward } from "@/lib/db";

/* ================================================================
   Event picker — helper for live/analytics screens
   ================================================================ */
const useMyEvents = () => {
  const { session } = useAuth();
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    (async () => {
      if (!session?.user) { setLoading(false); return; }
      const v = await getMyVenue(session.user.id);
      if (v) setEvents(await listEvents(v.id));
      setLoading(false);
    })();
  }, [session]);
  return { events, loading };
};

const EventPicker = ({ events, activeId, onPick }) => (
  <div className="-mx-6 px-6 flex gap-2 overflow-x-auto phone-scroll pb-2">
    {events.map(e => {
      const on = activeId === e.id;
      return (
        <button key={e.id} onClick={() => onPick(e.id)}
          className={`shrink-0 h-9 px-3 rounded-full text-[12px] font-medium ${on ? "gradient-brand text-white glow-pink" : "glass text-white/80"}`}>
          {e.title.length > 24 ? e.title.slice(0,22)+"…" : e.title}
        </button>
      );
    })}
  </div>
);

/* ================================================================
   1. LIVE PARTICIPANTS  — real, per event, polling
   ================================================================ */
export const VenueLive = ({ go, params }) => {
  const { events, loading } = useMyEvents();
  const [eventId, setEventId] = React.useState(params?.eventId || null);
  const [participants, setParticipants] = React.useState([]);
  const [event, setEvent] = React.useState(null);

  React.useEffect(() => {
    if (!eventId && events.length > 0) setEventId(events[0].id);
  }, [events, eventId]);

  const refresh = React.useCallback(async () => {
    if (!eventId) return;
    setEvent(await getEvent(eventId));
    setParticipants(await listParticipants(eventId));
  }, [eventId]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const [query, setQuery] = React.useState("");
  const filtered = participants.filter(p => !query || (p.profiles?.name || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Live floor" onBack={() => go?.("venueDashboard")} right={<span className="text-[11px] text-[#00E5FF] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"/>Live</span>}/>
      <div className="px-6 pb-32">
        {loading && <div className="text-white/40 text-[13px]">Loading events…</div>}
        {!loading && events.length === 0 && (
          <div className="glass rounded-3xl p-8 text-center">
            <div className="text-[15px] font-semibold">No events yet</div>
            <button onClick={() => go?.("venueCreate")} className="mt-4 h-11 px-5 rounded-full gradient-brand text-[13px] font-semibold">Create your first</button>
          </div>
        )}
        {events.length > 0 && (
          <>
            <EventPicker events={events} activeId={eventId} onPick={setEventId}/>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatCard v={participants.length} l="Total"/>
              <StatCard v={participants.filter(p => p.status==="waiting").length} l="Waiting"/>
              <StatCard v={participants.filter(p => p.status==="matched").length} l="Matched"/>
            </div>

            <div className="mt-5 glass rounded-2xl h-11 flex items-center px-3 gap-2">
              <Search className="w-4 h-4 text-white/50"/>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search participants" className="flex-1 bg-transparent outline-none text-[13px]"/>
            </div>

            <div className="mt-4 space-y-2">
              {filtered.length === 0 && <div className="glass rounded-2xl p-6 text-center text-white/50 text-[13px]">No participants yet. Share the QR to fill the room.</div>}
              {filtered.map((p, i) => (
                <div key={p.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                  <img src={p.profiles?.avatar_url || `https://i.pravatar.cc/80?img=${(i%70)+1}`} className="w-10 h-10 rounded-full object-cover"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-2 truncate">{p.profiles?.name || "Guest"}<span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]"/></div>
                    <div className="text-[11px] text-white/50 truncate">{(p.profiles?.interests || []).slice(0,3).join(" · ") || "No interests"}</div>
                  </div>
                  <StatusPill status={p.status}/>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ v, l }) => (
  <div className="glass rounded-2xl p-3.5 text-center">
    <div className="text-[22px] font-semibold tracking-tighter">{v}</div>
    <div className="text-[11px] text-white/50">{l}</div>
  </div>
);
const StatusPill = ({ status }) => {
  const map = {
    waiting: { l: "Waiting", c: "bg-white/10 text-white/70" },
    matched: { l: "Matched", c: "gradient-brand text-white" },
    left: { l: "Left", c: "bg-white/5 text-white/40" },
  };
  const s = map[status] || map.waiting;
  return <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${s.c}`}>{s.l}</span>;
};

/* ================================================================
   2. LIVE MATCHES
   ================================================================ */
export const VenueMatches = ({ go, params }) => {
  const { events, loading } = useMyEvents();
  const [eventId, setEventId] = React.useState(params?.eventId || null);
  const [matches, setMatches] = React.useState([]);

  React.useEffect(() => { if (!eventId && events.length > 0) setEventId(events[0].id); }, [events, eventId]);

  const refresh = React.useCallback(async () => {
    if (!eventId) return;
    const sb = getSupabase(); if (!sb) return;
    // Fetch matches; RLS may block cross-user reads with anon. For MVP venue dashboard, we
    // rely on the fact that the venue owner’s auth is separate and matches remain visible
    // if they exist. Fallback to just counts when read is blocked.
    const { data } = await sb.from("matches").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    setMatches(data || []);
  }, [eventId]);

  React.useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Live matches" onBack={() => go?.("venueDashboard")} right={<span className="text-[11px] text-[#FF2F92] flex items-center gap-1"><Heart className="w-3 h-3"/>{matches.length}</span>}/>
      <div className="px-6 pb-32">
        {loading && <div className="text-white/40 text-[13px]">Loading…</div>}
        {!loading && events.length === 0 && <div className="glass rounded-3xl p-8 text-center text-[13px] text-white/60">Create an event first.</div>}
        {events.length > 0 && <>
          <EventPicker events={events} activeId={eventId} onPick={setEventId}/>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard v={matches.length} l="Total"/>
            <StatCard v={matches.length > 0 ? Math.round(matches.reduce((s,m)=>s+(m.score||0),0)/matches.length) + "%" : "—"} l="Avg score"/>
            <StatCard v={matches.filter(m => (m.score||0) >= 85).length} l="High vibe"/>
          </div>

          <div className="mt-6 space-y-2">
            {matches.length === 0 && <div className="glass rounded-2xl p-6 text-center text-white/50 text-[13px]">No matches yet.</div>}
            {matches.map((m, i) => (
              <div key={m.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="flex -space-x-3">
                  <div className="w-9 h-9 rounded-full border-2 border-black overflow-hidden bg-white/10"><img src={`https://i.pravatar.cc/80?u=${m.user_a}`} className="w-full h-full object-cover"/></div>
                  <div className="w-9 h-9 rounded-full border-2 border-black overflow-hidden bg-white/10"><img src={`https://i.pravatar.cc/80?u=${m.user_b}`} className="w-full h-full object-cover"/></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">Match #{i+1}</div>
                  <div className="text-[11px] text-white/50">{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-bold text-gradient">{m.score}%</div>
                  <div className="text-[10px] text-white/40">score</div>
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
};

/* ================================================================
   3. REWARD REDEEMS
   ================================================================ */
export const VenueRedeems = ({ go, params }) => {
  const { events, loading } = useMyEvents();
  const [eventId, setEventId] = React.useState(params?.eventId || null);
  const [rewards, setRewards] = React.useState([]);
  const [manual, setManual] = React.useState("");
  const [flash, setFlash] = React.useState("");

  React.useEffect(() => { if (!eventId && events.length > 0) setEventId(events[0].id); }, [events, eventId]);

  const refresh = React.useCallback(async () => {
    if (!eventId) return;
    const sb = getSupabase(); if (!sb) return;
    const { data } = await sb.from("rewards").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    setRewards(data || []);
  }, [eventId]);

  React.useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [refresh]);

  const doRedeem = async () => {
    if (!manual.trim()) return;
    const { data, error } = await redeemReward(manual.trim());
    if (error || !data) setFlash("Invalid code");
    else setFlash(`✓ Redeemed — ${data.title}`);
    setManual("");
    refresh();
    setTimeout(() => setFlash(""), 2500);
  };

  const redeemed = rewards.filter(r => r.redeemed_at);
  const outstanding = rewards.filter(r => !r.redeemed_at);

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Reward redeems" onBack={() => go?.("venueDashboard")} right={<Gift className="w-4 h-4 text-[#FF2F92]"/>}/>
      <div className="px-6 pb-32">
        {loading && <div className="text-white/40 text-[13px]">Loading…</div>}
        {!loading && events.length === 0 && <div className="glass rounded-3xl p-8 text-center text-[13px] text-white/60">Create an event first.</div>}
        {events.length > 0 && <>
          <EventPicker events={events} activeId={eventId} onPick={setEventId}/>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard v={rewards.length} l="Issued"/>
            <StatCard v={redeemed.length} l="Redeemed"/>
            <StatCard v={outstanding.length} l="Outstanding"/>
          </div>

          {/* Manual redeem */}
          <div className="mt-6 glass-strong rounded-3xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/40">Redeem code manually</div>
            <div className="mt-2 flex gap-2">
              <input value={manual} onChange={e=>setManual(e.target.value.trim())} placeholder="Enter reward code" className="flex-1 h-11 rounded-xl px-3 bg-white/[0.05] border border-white/10 outline-none text-[13px] font-mono placeholder-white/30"/>
              <button onClick={doRedeem} className="h-11 px-4 rounded-xl gradient-brand text-[13px] font-semibold glow-pink flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5"/> Redeem</button>
            </div>
            {flash && <div className={`mt-2 text-[12px] ${flash.startsWith("✓") ? "text-[#00E5FF]" : "text-[#FF2F92]"}`}>{flash}</div>}
          </div>

          <div className="mt-6 text-[13px] font-semibold">Recent redeems</div>
          <div className="mt-3 space-y-2">
            {rewards.length === 0 && <div className="glass rounded-2xl p-6 text-center text-white/50 text-[13px]">No rewards issued yet.</div>}
            {rewards.slice(0, 30).map(r => (
              <div key={r.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.redeemed_at ? "bg-[#00E5FF]/20 text-[#00E5FF]" : "gradient-brand-soft"}`}>
                  {r.redeemed_at ? <CheckCircle2 className="w-4 h-4"/> : <Gift className="w-4 h-4"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-white/50 font-mono">{r.code}</div>
                </div>
                <div className="text-right">
                  {r.redeemed_at
                    ? <div className="text-[11px] text-[#00E5FF]">Redeemed</div>
                    : <div className="text-[11px] text-white/50">Pending</div>}
                  <div className="text-[10px] text-white/40">{new Date(r.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
};

/* ================================================================
   4. EVENT ANALYTICS (per-event + venue-wide)
   ================================================================ */
export const VenueAnalytics = ({ go, params }) => {
  const { events, loading } = useMyEvents();
  const [eventId, setEventId] = React.useState(params?.eventId || null);
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => { if (!eventId && events.length > 0) setEventId(events[0].id); }, [events, eventId]);

  const refresh = React.useCallback(async () => {
    if (!eventId) return;
    const sb = getSupabase(); if (!sb) return;
    const [pCount, mRes, rRes] = await Promise.all([
      countParticipants(eventId),
      sb.from("matches").select("score, created_at").eq("event_id", eventId),
      sb.from("rewards").select("redeemed_at, xp").eq("event_id", eventId),
    ]);
    const matches = mRes.data || [];
    const rewards = rRes.data || [];
    const avg = matches.length ? Math.round(matches.reduce((s,m)=>s+(m.score||0),0)/matches.length) : 0;
    const redeemPct = rewards.length ? Math.round((rewards.filter(r=>r.redeemed_at).length/rewards.length)*100) : 0;
    // last 7 days participants breakdown — fallback simple bar of matches by day
    const byDay = Array(7).fill(0);
    const now = new Date();
    matches.forEach(m => {
      const d = new Date(m.created_at);
      const diff = Math.floor((now - d)/(1000*60*60*24));
      if (diff >= 0 && diff < 7) byDay[6-diff]++;
    });
    setStats({ participants: pCount, matches: matches.length, avg, rewards: rewards.length, redeemPct, byDay });
  }, [eventId]);

  React.useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  const days = ["M","T","W","T","F","S","S"];
  const maxBar = Math.max(1, ...(stats?.byDay || [1]));

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Analytics" onBack={() => go?.("venueDashboard")}/>
      <div className="px-6 pb-32">
        {loading && <div className="text-white/40 text-[13px]">Loading…</div>}
        {!loading && events.length === 0 && <div className="glass rounded-3xl p-8 text-center text-[13px] text-white/60">Create an event first.</div>}
        {events.length > 0 && <>
          <EventPicker events={events} activeId={eventId} onPick={setEventId}/>

          <div className="mt-4 glass-strong rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/50">Matches (7d)</div>
                <div className="mt-1 text-[32px] font-bold tracking-tighter">{stats?.matches || 0}</div>
              </div>
              <div className="text-[11px] px-2 py-1 rounded-full bg-[#00E5FF]/15 text-[#00E5FF]"><TrendingUp className="w-3 h-3 inline mr-1"/>{stats?.avg || 0}% avg</div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-2 h-32">
              {(stats?.byDay || Array(7).fill(0)).map((h,i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-t-xl transition-all" style={{ height: `${(h/maxBar)*100}%`, minHeight: 4, background: `linear-gradient(180deg,#FF2F92,#A93CFF ${h/2*20}%, #00E5FF)` }}/>
                  <div className="text-[10px] text-white/40">{days[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <KpiCard Icon={Users} l="Participants" v={stats?.participants ?? 0}/>
            <KpiCard Icon={Heart} l="Total matches" v={stats?.matches ?? 0}/>
            <KpiCard Icon={Sparkles} l="Avg score" v={(stats?.avg ?? 0) + "%"}/>
            <KpiCard Icon={Gift} l="Redeem rate" v={(stats?.redeemPct ?? 0) + "%"}/>
          </div>

          <div className="mt-6 glass rounded-3xl p-4">
            <div className="text-[13px] font-semibold">Funnel</div>
            <div className="mt-3 space-y-2.5">
              {[
                { l: "Joined event", v: stats?.participants ?? 0, max: stats?.participants ?? 1 },
                { l: "Matched", v: stats?.matches ?? 0, max: stats?.participants ?? 1 },
                { l: "Rewards earned", v: stats?.rewards ?? 0, max: stats?.participants ?? 1 },
                { l: "Rewards redeemed", v: Math.round((stats?.rewards ?? 0) * (stats?.redeemPct ?? 0) / 100), max: stats?.participants ?? 1 },
              ].map(r => (
                <div key={r.l}>
                  <div className="flex items-center justify-between text-[11px] text-white/60"><span>{r.l}</span><span>{r.v}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full gradient-brand" style={{ width: `${Math.min(100, (r.v/Math.max(1,r.max))*100)}%` }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => go?.("venueLive", { eventId })} className="mt-6 w-full h-14 rounded-2xl glass flex items-center justify-center gap-2 font-semibold text-[14px]"><Radio className="w-4 h-4"/> Open live floor</button>
        </>}
      </div>
    </div>
  );
};

const KpiCard = ({ Icon, l, v }) => (
  <div className="glass rounded-2xl p-4">
    <div className="flex items-center gap-2 text-white/60"><Icon className="w-3.5 h-3.5"/><span className="text-[11px]">{l}</span></div>
    <div className="mt-2 text-[22px] font-semibold tracking-tighter">{v}</div>
  </div>
);
