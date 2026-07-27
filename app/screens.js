"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  Search,
  Home,
  Trophy,
  MessageCircle,
  User,
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Camera,
  QrCode,
  Sparkles,
  Music,
  Utensils,
  Plane,
  Briefcase,
  Shirt,
  Gamepad2,
  Coffee,
  PartyPopper,
  Cpu,
  Heart,
  Send,
  Gift,
  CheckCircle2,
  Circle,
  Star,
  ShieldCheck,
  Globe,
  LogOut,
  BellRing,
  Lock,
  Settings as SettingsIcon,
  ChevronLeft,
  Plus,
  MoreHorizontal,
  Zap,
  Target,
  Award,
  Flame,
  BarChart3,
  Activity,
  Eye,
  Phone,
  X,
  Check,
  Radio,
  Crown,
  Volume2,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  PolarRadiusAxis,
} from "recharts";
import { useAuth } from "./authContext";

/* ---------- Shared UI Primitives ---------- */

// StatusBar retired \u2014 sirgaZ is a true responsive web app, not a fake iPhone frame.
// Kept as a small transparent safe-area spacer so legacy screens that still call
// <StatusBar /> keep their top rhythm. Renders nothing visible, no battery/signal.
export const StatusBar = () => (
  <div aria-hidden className="h-3 sm:h-4 pt-safe" />
);

export const TopBar = ({ title, onBack, right, subtle = false }) => (
  <div
    className={`flex items-center justify-between px-6 pt-2 pb-4 ${subtle ? "" : ""}`}
  >
    <button
      onClick={onBack}
      className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-95 transition"
    >
      <ChevronLeft className="w-5 h-5 text-white" />
    </button>
    <div className="text-[15px] font-semibold tracking-tight">{title}</div>
    <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
      {right || <MoreHorizontal className="w-4 h-4 text-white/70" />}
    </div>
  </div>
);

export const BigButton = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  icon,
}) => {
  const base =
    "w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[15px] tracking-tight active:scale-[0.98] transition";
  const styles = {
    primary: "gradient-brand text-white glow-pink",
    ghost: "glass text-white",
    outline: "border border-white/15 text-white bg-white/[0.02]",
    dark: "bg-white text-black",
  };
  return (
    <button
      onClick={onClick}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
      {icon}
    </button>
  );
};

