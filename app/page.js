"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Splash, Landing, Login, OTP, Success, CreateProfile, Interest, Personality, Goal,
  HomeScreen, EventDetail, QRScreen, WaitingRoom, Countdown, AIMatching, MatchResult,
  Compatibility, IceBreaker, Mission, MissionProgress, Reward, Chat, Leaderboard,
  History, Profile, Settings, AdminLogin, AdminDashboard, AdminLive, AdminAnalytics
} from "./screens";
import {
  VenueDashboard, VenueEventList, VenueCreateEvent, VenueEventManage, VenueEventSettings, VenueSetup
} from "./screens_extra";
import {
  VenueLive, VenueMatches, VenueRedeems, VenueAnalytics
} from "./screens_venue_live";
import { ChevronLeft, ChevronRight, Grid3x3, X } from "lucide-react";
import { AuthProvider, useAuth } from "./authContext";

const FLOW = [
  { id: "splash",           n: "01 Splash",              Comp: Splash },
  { id: "landing",          n: "02 Landing",             Comp: Landing },
  { id: "login",            n: "03 Login",               Comp: Login },
  { id: "otp",              n: "04 OTP",                 Comp: OTP },
  { id: "success",          n: "05 Success",             Comp: Success },
  { id: "createProfile",    n: "06 Create Profile",      Comp: CreateProfile },
  { id: "interest",         n: "07 Vibe Interests",      Comp: Interest },
  { id: "personality",      n: "08 Energy",              Comp: Personality },
  { id: "goal",             n: "09 Tonight",             Comp: Goal },
  { id: "home",             n: "10 Home",                Comp: HomeScreen },
  { id: "eventDetail",      n: "11 Event Detail",        Comp: EventDetail },
  { id: "qr",               n: "12 QR Check-in",         Comp: QRScreen },
  { id: "waitingRoom",      n: "13 Waiting Room",        Comp: WaitingRoom },
  { id: "countdown",        n: "14 Countdown",           Comp: Countdown },
  { id: "aiMatching",       n: "15 AI Matching",         Comp: AIMatching },
  { id: "matchResult",      n: "16 Match Result",        Comp: MatchResult },
  { id: "compatibility",    n: "17 Compatibility",       Comp: Compatibility },
  { id: "iceBreaker",       n: "18 Ice Breakers",        Comp: IceBreaker },
  { id: "mission",          n: "19 Mission",             Comp: Mission },
  { id: "missionProgress",  n: "20 Mission Progress",    Comp: MissionProgress },
  { id: "reward",           n: "21 Reward",              Comp: Reward },
  { id: "chat",             n: "22 Chat",                Comp: Chat },
  { id: "leaderboard",      n: "23 Leaderboard",         Comp: Leaderboard },
  { id: "history",          n: "24 History",             Comp: History },
  { id: "profile",          n: "25 Profile",             Comp: Profile },
  { id: "settings",         n: "26 Settings",            Comp: Settings },
  { id: "adminLogin",       n: "27 Admin Login",         Comp: AdminLogin },
  { id: "adminDashboard",   n: "28 Admin Dashboard",     Comp: AdminDashboard },
  { id: "adminLive",        n: "29 Admin Live",          Comp: AdminLive },
  { id: "adminAnalytics",   n: "30 Admin Analytics",     Comp: AdminAnalytics },
  // Real venue flow (MVP)
  { id: "venueDashboard",   n: "31 Venue Dashboard",     Comp: VenueDashboard },
  { id: "venueSetup",       n: "31b Venue Setup",        Comp: VenueSetup },
  { id: "venueEvents",      n: "32 Event List",          Comp: VenueEventList },
  { id: "venueCreate",      n: "33 Create Event",        Comp: VenueCreateEvent },
  { id: "venueEventManage", n: "34 Event Manage",        Comp: VenueEventManage },
  { id: "venueEventSettings", n: "35 Event Settings",    Comp: VenueEventSettings },
  { id: "venueLive",        n: "36 Live Floor",          Comp: VenueLive },
  { id: "venueMatches",     n: "37 Live Matches",        Comp: VenueMatches },
  { id: "venueRedeems",     n: "38 Reward Redeems",      Comp: VenueRedeems },
  { id: "venueAnalytics",   n: "39 Analytics",           Comp: VenueAnalytics },
];

const App = () => {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
};

