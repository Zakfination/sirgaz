"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight, Calendar, MapPin, Users, ChevronLeft, Sparkles, Send, Check, Circle,
  Lock, Activity, Zap, Gift, Flame, Heart, MessageCircle, Award, X, Star,
  PartyPopper, Plane, Music
} from "lucide-react";
import { AuthProvider, useAuth } from "../../authContext";
import {
  getEvent, joinEvent, countParticipants, listParticipants, findOrCreateMatch,
  getMatchPeer, getOrCreateMission, updateMission, createReward, listMyRewards,
  upsertProfile, getProfile
} from "@/lib/db";
import { StatusBar, TopBar, BigButton, PublicEventScreen } from "../../screens_extra";
import { VibeProfileCard, MatchReasons } from "@/components/VibeProfile";
import { normalizeVibe, computeVibeMatch } from "@/lib/vibe";

/* Mini phone frame for public page */
const Frame = ({ children }) => (
  <div className="min-h-screen w-full bg-black flex items-center justify-center py-6 relative overflow-hidden">
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#FF2F92]/15 blur-[120px]"/>
      <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-[#A93CFF]/15 blur-[120px]"/>
      <div className="absolute bottom-0 left-1/3 w-[520px] h-[520px] rounded-full bg-[#00E5FF]/10 blur-[120px]"/>
    </div>
    <div className="relative w-full max-w-[430px] min-h-[100dvh] md:min-h-[860px] md:h-[860px] md:max-h-[860px] md:rounded-[52px] overflow-hidden bg-black md:border md:border-white/10 md:shadow-[0_40px_120px_-20px_rgba(255,47,146,0.35)]">
      {children}
    </div>
  </div>
);

const Wrapped = () => (
  <AuthProvider>
    <EventFlow />
  </AuthProvider>
);
export default Wrapped;

const EventFlow = () => {
  const { eventId } = useParams();
  const router = useRouter();
  const { session, sessionLoading, sendOtp, verifyOtp, pendingIdentifier, authMethod } = useAuth();

  const [event, setEvent] = React.useState(null);
  const [participants, setParticipants] = React.useState(0);
  const [participantList, setParticipantList] = React.useState([]);
  const [phase, setPhase] = React.useState("event"); // event | authPhone | authOtp | joining | waiting | countdown | matching | match | mission | reward
  const [me, setMe] = React.useState(null);
  const [match, setMatch] = React.useState(null);
  const [peer, setPeer] = React.useState(null);
  const [mission, setMission] = React.useState(null);
  const [reward, setReward] = React.useState(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Load event
  React.useEffect(() => {
    (async () => {
      const e = await getEvent(eventId);
      if (!e) { setError("Event not found"); return; }
      setEvent(e);
      setParticipants(await countParticipants(eventId));
    })();
  }, [eventId]);

  // Poll participants + status when waiting/matching
  React.useEffect(() => {
    if (!eventId) return;
    if (!["waiting","matching","event"].includes(phase)) return;
    const t = setInterval(async () => {
      setParticipants(await countParticipants(eventId));
      const list = await import("@/lib/db").then(m => m.listParticipants(eventId));
      setParticipantList(list);
    }, 4000);
    return () => clearInterval(t);
  }, [eventId, phase]);

  // Load my own profile when authed
  React.useEffect(() => {
    if (!session?.user) { setMe(null); return; }
    (async () => setMe(await getProfile(session.user.id)))();
  }, [session]);

  // Auto-progress once authed + they clicked join → do actual join
  const doJoin = async () => {
    if (!session?.user) { setPhase("authPhone"); return; }
    setLoading(true);
    setError("");
    // Ensure a profile row exists — if incomplete, still allow join but with defaults
    let prof = await getProfile(session.user.id);
    if (!prof || !prof.name) {
      const rand = Math.floor(Math.random()*1000);
      const defaultInterests = ["House Music","Coffee","Creative"];
      await upsertProfile(session.user.id, {
        name: prof?.name || `Guest ${rand}`,
        bio: prof?.bio || "Discovering sirgaZ",
        avatar_url: prof?.avatar_url || `https://i.pravatar.cc/300?u=${session.user.id}`,
        interests: prof?.interests?.length ? prof.interests : defaultInterests,
        goal: prof?.goal || "meet",
        personality: { energy: 60, tonight: "meet", ...(prof?.personality || {}) },
      });
      prof = await getProfile(session.user.id);
    }
    setMe(prof);
    const { error } = await joinEvent(eventId, session.user.id);
    setLoading(false);
    if (error) { setError(error); return; }
    setPhase("waiting");
  };

  // From waiting → countdown after user readies
  const startMatching = () => {
    setPhase("countdown");
  };

  // Countdown → matching → match
  React.useEffect(() => {
    if (phase !== "matching") return;
    (async () => {
      // Ensure at least one demo peer exists (for solo testing, seed a fake profile row)
      // Skip if there are peers already.
      await new Promise(r => setTimeout(r, 2500));
      const m = await findOrCreateMatch(eventId, session.user.id);
      if (!m) {
        // Nobody else here; show a curated demo peer for solo testing
        setMatch({
          id: "demo-match",
          score: 92,
          breakdown: {
            interest: 78, music: 88, energy: 82, goal: 60, zodiacBonus: 5,
            reasons: [
              { icon: "✨", label: "Shared Interests", detail: "House Music · Coffee · Creative" },
              { icon: "⚡", label: "Similar Energy", detail: "Night Owl ↔ Firework" },
              { icon: "🎯", label: "Same Event Goal", detail: "Meet New People" },
              { icon: "🎵", label: "Music Taste", detail: "House Music · EDM" },
              { icon: "♏", label: "Zodiac Bonus", detail: "Scorpio × Cancer (+5%)" },
            ],
          },
        });
        setPeer({
          id: "demo-peer",
          name: "Raka Wibisana",
          avatar_url: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600",
          bio: "Music producer · Bali",
          interests: ["House Music","Coffee","Creative","Photography"],
          goal: "meet",
          personality: { birthday: "1998-11-08", energy: 78, tonight: "meet" },
        });
      } else {
        setMatch(m);
        setPeer(await getMatchPeer(m, session.user.id));
      }
      setPhase("match");
    })();
  }, [phase, eventId, session]);

  // Load mission when phase enters mission
  React.useEffect(() => {
    if (phase !== "mission" || !match || match.id === "demo-match") return;
    (async () => {
      setMission(await getOrCreateMission(match.id));
    })();
  }, [phase, match]);

  if (error && !event) return <Frame><div className="p-10 text-center text-white/70"><div className="text-[24px] font-semibold">Event not found</div><div className="mt-2 text-[13px]">{error}</div></div></Frame>;
  if (!event) return <Frame><div className="p-10 text-center text-white/60">Loading event…</div></Frame>;

  return (
    <Frame>
      <AnimatePresence mode="wait">
        <motion.div key={phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
          {phase === "event" && (
            <PublicEventScreen
              event={event}
              participantCount={participants}
              isAuthed={!!session}
              onJoin={doJoin}
              onLogin={() => setPhase("authPhone")}
            />
          )}
          {phase === "authPhone" && <EmailStep onBack={() => setPhase("event")} onNext={() => setPhase("authOtp")} sendOtp={sendOtp} />}
          {phase === "authOtp" && <OtpStep onBack={() => setPhase("authPhone")} onSuccess={() => setPhase("event") /* will re-render as authed */} verifyOtp={verifyOtp} pendingIdentifier={pendingIdentifier} />}
          {phase === "waiting" && <WaitingStep event={event} count={participants} participants={participantList} onReady={startMatching} />}
          {phase === "countdown" && <CountdownStep onDone={() => setPhase("matching")} />}
          {phase === "matching" && <MatchingStep />}
          {phase === "match" && <MatchStep match={match} peer={peer} me={me} onNext={() => setPhase("compat")} />}
          {phase === "compat" && <CompatStep match={match} peer={peer} me={me} onNext={() => setPhase("mission")} />}
          {phase === "mission" && <MissionStep mission={mission} onNext={() => setPhase("reward")} match={match} userId={session?.user?.id} eventId={eventId} setReward={setReward} />}
          {phase === "reward" && <RewardStep reward={reward} onClose={() => router.push("/")} />}
        </motion.div>
      </AnimatePresence>

      {/* After successful auth, poll session and if landed on authOtp, jump back */}
      <SessionWatcher onAuthed={() => { if (phase === "authOtp" || phase === "authPhone") setPhase("event"); }} />
    </Frame>
  );
};

const SessionWatcher = ({ onAuthed }) => {
  const { session } = useAuth();
  React.useEffect(() => { if (session) onAuthed?.(); }, [session]);
  return null;
};

/* Email entry */
const EmailStep = ({ onBack, onNext, sendOtp }) => {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const submit = async () => {
    setError(""); setLoading(true);
    const res = await sendOtp(email);
    setLoading(false);
    if (res?.error) { setError(res.error); return; }
    onNext();
  };
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden">
      <StatusBar />
      <TopBar title="Sign in" onBack={onBack} />
      <div className="px-7 pt-2">
        <h2 className="text-[30px] font-semibold tracking-tighter">Join the event</h2>
        <p className="text-white/50 text-[13px] mt-2">Enter your email to get a 6 digit code.</p>
        <div className="mt-8 space-y-3">
          <div className="glass rounded-2xl px-4 h-14 flex items-center gap-3">
            <span className="text-[14px] font-medium text-white/70">@</span>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" onKeyDown={(e)=>{ if (e.key==="Enter") submit(); }} className="flex-1 bg-transparent outline-none text-[15px] placeholder-white/30"/>
          </div>
          {error && <div className="px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">{error}</div>}
        </div>
        <div className="mt-8"><BigButton onClick={submit} disabled={loading} icon={loading ? null : <ArrowRight className="w-4 h-4"/>}>{loading ? "Sending code…" : "Continue"}</BigButton></div>
      </div>
    </div>
  );
};

/* OTP entry */
const OtpStep = ({ onBack, onSuccess, verifyOtp, pendingIdentifier }) => {
  const [code, setCode] = React.useState(["","","","","",""]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const pressKey = (k) => {
    setError("");
    if (k === "⌫") {
      setCode(prev => { const idx = prev.findIndex(c => c === ""); const t = idx === -1 ? prev.length-1 : idx-1; if (t<0) return prev; const n=[...prev]; n[t]=""; return n; });
      return;
    }
    setCode(prev => { const idx = prev.findIndex(c => c === ""); if (idx===-1) return prev; const n=[...prev]; n[idx]=k; return n; });
  };
  const doVerify = async () => {
    setError(""); const token = code.join("");
    if (token.length < 6) { setError("Enter the 6 digit code"); return; }
    setLoading(true); const res = await verifyOtp(token); setLoading(false);
    if (res?.error) { setError(res.error); return; }
    onSuccess();
  };
  React.useEffect(() => { if (code.every(c=>c!=="") && !loading) doVerify(); /*eslint-disable-next-line*/ }, [code.join("")]);
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden">
      <StatusBar />
      <TopBar title="Verification" onBack={onBack} />
      <div className="px-7">
        <h2 className="text-[30px] font-semibold tracking-tighter">Enter the code</h2>
        <p className="text-white/50 text-[13px] mt-2">Sent to {pendingIdentifier}</p>
        <div className="mt-10 flex gap-2.5 justify-between">
          {code.map((c, i) => (
            <div key={i} className={`flex-1 h-16 rounded-2xl flex items-center justify-center text-[24px] font-semibold ${c ? "gradient-brand-soft glow-pink" : "glass"}`}>
              {c || <span className="w-2 h-2 rounded-full bg-white/20" />}
            </div>
          ))}
        </div>
        {error && <div className="mt-5 px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92] text-center">{error}</div>}
        <div className="mt-8"><BigButton onClick={doVerify} disabled={loading} icon={loading ? null : <ArrowRight className="w-4 h-4"/>}>{loading ? "Verifying…" : "Verify"}</BigButton></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 grid grid-cols-3 gap-2.5">
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
          <button key={i} disabled={!k || loading} onClick={() => k && pressKey(k)} className={`h-14 rounded-2xl text-[20px] font-medium active:scale-95 transition ${k ? "glass" : ""}`}>{k}</button>
        ))}
      </div>
    </div>
  );
};