export const BottomNav = ({ active = "home", onNavigate }) => {
  const items = [
    { id: "home", icon: Home, label: "Home", target: "home" },
    { id: "leaderboard", icon: Trophy, label: "Ranks", target: "leaderboard" },
    { id: "chat", icon: MessageCircle, label: "Chat", target: "chat" },
    { id: "profile", icon: User, label: "Profile", target: "profile" },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-3 z-30 pointer-events-none">
      <div className="glass-strong rounded-[28px] px-2.5 py-2.5 flex items-center justify-between pointer-events-auto shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)]">
        {items.map((it) => {
          const A = it.icon;
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onNavigate?.(it.target)}
              className={`relative flex-1 h-12 rounded-2xl flex items-center justify-center gap-1.5 transition ${isActive ? "text-white" : "text-white/45"}`}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-2xl gradient-brand opacity-90 glow-pink" />
              )}
              <A className="w-[18px] h-[18px] relative" />
              <span className="text-[11px] font-medium relative">
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* Reusable event card */
export const EventCard = ({
  title,
  venue,
  date,
  tag,
  hue = "pink",
  onClick,
}) => {
  const grad = {
    pink: "from-[#FF2F92]/70 via-[#A93CFF]/60 to-[#00E5FF]/40",
    purple: "from-[#A93CFF]/70 via-[#00E5FF]/40 to-[#FF2F92]/50",
    cyan: "from-[#00E5FF]/60 via-[#A93CFF]/50 to-[#FF2F92]/60",
  }[hue];
  return (
    <button
      onClick={onClick}
      className="relative w-full text-left rounded-3xl overflow-hidden active:scale-[0.99] transition"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${grad}`} />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.25),transparent_60%)]" />
      <div className="absolute inset-0 grid-lines opacity-40" />
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative p-5 h-[180px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] px-2.5 py-1 rounded-full glass-strong font-medium">
            {tag}
          </span>
          <span className="text-[11px] font-medium opacity-90 flex items-center gap-1">
            <Users className="w-3 h-3" /> 1.2k
          </span>
        </div>
        <div>
          <div className="text-[20px] font-semibold leading-tight tracking-tight">
            {title}
          </div>
          <div className="mt-1 text-[12px] text-white/80 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {venue}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {date}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

/* ---------- 01 SPLASH \u2014 MAXE CLASS Anniversary ---------- */
export const Splash = ({ go }) => {
  const { session, sessionLoading } = useAuth();
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (sessionLoading) return;
      go?.(session ? "home" : "landing");
    }, 2000);
    return () => clearTimeout(t);
  }, [session, sessionLoading, go]);

  return (
    <div className="relative w-full min-h-[100dvh] overflow-hidden bg-black">
      {/* Cinematic vignette */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_40%,rgba(255,255,255,0.06),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(196,255,0,0.10),transparent_60%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-6">
        {/* small event label \u2014 fades in first */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-[11px] sm:text-[12px] tracking-[0.34em] uppercase text-white/50 mb-10 sm:mb-12"
        >
          Anniversary
        </motion.div>

        {/* Logo w/ animated glow rings */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Concentric pulse rings */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#C4FF00]/20 blur-2xl maxe-breathe"
          />
          <span
            aria-hidden
            className="absolute -inset-6 rounded-full border border-[#C4FF00]/15 ring-ping"
            style={{ animationDelay: "0.3s" }}
          />
          <span
            aria-hidden
            className="absolute -inset-10 rounded-full border border-[#C4FF00]/10 ring-ping"
            style={{ animationDelay: "0.9s" }}
          />

          <img
            src="/brand/maxe-class-logo.png"
            alt="MAXE CLASS"
            width={220}
            height={220}
            className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] object-contain drop-shadow-[0_0_44px_rgba(196,255,0,0.35)]"
            draggable="false"
          />
        </motion.div>

        {/* Hairline separator + Powered by */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 sm:mt-16 flex flex-col items-center gap-3"
        >
          <span className="w-10 h-px bg-white/15" />
          <span className="text-[11px] tracking-[0.26em] uppercase text-white/40">
            Powered by <span className="text-white/70 font-medium">sirgaZ</span>
          </span>
        </motion.div>

        {/* subtle progress hint */}
        <div className="absolute bottom-10 flex gap-2">
          <span className="dot w-1.5 h-1.5 rounded-full bg-[#C4FF00]/80" />
          <span
            className="dot w-1.5 h-1.5 rounded-full bg-[#C4FF00]/60"
            style={{ animationDelay: "0.15s" }}
          />
          <span
            className="dot w-1.5 h-1.5 rounded-full bg-[#C4FF00]/40"
            style={{ animationDelay: "0.3s" }}
          />
        </div>

        {/* tap-anywhere to skip */}
        <button
          onClick={() => go?.("landing")}
          className="absolute inset-0"
          aria-label="Continue"
        />
      </div>
    </div>
  );
};

/* ---------- 02 LANDING \u2014 MAXE CLASS Anniversary ---------- */
export const Landing = ({ go }) => (
  <div className="relative w-full min-h-[100dvh] overflow-hidden bg-[--sirgaz-bg]">
    {/* Cinematic gradient + soft stage spotlight */}
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0B0B0D_0%,#09090B_60%,#050506_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_-10%,rgba(255,255,255,0.10),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_15%_110%,rgba(196,255,0,0.10),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_85%_110%,rgba(196,255,0,0.06),transparent_60%)]" />
      <div className="absolute inset-0 grid-lines opacity-40" />
    </div>

    {/* Top nav */}
    <header className="relative z-10 px-6 sm:px-10 pt-safe">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-16 sm:h-20">
        <div className="flex items-center gap-2.5">
          <img
            src="/brand/maxe-class-logo.png"
            alt="MAXE CLASS"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            draggable="false"
          />
          <div className="leading-tight">
            <div className="text-[13px] sm:text-[14px] font-semibold tracking-tight">
              MAXE <span className="text-maxe">CLASS</span>
            </div>
            <div className="text-[9px] tracking-[0.22em] uppercase text-white/40 mt-0.5">
              Anniversary
            </div>
          </div>
        </div>
        <button
          onClick={() => go?.("login")}
          className="text-[13px] sm:text-[14px] text-white/75 hover:text-white font-medium transition"
        >
          Sign in
        </button>
      </div>
    </header>

    {/* Hero */}
    <main className="relative z-10 px-6 sm:px-10 pb-safe">
      <div className="max-w-6xl mx-auto min-h-[calc(100dvh-9rem)] grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-10 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px] font-medium mb-6 sm:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4FF00] animate-pulse" />
            <span className="text-white/85">
              Anniversary edition{" "}
              <span className="text-white/40 mx-1.5">/</span>
              <span className="text-maxe">Live now</span>
            </span>
          </span>

          <h1 className="font-editorial italic text-[52px] sm:text-[72px] lg:text-[88px] leading-[0.94] tracking-tighter text-white">
            Celebrate
            <br />
            Together<span className="not-italic text-maxe">.</span>
          </h1>

          <p className="mt-6 sm:mt-8 text-white/62 text-[15px] sm:text-[17px] leading-relaxed max-w-md">
            The official digital experience for MAXE CLASS Anniversary. Connect
            with your crew, discover your vibe match, unlock the night.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 max-w-md">
            <button
              onClick={() => go?.("login")}
              className="h-14 px-6 rounded-2xl bg-[#C4FF00] text-black font-semibold text-[15px] tracking-tight
                         inline-flex items-center justify-center gap-2 shadow-glow-maxe
                         hover:brightness-[1.05] hover:-translate-y-[1px] active:scale-[0.98]
                         transition-all duration-300 ease-out-expo"
            >
              Join Event <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => go?.("login")}
              className="h-14 px-6 rounded-2xl glass text-white font-medium text-[14px] tracking-tight
                         inline-flex items-center justify-center gap-2
                         hover:bg-white/[0.06] active:scale-[0.98] transition"
            >
              I have an invite
            </button>
          </div>

          {/* Event stats strip */}
          <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-md">
            {[
              { k: "1000+", v: "Attending" },
              { k: "20", v: "Live sets" },
              { k: "12h", v: "Nonstop" },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-[22px] sm:text-[28px] font-semibold tracking-tighter text-white">
                  {s.k}
                </div>
                <div className="mt-1 text-[11px] sm:text-[12px] text-white/45 tracking-wide">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right column \u2014 desktop only: floating event card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex justify-end"
        >
          <div className="relative w-full max-w-md">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[40px] bg-[#C4FF00]/[0.10] blur-[60px]"
            />
            <div className="relative glass-card rounded-[32px] p-8 float-slow overflow-hidden">
              {/* subtle top edge highlight */}
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              <div className="flex items-center gap-3">
                <img
                  src="/brand/maxe-class-logo.png"
                  alt="MAXE CLASS"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <div className="text-[14px] font-semibold tracking-tight">
                    MAXE CLASS · Anniversary
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-white/50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C4FF00] animate-pulse" />
                    Tonight · Live now
                  </div>
                </div>
              </div>

              <div className="mt-8 text-[10.5px] uppercase tracking-[0.24em] text-white/35">
                Your vibe match
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[64px] font-semibold tracking-tighter text-maxe leading-none">
                  94
                </span>
                <span className="text-white/50 text-[13px]">
                  % compatibility
                </span>
              </div>

              <div className="mt-6 space-y-2.5 text-[13px] text-white/75">
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-[#C4FF00]" />
                  Same energy tonight
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-[#C4FF00]" />
                  Both love afro-house
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-[#C4FF00]" />
                  Unlocks a shared reward
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/8 flex items-center justify-between">
                <span className="text-[11px] tracking-[0.2em] uppercase text-white/40">
                  Powered by <span className="text-white/70">sirgaZ</span>
                </span>
                <span className="w-8 h-8 rounded-full bg-[#C4FF00]/10 border border-[#C4FF00]/25 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-maxe" />
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  </div>
);

/* ---------- 03 LOGIN ---------- */
export const Login = ({ go }) => {
  const { sendOtp } = useAuth();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const onContinue = async () => {
    setError("");
    setLoading(true);
    const res = await sendOtp(email);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    go?.("otp");
  };

  return (
    <div className="relative w-full min-h-[100dvh] overflow-hidden bg-[--sirgaz-bg]">
      {/* Ambient bloom */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-32 w-[420px] h-[420px] rounded-full bg-[#ff2f92]/[0.10] blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full bg-[#a93cff]/[0.10] blur-[140px]" />
      </div>

      {/* Top nav */}
      <header className="relative z-10 px-6 sm:px-10 pt-safe">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 sm:h-20">
          <button
            onClick={() => go?.("landing")}
            className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/[0.06] transition"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/maxe-class-logo.png"
              alt="MAXE CLASS"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
              draggable="false"
            />
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">
                MAXE <span className="text-maxe">CLASS</span>
              </div>
              <div className="text-[9px] tracking-[0.22em] uppercase text-white/40 mt-0.5">
                Anniversary
              </div>
            </div>
          </div>
          <div className="w-10 h-10" />
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 px-6 sm:px-10">
        <div className="max-w-[440px] mx-auto pt-8 sm:pt-16 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full glass text-[10.5px] font-medium mb-5">
              <span className="w-1 h-1 rounded-full bg-[#C4FF00]" />
              <span className="text-white/70 tracking-wide">Step 1 of 2</span>
            </span>
            <h1 className="font-editorial italic text-[40px] sm:text-[52px] leading-[0.98] tracking-tighter">
              What's your <br />
              <span className="not-italic font-sans font-semibold text-maxe">
                email?
              </span>
            </h1>
            <p className="mt-4 text-white/58 text-[14px] sm:text-[15px] leading-relaxed">
              We'll send you a 6 digit code. No password. No spam. Just the
              vibe.
            </p>

            <div className="mt-10 space-y-3">
              <label className="block">
                <div className="rounded-2xl bg-[--sirgaz-surface] border border-white/8 px-5 h-16 flex items-center gap-3 transition-all focus-within:border-[#C4FF00]/50 focus-within:bg-[--sirgaz-surface-2]">
                  <span className="text-white/40 text-[14px]">@</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    aria-label="Email address"
                    className="flex-1 bg-transparent outline-none text-[16px] placeholder-white/25 tracking-normal"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onContinue();
                    }}
                  />
                </div>
              </label>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/25 text-[13px] text-red-300"
                >
                  {error}
                </motion.div>
              )}

              <div className="flex items-center gap-2 text-[12px] text-white/40 px-1">
                <ShieldCheck className="w-3.5 h-3.5 text-maxe" />
                Passwordless · encrypted · never spammed
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={onContinue}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-[#C4FF00] text-black font-semibold text-[15px] tracking-tight
                           inline-flex items-center justify-center gap-2 shadow-glow-maxe
                           hover:brightness-[1.05] hover:-translate-y-[1px] active:scale-[0.98]
                           transition-all duration-300 ease-out-expo
                           disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-black/70 border-t-transparent animate-spin" />
                    Sending code…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-white/40 tracking-widest uppercase">
                or
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="h-12 rounded-2xl glass text-[13px] font-medium hover:bg-white/[0.06] transition disabled:opacity-50"
                disabled
                aria-disabled
              >
                Apple
              </button>
              <button
                type="button"
                className="h-12 rounded-2xl glass text-[13px] font-medium hover:bg-white/[0.06] transition disabled:opacity-50"
                disabled
                aria-disabled
              >
                Google
              </button>
            </div>

            <p className="mt-10 text-[11.5px] text-white/35 leading-relaxed">
              By continuing you agree to sirgaZ's{" "}
              <span className="text-white/60">Terms</span> and{" "}
              <span className="text-white/60">Privacy Policy</span>.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

/* ---------- 04 OTP ---------- */
export const OTP = ({ go }) => {
  const { verifyOtp, resendOtp, pendingIdentifier, authMethod } = useAuth();
  const [code, setCode] = React.useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resendTimer, setResendTimer] = React.useState(30);
  const inputsRef = React.useRef([]);

  React.useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Auto-focus first tile on mount
  React.useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const setDigit = (i, val) => {
    const clean = val.replace(/\D/g, "").slice(0, 1);
    setCode((prev) => {
      const n = [...prev];
      n[i] = clean;
      return n;
    });
    setError("");
    if (clean && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = (e.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || "");
    setCode(next);
    setError("");
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
      setCode((prev) => {
        const n = [...prev];
        n[i - 1] = "";
        return n;
      });
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const doVerify = React.useCallback(async () => {
    setError("");
    const token = code.join("");
    if (token.length < 6) {
      setError("Enter the 6 digit code");
      return;
    }
    setLoading(true);
    const res = await verifyOtp(token);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    go?.("success");
  }, [code, verifyOtp, go]);

  // Auto-submit when 6 digits are filled (unchanged business logic)
  React.useEffect(() => {
    if (code.every((c) => c !== "") && !loading) {
      doVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code.join("")]);

  const doResend = async () => {
    if (resendTimer > 0) return;
    setError("");
    const res = await resendOtp();
    if (res?.error) {
      setError(res.error);
      return;
    }
    setResendTimer(30);
  };

  return (
    <div className="relative w-full min-h-[100dvh] overflow-hidden bg-[--sirgaz-bg]">
      {/* Ambient bloom */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-32 w-[420px] h-[420px] rounded-full bg-[#a93cff]/[0.10] blur-[140px]" />
        <div className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full bg-[#00e5ff]/[0.08] blur-[140px]" />
      </div>

      {/* Top nav */}
      <header className="relative z-10 px-6 sm:px-10 pt-safe">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 sm:h-20">
          <button
            onClick={() => go?.("login")}
            className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/[0.06] transition"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/maxe-class-logo.png"
              alt="MAXE CLASS"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
              draggable="false"
            />
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">
                MAXE <span className="text-maxe">CLASS</span>
              </div>
              <div className="text-[9px] tracking-[0.22em] uppercase text-white/40 mt-0.5">
                Anniversary
              </div>
            </div>
          </div>
          <div className="w-10 h-10" />
        </div>
      </header>

      <main className="relative z-10 px-6 sm:px-10">
        <div className="max-w-[440px] mx-auto pt-8 sm:pt-16 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full glass text-[10.5px] font-medium mb-5">
              <span className="w-1 h-1 rounded-full bg-[#C4FF00]" />
              <span className="text-white/70 tracking-wide">Step 2 of 2</span>
            </span>
            <h1 className="font-editorial italic text-[40px] sm:text-[52px] leading-[0.98] tracking-tighter">
              Enter the <br />
              <span className="not-italic font-sans font-semibold text-maxe">
                code.
              </span>
            </h1>
            <p className="mt-4 text-white/58 text-[14px] sm:text-[15px] leading-relaxed break-all">
              Sent to{" "}
              <span className="text-white/85">
                {pendingIdentifier ||
                  (authMethod === "email" ? "your email" : "your number")}
              </span>
            </p>

            {/* 6 digit input tiles */}
            <div
              className="mt-10 grid grid-cols-6 gap-2 sm:gap-3"
              onPaste={handlePaste}
            >
              {code.map((c, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={c}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  aria-label={`Digit ${i + 1}`}
                  className={`
                    h-14 sm:h-16 rounded-2xl text-center text-[22px] sm:text-[26px] font-semibold tracking-tighter
                    transition-all duration-200 ease-out-expo outline-none
                    ${
                      c
                        ? "bg-[#C4FF00] text-black shadow-glow-maxe-soft"
                        : "bg-[--sirgaz-surface] border border-white/8 text-white focus:border-[#C4FF00]/50 focus:bg-[--sirgaz-surface-2]"
                    }
                  `}
                />
              ))}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/25 text-[13px] text-red-300 text-center"
              >
                {error}
              </motion.div>
            )}

            <div className="mt-6 text-center text-[13px] text-white/50">
              Didn't get it?{" "}
              {resendTimer > 0 ? (
                <span className="text-white/40">
                  Resend in 0:{String(resendTimer).padStart(2, "0")}
                </span>
              ) : (
                <button
                  onClick={doResend}
                  className="text-maxe font-medium underline underline-offset-2 decoration-[#C4FF00]/30 hover:decoration-[#C4FF00] transition"
                >
                  Resend code
                </button>
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={doVerify}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-[#C4FF00] text-black font-semibold text-[15px] tracking-tight
                           inline-flex items-center justify-center gap-2 shadow-glow-maxe
                           hover:brightness-[1.05] hover:-translate-y-[1px] active:scale-[0.98]
                           transition-all duration-300 ease-out-expo
                           disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-black/70 border-t-transparent animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <p className="mt-10 text-[11.5px] text-white/35 leading-relaxed text-center">
              Tip: check your spam folder if the code doesn't arrive within 30
              seconds.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

/* ---------- 05 SUCCESS / LOADING ---------- */
export const Success = ({ go }) => {
  const { session } = useAuth();
  React.useEffect(() => {
    const t = setTimeout(async () => {
      // Check profile completeness → route to onboarding or home
      if (!session?.user) {
        go?.("home");
        return;
      }
      const { getProfile } = await import("@/lib/db");
      const p = await getProfile(session.user.id);
      const isComplete =
        p &&
        p.name &&
        p.personality?.birthday &&
        p.personality?.tonight &&
        (p.interests?.length || 0) >= 1;
      go?.(isComplete ? "home" : "createProfile");
    }, 1600);
    return () => clearTimeout(t);
  }, [go, session]);
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden flex flex-col items-center justify-center">
      <div className="absolute w-[420px] h-[420px] rounded-full bg-[#A93CFF]/25 blur-3xl" />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="relative w-24 h-24 rounded-full gradient-brand flex items-center justify-center glow-pink"
      >
        <Check className="w-10 h-10 text-white" strokeWidth={3} />
      </motion.div>
      <div className="mt-8 text-[26px] font-semibold tracking-tighter">
        You're in
      </div>
      <div className="mt-2 text-white/60 text-[13px]">
        Preparing your experience…
      </div>
      <div className="mt-6 w-40 h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 2 }}
          className="h-full gradient-brand"
        />
      </div>
    </div>
  );
};

/* ---------- 06 CREATE PROFILE (Vibe onboarding step 1/4) ---------- */
export const CreateProfile = ({ go }) => {
  const { session } = useAuth();
  const [name, setName] = React.useState("");
  const [birthday, setBirthday] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    (async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { getProfile } = await import("@/lib/db");
      const p = await getProfile(session.user.id);
      if (p) {
        setName(p.name || "");
        setBio(p.bio || "");
        setAvatarUrl(p.avatar_url || "");
        if (p.personality?.birthday) setBirthday(p.personality.birthday);
      }
      if (!p?.avatar_url) {
        // seed default avatar
        setAvatarUrl(`https://i.pravatar.cc/300?u=${session.user.id}`);
      }
      setLoading(false);
    })();
  }, [session]);

  const { getZodiac, getAge } = React.useMemo(() => require("@/lib/vibe"), []);
  const zodiac = birthday ? getZodiac(birthday) : null;
  const age = birthday ? getAge(birthday) : null;

  const next = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!birthday) {
      setError("Please pick your birthday");
      return;
    }
    if (age !== null && age < 18) {
      setError("You must be 18+ to use sirgaZ");
      return;
    }
    setSaving(true);
    const { upsertProfile, getProfile } = await import("@/lib/db");
    const existing = await getProfile(session.user.id);
    const patch = {
      name: name.trim(),
      bio: bio.trim(),
      avatar_url: avatarUrl,
      personality: { ...(existing?.personality || {}), birthday },
    };
    const { error } = await upsertProfile(session.user.id, patch);
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    go?.("interest");
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar
        title="Create profile"
        onBack={() => go?.("landing")}
        right={<span className="text-[11px] text-white/60">1 / 4</span>}
      />
      <div className="px-7 pb-32">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-1/4 gradient-brand" />
        </div>
        <h2 className="text-[28px] font-semibold tracking-tighter">
          Tell us about you
        </h2>
        <p className="text-white/50 text-[13px] mt-1">
          This shapes your matches. Be authentic.
        </p>
        <div className="mt-6 flex flex-col items-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full gradient-brand p-[2px] glow-pink">
              <div className="w-full h-full rounded-full bg-[#0b0b0b] flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-white/40" />
                )}
              </div>
            </div>
            <button
              onClick={() =>
                setAvatarUrl(`https://i.pravatar.cc/300?u=${Date.now()}`)
              }
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[12px] text-white/50 mt-3">
            Tap to shuffle photo
          </div>
        </div>
        <div className="mt-8 space-y-3">
          <div className="glass rounded-2xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-white/40">
              Full name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1 bg-transparent outline-none text-[15px] placeholder-white/30"
            />
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-white/40 flex items-center justify-between">
              <span>Birthday</span>
              {zodiac && (
                <span className="text-[11px] text-white/60 normal-case tracking-normal">
                  {zodiac.emoji} {zodiac.name}
                  {age !== null ? ` · ${age}` : ""}
                </span>
              )}
            </div>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full mt-1 bg-transparent outline-none text-[15px] placeholder-white/30 [color-scheme:dark]"
            />
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/40">
              Bio
            </div>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about you"
              className="w-full mt-1.5 bg-transparent outline-none text-[14px] resize-none placeholder-white/30"
            />
          </div>
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">
              {error}
            </div>
          )}
          {loading && (
            <div className="text-[12px] text-white/40">Loading profile…</div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <BigButton
          onClick={next}
          disabled={saving}
          icon={saving ? null : <ArrowRight className="w-4 h-4" />}
        >
          {saving ? "Saving…" : "Continue"}
        </BigButton>
      </div>
    </div>
  );
};

