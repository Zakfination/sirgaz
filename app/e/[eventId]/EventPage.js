"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  Check,
  Circle,
  Activity,
  Zap,
  Flame,
  Heart,
  Award,
} from "lucide-react";
import { AuthProvider, useAuth } from "../../authContext";
import {
  getEvent,
  joinEvent,
  countParticipants,
  listParticipants,
  findOrCreateMatch,
  getMatchPeer,
  getOrCreateMission,
  updateMission,
  createReward,
  getProfile,
  upsertProfile,
} from "@/lib/db";
import {
  StatusBar,
  TopBar,
  BigButton,
  PublicEventScreen,
} from "../../screens_extra";
import { VibeProfileCard, MatchReasons } from "@/components/VibeProfile";
import {
  normalizeVibe,
  computeVibeMatch,
  ALL_VIBE_INTERESTS,
  getInterestEmoji,
  TONIGHT_OPTIONS,
  getVibeTitle,
} from "@/lib/vibe";

/* Mini phone frame */
const Frame = ({ children }) => (
  <div className="min-h-screen w-full bg-black flex items-center justify-center py-6 relative overflow-hidden">
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#FF2F92]/15 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-[#A93CFF]/15 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 w-[520px] h-[520px] rounded-full bg-[#00E5FF]/10 blur-[120px]" />
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
  const { session, sendOtp, verifyOtp, pendingIdentifier } = useAuth();

  const [event, setEvent] = React.useState(null);
  const [participants, setParticipants] = React.useState(0);
  const [participantList, setParticipantList] = React.useState([]);
  const [phase, setPhase] = React.useState("event"); // event | authPhone | authOtp | profile | waiting | countdown | matching | match | compat | mission | reward
  const [me, setMe] = React.useState(null);
  const [match, setMatch] = React.useState(null);
  const [peer, setPeer] = React.useState(null);
  const [mission, setMission] = React.useState(null);
  const [reward, setReward] = React.useState(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Load real event from Supabase
  React.useEffect(() => {
    (async () => {
      const e = await getEvent(eventId);
      if (!e) {
        setError("Event tidak ditemukan");
        return;
      }
      setEvent(e);
      setParticipants(await countParticipants(eventId));
    })();
  }, [eventId]);

  // Poll participants real-time
  React.useEffect(() => {
    if (!eventId) return;
    if (!["waiting", "matching", "event"].includes(phase)) return;
    const t = setInterval(async () => {
      setParticipants(await countParticipants(eventId));
      const list = await listParticipants(eventId);
      setParticipantList(list);
    }, 4000);
    return () => clearInterval(t);
  }, [eventId, phase]);

  // Load logged-in user profile
  React.useEffect(() => {
    if (!session?.user) {
      setMe(null);
      return;
    }
    (async () => setMe(await getProfile(session.user.id)))();
  }, [session]);

  const doJoin = async () => {
    if (!session?.user) {
      setPhase("authPhone");
      return;
    }
    setLoading(true);
    setError("");
    const prof = await getProfile(session.user.id);
    const isComplete =
      prof &&
      prof.name &&
      prof.personality?.birthday &&
      (prof.interests?.length || 0) >= 1 &&
      (prof.personality?.tonight || prof.goal);
    setLoading(false);

    setMe(prof);
    if (!isComplete) {
      setPhase("profile");
      return;
    }
    await actuallyJoin();
  };

  const actuallyJoin = async () => {
    setLoading(true);
    const { error: joinErr } = await joinEvent(eventId, session.user.id);
    setLoading(false);
    if (joinErr) {
      setError(joinErr);
      return;
    }
    setPhase("waiting");
  };

  const onProfileDone = async () => {
    const prof = await getProfile(session.user.id);
    setMe(prof);
    await actuallyJoin();
  };

  // Process Real Matchmaking
  React.useEffect(() => {
    if (phase !== "matching") return;
    (async () => {
      const m = await findOrCreateMatch(eventId, session.user.id);
      if (m) {
        setMatch(m);
        const peerData = await getMatchPeer(m, session.user.id);
        setPeer(peerData);
      } else {
        // Fallback jika belum ada partisipan lain
        setMatch(null);
        setPeer(null);
      }
      setPhase("match");
    })();
  }, [phase, eventId, session]);

  // Fetch real mission from DB
  React.useEffect(() => {
    if (phase !== "mission" || !match) return;
    (async () => {
      const dbMission = await getOrCreateMission(match.id, eventId);
      setMission(dbMission);
    })();
  }, [phase, match, eventId]);

  if (error && !event)
    return (
      <Frame>
        <div className="p-10 text-center text-white/70">
          <div className="text-[24px] font-semibold">Event Tidak Ditemukan</div>
          <div className="mt-2 text-[13px]">{error}</div>
        </div>
      </Frame>
    );

  if (!event)
    return (
      <Frame>
        <div className="p-10 text-center text-white/60">Memuat Event...</div>
      </Frame>
    );

  return (
    <Frame>
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0"
        >
          {phase === "event" && (
            <PublicEventScreen
              event={event}
              participantCount={participants}
              isAuthed={!!session}
              onJoin={doJoin}
              onLogin={() => setPhase("authPhone")}
            />
          )}
          {phase === "authPhone" && (
            <EmailStep
              onBack={() => setPhase("event")}
              onNext={() => setPhase("authOtp")}
              sendOtp={sendOtp}
            />
          )}
          {phase === "authOtp" && (
            <OtpStep
              onBack={() => setPhase("authPhone")}
              onSuccess={() => setPhase("event")}
              verifyOtp={verifyOtp}
              pendingIdentifier={pendingIdentifier}
            />
          )}
          {phase === "profile" && (
            <ProfileStep
              session={session}
              existingProfile={me}
              onDone={onProfileDone}
            />
          )}
          {phase === "waiting" && (
            <WaitingStep
              event={event}
              count={participants}
              participants={participantList}
              onReady={() => setPhase("countdown")}
            />
          )}
          {phase === "countdown" && (
            <CountdownStep onDone={() => setPhase("matching")} />
          )}
          {phase === "matching" && <MatchingStep />}
          {phase === "match" && (
            <MatchStep
              match={match}
              peer={peer}
              me={me}
              onNext={() => setPhase("compat")}
            />
          )}
          {phase === "compat" && (
            <CompatStep
              match={match}
              peer={peer}
              me={me}
              onNext={() => setPhase("mission")}
            />
          )}
          {phase === "mission" && (
            <MissionStep
              mission={mission}
              event={event}
              onNext={() => setPhase("reward")}
              match={match}
              userId={session?.user?.id}
              eventId={eventId}
              setReward={setReward}
            />
          )}
          {phase === "reward" && (
            <RewardStep reward={reward} onClose={() => router.push("/")} />
          )}
        </motion.div>
      </AnimatePresence>

      <SessionWatcher
        onAuthed={() => {
          if (phase === "authOtp" || phase === "authPhone") setPhase("event");
        }}
      />
    </Frame>
  );
};

/* Component watcher */
const SessionWatcher = ({ onAuthed }) => {
  const { session } = useAuth();
  React.useEffect(() => {
    if (session) onAuthed?.();
  }, [session]);
  return null;
};

/* Profiling user */
const ProfileStep = ({ session, existingProfile, onDone }) => {
  const [name, setName] = React.useState(existingProfile?.name || "");
  const [birthday, setBirthday] = React.useState(
    existingProfile?.personality?.birthday || "",
  );
  const [interests, setInterests] = React.useState(
    existingProfile?.interests || [],
  );
  const [energy, setEnergy] = React.useState(
    existingProfile?.personality?.energy ?? 60,
  );
  const [goal, setGoal] = React.useState(
    existingProfile?.personality?.tonight || existingProfile?.goal || "",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const toggleInterest = (label) => {
    setError("");
    setInterests((prev) => {
      if (prev.includes(label)) return prev.filter((x) => x !== label);
      if (prev.length >= 5) {
        setError("Maksimal 5 minat");
        return prev;
      }
      return [...prev, label];
    });
  };

  const vibe = getVibeTitle(energy);

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("Isi nama kamu");
    if (!birthday) return setError("Pilih tanggal lahir");
    if (interests.length < 1) return setError("Pilih minimal 1 minat");
    if (!goal) return setError("Pilih tujuan kamu malam ini");

    setSaving(true);
    const { error: err } = await upsertProfile(session.user.id, {
      name: name.trim(),
      interests,
      goal,
      avatar_url:
        existingProfile?.avatar_url ||
        `https://i.pravatar.cc/300?u=${session.user.id}`,
      personality: {
        ...(existingProfile?.personality || {}),
        birthday,
        energy,
        tonight: goal,
      },
    });
    setSaving(false);
    if (err) return setError(err);
    onDone();
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Lengkapi Profil" />
      <div className="px-7 pb-40">
        <h2 className="text-[24px] font-semibold tracking-tighter mt-2">
          Tentang Kamu
        </h2>
        <p className="text-white/50 text-[13px] mt-1">
          Data ini digunakan untuk matchmaking AI.
        </p>

        <div className="mt-6">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            Nama Lengkap / Panggilan
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kamu"
            className="mt-2 w-full glass rounded-2xl px-4 h-12 bg-transparent outline-none text-[15px] placeholder-white/30"
          />
        </div>

        <div className="mt-5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            Tanggal Lahir
          </label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="mt-2 w-full glass rounded-2xl px-4 h-12 bg-transparent outline-none text-[15px]"
          />
        </div>

        <div className="mt-5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            Minat & Vibe ({interests.length}/5)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_VIBE_INTERESTS.map((label) => {
              const on = interests.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleInterest(label)}
                  className={`h-10 px-3.5 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium transition ${
                    on
                      ? "gradient-brand text-white glow-pink"
                      : "glass text-white/85"
                  }`}
                >
                  <span>{getInterestEmoji(label)}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            Tingkat Energi Malam Ini
          </label>
          <div className="mt-2 text-center text-[13px] text-white/70">
            {vibe.emoji} {vibe.l} · {energy}%
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="mt-2 w-full h-2 rounded-full bg-white/10 accent-[#FF2F92]"
          />
        </div>

        <div className="mt-5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            Tujuan di Event Ini
          </label>
          <div className="mt-2 space-y-2">
            {TONIGHT_OPTIONS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`w-full rounded-2xl p-3 text-left flex items-center gap-3 ${
                  goal === g.id ? "gradient-brand glow-pink" : "glass"
                }`}
              >
                <span className="text-[18px]">{g.emoji}</span>
                <span className="text-[14px] font-medium">{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">
            {error}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={submit} disabled={saving}>
          {saving ? "Menyimpan…" : "Lanjutkan"}
        </BigButton>
      </div>
    </div>
  );
};

/* Email Step */
const EmailStep = ({ onBack, onNext, sendOtp }) => {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const submit = async () => {
    setError("");
    setLoading(true);
    const res = await sendOtp(email);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    onNext();
  };
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden">
      <StatusBar />
      <TopBar title="Masuk" onBack={onBack} />
      <div className="px-7 pt-2">
        <h2 className="text-[30px] font-semibold tracking-tighter">
          Gabung Event
        </h2>
        <p className="text-white/50 text-[13px] mt-2">
          Masukkan email untuk menerima kode OTP 6-digit.
        </p>
        <div className="mt-8 space-y-3">
          <div className="glass rounded-2xl px-4 h-14 flex items-center gap-3">
            <span className="text-[14px] font-medium text-white/70">@</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              inputMode="email"
              autoComplete="email"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="flex-1 bg-transparent outline-none text-[15px] placeholder-white/30"
            />
          </div>
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">
              {error}
            </div>
          )}
        </div>
        <div className="mt-8">
          <BigButton
            onClick={submit}
            disabled={loading}
            icon={loading ? null : <ArrowRight className="w-4 h-4" />}
          >
            {loading ? "Mengirim kode…" : "Lanjutkan"}
          </BigButton>
        </div>
      </div>
    </div>
  );
};