/* Waiting room */
const WaitingStep = ({ event, count, participants = [], onReady }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar title="Waiting room" right={<span className="text-[11px] font-medium text-[#00E5FF] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"/>Live</span>} />
    <div className="px-6 pb-32">
      <div className="glass-strong rounded-3xl p-5 text-center">
        <div className="text-[11px] uppercase tracking-widest text-white/50">You're in</div>
        <div className="mt-2 text-[26px] font-bold tracking-tighter">{event.title}</div>
        <div className="mt-1 text-[13px] text-white/60">{event.venue_name}</div>
        <div className="mt-5 flex items-center justify-center gap-4 text-[12px] text-white/60">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5"/> {count} inside</span>
          <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-[#00E5FF]"/> Matching soon</span>
        </div>
      </div>

      {/* Participants with Vibe chips */}
      {participants?.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">In the room</div>
          <div className="space-y-2">
            {participants.slice(0, 10).map(p => (
              <div key={p.id} className="glass rounded-2xl p-3">
                <VibeProfileCard profile={p.profiles} variant="compact" showBio={false} avatarSize={44}/>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-[13.5px] text-white/70 leading-relaxed">
        Grab a drink. Say hi to someone new. When you're ready, we'll match you.
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
      <BigButton onClick={onReady} icon={<ArrowRight className="w-4 h-4"/>}>I'm ready</BigButton>
    </div>
  </div>
);

/* Countdown */
const CountdownStep = ({ onDone }) => {
  const [n, setN] = React.useState(3);
  React.useEffect(() => {
    if (n <= 0) { const t = setTimeout(onDone, 500); return () => clearTimeout(t); }
    const t = setTimeout(() => setN(n - 1), 900); return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden flex items-center justify-center">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-[#FF2F92]/25 blur-3xl pulse-slow"/>
      <div className="absolute w-[380px] h-[380px] rounded-full bg-[#A93CFF]/25 blur-3xl pulse-slow" style={{animationDelay:".3s"}}/>
      <AnimatePresence mode="wait">
        <motion.div key={n} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.7 }}
          className="text-[220px] font-bold leading-none tracking-tighter text-gradient text-glow-white">
          {n > 0 ? n : "GO"}
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-20 text-[13px] text-white/60 tracking-widest uppercase">Prepare to be matched</div>
    </div>
  );
};

/* AI matching */
const MatchingStep = () => (
  <div className="relative h-full w-full bg-black overflow-hidden">
    <div className="absolute -inset-32 aurora">
      <div className="absolute top-0 left-1/2 w-[80%] h-[80%] rounded-full bg-[#FF2F92]/40 blur-3xl"/>
      <div className="absolute bottom-10 right-0 w-[70%] h-[70%] rounded-full bg-[#A93CFF]/40 blur-3xl"/>
      <div className="absolute top-1/3 -left-10 w-[60%] h-[60%] rounded-full bg-[#00E5FF]/30 blur-3xl"/>
    </div>
    <div className="relative h-full flex flex-col items-center justify-center px-8">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-64 h-64 rounded-full border border-white/10 animate-[spin_10s_linear_infinite]"/>
        <div className="absolute w-48 h-48 rounded-full border border-white/15 animate-[spin_7s_linear_infinite_reverse]"/>
        <div className="absolute w-32 h-32 rounded-full border border-[#FF2F92]/50 animate-[spin_5s_linear_infinite]"/>
        <div className="relative w-24 h-24 rounded-full gradient-brand glow-pink flex items-center justify-center"><Sparkles className="w-8 h-8"/></div>
      </div>
      <div className="mt-14 text-[22px] font-semibold tracking-tighter">Reading the room…</div>
      <div className="mt-2 text-white/60 text-[13px]">Analyzing signals</div>
    </div>
  </div>
);

/* Match result — AI Vibe Match card with reasons */
const MatchStep = ({ match, peer, onNext, me }) => {
  const vibeMatch = React.useMemo(() => {
    // If match already carries reasons, use them; else compute from me + peer
    const stored = match?.breakdown?.reasons;
    if (stored && stored.length) return { score: match.score, reasons: stored };
    if (me && peer) return computeVibeMatch(me, peer);
    return { score: match?.score || 0, reasons: [] };
  }, [match, me, peer]);
  const peerVibe = normalizeVibe(peer);
  return (
  <div className="relative h-full w-full bg-black overflow-hidden">
    <img src={peer?.avatar_url || "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=900"} className="absolute inset-0 w-full h-full object-cover opacity-70"/>
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black"/>
    <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_20%,rgba(255,47,146,0.35),transparent_70%)]"/>
    <StatusBar/>
    <div className="px-6 mt-4 flex flex-col items-center relative pb-40 overflow-y-auto phone-scroll" style={{ height: "calc(100% - 40px)" }}>
      <div className="text-[11px] uppercase tracking-widest text-white/70 flex items-center gap-1"><span>✨</span> AI Vibe Match</div>
      <div className="mt-3 relative">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <defs><linearGradient id="ring2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF2F92"/><stop offset="60%" stopColor="#A93CFF"/><stop offset="100%" stopColor="#00E5FF"/></linearGradient></defs>
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
          <circle cx="100" cy="100" r="90" fill="none" stroke="url(#ring2)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${2*Math.PI*90*(vibeMatch.score/100)} ${2*Math.PI*90}`} transform="rotate(-90 100 100)"/>
        </svg>
        <div className="absolute inset-4 rounded-full overflow-hidden">
          <img src={peer?.avatar_url || "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600"} className="w-full h-full object-cover"/>
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-brand text-[14px] font-bold glow-pink">{vibeMatch.score}%</div>
      </div>
      <div className="mt-6 text-[26px] font-bold tracking-tighter">{peer?.name || "Match"}</div>
      <div className="mt-1 text-white/70 text-[12px] flex items-center gap-2 flex-wrap justify-center">
        {peerVibe?.age && <span>{peerVibe.age}</span>}
        {peerVibe?.zodiac && <span>{peerVibe.zodiac.emoji} {peerVibe.zodiac.name}</span>}
        {peerVibe?.vibeTitle && <span>{peerVibe.vibeTitle.emoji} {peerVibe.vibeTitle.l}</span>}
      </div>

      {/* Why you matched */}
      <div className="mt-6 w-full glass-strong rounded-3xl p-4">
        <div className="text-[11px] uppercase tracking-widest text-white/50 mb-3">Why you matched</div>
        <MatchReasons reasons={vibeMatch.reasons}/>
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 flex gap-3 bg-gradient-to-t from-black via-black/90 to-transparent">
      <div className="flex-1"><BigButton onClick={onNext}>See compatibility</BigButton></div>
    </div>
  </div>
  );
};

/* Compat + reasons */
const CompatStep = ({ match, peer, me, onNext }) => {
  const stored = match?.breakdown?.reasons;
  const computed = React.useMemo(() => {
    if (stored?.length) return { score: match.score, reasons: stored, breakdown: match?.breakdown || {} };
    if (me && peer) return computeVibeMatch(me, peer);
    return { score: match?.score || 0, reasons: [], breakdown: {} };
  }, [match, me, peer]);
  const b = computed.breakdown || {};
  const items = [
    { l: "Interests", v: b.interest ?? 70 },
    { l: "Music", v: b.music ?? 60 },
    { l: "Energy", v: b.energy ?? 75 },
    { l: "Event Goal", v: b.goal ?? 60 },
    { l: "Zodiac", v: b.zodiacBonus ? 85 : 55 },
    { l: "Vibe", v: Math.min(99, computed.score) },
  ];
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar/>
      <TopBar title="Compatibility"/>
      <div className="px-6 pb-40">
        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <img src={peer?.avatar_url} className="w-12 h-12 rounded-full object-cover"/>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">You & {peer?.name?.split(" ")[0]}</div>
              <div className="text-[11px] text-white/50">AI-generated vibe match</div>
            </div>
            <div className="px-2.5 py-1 rounded-full gradient-brand text-[11px] font-bold glow-pink">{computed.score}%</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map(r => (
            <div key={r.l} className="glass rounded-2xl p-4">
              <div className="text-[11px] text-white/50">{r.l}</div>
              <div className="mt-2 text-[22px] font-semibold tracking-tighter">{r.v}%</div>
              <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full gradient-brand" style={{ width: `${r.v}%` }}/>
              </div>
            </div>
          ))}
        </div>
        {computed.reasons?.length > 0 && (
          <div className="mt-5 glass rounded-3xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50 mb-3">Why you matched</div>
            <MatchReasons reasons={computed.reasons}/>
          </div>
        )}
        <div className="mt-6 text-[13px] font-semibold">AI Ice-breakers</div>
        <div className="mt-3 space-y-2.5">
          {[
            { t: "Serious", q: "Which producer would you kill to see live once?" },
            { t: "Funny", q: "Rate your dance moves 1-10 — and I'll verify tonight." },
            { t: "Deep", q: "What made you say yes to tonight?" },
          ].map((s, i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/40">{s.t}</div>
              <div className="mt-1 text-[14px] leading-snug">"{s.q}"</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={onNext} icon={<Flame className="w-4 h-4"/>}>Start your mission</BigButton>
      </div>
    </div>
  );
};

/* Mission with checkable clues */
const MissionStep = ({ mission, onNext, match, userId, eventId, setReward }) => {
  const [clues, setClues] = React.useState(() => mission?.clues || [
    { label: "Blue leather jacket", done: false },
    { label: "White sneakers", done: false },
    { label: "Near the main bar", done: false },
    { label: "Say hi", done: false },
  ]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (mission?.clues) setClues(mission.clues); }, [mission]);
  const doneCount = clues.filter(c => c.done).length;
  const pct = Math.round((doneCount / clues.length) * 100);
  const toggle = async (idx) => {
    const next = clues.map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    setClues(next);
    if (mission?.id) await updateMission(mission.id, { clues: next });
  };
  const claim = async () => {
    setBusy(true);
    // Create a real reward with unique redeem code
    const title = mission?.reward_title || "20% off drinks";
    const xp = mission?.reward_xp || 200;
    let created = null;
    if (userId) {
      const { data } = await createReward(userId, eventId, mission?.id, { title, description: `Earned at ${title}`, xp });
      created = data;
    }
    if (mission?.id) await updateMission(mission.id, { status: "complete" });
    setReward(created || { title, xp, code: Math.random().toString(36).slice(2,10).toUpperCase() });
    setBusy(false);
    onNext();
  };
  const allDone = clues.every(c => c.done);
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar/>
      <TopBar title="Your mission"/>
      <div className="px-6 pb-40">
        <div className="relative rounded-3xl overflow-hidden p-6 gradient-brand glow-pink">
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.3),transparent_60%)]"/>
          <div className="relative">
            <div className="text-[11px] uppercase tracking-widest opacity-80">Live mission</div>
            <div className="mt-1 text-[22px] font-bold tracking-tighter leading-tight">{mission?.title || "Find your match. Say hi."}</div>
          </div>
        </div>
        <div className="mt-4 glass-strong rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-white/40">Progress</span>
            <span className="text-[11px] text-[#00E5FF]">{doneCount} of {clues.length}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full gradient-brand rounded-full transition-all" style={{ width: `${pct}%` }}/>
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {clues.map((c, i) => (
            <button key={i} onClick={() => toggle(i)} className={`w-full glass rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99]`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${c.done ? "bg-[#00E5FF] text-black" : "border border-white/25"}`}>
                {c.done ? <Check className="w-4 h-4"/> : <Circle className="w-3 h-3 opacity-40"/>}
              </div>
              <div className={`flex-1 text-[14px] ${c.done ? "line-through text-white/50" : ""}`}>{c.label}</div>
            </button>
          ))}
        </div>
        <div className="mt-6 glass rounded-3xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center"><Zap className="w-5 h-5"/></div>
          <div className="flex-1">
            <div className="text-[13.5px] font-medium">Reward preview</div>
            <div className="text-[11.5px] text-white/50">+{mission?.reward_xp || 200} XP · {mission?.reward_title || "20% off drinks"}</div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={claim} disabled={!allDone || busy} icon={<Award className="w-4 h-4"/>}>{busy ? "Claiming…" : allDone ? "Claim reward" : `Complete ${clues.length - doneCount} more`}</BigButton>
      </div>
    </div>
  );
};

/* Reward */
const RewardStep = ({ reward, onClose }) => {
  const code = reward?.code || "SIRGAZ";
  const redeemUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : "";
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar/>
      <TopBar title="Reward"/>
      <div className="px-6 pb-32">
        <div className="relative rounded-3xl overflow-hidden p-6 gradient-brand glow-pink text-center">
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.35),transparent_60%)]"/>
          <div className="relative">
            <div className="text-[11px] uppercase tracking-widest opacity-80">You earned</div>
            <div className="mt-2 text-[52px] font-bold tracking-tighter">+{reward?.xp || 200}<span className="text-[20px] align-top ml-2 opacity-90">XP</span></div>
            <div className="mt-2 text-[14px] opacity-90">{reward?.title || "Reward unlocked"}</div>
          </div>
        </div>
        <div className="mt-5 glass-strong rounded-3xl p-5 flex flex-col items-center">
          <div className="text-[11px] uppercase tracking-widest text-white/50">Redeem QR</div>
          <div className="mt-3 p-4 rounded-2xl bg-white">
            <QRCodeCanvas value={redeemUrl} size={180} level="H" />
          </div>
          <div className="mt-3 text-[13px] font-mono text-white/70 tracking-widest">{code}</div>
          <div className="mt-1 text-[11px] text-white/50">Show this at the venue to redeem</div>
        </div>
        <div className="mt-5 space-y-2">
          <BigButton onClick={onClose} variant="ghost" icon={<Heart className="w-4 h-4"/>}>Back to sirgaZ</BigButton>
        </div>
      </div>
    </div>
  );
};
