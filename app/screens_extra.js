"use client";

import React from "react";
import { motion } from "framer-motion";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, MapPin, Users, MoreHorizontal,
  Copy, Download, QrCode, Trash2, Edit3, Sparkles, Zap, Check, X, Share2, Radio,
  Music, Utensils, Plane, Briefcase, Shirt, Gamepad2, Coffee, PartyPopper, Cpu,
  Camera, Send, Award, Flame, Target, Gift, Lock, Activity, ArrowRight, BarChart3
} from "lucide-react";
import { useAuth } from "./authContext";
import {
  ensureVenue, getMyVenue, listEvents, createEvent, updateEvent, deleteEvent,
  getEvent, joinEvent, listParticipants, countParticipants, findOrCreateMatch,
  getMatch, getMatchPeer, getOrCreateMission, updateMission, createReward,
  listMyRewards, redeemReward, listPublishedEvents, upsertProfile, getProfile,
  eventPublicUrl, computeCompat, isVenueConfigured, updateVenue, createVenue, HEVN_DEFAULTS
} from "@/lib/db";

/* ---------- reusable ---------- */
// StatusBar retired \u2014 no more fake iPhone chrome. Kept as a small safe-area
// spacer so legacy screens that still call <StatusBar /> retain their top rhythm.
export const StatusBar = () => (
  <div aria-hidden className="h-3 sm:h-4 pt-safe" />
);
export const TopBar = ({ title, onBack, right }) => (
  <div className="flex items-center justify-between px-6 pt-2 pb-4">
    <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-95 transition">
      <ChevronLeft className="w-5 h-5 text-white" />
    </button>
    <div className="text-[15px] font-semibold tracking-tight">{title}</div>
    <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
      {right || <MoreHorizontal className="w-4 h-4 text-white/70" />}
    </div>
  </div>
);
export const BigButton = ({ children, onClick, variant = "primary", className = "", icon, disabled }) => {
  const base = "w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[15px] tracking-tight active:scale-[0.98] transition disabled:opacity-60";
  const styles = {
    primary: "gradient-brand text-white glow-pink",
    ghost: "glass text-white",
    outline: "border border-white/15 text-white bg-white/[0.02]",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
      {icon}
    </button>
  );
};

/* ============================================================
   VENUE  —  Admin Dashboard, Event List, Create Event, Event Settings
   ============================================================ */