/* OTP Step */
const OtpStep = ({ onBack, onSuccess, verifyOtp, pendingIdentifier }) => {
  const [code, setCode] = React.useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const pressKey = (k) => {
    setError("");
    if (k === "⌫") {
      setCode((prev) => {
        const idx = prev.findIndex((c) => c === "");
        const t = idx === -1 ? prev.length - 1 : idx - 1;
        if (t < 0) return prev;
        const n = [...prev];
        n[t] = "";
        return n;
      });
      return;
    }
    setCode((prev) => {
      const idx = prev.findIndex((c) => c === "");
      if (idx === -1) return prev;
      const n = [...prev];
      n[idx] = k;
      return n;
    });
  };

  const doVerify = async () => {
    setError("");
    const token = code.join("");
    if (token.length < 6) return setError("Masukkan 6 digit kode OTP");
    setLoading(true);
    const res = await verifyOtp(token);
    setLoading(false);
    if (res?.error) return setError(res.error);
    onSuccess();
  };

  React.useEffect(() => {
    if (code.every((c) => c !== "") && !loading) doVerify();
  }, [code.join("")]);

  return (
    <div className="relative h-full w-full bg-haze overflow-hidden">
      <StatusBar />
      <TopBar title="Verifikasi" onBack={onBack} />
      <div className="px-7">
        <h2 className="text-[30px] font-semibold tracking-tighter">
          Verifikasi Kode
        </h2>
        <p className="text-white/50 text-[13px] mt-2">
          Dikirim ke {pendingIdentifier}
        </p>
        <div className="mt-10 flex gap-2.5 justify-between">
          {code.map((c, i) => (
            <div
              key={i}
              className={`flex-1 h-16 rounded-2xl flex items-center justify-center text-[24px] font-semibold ${
                c ? "gradient-brand-soft glow-pink" : "glass"
              }`}
            >
              {c || <span className="w-2 h-2 rounded-full bg-white/20" />}
            </div>
          ))}
        </div>
        {error && (
          <div className="mt-5 px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92] text-center">
            {error}
          </div>
        )}
        <div className="mt-8">
          <BigButton
            onClick={doVerify}
            disabled={loading}
            icon={loading ? null : <ArrowRight className="w-4 h-4" />}
          >
            {loading ? "Memverifikasi…" : "Verifikasi"}
          </BigButton>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
          (k, i) => (
            <button
              key={i}
              disabled={!k || loading}
              onClick={() => k && pressKey(k)}
              className={`h-14 rounded-2xl text-[20px] font-medium active:scale-95 transition ${
                k ? "glass" : ""
              }`}
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
};

/* Waiting Room */
const WaitingStep = ({ event, count, participants = [], onReady }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar
      title="Waiting Room"
      right={
        <span className="text-[11px] font-medium text-[#00E5FF] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
          Live
        </span>
      }
    />
    <div className="px-6 pb-32">
      <div className="glass-strong rounded-3xl p-5 text-center">
        <div className="text-[11px] uppercase tracking-widest text-white/50">
          Kamu Sudah Masuk
        </div>
        <div className="mt-2 text-[26px] font-bold tracking-tighter">
          {event.title || event.name}
        </div>
        {event.venue_name && (
          <div className="mt-1 text-[13px] text-white/60">
            📍 {event.venue_name}
          </div>
        )}
        <div className="mt-5 flex items-center justify-center gap-4 text-[12px] text-white/60">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {count} Pengunjung
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#00E5FF]" /> Matchmaking
            Aktif
          </span>
        </div>
      </div>

      {participants?.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">
            Di Dalam Ruangan
          </div>
          <div className="space-y-2">
            {participants.slice(0, 10).map((p) => (
              <div key={p.id} className="glass rounded-2xl p-3">
                <VibeProfileCard
                  profile={p.profiles}
                  variant="compact"
                  showBio={false}
                  avatarSize={44}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-[13.5px] text-white/70 leading-relaxed text-center">
        Bersantai sejenak, nikmati suasananya. Ketika siap, klik tombol di bawah
        untuk dicocokkan!
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
      <BigButton onClick={onReady} icon={<ArrowRight className="w-4 h-4" />}>
        Saya Siap
      </BigButton>
    </div>
  </div>
);

/* Countdown */
const CountdownStep = ({ onDone }) => {
  const [n, setN] = React.useState(3);
  React.useEffect(() => {
    if (n <= 0) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n - 1), 900);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden flex items-center justify-center">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-[#FF2F92]/25 blur-3xl pulse-slow" />
      <AnimatePresence mode="wait">
        <motion.div
          key={n}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="text-[220px] font-bold leading-none tracking-tighter text-gradient text-glow-white"
        >
          {n > 0 ? n : "GO"}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* Matching animation */
const MatchingStep = () => (
  <div className="relative h-full w-full bg-black overflow-hidden">
    <div className="relative h-full flex flex-col items-center justify-center px-8">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-64 h-64 rounded-full border border-white/10 animate-[spin_10s_linear_infinite]" />
        <div className="absolute w-32 h-32 rounded-full border border-[#FF2F92]/50 animate-[spin_5s_linear_infinite]" />
        <div className="relative w-24 h-24 rounded-full gradient-brand glow-pink flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </div>
      <div className="mt-14 text-[22px] font-semibold tracking-tighter">
        Mencari Partner Vibe...
      </div>
      <div className="mt-2 text-white/60 text-[13px]">
        Mengakumulasi Poin & Sinyal Vibe
      </div>
    </div>
  </div>
);

/* Match Result Step */
const MatchStep = ({ match, peer, onNext, me }) => {
  const vibeMatch = React.useMemo(() => {
    if (match?.breakdown?.reasons?.length) {
      return { score: match.score, reasons: match.breakdown.reasons };
    }
    if (me && peer) return computeVibeMatch(me, peer);
    return { score: match?.score || 85, reasons: [] };
  }, [match, me, peer]);

  const peerVibe = normalizeVibe(peer);

  if (!peer) {
    return (
      <div className="relative h-full w-full bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="text-xl font-bold mb-2">Belum ada partner lain</div>
        <p className="text-xs text-white/60 mb-6">
          Kamu adalah orang pertama di event ini atau partisipan lain sedang
          offline.
        </p>
        <BigButton onClick={onNext}>Lanjut ke Misi</BigButton>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <img
        src={peer?.avatar_url || "https://i.pravatar.cc/600"}
        className="absolute inset-0 w-full h-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
      <StatusBar />
      <div
        className="px-6 mt-4 flex flex-col items-center relative pb-40 overflow-y-auto phone-scroll"
        style={{ height: "calc(100% - 40px)" }}
      >
        <div className="text-[11px] uppercase tracking-widest text-white/70 flex items-center gap-1">
          <span>✨</span> Matchmaking Vibe AI
        </div>
        <div className="mt-3 relative">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-pink-500">
            <img
              src={peer?.avatar_url || "https://i.pravatar.cc/300"}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-brand text-[14px] font-bold glow-pink">
            {vibeMatch.score}%
          </div>
        </div>
        <div className="mt-6 text-[26px] font-bold tracking-tighter">
          {peer?.name || "Partner Kamu"}
        </div>
        <div className="mt-1 text-white/70 text-[12px] flex items-center gap-2 flex-wrap justify-center">
          {peerVibe?.vibeTitle && (
            <span>
              {peerVibe.vibeTitle.emoji} {peerVibe.vibeTitle.l}
            </span>
          )}
        </div>

        {vibeMatch.reasons?.length > 0 && (
          <div className="mt-6 w-full glass-strong rounded-3xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50 mb-3">
              Alasan Cocok
            </div>
            <MatchReasons reasons={vibeMatch.reasons} />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={onNext}>Lihat Kompatibilitas</BigButton>
      </div>
    </div>
  );
};

/* Compatibility Step */
const CompatStep = ({ match, peer, me, onNext }) => {
  const computed = React.useMemo(() => {
    if (match?.breakdown?.reasons?.length) {
      return {
        score: match.score,
        reasons: match.breakdown.reasons,
        breakdown: match?.breakdown || {},
      };
    }
    if (me && peer) return computeVibeMatch(me, peer);
    return { score: match?.score || 80, reasons: [], breakdown: {} };
  }, [match, me, peer]);

  const b = computed.breakdown || {};
  const items = [
    { l: "Minat", v: b.interest ?? 75 },
    { l: "Energi", v: b.energy ?? 80 },
    { l: "Tujuan Event", v: b.goal ?? 70 },
    { l: "Kecocokan Vibe", v: Math.min(99, computed.score) },
  ];

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Tingkat Kompatibilitas" />
      <div className="px-6 pb-40">
        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <img
              src={peer?.avatar_url || "https://i.pravatar.cc/100"}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="text-[15px] font-semibold">
                Kamu & {peer?.name ? peer.name.split(" ")[0] : "Partner"}
              </div>
              <div className="text-[11px] text-white/50">Kalkulasi Vibe AI</div>
            </div>
            <div className="px-2.5 py-1 rounded-full gradient-brand text-[11px] font-bold glow-pink">
              {computed.score}%
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map((r) => (
            <div key={r.l} className="glass rounded-2xl p-4">
              <div className="text-[11px] text-white/50">{r.l}</div>
              <div className="mt-2 text-[22px] font-semibold tracking-tighter">
                {r.v}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full gradient-brand"
                  style={{ width: `${r.v}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton onClick={onNext} icon={<Flame className="w-4 h-4" />}>
          Mulai Misi Kamu
        </BigButton>
      </div>
    </div>
  );
};

/* Mission Step dengan Clues Dinamis */
const MissionStep = ({
  mission,
  event,
  onNext,
  userId,
  eventId,
  setReward,
}) => {
  // Clues dinamis dari objek mission atau default dari event
  const [clues, setClues] = React.useState([]);

  React.useEffect(() => {
    if (mission?.clues && Array.isArray(mission.clues)) {
      setClues(mission.clues);
    } else {
      setClues([
        {
          label: `Temui pengunjung di area ${event?.venue_name || "Venue"}`,
          done: false,
        },
        { label: "Sapa dan tanyakan minuman/topik favoritnya", done: false },
        { label: "Foto atau tanyakan poin check-in mereka", done: false },
      ]);
    }
  }, [mission, event]);

  const [busy, setBusy] = React.useState(false);

  const doneCount = clues.filter((c) => c.done).length;
  const pct =
    clues.length > 0 ? Math.round((doneCount / clues.length) * 100) : 0;

  const toggle = async (idx) => {
    const next = clues.map((c, i) => (i === idx ? { ...c, done: !c.done } : c));
    setClues(next);
    if (mission?.id) await updateMission(mission.id, { clues: next });
  };

  const claim = async () => {
    setBusy(true);
    const title = mission?.reward_title || "Poin Hadiah Event";
    const xp = mission?.reward_xp || event?.checkin_points || 50;

    let created = null;
    if (userId) {
      const { data } = await createReward(userId, eventId, mission?.id, {
        title,
        description: `Didapatkan di event ${event?.title || event?.name || ""}`,
        xp,
      });
      created = data;
    }
    if (mission?.id) await updateMission(mission.id, { status: "complete" });

    setReward(
      created || {
        title,
        xp,
        code: Math.random().toString(36).slice(2, 10).toUpperCase(),
      },
    );
    setBusy(false);
    onNext();
  };

  const allDone = clues.length > 0 && clues.every((c) => c.done);

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Misi Event" />
      <div className="px-6 pb-40">
        <div className="relative rounded-3xl overflow-hidden p-6 gradient-brand glow-pink">
          <div className="relative">
            <div className="text-[11px] uppercase tracking-widest opacity-80">
              Misi Berlangsung
            </div>
            <div className="mt-1 text-[22px] font-bold tracking-tighter leading-tight">
              {mission?.title ||
                `Selesaikan Misi di ${event?.title || "Event"}`}
            </div>
          </div>
        </div>

        <div className="mt-4 glass-strong rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-white/40">
              Progres
            </span>
            <span className="text-[11px] text-[#00E5FF]">
              {doneCount} dari {clues.length} Selesai
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full gradient-brand rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {clues.map((c, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99]"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  c.done ? "bg-[#00E5FF] text-black" : "border border-white/25"
                }`}
              >
                {c.done ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3 opacity-40" />
                )}
              </div>
              <div
                className={`flex-1 text-[14px] ${
                  c.done ? "line-through text-white/50" : ""
                }`}
              >
                {c.label}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 glass rounded-3xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-medium">Hadiah Misi</div>
            <div className="text-[11.5px] text-white/50">
              +{mission?.reward_xp || event?.checkin_points || 50} Poin / XP
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <BigButton
          onClick={claim}
          disabled={!allDone || busy}
          icon={<Award className="w-4 h-4" />}
        >
          {busy
            ? "Mengklaim…"
            : allDone
              ? "Klaim Hadiah"
              : `Selesaikan ${clues.length - doneCount} Tugas Lagi`}
        </BigButton>
      </div>
    </div>
  );
};

/* Reward Claimed Step */
const RewardStep = ({ reward, onClose }) => {
  const code = reward?.code || "SIRGAZ-EVENT";
  const redeemUrl =
    typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : "";

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Hadiah Kamu" />
      <div className="px-6 pb-32">
        <div className="relative rounded-3xl overflow-hidden p-6 gradient-brand glow-pink text-center">
          <div className="relative">
            <div className="text-[11px] uppercase tracking-widest opacity-80">
              Selamat! Kamu Mendapatkan
            </div>
            <div className="mt-2 text-[52px] font-bold tracking-tighter">
              +{reward?.xp || 50}
              <span className="text-[20px] align-top ml-2 opacity-90">
                XP / Poin
              </span>
            </div>
            <div className="mt-2 text-[14px] opacity-90">
              {reward?.title || "Hadiah Berhasil Diberikan"}
            </div>
          </div>
        </div>

        <div className="mt-5 glass-strong rounded-3xl p-5 flex flex-col items-center">
          <div className="text-[11px] uppercase tracking-widest text-white/50">
            QR Penukaran
          </div>
          <div className="mt-3 p-4 rounded-2xl bg-white">
            <QRCodeCanvas value={redeemUrl} size={180} level="H" />
          </div>
          <div className="mt-3 text-[13px] font-mono text-white/70 tracking-widest">
            {code}
          </div>
          <div className="mt-1 text-[11px] text-white/50">
            Tunjukkan QR ini kepada kasir/merchant di lokasi
          </div>
        </div>

        <div className="mt-5">
          <BigButton
            onClick={onClose}
            variant="ghost"
            icon={<Heart className="w-4 h-4" />}
          >
            Selesai & Kembali
          </BigButton>
        </div>
      </div>
    </div>
  );
};