const AppInner = () => {
  const { session, sessionLoading } = useAuth();
  const [screen, setScreen] = React.useState("splash");
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Auto-route: if signed-in user lands on the auth flow, jump to home
  React.useEffect(() => {
    if (sessionLoading) return;
    const authScreens = ["splash", "landing", "login", "otp", "success"];
    if (session && authScreens.includes(screen)) {
      // Check onboarding completeness
      (async () => {
        const { getProfile } = await import("@/lib/db");
        const p = await getProfile(session.user.id);
        const isComplete = p && p.name && p.personality?.birthday && p.personality?.tonight && (p.interests?.length || 0) >= 1;
        setScreen(isComplete ? "home" : "createProfile");
      })();
    }
    // If session is cleared (logout) and user is inside app, bounce to landing
    if (!session && !authScreens.includes(screen)) {
      const protectedScreens = ["home","eventDetail","qr","waitingRoom","countdown","aiMatching","matchResult","compatibility","iceBreaker","mission","missionProgress","reward","chat","leaderboard","history","profile","settings","venueDashboard","venueSetup","venueEvents","venueCreate","venueEventManage","venueEventSettings","venueLive","venueMatches","venueRedeems","venueAnalytics","adminDashboard","adminLive","adminAnalytics"];
      if (protectedScreens.includes(screen)) setScreen("landing");
    }
  }, [session, sessionLoading, screen]);

  const idx = Math.max(0, FLOW.findIndex(s => s.id === screen));
  const Current = FLOW[idx].Comp;
  const [params, setParams] = React.useState({});

  const go = (id, p) => {
    if (!id) return;
    setParams(p || {});
    setScreen(id);
    setMenuOpen(false);
  };
  const next = () => setScreen(FLOW[Math.min(idx + 1, FLOW.length - 1)].id);
  const prev = () => setScreen(FLOW[Math.max(idx - 1, 0)].id);

  return (
    <div className="min-h-screen w-full bg-black text-white overflow-hidden relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#FF2F92]/15 blur-[120px]"/>
        <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-[#A93CFF]/15 blur-[120px]"/>
        <div className="absolute bottom-0 left-1/3 w-[520px] h-[520px] rounded-full bg-[#00E5FF]/10 blur-[120px]"/>
        <div className="absolute inset-0 grid-lines opacity-[0.15]"/>
      </div>

      {/* Desktop chrome */}
      <div className="relative z-10 hidden md:flex min-h-screen items-center justify-center py-10 px-6">
        <div className="w-full max-w-[1400px] flex items-start gap-10">
          {/* Left brand column */}
          <div className="flex-1 pt-16 max-w-[420px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center glow-pink">
                <span className="text-[14px] font-bold">sZ</span>
              </div>
              <div className="text-[18px] font-semibold tracking-tight">sirga<span className="text-gradient">Z</span></div>
            </div>
            <div className="mt-10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"/>
                30 screens · production ready
              </span>
              <h1 className="mt-6 text-[64px] leading-[0.98] font-bold tracking-tighter">
                Design that <br/>feels like a <br/><span className="text-gradient">$50M startup</span>.
              </h1>
              <p className="mt-6 text-white/55 text-[15px] leading-relaxed">
                sirgaZ is the premium AI matchmaking layer for clubs, festivals, concerts and nightlife communities. Explore every screen — flow naturally or jump.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 max-w-sm">
              {[
                ["Dark Luxury","#FF2F92"],
                ["Frosted Glass","#A93CFF"],
                ["Editorial","#00E5FF"],
                ["Apple UI","#FFFFFF"],
              ].map(([l,c]) => (
                <div key={l} className="glass rounded-2xl px-4 py-3 flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full" style={{background:c, boxShadow:`0 0 12px ${c}`}}/>
                  <span className="text-[13px] font-medium">{l}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3">
              <button onClick={prev} className="w-11 h-11 rounded-full glass flex items-center justify-center active:scale-95 transition"><ChevronLeft className="w-5 h-5"/></button>
              <button onClick={next} className="h-11 px-5 rounded-full gradient-brand font-semibold text-[13px] flex items-center gap-2 glow-pink active:scale-[0.98] transition">
                Next screen <ChevronRight className="w-4 h-4"/>
              </button>
              <button onClick={() => setMenuOpen(true)} className="h-11 px-5 rounded-full glass font-medium text-[13px] flex items-center gap-2">
                <Grid3x3 className="w-4 h-4"/> All 30 screens
              </button>
            </div>

            <div className="mt-8 text-[11px] text-white/40">Current: <span className="text-white/80">{FLOW[idx].n}</span></div>
          </div>

          {/* Phone frame */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <PhoneFrame>
              <ScreenSwitcher screen={screen}>
                <Current go={go} next={next} params={params}/>
              </ScreenSwitcher>
            </PhoneFrame>
            <div className="mt-4 text-[11px] text-white/40 tracking-widest uppercase">iPhone 15 Pro · 390 × 844</div>
          </div>

          {/* Right rail: screen list */}
          <div className="flex-1 max-w-[300px] pt-16">
            <div className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Screens</div>
            <div className="glass rounded-3xl p-2 max-h-[720px] overflow-y-auto menu-scroll">
              {FLOW.map(s => {
                const active = s.id === screen;
                return (
                  <button key={s.id} onClick={() => go(s.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-2xl flex items-center gap-3 transition ${active ? "gradient-brand-soft" : "hover:bg-white/[0.04]"}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-semibold ${active ? "bg-black/25" : "bg-white/[0.06] text-white/60"}`}>{s.n.slice(0,2)}</div>
                    <div className="text-[12.5px] font-medium">{s.n.slice(3)}</div>
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto"/>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile view: fullscreen phone */}
      <div className="relative z-10 md:hidden min-h-screen w-full flex flex-col">
        <div className="flex-1 relative w-full max-w-[390px] mx-auto" style={{ height: "100dvh" }}>
          <ScreenSwitcher screen={screen}>
            <Current go={go} next={next} params={params}/>
          </ScreenSwitcher>
        </div>
        {/* Floating controls (mobile) */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          <button onClick={prev} className="w-11 h-11 rounded-full glass-strong flex items-center justify-center"><ChevronLeft className="w-4 h-4"/></button>
          <button onClick={() => setMenuOpen(true)} className="h-11 px-4 rounded-full gradient-brand text-[12px] font-semibold glow-pink flex items-center gap-2"><Grid3x3 className="w-3.5 h-3.5"/>Screens</button>
          <button onClick={next} className="w-11 h-11 rounded-full glass-strong flex items-center justify-center"><ChevronRight className="w-4 h-4"/></button>
        </div>
      </div>

      {/* Full screens menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-4xl glass-strong rounded-[32px] p-6 relative max-h-[85vh] overflow-y-auto menu-scroll">
              <button onClick={() => setMenuOpen(false)} className="absolute top-5 right-5 w-10 h-10 rounded-full glass flex items-center justify-center"><X className="w-4 h-4"/></button>
              <div className="text-[11px] uppercase tracking-widest text-white/40">Screen library</div>
              <div className="mt-1 text-[26px] font-semibold tracking-tighter">All 30 screens</div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {FLOW.map(s => {
                  const active = s.id === screen;
                  return (
                    <button key={s.id} onClick={() => go(s.id)}
                      className={`relative aspect-[9/16] rounded-2xl overflow-hidden text-left group ${active?"ring-2 ring-[#FF2F92] glow-pink":""}`}>
                      <div className="absolute inset-0 gradient-brand-soft opacity-40 group-hover:opacity-70 transition"/>
                      <div className="absolute inset-0 bg-black/40"/>
                      <div className="relative h-full p-3 flex flex-col justify-between">
                        <div className="text-[10px] font-medium text-white/70">{s.n.slice(0,2)}</div>
                        <div className="text-[12px] font-semibold leading-tight">{s.n.slice(3)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PhoneFrame = ({ children }) => (
  <div className="relative">
    <div className="absolute -inset-6 rounded-[70px] bg-gradient-to-br from-[#FF2F92]/20 via-[#A93CFF]/20 to-[#00E5FF]/20 blur-3xl opacity-70"/>
    <div className="relative w-[412px] h-[866px] rounded-[62px] bg-[#0a0a0a] p-[11px] shadow-[0_40px_120px_-20px_rgba(255,47,146,0.35),0_20px_60px_-10px_rgba(0,0,0,0.9)] border border-white/10">
      <div className="relative w-full h-full rounded-[52px] overflow-hidden bg-black">
        {/* Dynamic Island */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[120px] h-[34px] rounded-full bg-black z-40 border border-white/5"/>
        {children}
      </div>
    </div>
  </div>
);

const ScreenSwitcher = ({ screen, children }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={screen}
      initial={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

export default App;