export const VenueDashboard = ({ go }) => {
  const { session } = useAuth();
  const [venue, setVenue] = React.useState(null);
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const v = await getMyVenue(session.user.id);
    if (!v || !isVenueConfigured(v)) {
      // Redirect to venue setup — first-run experience
      go?.("venueSetup");
      return;
    }
    setVenue(v);
    const list = await listEvents(v.id);
    setEvents(list);
    setLoading(false);
  }, [session, go]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const stats = React.useMemo(() => {
    const live = events.filter(e => e.status === "live" || e.status === "published").length;
    const drafts = events.filter(e => e.status === "draft").length;
    const total = events.length;
    return { live, drafts, total };
  }, [events]);

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <div className="px-6 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {venue?.logo_url ? (
            <img src={venue.logo_url} className="w-11 h-11 rounded-2xl object-cover glow-pink"/>
          ) : (
            <div className="w-11 h-11 rounded-2xl gradient-brand flex items-center justify-center font-bold glow-pink">
              {(venue?.name || "?").slice(0,2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] text-white/50 truncate">{venue?.category || "Venue"}</div>
            <div className="text-[15px] font-semibold truncate flex items-center gap-1.5">
              {venue?.name || "Setting up…"}
              {venue?.instagram && <span className="text-[10.5px] text-white/45 font-normal">{venue.instagram}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => go?.("venueSetup", { edit: true })} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Edit3 className="w-4 h-4"/></button>
          <button onClick={() => go?.("venueEvents")} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Radio className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="px-6 pb-32">
        <div className="mt-4 relative rounded-3xl p-5 overflow-hidden gradient-brand-soft glow-pink">
          <div className="absolute inset-0 bg-black/25"/>
          <div className="relative">
            <div className="text-[11px] uppercase tracking-widest opacity-80">Active events</div>
            <div className="mt-1 text-[36px] font-bold tracking-tighter">{stats.live}<span className="text-[16px] opacity-80 ml-2 font-medium">live now</span></div>
            <div className="mt-1 text-[12px] opacity-90 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/> {stats.total} events total</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[["Live", stats.live], ["Drafts", stats.drafts], ["Total", stats.total]].map(([l,v]) => (
            <div key={l} className="glass rounded-2xl p-3.5 text-center">
              <div className="text-[20px] font-semibold tracking-tighter">{v}</div>
              <div className="text-[11px] text-white/50">{l}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-[15px] font-semibold">Quick actions</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { l: "Create event", Icon: Plus, go: "venueCreate" },
            { l: "All events", Icon: Calendar, go: "venueEvents" },
            { l: "Live floor", Icon: Radio, go: "venueLive" },
            { l: "Live matches", Icon: Sparkles, go: "venueMatches" },
            { l: "Reward redeems", Icon: Gift, go: "venueRedeems" },
            { l: "Analytics", Icon: Activity, go: "venueAnalytics" },
          ].map(a => (
            <button key={a.l} onClick={() => go?.(a.go)} className="glass rounded-2xl p-4 text-left active:scale-[0.98] transition">
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center mb-2"><a.Icon className="w-4 h-4"/></div>
              <div className="text-[13px] font-medium">{a.l}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-[15px] font-semibold">Recent events</div>
          <button onClick={() => go?.("venueEvents")} className="text-[12px] text-white/60 flex items-center gap-1">See all <ChevronRight className="w-3.5 h-3.5"/></button>
        </div>
        <div className="mt-3 space-y-2">
          {loading && <div className="text-[12px] text-white/40">Loading…</div>}
          {!loading && events.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-[13px] text-white/70">No events yet</div>
              <button onClick={() => go?.("venueCreate")} className="mt-3 h-10 px-4 rounded-full gradient-brand text-[12px] font-semibold">Create your first</button>
            </div>
          )}
          {events.slice(0, 5).map(e => (
            <button key={e.id} onClick={() => go?.("venueEventManage", { eventId: e.id })} className="w-full glass rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition">
              <div className="w-11 h-11 rounded-xl gradient-brand-soft flex items-center justify-center"><Calendar className="w-4 h-4"/></div>
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">{e.title}</div>
                <div className="text-[11px] text-white/50">{e.starts_at ? new Date(e.starts_at).toLocaleString() : "Date TBD"}</div>
              </div>
              <StatusBadge status={e.status} />
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-6">
        <button onClick={() => go?.("venueCreate")} className="w-14 h-14 rounded-full gradient-brand glow-pink flex items-center justify-center shadow-2xl active:scale-95 transition">
          <Plus className="w-6 h-6"/>
        </button>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    draft: { l: "Draft", c: "bg-white/8 text-white/60" },
    published: { l: "Published", c: "bg-[#00E5FF]/15 text-[#00E5FF]" },
    live: { l: "Live", c: "gradient-brand" },
    ended: { l: "Ended", c: "bg-white/5 text-white/40" },
  };
  const s = map[status] || map.draft;
  return <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${s.c}`}>{s.l}</span>;
};

/* ---------- Event list ---------- */
export const VenueEventList = ({ go }) => {
  const { session } = useAuth();
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    (async () => {
      if (!session?.user) return;
      const v = await getMyVenue(session.user.id);
      if (v) setEvents(await listEvents(v.id));
      setLoading(false);
    })();
  }, [session]);
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="All events" onBack={() => go?.("venueDashboard")} right={<button onClick={() => go?.("venueCreate")}><Plus className="w-4 h-4"/></button>} />
      <div className="px-6 pb-32">
        {loading && <div className="text-[12px] text-white/40">Loading…</div>}
        {!loading && events.length === 0 && (
          <div className="glass rounded-3xl p-8 text-center">
            <div className="text-[15px] font-semibold">No events yet</div>
            <div className="text-[12px] text-white/50 mt-1">Create your first sirgaZ event.</div>
            <button onClick={() => go?.("venueCreate")} className="mt-4 h-11 px-5 rounded-full gradient-brand text-[13px] font-semibold">Create event</button>
          </div>
        )}
        <div className="space-y-3">
          {events.map(e => (
            <button key={e.id} onClick={() => go?.("venueEventManage", { eventId: e.id })} className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
              <div className="w-12 h-12 rounded-2xl gradient-brand-soft flex items-center justify-center"><Calendar className="w-5 h-5"/></div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{e.title}</div>
                <div className="text-[11.5px] text-white/50">{e.starts_at ? new Date(e.starts_at).toLocaleString() : "Date TBD"} · {e.tags?.join(", ") || "No tags"}</div>
              </div>
              <StatusBadge status={e.status}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------- Create event ---------- */
export const VenueCreateEvent = ({ go }) => {
  const { session } = useAuth();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [venueName, setVenueName] = React.useState("");
  const [startsAt, setStartsAt] = React.useState(() => {
    const d = new Date(Date.now() + 2*3600*1000);
    return d.toISOString().slice(0,16);
  });
  const [capacity, setCapacity] = React.useState(200);
  const [tags, setTags] = React.useState(["Music"]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Auto-load the configured venue and pre-fill the display name
  React.useEffect(() => {
    (async () => {
      if (!session?.user) return;
      const v = await getMyVenue(session.user.id);
      if (!v || !isVenueConfigured(v)) { go?.("venueSetup"); return; }
      if (!venueName) setVenueName(v.name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const ALL_TAGS = ["Music","Techno","Rooftop","Beach","Festival","Fashion","18+","Chill","House","Party"];
  const toggle = (t) => setTags(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);

  const save = async (status) => {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    // Venue must be configured before creating events
    const venue = await getMyVenue(session.user.id);
    if (!venue || !isVenueConfigured(venue)) {
      setLoading(false);
      go?.("venueSetup");
      return;
    }
    const { data, error } = await createEvent(venue.id, {
      title, description, venue_name: venueName || venue.name,
      starts_at: new Date(startsAt).toISOString(), capacity, tags, status,
      banner_url: "https://images.pexels.com/photos/5192289/pexels-photo-5192289.jpeg",
    });
    setLoading(false);
    if (error) { setError(error); return; }
    go?.("venueEventManage", { eventId: data.id });
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Create event" onBack={() => go?.("venueDashboard")} />
      <div className="px-6 pb-40 space-y-3">
        <FieldB label="Event title" value={title} onChange={setTitle} placeholder="NEONVERSE · Techno Ritual" />
        <FieldB label="Venue display name" value={venueName} onChange={setVenueName} placeholder="Potato Head, Bali" />
        <FieldB label="Description" value={description} onChange={setDescription} placeholder="A ritual of sound, light and connection…" multiline />
        <div className="grid grid-cols-2 gap-3">
          <FieldB label="Starts at" value={startsAt} onChange={setStartsAt} type="datetime-local" />
          <FieldB label="Capacity" value={capacity} onChange={(v)=>setCapacity(Number(v)||0)} type="number" />
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-white/40">Tags</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_TAGS.map(t => {
              const on = tags.includes(t);
              return <button key={t} onClick={() => toggle(t)} className={`h-8 px-3 rounded-full text-[12px] ${on ? "gradient-brand text-white glow-pink" : "glass text-white/80"}`}>{t}</button>;
            })}
          </div>
        </div>
        {error && <div className="px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">{error}</div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent flex gap-3">
        <button onClick={() => save("draft")} disabled={loading} className="flex-1 h-14 rounded-2xl glass font-semibold text-[14px] disabled:opacity-60">{loading ? "Saving…" : "Save as draft"}</button>
        <button onClick={() => save("published")} disabled={loading} className="flex-1 h-14 rounded-2xl gradient-brand glow-pink font-semibold text-[14px] disabled:opacity-60">{loading ? "Publishing…" : "Publish"}</button>
      </div>
    </div>
  );
};
const FieldB = ({ label, value, onChange, placeholder, type="text", multiline }) => (
  <div className="glass rounded-2xl px-4 py-3">
    <div className="text-[11px] uppercase tracking-widest text-white/40">{label}</div>
    {multiline ? (
      <textarea value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} rows={3}
        className="w-full mt-1.5 bg-transparent outline-none text-[14px] placeholder-white/30 resize-none" />
    ) : (
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1 bg-transparent outline-none text-[15px] placeholder-white/30" />
    )}
  </div>
);

/* ---------- Event manage (single event) ---------- */
export const VenueEventManage = ({ go, params }) => {
  const { session } = useAuth();
  const [event, setEvent] = React.useState(null);
  const [count, setCount] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [showQR, setShowQR] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const eventId = params?.eventId;

  const refresh = React.useCallback(async () => {
    if (!eventId) return;
    const e = await getEvent(eventId); setEvent(e);
    setCount(await countParticipants(eventId));
  }, [eventId]);

  React.useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  const publicUrl = event ? eventPublicUrl(event.id) : "";

  const setStatus = async (status) => {
    setBusy(true);
    await updateEvent(event.id, { status });
    await refresh();
    setBusy(false);
  };
  const del = async () => {
    if (!confirm("Delete this event?")) return;
    await deleteEvent(event.id);
    go?.("venueEvents");
  };
  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  if (!event) return <div className="h-full w-full bg-haze"><StatusBar/><TopBar title="Event" onBack={() => go?.("venueEvents")}/><div className="px-6 text-white/40 text-[13px]">Loading…</div></div>;

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Manage event" onBack={() => go?.("venueEvents")} right={<button onClick={del}><Trash2 className="w-4 h-4 text-[#FF2F92]"/></button>} />
      <div className="px-6 pb-40">
        <div className="glass-strong rounded-3xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-brand-soft flex items-center justify-center"><Calendar className="w-5 h-5"/></div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">{event.title}</div>
            <div className="text-[11.5px] text-white/50">{event.venue_name} · {event.starts_at ? new Date(event.starts_at).toLocaleString() : "TBD"}</div>
          </div>
          <StatusBadge status={event.status}/>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="glass rounded-2xl p-3.5 text-center">
            <div className="text-[20px] font-semibold tracking-tighter">{count}</div>
            <div className="text-[11px] text-white/50">Joined</div>
          </div>
          <div className="glass rounded-2xl p-3.5 text-center">
            <div className="text-[20px] font-semibold tracking-tighter">{event.capacity}</div>
            <div className="text-[11px] text-white/50">Capacity</div>
          </div>
          <div className="glass rounded-2xl p-3.5 text-center">
            <div className="text-[20px] font-semibold tracking-tighter">{event.tags?.length || 0}</div>
            <div className="text-[11px] text-white/50">Tags</div>
          </div>
        </div>

        {/* Public URL / QR */}
        <div className="mt-5 glass-strong rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/40">Event QR code</div>
              <div className="text-[13.5px] font-medium mt-0.5">Scan to join</div>
            </div>
            <button onClick={() => setShowQR(true)} className="h-9 px-3 rounded-full gradient-brand text-[12px] font-semibold flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5"/> Open</button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 glass rounded-xl px-3 py-2 text-[11.5px] text-white/70 truncate font-mono">{publicUrl}</div>
            <button onClick={copyUrl} className="w-10 h-10 rounded-xl glass flex items-center justify-center">{copied ? <Check className="w-4 h-4 text-[#00E5FF]"/> : <Copy className="w-4 h-4"/>}</button>
          </div>
        </div>

        {/* Publish controls */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {event.status === "draft" && <button onClick={() => setStatus("published")} disabled={busy} className="h-12 rounded-2xl gradient-brand glow-pink text-[13px] font-semibold">Publish</button>}
          {event.status === "published" && <button onClick={() => setStatus("live")} disabled={busy} className="h-12 rounded-2xl gradient-brand glow-pink text-[13px] font-semibold">Go live</button>}
          {event.status === "live" && <button onClick={() => setStatus("ended")} disabled={busy} className="h-12 rounded-2xl glass text-[13px] font-semibold">End event</button>}
          {event.status === "ended" && <button onClick={() => setStatus("draft")} disabled={busy} className="h-12 rounded-2xl glass text-[13px] font-semibold">Reset to draft</button>}
          <button onClick={() => go?.("venueEventSettings", { eventId })} className="h-12 rounded-2xl glass text-[13px] font-semibold flex items-center justify-center gap-1.5"><Edit3 className="w-3.5 h-3.5"/> Settings</button>
        </div>

        {/* Description */}
        {event.description && (
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-widest text-white/40">About</div>
            <p className="mt-2 text-[13.5px] text-white/75 leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* Live floor / analytics buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => go?.("venueLive", { eventId })} className="h-14 rounded-2xl glass flex items-center justify-center gap-2 font-semibold text-[14px]">
            <Radio className="w-4 h-4"/> Live floor
          </button>
          <button onClick={() => go?.("venueAnalytics", { eventId })} className="h-14 rounded-2xl glass flex items-center justify-center gap-2 font-semibold text-[14px]">
            <BarChart3 className="w-4 h-4"/> Analytics
          </button>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && <QRModal url={publicUrl} title={event.title} onClose={() => setShowQR(false)} />}
    </div>
  );
};

const QRModal = ({ url, title, onClose }) => {
  const canvasRef = React.useRef(null);
  const download = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `sirgaZ-${title.replace(/\s+/g,"-")}.png`;
    link.click();
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6">
      <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full glass-strong flex items-center justify-center"><X className="w-4 h-4"/></button>
      <div className="text-[11px] uppercase tracking-widest text-white/50">Event QR</div>
      <div className="mt-1 text-[20px] font-semibold tracking-tighter text-center">{title}</div>
      <div ref={canvasRef} className="mt-6 p-6 rounded-3xl bg-white">
        <QRCodeCanvas value={url} size={220} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false} />
      </div>
      <div className="mt-4 text-[11px] text-white/60 font-mono px-4 text-center break-all">{url}</div>
      <div className="mt-6 w-full max-w-[280px] space-y-2">
        <BigButton onClick={download} icon={<Download className="w-4 h-4"/>}>Download PNG</BigButton>
        <BigButton onClick={() => navigator.share?.({ title, url }).catch(()=>{})} variant="ghost" icon={<Share2 className="w-4 h-4"/>}>Share link</BigButton>
      </div>
    </div>
  );
};

/* ---------- Event Settings ---------- */
export const VenueEventSettings = ({ go, params }) => {
  const [event, setEvent] = React.useState(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [venueName, setVenueName] = React.useState("");
  const [startsAt, setStartsAt] = React.useState("");
  const [capacity, setCapacity] = React.useState(200);
  const [tags, setTags] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const eventId = params?.eventId;

  React.useEffect(() => {
    (async () => {
      const e = await getEvent(eventId); if (!e) return;
      setEvent(e); setTitle(e.title||""); setDescription(e.description||"");
      setVenueName(e.venue_name||""); setStartsAt(e.starts_at ? new Date(e.starts_at).toISOString().slice(0,16) : "");
      setCapacity(e.capacity||200); setTags(e.tags||[]);
    })();
  }, [eventId]);

  const ALL_TAGS = ["Music","Techno","Rooftop","Beach","Festival","Fashion","18+","Chill","House","Party"];
  const toggle = (t) => setTags(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  const save = async () => {
    setSaving(true);
    await updateEvent(eventId, { title, description, venue_name: venueName, starts_at: startsAt ? new Date(startsAt).toISOString() : null, capacity, tags });
    setSaving(false);
    go?.("venueEventManage", { eventId });
  };

  if (!event) return <div className="h-full w-full bg-haze"><StatusBar/><TopBar title="Settings" onBack={() => go?.("venueEvents")}/><div className="px-6 text-white/40 text-[13px]">Loading…</div></div>;

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Event settings" onBack={() => go?.("venueEventManage", { eventId })} />
      <div className="px-6 pb-40 space-y-3">
        <FieldB label="Event title" value={title} onChange={setTitle} />
        <FieldB label="Venue display name" value={venueName} onChange={setVenueName} />
        <FieldB label="Description" value={description} onChange={setDescription} multiline />
        <div className="grid grid-cols-2 gap-3">
          <FieldB label="Starts at" value={startsAt} onChange={setStartsAt} type="datetime-local" />
          <FieldB label="Capacity" value={capacity} onChange={(v)=>setCapacity(Number(v)||0)} type="number" />
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-white/40">Tags</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_TAGS.map(t => {
              const on = tags.includes(t);
              return <button key={t} onClick={() => toggle(t)} className={`h-8 px-3 rounded-full text-[12px] ${on ? "gradient-brand text-white glow-pink" : "glass text-white/80"}`}>{t}</button>;
            })}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={save} disabled={saving} icon={<Check className="w-4 h-4"/>}>{saving ? "Saving…" : "Save changes"}</BigButton>
      </div>
    </div>
  );
};

/* ============================================================
   CUSTOMER FLOW  — Public event page (via /e/[id] route)
   Also standalone screens for join / waiting / countdown / match / mission / reward
   ============================================================ */

export const PublicEventScreen = ({ event, onJoin, participantCount, isAuthed, onLogin }) => (
  <div className="relative h-full w-full bg-black overflow-y-auto phone-scroll">
    <div className="relative h-[380px]">
      <img src={event.banner_url || "https://images.pexels.com/photos/5192289/pexels-photo-5192289.jpeg"} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black" />
      <StatusBar />
      <div className="absolute bottom-6 left-6 right-6">
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full glass-strong">{event.tags?.[0] || "Event"}</span>
        <h1 className="mt-3 text-[30px] font-bold tracking-tighter leading-tight">{event.title}</h1>
      </div>
    </div>
    <div className="px-6 pb-40 -mt-6 relative z-10">
      <div className="glass-strong rounded-3xl p-5 space-y-4">
        <RowB Icon={MapPin} title={event.venue_name || event.venues?.name || "Venue"} sub={event.venues?.address || ""} />
        <RowB Icon={Calendar} title={event.starts_at ? new Date(event.starts_at).toLocaleString() : "TBD"} sub="Doors open 1h before" />
        <RowB Icon={Users} title={`${participantCount} going`} sub={`${Math.min(event.capacity || 200, participantCount + 50)} predicted`} />
      </div>
      {event.description && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-widest text-white/40">About</div>
          <p className="mt-2 text-[13.5px] text-white/75 leading-relaxed">{event.description}</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {event.tags?.map(t => <span key={t} className="text-[11px] px-2.5 py-1 rounded-full glass">{t}</span>)}
      </div>
    </div>
    <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent max-w-[430px] mx-auto">
      {isAuthed
        ? <BigButton onClick={onJoin} icon={<ArrowRight className="w-4 h-4"/>}>Join event</BigButton>
        : <BigButton onClick={onLogin} icon={<ArrowRight className="w-4 h-4"/>}>Sign in to join</BigButton>}
    </div>
  </div>
);
const RowB = ({ Icon, title, sub }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-white/6 flex items-center justify-center"><Icon className="w-4 h-4"/></div>
    <div className="flex-1">
      <div className="text-[14px] font-medium">{title}</div>
      {sub && <div className="text-[11.5px] text-white/50">{sub}</div>}
    </div>
  </div>
);

/* ============================================================
   VENUE SETUP  \u2014 first-run experience (only shown if unconfigured)
   Prefills with the Hevn Station demo defaults on first render.
   ============================================================ */

export const VenueSetup = ({ go, params }) => {
  const { session } = useAuth();
  const [name, setName] = React.useState(HEVN_DEFAULTS.name);
  const [category, setCategory] = React.useState(HEVN_DEFAULTS.category);
  const [description, setDescription] = React.useState(HEVN_DEFAULTS.description);
  const [address, setAddress] = React.useState(HEVN_DEFAULTS.address);
  const [instagram, setInstagram] = React.useState(HEVN_DEFAULTS.instagram);
  const [logoUrl, setLogoUrl] = React.useState("");
  const [existingId, setExistingId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const editing = !!params?.edit;

  const CATEGORIES = ["Night Club", "Rooftop Bar", "Beach Club", "Restaurant", "Concert Venue", "Festival", "Community", "Other"];

  React.useEffect(() => {
    (async () => {
      if (!session?.user) { setLoading(false); return; }
      const v = await getMyVenue(session.user.id);
      if (v) {
        setExistingId(v.id);
        // If venue exists but is unconfigured, keep HEVN_DEFAULTS prefill; else fill with existing values
        if (isVenueConfigured(v)) {
          setName(v.name || HEVN_DEFAULTS.name);
          setCategory(v.category || HEVN_DEFAULTS.category);
          setDescription(v.description || HEVN_DEFAULTS.description);
          setAddress(v.address || "");
          setInstagram(v.instagram || HEVN_DEFAULTS.instagram);
          setLogoUrl(v.logo_url || "");
        }
      }
      setLoading(false);
    })();
  }, [session]);

  const onLogoPick = (file) => {
    if (!file) return;
    if (file.size > 500 * 1024) { setError("Logo must be under 500 KB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => setLogoUrl(String(e.target?.result || ""));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Venue name is required"); return; }
    if (!category) { setError("Pick a category"); return; }
    setSaving(true);
    const patch = {
      name: name.trim(),
      category,
      description: description.trim(),
      address: address.trim(),
      instagram: instagram.trim(),
      logo_url: logoUrl,
    };
    let result;
    if (existingId) result = await updateVenue(existingId, patch);
    else result = await createVenue(session.user.id, patch);
    setSaving(false);
    if (result?.error) {
      const msg = String(result.error);
      if (msg.includes("column") && msg.includes("does not exist")) {
        setError("Database is missing the new venue columns. Please run supabase/002_venue_profile.sql in the Supabase SQL editor.");
      } else {
        setError(msg);
      }
      return;
    }
    go?.("venueDashboard");
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title={editing ? "Edit venue" : "Set up your venue"} onBack={editing ? () => go?.("venueDashboard") : () => go?.("home")} />
      <div className="px-6 pb-40">
        <div className="text-[11px] uppercase tracking-widest text-white/40">First-run</div>
        <h2 className="mt-1 text-[26px] font-semibold tracking-tighter">Your venue profile</h2>
        <p className="text-white/50 text-[13px] mt-1.5">This is how customers, QR pages, and analytics identify you.</p>

        {/* Logo */}
        <div className="mt-6 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl gradient-brand p-[2px]">
            <div className="w-full h-full rounded-2xl bg-[#0b0b0b] flex items-center justify-center overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover"/> : <Sparkles className="w-6 h-6 text-white/40"/>}
            </div>
          </div>
          <div>
            <label className="h-9 px-3 rounded-full glass text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition">
              <Camera className="w-3.5 h-3.5"/> {logoUrl ? "Change logo" : "Upload logo (optional)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e)=>onLogoPick(e.target.files?.[0])}/>
            </label>
            {logoUrl && <button onClick={()=>setLogoUrl("")} className="ml-2 h-9 px-3 rounded-full bg-white/[0.04] text-[12px] text-white/60">Clear</button>}
            <div className="mt-1 text-[10.5px] text-white/40">PNG or JPG, up to 500 KB</div>
          </div>
        </div>

        {/* Fields */}
        <div className="mt-5 space-y-3">
          <FieldB label="Venue name" value={name} onChange={setName} placeholder="Hevn Station"/>

          <div className="glass rounded-2xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-white/40">Category</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`h-9 px-3 rounded-full text-[12px] font-medium ${category === c ? "gradient-brand text-white glow-pink" : "glass text-white/80"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <FieldB label="Description" value={description} onChange={setDescription} placeholder="New Light Hevn 4.0" multiline/>
          <FieldB label="Address (optional)" value={address} onChange={setAddress} placeholder="Jl. …"/>
          <FieldB label="Instagram (optional)" value={instagram} onChange={setInstagram} placeholder="@thehevn"/>
        </div>

        {error && <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12.5px] text-[#FF2F92]">{error}</div>}
        {loading && <div className="mt-4 text-[12px] text-white/40">Loading\u2026</div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={save} disabled={saving} icon={saving ? null : <ArrowRight className="w-4 h-4"/>}>{saving ? "Saving\u2026" : (editing ? "Save changes" : "Save & continue")}</BigButton>
      </div>
    </div>
  );
};
export const RedeemReward = ({ code, onDone }) => {
  const [state, setState] = React.useState({ loading: true, ok: false, reward: null, error: "" });
  React.useEffect(() => {
    (async () => {
      const { data, error } = await redeemReward(code);
      if (error || !data) setState({ loading: false, ok: false, error: error || "Invalid code" });
      else setState({ loading: false, ok: true, reward: data });
    })();
  }, [code]);
  return (
    <div className="relative h-full w-full bg-haze flex flex-col items-center justify-center p-8 text-center">
      {state.loading && <div className="text-white/60">Verifying code…</div>}
      {!state.loading && state.ok && (
        <>
          <div className="w-24 h-24 rounded-full gradient-brand glow-pink flex items-center justify-center"><Check className="w-10 h-10" strokeWidth={3}/></div>
          <div className="mt-6 text-[26px] font-semibold tracking-tighter">Reward redeemed</div>
          <div className="mt-2 text-white/60 text-[13px]">{state.reward?.title}</div>
          <div className="mt-1 text-white/40 text-[11px] font-mono">{code}</div>
        </>
      )}
      {!state.loading && !state.ok && (
        <>
          <div className="w-24 h-24 rounded-full bg-white/8 flex items-center justify-center"><X className="w-10 h-10 text-[#FF2F92]"/></div>
          <div className="mt-6 text-[22px] font-semibold">Invalid reward code</div>
          <div className="mt-2 text-white/50 text-[13px]">{state.error}</div>
        </>
      )}
      {onDone && <button onClick={onDone} className="mt-8 h-11 px-6 rounded-full glass">Done</button>}
    </div>
  );
};
