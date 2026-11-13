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
  RefreshCw,
  ShieldAlert,
  Ban,
  Camera,
} from "lucide-react";
import { AuthProvider, useAuth } from "../../authContext";
import {
  getEvent,
  joinEvent,
  countParticipants,
  listParticipants,
  getOrCreateMission,
  updateMission,
  createReward,
  getProfile,
  upsertProfile,
  getPrivateProfile,
  upsertPrivateProfile,
  uploadAvatar,
  isAdult,
  isMatchProfileComplete,
  matchmakingStart,
  matchmakingCurrent,
  matchmakingReroll,
  matchmakingConfirm,
  blockUser,
  reportUser,
  REPORT_REASONS,
  matchErrorMessage,
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
  const [mePrivate, setMePrivate] = React.useState(null);
  // PRD V2: server-side random match session { match, quota, status, ... }
  const [mm, setMm] = React.useState(null);
  const [mmBusy, setMmBusy] = React.useState(false);
  const [mmError, setMmError] = React.useState("");
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
    (async () => {
      setMe(await getProfile(session.user.id));
      setMePrivate(await getPrivateProfile(session.user.id));
    })();
  }, [session]);

  const doJoin = async () => {
    if (!session?.user) {
      setPhase("authPhone");
      return;
    }
    setLoading(true);
    setError("");
    const prof = await getProfile(session.user.id);
    const priv = await getPrivateProfile(session.user.id);
    const isComplete =
      isMatchProfileComplete(prof, priv) &&
      (prof.personality?.tonight || prof.goal);
    setLoading(false);

    setMe(prof);
    setMePrivate(priv);
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
    setMePrivate(await getPrivateProfile(session.user.id));
    await actuallyJoin();
  };

  // PRD V2 random matchmaking: the server picks (and remembers) one eligible person.
  // Reloading calls the same idempotent RPC and gets the same person back.
  const applyMm = (state) => {
    setMm(state);
    setPeer(state?.match || null);
    setMatch(null);
  };

  React.useEffect(() => {
    if (phase !== "matching") return;
    (async () => {
      setMmError("");
      const { data, error, code } = await matchmakingStart(eventId);
      if (error) setMmError(matchErrorMessage(code, error));
      applyMm(data || null);
      setPhase("match");
    })();
  }, [phase, eventId, session]);

  // Nobody eligible yet: keep checking for free (no quota is used for the first match).
  React.useEffect(() => {
    if (phase !== "match" || mm?.match || mmError) return;
    const t = setInterval(async () => {
      const { data } = await matchmakingCurrent(eventId);
      if (data?.match) applyMm(data);
    }, 5000);
    return () => clearInterval(t);
  }, [phase, mm, mmError, eventId]);

  const doReroll = async () => {
    setMmBusy(true);
    setMmError("");
    // One key per tap: a network retry of the same tap never spends quota twice.
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { data, error, code } = await matchmakingReroll(eventId, key);
    setMmBusy(false);
    if (error) return setMmError(matchErrorMessage(code, error));
    applyMm(data);
  };

  const doBlock = async () => {
    if (!peer?.user_id) return;
    setMmBusy(true);
    const { error, code } = await blockUser(peer.user_id);
    if (error) {
      setMmBusy(false);
      return setMmError(matchErrorMessage(code, error));
    }
    const { data } = await matchmakingCurrent(eventId);
    setMmBusy(false);
    applyMm(data || null);
  };

  const doReport = async ({ reason, details }) => {
    if (!peer?.user_id) return { error: "Tidak ada pengguna" };
    const { error, code } = await reportUser({
      userId: peer.user_id,
      reason,
      details,
      eventId,
      block: true,
    });
    if (error) return { error: matchErrorMessage(code, error) };
    const { data } = await matchmakingCurrent(eventId);
    applyMm(data || null);
    return { error: null };
  };

  const doConfirm = async () => {
    setMmBusy(true);
    setMmError("");
    const { data, error, code } = await matchmakingConfirm(eventId);
    setMmBusy(false);
    if (error) return setMmError(matchErrorMessage(code, error));
    setMatch(data);
    setPhase("compat");
  };

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
              existingPrivate={mePrivate}
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
              peer={peer}
              me={me}
              quota={mm?.quota}
              busy={mmBusy}
              error={mmError}
              onReroll={doReroll}
              onBlock={doBlock}
              onReport={doReport}
              onNext={doConfirm}
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
const GENDER_OPTIONS = [
  { id: "male", label: "Pria" },
  { id: "female", label: "Wanita" },
];
const SEEKING_OPTIONS = [
  { id: "female", label: "Wanita" },
  { id: "male", label: "Pria" },
  { id: "any", label: "Siapa saja" },
];
// Old onboarding saved random i.pravatar.cc stock faces; those are not real photos.
const isRealPhoto = (url) => !!url && !/pravatar\.cc/.test(url);