/* ---------- 07 INTEREST (Vibe interests, max 5) ---------- */
export const Interest = ({ go }) => {
  const { session } = useAuth();
  const [selected, setSelected] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    (async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { getProfile } = await import("@/lib/db");
      const p = await getProfile(session.user.id);
      if (p?.interests?.length) setSelected(p.interests);
      setLoading(false);
    })();
  }, [session]);

  const { ALL_VIBE_INTERESTS, getInterestEmoji } = require("@/lib/vibe");

  const toggle = (label) => {
    setError("");
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((x) => x !== label);
      if (prev.length >= 5) {
        setError("Max 5 interests");
        return prev;
      }
      return [...prev, label];
    });
  };

  const next = async () => {
    setError("");
    if (selected.length < 1) {
      setError("Pick at least 1");
      return;
    }
    setSaving(true);
    const { upsertProfile } = await import("@/lib/db");
    const { error } = await upsertProfile(session.user.id, {
      interests: selected,
    });
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    go?.("personality");
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar
        title="Interests"
        onBack={() => go?.("createProfile")}
        right={<span className="text-[11px] text-white/60">2 / 4</span>}
      />
      <div className="px-7 pb-32">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-2/4 gradient-brand" />
        </div>
        <h2 className="text-[28px] font-semibold tracking-tighter">
          Your vibe
        </h2>
        <p className="text-white/50 text-[13px] mt-1">
          Pick up to 5. The more specific, the better your matches.
        </p>
        <div className="mt-4 text-[11px] text-white/50">
          {selected.length} / 5 selected
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {ALL_VIBE_INTERESTS.map((label) => {
            const on = selected.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggle(label)}
                className={`h-11 px-4 rounded-full flex items-center gap-2 text-[13px] font-medium transition ${on ? "gradient-brand text-white glow-pink" : "glass text-white/85"}`}
              >
                <span>{getInterestEmoji(label)}</span>
                {label}
              </button>
            );
          })}
        </div>
        {error && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#FF2F92]/10 border border-[#FF2F92]/30 text-[12px] text-[#FF2F92]">
            {error}
          </div>
        )}
        {loading && (
          <div className="mt-4 text-[12px] text-white/40">Loading…</div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <BigButton
          onClick={next}
          disabled={saving}
          icon={saving ? null : <ArrowRight className="w-4 h-4" />}
        >
          {saving ? "Saving…" : "Continue"}
        </BigButton>
      </div>
    </div>
  );
};