const ProfileStep = ({ session, existingProfile, existingPrivate, onDone }) => {
  const [name, setName] = React.useState(existingProfile?.name || "");
  const [birthday, setBirthday] = React.useState(
    existingPrivate?.birthday || existingProfile?.personality?.birthday || "",
  );
  const genderLocked = !!existingProfile?.gender;
  const [gender, setGender] = React.useState(existingProfile?.gender || "");
  const [seeking, setSeeking] = React.useState(existingPrivate?.seeking || "");
  const [photoUrl, setPhotoUrl] = React.useState(
    isRealPhoto(existingProfile?.avatar_url) ? existingProfile.avatar_url : "",
  );
  const [uploading, setUploading] = React.useState(false);
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

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    const { data, error: upErr } = await uploadAvatar(session.user.id, file);
    setUploading(false);
    if (upErr) return setError(upErr);
    setPhotoUrl(data);
  };

  const submit = async () => {
    setError("");
    if (!photoUrl) return setError("Unggah foto kamu");
    if (!name.trim()) return setError("Isi nama kamu");
    if (!birthday) return setError("Pilih tanggal lahir");
    if (!isAdult(birthday)) return setError("SirGaZ hanya untuk usia 18 tahun ke atas");
    if (!gender) return setError("Pilih gender kamu");
    if (!seeking) return setError("Pilih siapa yang ingin kamu temui");
    if (interests.length < 1) return setError("Pilih minimal 1 minat");
    if (!goal) return setError("Pilih tujuan kamu malam ini");

    setSaving(true);
    // Birthday is private: it lives in profile_private, never in the public profile JSON.
    const { birthday: _drop, ...publicPersonality } =
      existingProfile?.personality || {};
    const { error: err } = await upsertProfile(session.user.id, {
      name: name.trim(),
      interests,
      goal,
      ...(genderLocked ? {} : { gender }),
      avatar_url: photoUrl,
      personality: { ...publicPersonality, energy, tonight: goal },
    });
    if (err) {
      setSaving(false);
      return setError(err);
    }
    const { error: privErr } = await upsertPrivateProfile(session.user.id, {
      birthday,
      seeking,
      energy,
      goal,
    });
    setSaving(false);
    if (privErr) return setError(privErr);
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
          Dipakai untuk mencarikan match di event ini. Tanggal lahir tidak
          ditampilkan ke orang lain.
        </p>

        <div className="mt-6 flex items-center gap-4">
          <label className="relative w-20 h-20 rounded-full glass overflow-hidden flex items-center justify-center cursor-pointer shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-6 h-6 text-white/60" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPhoto}
              className="hidden"
            />
          </label>
          <div className="text-[12px] text-white/60">
            {uploading
              ? "Mengunggah foto…"
              : photoUrl
                ? "Ketuk foto untuk mengganti"
                : "Unggah foto wajah kamu (wajib, maks 5 MB)"}
          </div>
        </div>

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
            Gender
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {GENDER_OPTIONS.map((g) => (
              <button
                key={g.id}
                disabled={genderLocked}
                onClick={() => setGender(g.id)}
                className={`h-11 rounded-2xl text-[14px] font-medium ${
                  gender === g.id ? "gradient-brand glow-pink" : "glass"
                } ${genderLocked && gender !== g.id ? "opacity-40" : ""}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {genderLocked && (
            <div className="mt-1 text-[11px] text-white/40">
              Gender tidak bisa diubah sendiri. Hubungi support jika salah.
            </div>
          )}
        </div>

        <div className="mt-5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            Ingin Bertemu
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SEEKING_OPTIONS.map((g) => (
              <button
                key={g.id}
                onClick={() => setSeeking(g.id)}
                className={`h-11 rounded-2xl text-[13px] font-medium ${
                  seeking === g.id ? "gradient-brand glow-pink" : "glass"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
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
        <BigButton onClick={submit} disabled={saving || uploading}>
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

/* Match Result Step — PRD V2: one random eligible person, reroll with quota, block/report */
const MatchStep = ({ peer, me, quota, busy, error, onReroll, onBlock, onReport, onNext }) => {
  const [reportOpen, setReportOpen] = React.useState(false);
  const vibeMatch = React.useMemo(() => {
    if (me && peer) {
      const local = computeVibeMatch(me, peer);
      return { score: peer.compatibility ?? local.score, reasons: local.reasons };
    }
    return { score: peer?.compatibility ?? 0, reasons: [] };
  }, [me, peer]);

  const peerVibe = normalizeVibe(peer);
  const free = quota?.free_remaining ?? 0;
  const paid = quota?.paid_remaining ?? 0;
  const outOfQuota = free + paid <= 0;

  if (!peer) {
    return (
      <div className="relative h-full w-full bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full gradient-brand glow-pink flex items-center justify-center mb-5 animate-pulse">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="text-xl font-bold mb-2">Mencari orang yang cocok…</div>
        <p className="text-xs text-white/60 mb-6 max-w-[280px]">
          {error ||
            "Belum ada peserta lain yang sesuai preferensimu. Kami cek otomatis tiap beberapa detik — kuota gantimu tidak terpakai."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {peer.avatar_url && (
        <img
          src={peer.avatar_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
      <StatusBar />
      <div
        className="px-6 mt-4 flex flex-col items-center relative pb-64 overflow-y-auto phone-scroll"
        style={{ height: "calc(100% - 40px)" }}
      >
        <div className="w-full flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-white/70">
            Match Kamu Malam Ini
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setReportOpen(true)}
              disabled={busy}
              aria-label="Laporkan"
              className="w-9 h-9 rounded-full glass flex items-center justify-center"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Blokir ${peer.name || "pengguna ini"}? Kalian tidak akan dipertemukan lagi.`)) onBlock();
              }}
              disabled={busy}
              aria-label="Blokir"
              className="w-9 h-9 rounded-full glass flex items-center justify-center"
            >
              <Ban className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 relative">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-pink-500 bg-white/5">
            {peer.avatar_url && (
              <img src={peer.avatar_url} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-brand text-[14px] font-bold glow-pink">
            {vibeMatch.score}%
          </div>
        </div>
        <div className="mt-6 text-[26px] font-bold tracking-tighter">
          {peer.name || "Partner Kamu"}
          {peer.age ? <span className="text-white/60 font-medium">, {peer.age}</span> : null}
        </div>
        <div className="mt-1 text-white/70 text-[12px] flex items-center gap-2 flex-wrap justify-center">
          {peerVibe?.vibeTitle && (
            <span>
              {peerVibe.vibeTitle.emoji} {peerVibe.vibeTitle.l}
            </span>
          )}
        </div>
        {(peer.interests || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {peer.interests.slice(0, 5).map((i) => (
              <span key={i} className="px-2.5 h-7 rounded-full glass text-[11.5px] flex items-center gap-1">
                {getInterestEmoji(i)} {i}
              </span>
            ))}
          </div>
        )}

        {vibeMatch.reasons?.length > 0 && (
          <div className="mt-6 w-full glass-strong rounded-3xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50 mb-3">
              Alasan Cocok
            </div>
            <MatchReasons reasons={vibeMatch.reasons} />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/95 to-transparent space-y-2.5">
        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">
            {error}
          </div>
        )}
        {outOfQuota ? (
          <div className="glass rounded-2xl p-3 text-center">
            <div className="text-[13px] font-semibold">Kuota ganti match habis</div>
            <div className="text-[11.5px] text-white/60 mt-0.5">
              Paket 10× ganti match · Rp10.000 — pembayaran segera tersedia
            </div>
          </div>
        ) : (
          <button
            onClick={onReroll}
            disabled={busy}
            className="w-full h-12 rounded-2xl glass flex items-center justify-center gap-2 text-[14px] font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
            Ganti Match
            <span className="text-white/60 text-[12px]">
              ({free > 0 ? `${free} gratis` : `${paid} berbayar`} tersisa)
            </span>
          </button>
        )}
        <BigButton onClick={onNext} disabled={busy}>
          Lihat Kompatibilitas
        </BigButton>
      </div>

      {reportOpen && (
        <ReportSheet
          name={peer.name}
          onClose={() => setReportOpen(false)}
          onSubmit={async (payload) => {
            const res = await onReport(payload);
            if (!res?.error) setReportOpen(false);
            return res;
          }}
        />
      )}
    </div>
  );
};

/* Report bottom sheet (PRD V2 §6.4) — reporting also blocks */
const ReportSheet = ({ name, onClose, onSubmit }) => {
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState("");
  const send = async () => {
    if (!reason) return setErr("Pilih alasan laporan");
    setSending(true);
    setErr("");
    const res = await onSubmit({ reason, details: details.trim().slice(0, 1000) });
    setSending(false);
    if (res?.error) setErr(res.error);
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div
        className="w-full glass-strong rounded-t-3xl p-5 max-h-[85%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[17px] font-semibold">Laporkan {name || "pengguna"}</div>
        <div className="text-[12px] text-white/60 mt-1">
          Laporan ditinjau tim SirGaZ. Pengguna ini juga otomatis diblokir.
        </div>
        <div className="mt-4 space-y-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setReason(r.id)}
              className={`w-full rounded-2xl p-3 text-left text-[13.5px] ${
                reason === r.id ? "gradient-brand" : "glass"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          placeholder="Ceritakan singkat (opsional)"
          className="mt-3 w-full glass rounded-2xl p-3 bg-transparent outline-none text-[13px] min-h-[80px]"
        />
        {err && <div className="mt-2 text-[12px] text-[#FF2F92]">{err}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="h-11 rounded-2xl glass text-[14px]">
            Batal
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="h-11 rounded-2xl gradient-brand text-[14px] font-semibold disabled:opacity-50"
          >
            {sending ? "Mengirim…" : "Kirim Laporan"}
          </button>
        </div>
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
            {peer?.avatar_url ? (
              <img
                src={peer.avatar_url}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10" />
            )}
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

  const [claimError, setClaimError] = React.useState("");

  // Only a reward the server actually issued is shown. The old fallback invented a
  // random code that staff could never redeem.
  const claim = async () => {
    setBusy(true);
    setClaimError("");
    const { data, error, code } = userId
      ? await createReward(userId, eventId, mission?.id)
      : { data: null, error: "Silakan masuk terlebih dahulu.", code: null };
    setBusy(false);
    if (error || !data?.code) {
      return setClaimError(
        matchErrorMessage(code, error || "Hadiah belum bisa diklaim. Coba lagi."),
      );
    }
    setReward(data);
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
        {claimError && (
          <div className="mb-3 px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">
            {claimError}
          </div>
        )}
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