/* ---------- 08 PERSONALITY (Single Energy Slider) ---------- */
export const Personality = ({ go }) => {
  const { session } = useAuth();
  const [energy, setEnergy] = React.useState(60);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { getProfile } = await import("@/lib/db");
      const p = await getProfile(session.user.id);
      if (p?.personality?.energy != null) setEnergy(p.personality.energy);
      setLoading(false);
    })();
  }, [session]);

  const { getEnergyLabel, getVibeTitle } = require("@/lib/vibe");
  const label = getEnergyLabel(energy);
  const vibe = getVibeTitle(energy);

  const next = async () => {
    setSaving(true);
    const { upsertProfile, getProfile } = await import("@/lib/db");
    const existing = await getProfile(session.user.id);
    await upsertProfile(session.user.id, {
      personality: { ...(existing?.personality || {}), energy },
    });
    setSaving(false);
    go?.("goal");
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar
        title="Energy"
        onBack={() => go?.("interest")}
        right={<span className="text-[11px] text-white/60">3 / 4</span>}
      />
      <div className="px-7 pb-32">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-3/4 gradient-brand" />
        </div>
        <h2 className="text-[28px] font-semibold tracking-tighter">
          Your energy tonight
        </h2>
        <p className="text-white/50 text-[13px] mt-1">
          Slide to calibrate. This helps us match your rhythm.
        </p>

        <div className="mt-8 flex flex-col items-center">
          <div className="text-[64px] leading-none">{vibe.emoji}</div>
          <div className="mt-3 text-[24px] font-semibold tracking-tighter">
            {vibe.l}
          </div>
          <div className="mt-1 text-[12px] text-white/60">
            {label.l} · {energy}%
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between text-[12px] text-white/60 mb-3">
            <span>🌙 Chill</span>
            <span>✨ Relax</span>
            <span>🔥 Hyper</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer accent-[#FF2F92]
              [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(255,47,146,0.8)] [&::-webkit-slider-thumb]:-mt-2"
            style={{
              background: `linear-gradient(to right, #FF2F92 0%, #A93CFF ${energy / 2}%, #00E5FF ${energy}%, rgba(255,255,255,0.1) ${energy}%)`,
            }}
          />
        </div>
        {loading && (
          <div className="mt-4 text-[12px] text-white/40">Loading…</div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <BigButton
          onClick={next}
          disabled={saving}
          icon={saving ? null : <ArrowRight className="w-4 h-4" />}
        >
          {saving ? "Saving…" : "Continue"}
        </BigButton>
      </div>
    </div>
  );
};

/* ---------- 09 TONIGHT I'M HERE FOR ---------- */
export const Goal = ({ go }) => {
  const { session } = useAuth();
  const [sel, setSel] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { getProfile } = await import("@/lib/db");
      const p = await getProfile(session.user.id);
      if (p?.personality?.tonight) setSel(p.personality.tonight);
      else if (p?.goal) setSel(p.goal);
      setLoading(false);
    })();
  }, [session]);

  const { TONIGHT_OPTIONS } = require("@/lib/vibe");

  const gradients = [
    "from-[#A93CFF] to-[#00E5FF]",
    "from-[#FF2F92] to-[#A93CFF]",
    "from-[#FF2F92] to-[#00E5FF]",
    "from-[#00E5FF] to-[#A93CFF]",
    "from-[#A93CFF] to-[#FF2F92]",
    "from-[#00E5FF] to-[#FF2F92]",
  ];

  const finish = async () => {
    if (!sel) return;
    setSaving(true);
    const { upsertProfile, getProfile } = await import("@/lib/db");
    const existing = await getProfile(session.user.id);
    await upsertProfile(session.user.id, {
      goal: sel,
      personality: { ...(existing?.personality || {}), tonight: sel },
    });
    setSaving(false);
    go?.("home");
  };

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar
        title="Tonight"
        onBack={() => go?.("personality")}
        right={<span className="text-[11px] text-white/60">4 / 4</span>}
      />
      <div className="px-7 pb-32">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-full gradient-brand" />
        </div>
        <h2 className="text-[28px] font-semibold tracking-tighter">
          Tonight I'm here for
        </h2>
        <p className="text-white/50 text-[13px] mt-1">
          Choose one. Changes anytime.
        </p>
        <div className="mt-6 space-y-3">
          {TONIGHT_OPTIONS.map((g, i) => {
            const on = sel === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSel(g.id)}
                className={`relative w-full rounded-3xl p-4 text-left flex items-center gap-4 overflow-hidden active:scale-[0.99] transition ${on ? "" : "glass"}`}
              >
                {on && (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradients[i]} opacity-95`}
                  />
                )}
                {on && <div className="absolute inset-0 bg-black/20" />}
                <div
                  className={`relative w-12 h-12 rounded-2xl ${on ? "bg-white/15" : "bg-white/[0.06]"} flex items-center justify-center text-[22px]`}
                >
                  {g.emoji}
                </div>
                <div className="relative flex-1">
                  <div className="text-[15px] font-semibold">{g.label}</div>
                </div>
                <div
                  className={`relative w-6 h-6 rounded-full flex items-center justify-center ${on ? "bg-white text-black" : "border border-white/25"}`}
                >
                  {on && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
        {loading && (
          <div className="mt-4 text-[12px] text-white/40">Loading…</div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <BigButton
          onClick={finish}
          disabled={saving || !sel}
          icon={saving ? null : <ArrowRight className="w-4 h-4" />}
        >
          {saving ? "Saving…" : "Enter sirgaZ"}
        </BigButton>
      </div>
    </div>
  );
};

/* ---------- 10 HOME ---------- */ /*fix name profile*/
export const HomeScreen = ({ go }) => {
  const [events, setEvents] = React.useState([]);
  const [loadingEvents, setLoadingEvents] = React.useState(true);
  const [profile, setProfile] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      const { listPublishedEvents, getProfile } = await import("@/lib/db");
      const { getSupabase } = await import("@/lib/supabaseClient");

      const sb = getSupabase();
      const { data: authData } = await sb.auth.getUser();
      if (authData?.user) {
        const p = await getProfile(authData.user.id);
        setProfile(p);
      }

      const list = await listPublishedEvents();
      setEvents(list);
      setLoadingEvents(false);
    })();
  }, []);

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <div className="px-6 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full gradient-brand p-[2px]">
            <img
              src={
                profile?.avatar_url ||
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200"
              }
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div>
            <div className="text-[11px] text-white/50">Good evening</div>
            <div className="text-[15px] font-semibold tracking-tight">
              {profile?.name || "there"}{" "}
              <span className="text-[#FF2F92]">◆</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <Search className="w-4 h-4" />
          </button>
          <button className="relative w-10 h-10 rounded-full glass flex items-center justify-center">
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#FF2F92]" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-32">
        {/* Profile summary */}
        <div className="glass rounded-3xl p-4 flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl gradient-brand p-[2px]">
            <div className="w-full h-full rounded-2xl bg-black/40 flex items-center justify-center text-[18px] font-bold">
              87
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium">
              Match Energy · Level 4
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-[72%] gradient-brand rounded-full" />
            </div>
            <div className="text-[11px] text-white/50 mt-1">
              120 XP to Level 5
            </div>
          </div>
        </div>

        {/* Upcoming */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/40">
              Upcoming
            </div>
            <div className="text-[20px] font-semibold tracking-tight">
              Tonight for you
            </div>
          </div>
          <button className="text-[12px] text-white/60 flex items-center gap-1">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-4">
          {loadingEvents && (
            <div className="text-white/40 text-[12px]">Loading events…</div>
          )}
          {!loadingEvents && events[0] && (
            <EventCard
              title={events[0].title}
              venue={events[0].venue_name || events[0].venues?.name || "Venue"}
              date={
                events[0].starts_at
                  ? new Date(events[0].starts_at).toLocaleString([], {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "TBD"
              }
              tag={events[0].tags?.[0] || "Featured"}
              onClick={() => {
                if (typeof window !== "undefined")
                  window.location.href = `/e/${events[0].id}`;
              }}
            />
          )}
          {!loadingEvents && !events[0] && (
            <EventCard
              title="NEONVERSE · Techno Ritual"
              venue="Potato Head, Bali"
              date="Tonight · 22:00"
              tag="Demo"
              onClick={() => go?.("eventDetail")}
            />
          )}
        </div>

        {/* Recommended */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-[20px] font-semibold tracking-tight">
            Recommended
          </div>
          <span className="text-[11px] text-white/40">AI curated</span>
        </div>
        <div className="mt-4 -mx-6 px-6 flex gap-3 overflow-x-auto phone-scroll pb-2">
          {events.slice(1, 5).map((e, i) => (
            <div key={e.id} className="min-w-[240px]">
              <EventCard
                title={e.title}
                venue={e.venue_name || e.venues?.name || "Venue"}
                date={
                  e.starts_at
                    ? new Date(e.starts_at).toLocaleDateString()
                    : "TBD"
                }
                tag={e.tags?.[0] || "Event"}
                hue={i % 2 ? "cyan" : "purple"}
                onClick={() => {
                  if (typeof window !== "undefined")
                    window.location.href = `/e/${e.id}`;
                }}
              />
            </div>
          ))}
          {events.length <= 1 && (
            <>
              <div className="min-w-[240px]">
                <EventCard
                  title="Aurora Rooftop"
                  venue="SCBD, Jakarta"
                  date="Sat · 20:00"
                  tag="Rooftop"
                  hue="purple"
                  onClick={() => go?.("eventDetail")}
                />
              </div>
              <div className="min-w-[240px]">
                <EventCard
                  title="After Sunset"
                  venue="Canggu"
                  date="Sun · 18:30"
                  tag="Beach"
                  hue="cyan"
                  onClick={() => go?.("eventDetail")}
                />
              </div>
            </>
          )}
        </div>

        {/* Activity */}
        <div className="mt-8 text-[20px] font-semibold tracking-tight">
          Recent activity
        </div>
        <div className="mt-3 space-y-2.5">
          {[
            {
              t: "You matched with Raka at NEONVERSE",
              s: "2h ago",
              Icon: Heart,
            },
            { t: "+120 XP · Mission complete", s: "Yesterday", Icon: Zap },
            {
              t: "New voucher unlocked · 20% off drinks",
              s: "2d ago",
              Icon: Gift,
            },
          ].map((r, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-3.5 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl gradient-brand-soft flex items-center justify-center">
                <r.Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{r.t}</div>
                <div className="text-[11px] text-white/45">{r.s}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40" />
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="home" onNavigate={go} />
    </div>
  );
};

/* ---------- 11 EVENT DETAIL ---------- */
export const EventDetail = ({ go }) => (
  <div className="relative h-full w-full bg-black overflow-y-auto phone-scroll">
    <div className="relative h-[380px]">
      <img
        src="https://images.pexels.com/photos/5192289/pexels-photo-5192289.jpeg"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black" />
      <StatusBar />
      <div className="px-6 pt-2 flex items-center justify-between">
        <button
          onClick={() => go?.("home")}
          className="w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-6 left-6 right-6">
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full glass-strong">
          Techno · 18+
        </span>
        <h1 className="mt-3 text-[30px] font-bold tracking-tighter leading-tight">
          NEONVERSE
          <br />
          Techno Ritual
        </h1>
      </div>
    </div>
    <div className="px-6 pb-40 -mt-6 relative z-10">
      <div className="glass-strong rounded-3xl p-5 space-y-4">
        <Row
          Icon={MapPin}
          title="Potato Head Beach Club"
          sub="Jl. Petitenget No.51B, Bali"
        />
        <Row
          Icon={Calendar}
          title="Sat, 21 Jun · 22:00"
          sub="Doors open 21:00"
        />
        <Row
          Icon={Users}
          title="1,240 going"
          sub="182 matches predicted for you"
        />
      </div>

      <div className="mt-6">
        <div className="text-[11px] uppercase tracking-widest text-white/40">
          About
        </div>
        <p className="mt-2 text-[13.5px] text-white/75 leading-relaxed">
          A ritual of sound, light, and human connection. Curated by sirgaZ —
          every attendee is matched by AI for meaningful encounters between
          sets.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ["Match rate", "94%"],
          ["Vibe", "Deep"],
          ["Avg age", "24"],
        ].map(([l, v]) => (
          <div key={l} className="glass rounded-2xl p-3.5 text-center">
            <div className="text-[18px] font-semibold tracking-tighter">
              {v}
            </div>
            <div className="text-[11px] text-white/50">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex -space-x-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-9 h-9 rounded-full border-2 border-black overflow-hidden"
          >
            <img
              src={`https://i.pravatar.cc/80?img=${i + 8}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        <div className="pl-5 self-center text-[12px] text-white/60">
          +1,235 attending
        </div>
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
      <BigButton
        onClick={() => go?.("qr")}
        icon={<QrCode className="w-4 h-4" />}
      >
        Join Event · Free RSVP
      </BigButton>
    </div>
  </div>
);
const Row = ({ Icon, title, sub }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-white/6 flex items-center justify-center">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1">
      <div className="text-[14px] font-medium">{title}</div>
      <div className="text-[11.5px] text-white/50">{sub}</div>
    </div>
  </div>
);

/* ---------- 12 QR CHECK-IN ---------- */
export const QRScreen = ({ go }) => (
  <div className="relative h-full w-full bg-black overflow-hidden">
    <StatusBar />
    <TopBar title="Check in" onBack={() => go?.("eventDetail")} />
    <div className="px-7">
      <h2 className="text-[24px] font-semibold tracking-tighter">
        Scan venue QR
      </h2>
      <p className="text-white/50 text-[13px] mt-1">
        Point your camera at the sirgaZ marker at the venue.
      </p>
    </div>
    <div className="mt-6 mx-6 relative aspect-square rounded-[32px] overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div className="absolute inset-0 grid-lines opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,47,146,0.25),transparent_70%)]" />
      {/* Frame */}
      <div className="absolute inset-6 rounded-3xl border border-white/10">
        {[
          "top-0 left-0 border-t-2 border-l-2 rounded-tl-3xl",
          "top-0 right-0 border-t-2 border-r-2 rounded-tr-3xl",
          "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-3xl",
          "bottom-0 right-0 border-b-2 border-r-2 rounded-br-3xl",
        ].map((c, i) => (
          <div key={i} className={`absolute w-12 h-12 border-[#FF2F92] ${c}`} />
        ))}
      </div>
      {/* Scan line */}
      <div className="absolute left-6 right-6 top-6 bottom-6 overflow-hidden rounded-3xl">
        <div className="scan-line absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-[#FF2F92]/70 to-transparent blur-md" />
      </div>
      {/* Fake QR pattern */}
      <div className="absolute inset-16 opacity-30">
        <div className="grid grid-cols-10 grid-rows-10 gap-[3px] w-full h-full">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className={`${Math.random() > 0.55 ? "bg-white" : "bg-transparent"}`}
            />
          ))}
        </div>
      </div>
    </div>
    <div className="mt-6 px-7 text-center text-[13px] text-white/60">
      Hold steady — verifying identity
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5">
      <BigButton onClick={() => go?.("waitingRoom")} variant="ghost">
        Enter manually
      </BigButton>
    </div>
  </div>
);

/* ---------- 13 WAITING ROOM ---------- */
export const WaitingRoom = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar
      title="Waiting room"
      onBack={() => go?.("eventDetail")}
      right={
        <span className="text-[11px] font-medium text-[#00E5FF] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
          Live
        </span>
      }
    />
    <div className="px-6">
      <div className="glass-strong rounded-3xl p-5 text-center">
        <div className="text-[11px] uppercase tracking-widest text-white/50">
          Matching starts in
        </div>
        <div className="mt-2 text-[56px] font-bold tracking-tighter text-gradient">
          02:14
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[12px] text-white/60">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> 842 inside
          </span>
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> Room A
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-[15px] font-semibold">Participants</div>
        <span className="text-[11px] text-white/50">842 online</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {[10, 12, 15, 18, 22, 25, 28, 31, 34, 38, 41, 44].map((i) => (
          <div key={i} className="relative">
            <div className="w-full aspect-square rounded-2xl overflow-hidden">
              <img
                src={`https://i.pravatar.cc/200?img=${i}`}
                className="w-full h-full object-cover"
              />
            </div>
            {i % 3 === 0 && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00E5FF] border-2 border-black" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 glass rounded-3xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center">
            <Volume2 className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium">DJ Isha · Warm-up set</div>
            <div className="text-[11px] text-white/50">
              Now playing in Room A
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
      <BigButton
        onClick={() => go?.("countdown")}
        icon={<ArrowRight className="w-4 h-4" />}
      >
        I'm ready
      </BigButton>
    </div>
  </div>
);

/* ---------- 14 COUNTDOWN ---------- */
export const Countdown = ({ go }) => {
  const [n, setN] = React.useState(3);
  React.useEffect(() => {
    if (n <= 0) {
      const t = setTimeout(() => go?.("aiMatching"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n - 1), 900);
    return () => clearTimeout(t);
  }, [n, go]);
  return (
    <div className="relative h-full w-full bg-haze overflow-hidden flex items-center justify-center">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-[#FF2F92]/25 blur-3xl pulse-slow" />
      <div
        className="absolute w-[380px] h-[380px] rounded-full bg-[#A93CFF]/25 blur-3xl pulse-slow"
        style={{ animationDelay: ".3s" }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={n}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-[220px] font-bold leading-none tracking-tighter text-gradient text-glow-white"
        >
          {n > 0 ? n : "GO"}
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-20 text-[13px] text-white/60 tracking-widest uppercase">
        Prepare to be matched
      </div>
    </div>
  );
};

/* ---------- 15 AI MATCHING ---------- */
export const AIMatching = ({ go, params }) => {
  const eventId = params?.eventId;

  React.useEffect(() => {
    (async () => {
      const { getSupabase } = await import("@/lib/supabaseClient");
      const { findOrCreateMatch } = await import("@/lib/db");
      const sb = getSupabase();
      const { data: authData } = await sb.auth.getUser();
      const meId = authData?.user?.id;

      const minDelay = new Promise((r) => setTimeout(r, 3200));
      const matchPromise =
        meId && eventId
          ? findOrCreateMatch(eventId, meId)
          : Promise.resolve(null);

      const [match] = await Promise.all([matchPromise, minDelay]);

      if (match) {
        go?.("matchResult", { matchId: match.id, eventId });
      } else {
        go?.("waitingRoom", { eventId });
      }
    })();
  }, [go, eventId]);
  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <div className="absolute -inset-32 aurora">
        <div className="absolute top-0 left-1/2 w-[80%] h-[80%] rounded-full bg-[#FF2F92]/40 blur-3xl" />
        <div className="absolute bottom-10 right-0 w-[70%] h-[70%] rounded-full bg-[#A93CFF]/40 blur-3xl" />
        <div className="absolute top-1/3 -left-10 w-[60%] h-[60%] rounded-full bg-[#00E5FF]/30 blur-3xl" />
      </div>
      <StatusBar />
      <div className="relative h-full flex flex-col items-center justify-center px-8">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-64 h-64 rounded-full border border-white/10 animate-[spin_10s_linear_infinite]"></div>
          <div className="absolute w-48 h-48 rounded-full border border-white/15 animate-[spin_7s_linear_infinite_reverse]"></div>
          <div className="absolute w-32 h-32 rounded-full border border-[#FF2F92]/50 animate-[spin_5s_linear_infinite]"></div>
          <div className="relative w-24 h-24 rounded-full gradient-brand glow-pink flex items-center justify-center">
            <Sparkles className="w-8 h-8" />
          </div>
        </div>
        <div className="mt-14 text-[22px] font-semibold tracking-tighter">
          Reading the room…
        </div>
        <div className="mt-2 text-white/60 text-[13px]">
          Analyzing 842 energies · 2.4M signals
        </div>
        <div className="mt-6 flex gap-2">
          <span className="dot w-2 h-2 rounded-full bg-white/80" />
          <span
            className="dot w-2 h-2 rounded-full bg-white/80"
            style={{ animationDelay: ".15s" }}
          />
          <span
            className="dot w-2 h-2 rounded-full bg-white/80"
            style={{ animationDelay: ".3s" }}
          />
        </div>
      </div>
    </div>
  );
};

/* ---------- 16 MATCH RESULT ---------- */
export const MatchResult = ({ go, params }) => {
  const matchId = params?.matchId;
  const [match, setMatch] = React.useState(null);
  const [peer, setPeer] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { getSupabase } = await import("@/lib/supabaseClient");
      const { getMatch, getMatchPeer } = await import("@/lib/db");
      const sb = getSupabase();
      const { data: authData } = await sb.auth.getUser();
      const meId = authData?.user?.id;

      const m = await getMatch(matchId);
      setMatch(m);
      if (m && meId) {
        const p = await getMatchPeer(m, meId);
        setPeer(p);
      }
      setLoading(false);
    })();
  }, [matchId]);

  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-white/50">
        Loading…
      </div>
    );
  if (!match || !peer)
    return (
      <div className="h-full flex items-center justify-center text-white/50">
        Match not found
      </div>
    );

  const pct = Math.round(match.score || 0);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <img
        src={
          peer.avatar_url ||
          "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=900"
        }
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      {/* ...gradient overlays tetap... */}
      <StatusBar />
      <TopBar
        title="Your match"
        onBack={() => go?.("home")}
        right={<X className="w-4 h-4" />}
      />
      <div className="relative px-7 mt-2 flex flex-col items-center">
        <div className="relative">
          <svg width="240" height="240" viewBox="0 0 240 240">
            {/* ...defs & background circle sama... */}
            <circle
              cx="120"
              cy="120"
              r="108"
              fill="none"
              stroke="url(#ring)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 108 * (pct / 100)} ${2 * Math.PI * 108}`}
              transform="rotate(-90 120 120)"
            />
          </svg>
          <div className="absolute inset-4 rounded-full overflow-hidden">
            <img
              src={peer.avatar_url || `https://i.pravatar.cc/300?u=${peer.id}`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-brand text-[12px] font-semibold glow-pink">
            {pct}% Match
          </div>
        </div>
        <div className="mt-8 text-[32px] font-bold tracking-tighter">
          {peer.name}
        </div>
        <div className="mt-1 text-white/70 text-[13px]">{peer.bio}</div>
        <div className="mt-4 flex gap-2 flex-wrap justify-center">
          {(peer.interests || []).slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-[11px] px-2.5 py-1 rounded-full glass"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 flex gap-3 bg-gradient-to-t from-black via-black/90 to-transparent">
        <button className="w-14 h-14 rounded-2xl glass flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <BigButton onClick={() => go?.("compatibility", { matchId })}>
            See compatibility
          </BigButton>
        </div>
      </div>
    </div>
  );
};
/* ---------- 17 COMPATIBILITY (Radar) ---------- */
export const Compatibility = ({ go }) => {
  const data = [
    { k: "Interest", v: 92 },
    { k: "Music", v: 88 },
    { k: "Energy", v: 76 },
    { k: "Humor", v: 84 },
    { k: "Values", v: 90 },
    { k: "Vibe", v: 95 },
  ];
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Compatibility" onBack={() => go?.("matchResult")} />
      <div className="px-6 pb-32">
        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="text-[15px] font-semibold">You & Raka</div>
              <div className="text-[11px] text-white/50">
                Multi-dimensional analysis
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full gradient-brand text-[11px] font-bold glow-pink">
              94%
            </div>
          </div>
          <div className="mt-2 h-56">
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis
                  dataKey="k"
                  tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  tick={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Radar
                  dataKey="v"
                  stroke="#FF2F92"
                  fill="url(#g1)"
                  fillOpacity={0.55}
                  strokeWidth={2}
                />
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF2F92" />
                    <stop offset="100%" stopColor="#00E5FF" />
                  </linearGradient>
                </defs>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { l: "Interest match", v: 92, c: "#FF2F92" },
            { l: "Music match", v: 88, c: "#A93CFF" },
            { l: "Energy match", v: 76, c: "#00E5FF" },
            { l: "Personality", v: 90, c: "#FF2F92" },
          ].map((r) => (
            <div key={r.l} className="glass rounded-2xl p-4">
              <div className="text-[11px] text-white/50">{r.l}</div>
              <div className="mt-2 text-[26px] font-semibold tracking-tighter">
                {r.v}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${r.v}%`,
                    background: `linear-gradient(90deg, ${r.c}, #00E5FF)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <BigButton
          onClick={() => go?.("iceBreaker")}
          icon={<Sparkles className="w-4 h-4" />}
        >
          Get AI ice-breakers
        </BigButton>
      </div>
    </div>
  );
};

/* ---------- 18 AI CONVERSATION STARTER ---------- */
export const IceBreaker = ({ go }) => {
  const suggestions = [
    {
      t: "Serious vibe",
      q: "Which producer would you kill to see live once?",
      tag: "Music",
    },
    {
      t: "Funny",
      q: "Rate your dance moves 1-10. Be honest, I'll cross-check tonight.",
      tag: "Playful",
    },
    { t: "Deep", q: "What made you say yes to tonight?", tag: "Emotional" },
    { t: "Local", q: "Best late night food spot in Bali. GO.", tag: "Food" },
  ];
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Ice-breakers" onBack={() => go?.("compatibility")} />
      <div className="px-6 pb-32">
        <div className="glass-strong rounded-3xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-medium">
              sirgaZ AI wrote these for you
            </div>
            <div className="text-[11px] text-white/50">
              Based on you & Raka's shared signals
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className="glass rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-widest text-white/40">
                  {s.t}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60">
                  {s.tag}
                </span>
              </div>
              <div className="mt-2 text-[15px] leading-snug font-medium">
                "{s.q}"
              </div>
              <div className="mt-3 flex gap-2">
                <button className="h-9 px-3 rounded-full glass text-[12px] flex items-center gap-1.5">
                  <Send className="w-3 h-3" /> Send
                </button>
                <button className="h-9 px-3 rounded-full bg-white/5 text-[12px] text-white/70">
                  Remix
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <BigButton
          onClick={() => go?.("mission")}
          icon={<Target className="w-4 h-4" />}
        >
          Start your mission
        </BigButton>
      </div>
    </div>
  );
};

/* ---------- 19 MISSION ---------- */
export const Mission = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar title="Your mission" onBack={() => go?.("iceBreaker")} />
    <div className="px-6 pb-32">
      <div className="relative rounded-3xl overflow-hidden p-6 gradient-brand glow-pink">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.3),transparent_60%)]" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest opacity-80">
            Live mission
          </div>
          <div className="mt-1 text-[26px] font-bold tracking-tighter leading-tight">
            Find Raka.
            <br />
            Say hi. Get 200 XP.
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {[
          { l: "Blue leather jacket", ok: true },
          { l: "White sneakers", ok: true },
          { l: "Near the main bar", ok: false },
          { l: "Holding a mezcal", ok: false },
        ].map((c, i) => (
          <div
            key={i}
            className="glass rounded-2xl p-4 flex items-center gap-3"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${c.ok ? "bg-[#00E5FF] text-black" : "border border-white/25"}`}
            >
              {c.ok ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3 h-3 opacity-40" />
              )}
            </div>
            <div className="flex-1 text-[14px]">{c.l}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 glass-strong rounded-3xl p-4">
        <div className="text-[11px] uppercase tracking-widest text-white/40">
          Reward preview
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-medium">
              +200 XP · 20% off drinks
            </div>
            <div className="text-[11px] text-white/50">
              Redeemable at NEONVERSE bar
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
      <BigButton
        onClick={() => go?.("missionProgress")}
        icon={<Flame className="w-4 h-4" />}
      >
        Accept mission
      </BigButton>
    </div>
  </div>
);

/* ---------- 20 MISSION PROGRESS ---------- */
export const MissionProgress = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar title="Mission status" onBack={() => go?.("mission")} />
    <div className="px-6 pb-32">
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-white/40">
            Progress
          </span>
          <span className="text-[11px] text-[#00E5FF]">2 of 4</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "50%" }}
            transition={{ duration: 1 }}
            className="h-full gradient-brand rounded-full"
          />
        </div>
        <div className="mt-3 text-[13px] text-white/70">
          You're halfway there. Keep going.
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {[
          { l: "Spotted blue jacket", s: "22:14", ok: "done" },
          { l: "Confirmed white shoes", s: "22:18", ok: "done" },
          { l: "Approach the bar", s: "in progress", ok: "live" },
          { l: "Say hi to Raka", s: "locked", ok: "pending" },
        ].map((r, i) => (
          <div
            key={i}
            className="glass rounded-2xl p-4 flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${r.ok === "done" ? "bg-[#00E5FF]/20 text-[#00E5FF]" : r.ok === "live" ? "gradient-brand" : "bg-white/5 text-white/40"}`}
            >
              {r.ok === "done" ? (
                <Check className="w-4 h-4" />
              ) : r.ok === "live" ? (
                <Activity className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">{r.l}</div>
              <div className="text-[11px] text-white/50">{r.s}</div>
            </div>
            <span
              className={`text-[10px] px-2 py-1 rounded-full ${r.ok === "done" ? "bg-[#00E5FF]/15 text-[#00E5FF]" : r.ok === "live" ? "gradient-brand" : "bg-white/5 text-white/40"}`}
            >
              {r.ok === "done"
                ? "Completed"
                : r.ok === "live"
                  ? "Live"
                  : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
      <BigButton
        onClick={() => go?.("reward")}
        icon={<Award className="w-4 h-4" />}
      >
        Claim rewards
      </BigButton>
    </div>
  </div>
);

/* ---------- 21 REWARD ---------- */
export const Reward = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar title="Rewards" onBack={() => go?.("missionProgress")} />
    <div className="px-6 pb-32">
      <div className="relative rounded-3xl overflow-hidden p-6 gradient-brand glow-pink text-center">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.35),transparent_60%)]" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest opacity-80">
            You earned
          </div>
          <div className="mt-2 text-[64px] font-bold tracking-tighter">
            +280
            <span className="text-[24px] align-top ml-2 opacity-90">XP</span>
          </div>
          <div className="mt-2 text-[13px] opacity-90">
            Level 4 · 120 XP to next
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { v: "280", l: "XP", Icon: Zap },
          { v: "45", l: "Points", Icon: Star },
          { v: "3", l: "Badges", Icon: Award },
        ].map((r) => (
          <div key={r.l} className="glass rounded-2xl p-4 text-center">
            <r.Icon className="w-4 h-4 mx-auto text-[#FF2F92]" />
            <div className="mt-2 text-[20px] font-semibold tracking-tighter">
              {r.v}
            </div>
            <div className="text-[11px] text-white/50">{r.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-[15px] font-semibold">Vouchers unlocked</div>
      <div className="mt-3 space-y-3">
        {[
          {
            t: "20% off drinks",
            s: "NEONVERSE · valid tonight",
            Icon: Gift,
            hue: "from-[#FF2F92] to-[#A93CFF]",
          },
          {
            t: "Free entry next event",
            s: "Aurora Rooftop · Sat",
            Icon: PartyPopper,
            hue: "from-[#A93CFF] to-[#00E5FF]",
          },
          {
            t: "1 free ride home",
            s: "Partner: Grab",
            Icon: Plane,
            hue: "from-[#00E5FF] to-[#FF2F92]",
          },
        ].map((r, i) => (
          <div
            key={i}
            className="relative glass rounded-3xl p-4 overflow-hidden"
          >
            <div
              className={`absolute -right-8 -top-8 w-40 h-40 rounded-full bg-gradient-to-br ${r.hue} opacity-40 blur-2xl`}
            />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center">
                <r.Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{r.t}</div>
                <div className="text-[11px] text-white/55">{r.s}</div>
              </div>
              <button className="h-9 px-3 rounded-full bg-white text-black text-[12px] font-semibold">
                Redeem
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/85 to-transparent">
      <BigButton
        onClick={() => go?.("chat")}
        icon={<MessageCircle className="w-4 h-4" />}
      >
        Message Raka
      </BigButton>
    </div>
  </div>
);

/* ---------- 22 CHAT ---------- */
export const Chat = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-hidden flex flex-col">
    <StatusBar />
    <div className="px-4 pt-2 pb-3 flex items-center gap-3 border-b border-white/5">
      <button
        onClick={() => go?.("home")}
        className="w-10 h-10 rounded-full glass flex items-center justify-center"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <img
        src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=100"
        className="w-10 h-10 rounded-full object-cover"
      />
      <div className="flex-1">
        <div className="text-[14px] font-semibold flex items-center gap-1.5">
          Raka <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
        </div>
        <div className="text-[11px] text-white/50">
          Matched 94% · at NEONVERSE
        </div>
      </div>
      <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
        <Phone className="w-4 h-4" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto phone-scroll px-4 py-4 space-y-3">
      <div className="text-center text-[11px] text-white/40">Today · 22:24</div>
      <Bubble side="left">
        Which producer would you kill to see live once?
      </Bubble>
      <Bubble side="right">Fred again.. Any day. You?</Bubble>
      <Bubble side="left">Bicep. Saw them in Amsterdam, life changed.</Bubble>
      <Bubble side="right">Okay we're doing that trip 😅</Bubble>
      <div className="flex items-center gap-2 text-[11px] text-white/50 pl-2">
        <div className="flex gap-1">
          <span className="dot w-1.5 h-1.5 rounded-full bg-white/50" />
          <span
            className="dot w-1.5 h-1.5 rounded-full bg-white/50"
            style={{ animationDelay: ".1s" }}
          />
          <span
            className="dot w-1.5 h-1.5 rounded-full bg-white/50"
            style={{ animationDelay: ".2s" }}
          />
        </div>
        typing…
      </div>
    </div>
    <div className="p-4 pt-2">
      <div className="glass rounded-full h-12 flex items-center px-2 pr-1.5 gap-2">
        <button className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
        <input
          placeholder="Message"
          className="flex-1 bg-transparent outline-none text-[14px] placeholder-white/30"
        />
        <button className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center glow-pink">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);
const Bubble = ({ side, children }) => (
  <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
    <div
      className={`max-w-[78%] px-3.5 py-2.5 text-[13.5px] leading-relaxed ${side === "right" ? "gradient-brand rounded-[20px] rounded-br-md text-white" : "glass rounded-[20px] rounded-bl-md"}`}
    >
      {children}
    </div>
  </div>
);

/* ---------- 23 LEADERBOARD ---------- */
export const Leaderboard = ({ go }) => {
  const [tab, setTab] = React.useState("connections");
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [myId, setMyId] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      const { getSupabase } = await import("@/lib/supabaseClient");
      const sb = getSupabase();

      const { data: authData } = await sb.auth.getUser();
      const uid = authData?.user?.id || null;
      setMyId(uid);

      const { data } = await sb
        .from("profiles")
        .select("id, name, avatar_url, xp")
        .order("xp", { ascending: false })
        .limit(20);

      const mapped = (data || []).map((p, i) => ({
        r: i + 1,
        id: p.id,
        n: p.id === uid ? `${p.name || "You"} (you)` : p.name || "Anon",
        p: p.xp || 0,
        avatar: p.avatar_url,
        you: p.id === uid,
      }));

      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  const top3 = rows.slice(0, 3);
  const podiumOrder =
    top3.length === 3
      ? [top3[1], top3[0], top3[2]] // #2, #1, #3 layout
      : top3;

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Leaderboard" onBack={() => go?.("home")} />
      <div className="px-6 pb-32">
        <div className="glass rounded-full p-1 flex text-[12px]">
          {[
            ["connections", "Top Connections"],
            ["participants", "Top Participants"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 h-10 rounded-full font-medium transition ${tab === k ? "gradient-brand text-white glow-pink" : "text-white/60"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-6 text-[12px] text-white/40">Loading…</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="mt-6 text-[12px] text-white/40">Belum ada data.</div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Podium */}
            <div className="mt-6 grid grid-cols-3 gap-3 items-end">
              {podiumOrder.map((p) => (
                <div key={p.r} className="flex flex-col items-center">
                  <div className="relative">
                    {p.r === 1 && (
                      <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 w-5 h-5 text-[#FF2F92]" />
                    )}
                    <div
                      className={`w-16 h-16 rounded-full p-[2px] ${p.r === 1 ? "gradient-brand glow-pink" : "bg-white/10"}`}
                    >
                      <img
                        src={p.avatar || `https://i.pravatar.cc/160?u=${p.id}`}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </div>
                  <div
                    className={`mt-2 ${p.r === 1 ? "h-32" : p.r === 2 ? "h-24" : "h-20"} w-full glass rounded-t-2xl flex flex-col items-center justify-end pb-2`}
                  >
                    <div className="text-[11px] text-white/50">#{p.r}</div>
                    <div className="text-[12.5px] font-medium">
                      {p.you ? "You" : p.n}
                    </div>
                    <div className="text-[10.5px] text-white/50">{p.p} pts</div>
                  </div>
                </div>
              ))}
            </div>

            {/* List */}
            <div className="mt-6 space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`glass rounded-2xl p-3 flex items-center gap-3 ${r.you ? "ring-1 ring-[#FF2F92]/60" : ""}`}
                >
                  <div className="w-7 text-center text-[13px] font-semibold text-white/60">
                    #{r.r}
                  </div>
                  <img
                    src={r.avatar || `https://i.pravatar.cc/80?u=${r.id}`}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{r.n}</div>
                    <div className="text-[11px] text-white/45 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[#FF2F92]" />
                      {r.p} pts
                    </div>
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#00E5FF]" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <BottomNav active="leaderboard" onNavigate={go} />
    </div>
  );
};

/* ---------- 24 HISTORY ---------- */
export const History = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar title="History" onBack={() => go?.("profile")} />
    <div className="px-6 pb-32">
      <div className="text-[11px] uppercase tracking-widest text-white/40">
        Previous matches
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[3, 7, 13, 20, 25, 29, 33, 42].map((i, ix) => (
          <div
            key={i}
            className="relative aspect-[3/4] rounded-2xl overflow-hidden"
          >
            <img
              src={`https://i.pravatar.cc/300?img=${i}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2">
              <div className="text-[11px] font-semibold">
                {
                  [
                    "Raka",
                    "Aditya",
                    "Kaia",
                    "Sinta",
                    "Bimo",
                    "Jill",
                    "Rico",
                    "Ines",
                  ][ix]
                }
              </div>
              <div className="text-[10px] text-white/70">
                {[94, 88, 82, 79, 76, 74, 71, 68][ix]}%
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-[11px] uppercase tracking-widest text-white/40">
        Previous events
      </div>
      <div className="mt-3 space-y-3">
        {[
          { t: "NEONVERSE · Techno Ritual", d: "21 Jun · Bali", m: 3 },
          { t: "Aurora Rooftop", d: "14 Jun · Jakarta", m: 1 },
          { t: "Sunset Sessions", d: "07 Jun · Canggu", m: 2 },
        ].map((e, i) => (
          <div
            key={i}
            className="glass rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl gradient-brand-soft flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">{e.t}</div>
              <div className="text-[11px] text-white/50">
                {e.d} · {e.m} matches
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ---------- 25 PROFILE ---------- */
export const Profile = ({ go }) => {
  const { session } = useAuth();
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { getProfile } = await import("@/lib/db");
      setProfile(await getProfile(session.user.id));
      setLoading(false);
    })();
  }, [session]);

  const {
    normalizeVibe,
    getInterestEmoji,
    getTonightLabel,
    getTonightEmoji,
  } = require("@/lib/vibe");
  const v = normalizeVibe(profile);

  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <div className="px-6 pt-2 flex items-center justify-between">
        <button
          onClick={() => go?.("home")}
          className="w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-[15px] font-semibold">Profile</div>
        <button
          onClick={() => go?.("settings")}
          className="w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="px-6 pt-6 pb-32">
        <div className="flex flex-col items-center">
          <div className="w-28 h-28 rounded-full gradient-brand p-[2px] glow-pink">
            <img
              src={
                v?.avatar_url ||
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400"
              }
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div className="mt-4 text-[22px] font-semibold tracking-tighter">
            {v?.name || (loading ? "Loading…" : "Guest")}
          </div>
          <div className="text-[12px] text-white/60 flex items-center gap-2 mt-1">
            {v?.age && <span>{v.age}</span>}
            {v?.zodiac && (
              <span>
                {v.zodiac.emoji} {v.zodiac.name}
              </span>
            )}
            {v?.vibeTitle && (
              <span>
                {v.vibeTitle.emoji} {v.vibeTitle.l}
              </span>
            )}
          </div>

          {v?.interests?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {v.interests.slice(0, 5).map((i) => (
                <span
                  key={i}
                  className="text-[11px] px-2.5 py-1 rounded-full glass flex items-center gap-1"
                >
                  <span>{getInterestEmoji(i)}</span>
                  {i}
                </span>
              ))}
            </div>
          )}

          {v?.tonight && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-white/50 uppercase tracking-widest">
                Tonight
              </span>
              <span className="text-[11.5px] px-2.5 py-1 rounded-full gradient-brand-soft flex items-center gap-1">
                <span>{getTonightEmoji(v.tonight)}</span>
                {getTonightLabel(v.tonight)}
              </span>
            </div>
          )}

          {v?.bio && (
            <div className="mt-4 max-w-[280px] text-center text-[13px] text-white/70 leading-relaxed">
              {v.bio}
            </div>
          )}

          <button
            onClick={() => go?.("createProfile")}
            className="mt-4 h-9 px-4 rounded-full glass text-[12px] font-medium flex items-center gap-1.5"
          >
            <Edit3 className="w-3 h-3" /> Edit profile
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { v: "0", l: "Events" },
            { v: "0", l: "Matches" },
            { v: v?.xp || 0, l: "XP" },
          ].map((s) => (
            <div key={s.l} className="glass rounded-2xl p-4 text-center">
              <div className="text-[22px] font-semibold tracking-tighter">
                {s.v}
              </div>
              <div className="text-[11px] text-white/50">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 glass-strong rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">
              Level 1 · {v?.vibeTitle?.l || "New"}
            </div>
            <div className="text-[11px] text-white/50">{v?.xp || 0} pts</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full w-[10%] gradient-brand rounded-full" />
          </div>
        </div>
      </div>
      <BottomNav active="profile" onNavigate={go} />
    </div>
  );
};

/* ---------- 26 SETTINGS ---------- */
export const Settings = ({ go }) => {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    go?.("landing");
  };
  const Item = ({ Icon, l, s, right }) => (
    <div className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-medium">{l}</div>
        {s && <div className="text-[11px] text-white/45">{s}</div>}
      </div>
      {right || <ChevronRight className="w-4 h-4 text-white/40" />}
    </div>
  );
  const Toggle = ({ on = true }) => (
    <div
      className={`w-10 h-6 rounded-full flex items-center px-0.5 ${on ? "gradient-brand" : "bg-white/10"}`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white transition ${on ? "ml-auto" : ""}`}
      />
    </div>
  );
  return (
    <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
      <StatusBar />
      <TopBar title="Settings" onBack={() => go?.("profile")} />
      <div className="px-6 pb-32 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-white/40 mt-2">
          Preferences
        </div>
        <Item
          Icon={BellRing}
          l="Notifications"
          s="Matches, missions, events"
          right={<Toggle on />}
        />
        <Item Icon={Lock} l="Privacy" s="Visibility, blocklist" />
        <Item Icon={Globe} l="Language" s="English" />
        <div className="text-[11px] uppercase tracking-widest text-white/40 mt-4">
          Account
        </div>
        <Item
          Icon={ShieldCheck}
          l="Verified profile"
          s="Identity confirmed"
          right={
            <span className="text-[11px] text-[#00E5FF] font-medium">
              Verified
            </span>
          }
        />
        <Item Icon={User} l="Personal information" />
        <div className="mt-4">
          <button
            onClick={onLogout}
            disabled={loggingOut}
            className="w-full h-14 rounded-2xl glass flex items-center justify-center gap-2 text-[#FF2F92] font-semibold disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" />{" "}
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
        <div className="mt-2 text-center text-[10px] text-white/30">
          sirgaZ v1.0.0 · Made with ♥ in Bali
        </div>
      </div>
    </div>
  );
};

/* ---------- 27 ADMIN LOGIN ---------- */
export const AdminLogin = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-hidden">
    <StatusBar />
    <div className="px-7 pt-6">
      <div className="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center">
        <ShieldCheck className="w-5 h-5 text-[#00E5FF]" />
      </div>
      <div className="mt-6 text-[11px] uppercase tracking-widest text-white/40">
        Admin panel
      </div>
      <h2 className="mt-1 text-[30px] font-semibold tracking-tighter">
        Secure sign-in
      </h2>
      <p className="text-white/50 text-[13px] mt-2">
        For sirgaZ venue partners & operators only.
      </p>
      <div className="mt-8 space-y-3">
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-white/40">
            Work email
          </div>
          <input
            defaultValue="admin@potatohead.co"
            className="w-full mt-1 bg-transparent outline-none text-[14px]"
          />
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-white/40">
            Password
          </div>
          <input
            type="password"
            defaultValue="••••••••••"
            className="w-full mt-1 bg-transparent outline-none text-[14px]"
          />
        </div>
      </div>
      <div className="mt-6">
        <BigButton
          onClick={() => go?.("venueDashboard")}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Enter dashboard
        </BigButton>
      </div>
      <div className="mt-6 text-[11px] text-white/40 text-center">
        Protected by biometrics · Encrypted E2E
      </div>
    </div>
  </div>
);

/* ---------- 28 ADMIN DASHBOARD ---------- */
export const AdminDashboard = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <div className="px-6 pt-2 flex items-center justify-between">
      <div>
        <div className="text-[11px] text-white/50">Venue</div>
        <div className="text-[15px] font-semibold">Potato Head · Bali</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => go?.("adminAnalytics")}
          className="w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <BarChart3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => go?.("adminLive")}
          className="w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <Radio className="w-4 h-4" />
        </button>
      </div>
    </div>
    <div className="px-6 pb-32">
      <div className="mt-4 relative rounded-3xl p-5 overflow-hidden gradient-brand-soft glow-pink">
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest opacity-80">
            Live tonight
          </div>
          <div className="mt-1 text-[36px] font-bold tracking-tighter">
            1,240
            <span className="text-[16px] opacity-80 ml-2 font-medium">
              attendees
            </span>
          </div>
          <div className="mt-1 text-[12px] opacity-90 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />{" "}
            NEONVERSE · Room A
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { l: "Matches made", v: "312", d: "+18% vs last", Icon: Heart },
          { l: "Missions live", v: "84", d: "12 completed", Icon: Target },
          {
            l: "Revenue tonight",
            v: "$4.8k",
            d: "Vouchers redeemed",
            Icon: DollarSign,
          },
          { l: "Avg vibe", v: "4.8", d: "out of 5", Icon: Sparkles },
        ].map((s) => (
          <div key={s.l} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-white/60">
              <s.Icon className="w-3.5 h-3.5" />
              <span className="text-[11px]">{s.l}</span>
            </div>
            <div className="mt-2 text-[24px] font-semibold tracking-tighter">
              {s.v}
            </div>
            <div className="text-[11px] text-[#00E5FF]">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-[15px] font-semibold">Quick actions</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { l: "Launch mission", Icon: Flame, go: "adminLive" },
          { l: "Live participants", Icon: Users, go: "adminLive" },
          { l: "Analytics", Icon: BarChart3, go: "adminAnalytics" },
          { l: "Broadcast", Icon: Volume2, go: "adminDashboard" },
        ].map((a) => (
          <button
            key={a.l}
            onClick={() => go?.(a.go)}
            className="glass rounded-2xl p-4 text-left"
          >
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center mb-2">
              <a.Icon className="w-4 h-4" />
            </div>
            <div className="text-[13px] font-medium">{a.l}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

/* ---------- 29 ADMIN LIVE PARTICIPANTS ---------- */
export const AdminLive = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar
      title="Live participants"
      onBack={() => go?.("adminDashboard")}
      right={
        <span className="text-[11px] text-[#00E5FF] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
          Live
        </span>
      }
    />
    <div className="px-6 pb-32">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["1,240", "Total"],
          ["842", "In room"],
          ["312", "Matched"],
        ].map(([v, l]) => (
          <div key={l} className="glass rounded-2xl p-3.5 text-center">
            <div className="text-[20px] font-semibold tracking-tighter">
              {v}
            </div>
            <div className="text-[11px] text-white/50">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 glass rounded-2xl h-11 flex items-center px-3 gap-2">
        <Search className="w-4 h-4 text-white/50" />
        <input
          placeholder="Search participants"
          className="flex-1 bg-transparent outline-none text-[13px]"
        />
      </div>
      <div className="mt-5 space-y-2">
        {[
          { n: "Raka Wibisana", s: "Room A · matched", m: 94, i: 12 },
          { n: "Kaia Sondra", s: "Room A · mission", m: 88, i: 5 },
          { n: "Aditya M.", s: "Room B · idle", m: 79, i: 21 },
          { n: "Sinta R.", s: "Room A · matched", m: 91, i: 15 },
          { n: "Bimo T.", s: "Lobby", m: 71, i: 22 },
          { n: "Jill K.", s: "Room A · chat", m: 84, i: 34 },
        ].map((r, i) => (
          <div
            key={i}
            className="glass rounded-2xl p-3 flex items-center gap-3"
          >
            <img
              src={`https://i.pravatar.cc/80?img=${r.i}`}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="text-[13px] font-medium flex items-center gap-2">
                {r.n}
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
              </div>
              <div className="text-[11px] text-white/50">{r.s}</div>
            </div>
            <div className="text-right">
              <div className="text-[12px] font-semibold text-gradient">
                {r.m}%
              </div>
              <div className="text-[10px] text-white/40">match</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ---------- 30 ADMIN ANALYTICS ---------- */
export const AdminAnalytics = ({ go }) => (
  <div className="relative h-full w-full bg-haze overflow-y-auto phone-scroll">
    <StatusBar />
    <TopBar title="Analytics" onBack={() => go?.("adminDashboard")} />
    <div className="px-6 pb-32">
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/50">
              Matches this week
            </div>
            <div className="mt-1 text-[32px] font-bold tracking-tighter">
              1,842
            </div>
          </div>
          <div className="text-[11px] px-2 py-1 rounded-full bg-[#00E5FF]/15 text-[#00E5FF]">
            +24%
          </div>
        </div>
        {/* Bar chart */}
        <div className="mt-4 flex items-end justify-between gap-2 h-32">
          {[42, 58, 66, 49, 73, 88, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-xl"
                style={{
                  height: `${h}%`,
                  background: `linear-gradient(180deg,#FF2F92, #A93CFF ${h / 2}%, #00E5FF)`,
                }}
              />
              <div className="text-[10px] text-white/40">
                {["M", "T", "W", "T", "F", "S", "S"][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { l: "Retention", v: "82%", Icon: Activity },
          { l: "Avg match time", v: "3m 12s", Icon: Clock },
          { l: "Vibe rating", v: "4.8", Icon: Sparkles },
          { l: "Voucher redeem", v: "68%", Icon: Gift },
        ].map((k) => (
          <div key={k.l} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-white/60">
              <k.Icon className="w-3.5 h-3.5" />
              <span className="text-[11px]">{k.l}</span>
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-tighter">
              {k.v}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 glass rounded-3xl p-4">
        <div className="text-[13px] font-semibold">Top interests</div>
        <div className="mt-3 space-y-2.5">
          {[
            { l: "Music", v: 92 },
            { l: "Festival", v: 78 },
            { l: "Fashion", v: 61 },
            { l: "Coffee", v: 54 },
          ].map((r) => (
            <div key={r.l}>
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>{r.l}</span>
                <span>{r.v}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full gradient-brand"
                  style={{ width: `${r.v}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
