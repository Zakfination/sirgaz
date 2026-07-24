"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Splash, Landing, Login, OTP, Success, CreateProfile, Interest, Personality, Goal,
  HomeScreen, EventDetail, QRScreen, WaitingRoom, Countdown, AIMatching, MatchResult,
  Compatibility, IceBreaker, Mission, MissionProgress, Reward, Chat, Leaderboard,
  History, Profile, Settings, AdminLogin, AdminDashboard, AdminLive, AdminAnalytics
} from "./screens";
import {
  VenueDashboard, VenueEventList, VenueCreateEvent, VenueEventManage,
  VenueEventSettings, VenueSetup
} from "./screens_extra";
import {
  VenueLive, VenueMatches, VenueRedeems, VenueAnalytics
} from "./screens_venue_live";
import { AuthProvider, useAuth } from "./authContext";

/* ------------------------------------------------------------------ */
/*  Screen registry \u2014 id \u2192 component                                  */
/*  Navigation is driven purely by real user flow via go(id, params). */
/*  No dev navigator, no debug switcher, no prev/next controls.       */
/* ------------------------------------------------------------------ */
const SCREENS = {
  // Auth & onboarding
  splash: Splash,
  landing: Landing,
  login: Login,
  otp: OTP,
  success: Success,
  createProfile: CreateProfile,
  interest: Interest,
  personality: Personality,
  goal: Goal,
  // Customer experience
  home: HomeScreen,
  eventDetail: EventDetail,
  qr: QRScreen,
  waitingRoom: WaitingRoom,
  countdown: Countdown,
  aiMatching: AIMatching,
  matchResult: MatchResult,
  compatibility: Compatibility,
  iceBreaker: IceBreaker,
  mission: Mission,
  missionProgress: MissionProgress,
  reward: Reward,
  chat: Chat,
  leaderboard: Leaderboard,
  history: History,
  profile: Profile,
  settings: Settings,
  // Admin (legacy demo)
  adminLogin: AdminLogin,
  adminDashboard: AdminDashboard,
  adminLive: AdminLive,
  adminAnalytics: AdminAnalytics,
  // Venue MVP
  venueDashboard: VenueDashboard,
  venueSetup: VenueSetup,
  venueEvents: VenueEventList,
  venueCreate: VenueCreateEvent,
  venueEventManage: VenueEventManage,
  venueEventSettings: VenueEventSettings,
  venueLive: VenueLive,
  venueMatches: VenueMatches,
  venueRedeems: VenueRedeems,
  venueAnalytics: VenueAnalytics,
};

// Screens that have been upgraded to a true responsive fullscreen layout.
// Everything else renders inside a centered mobile-first column (max 460px)
// so legacy screens remain functional until they're upgraded in later phases.
const FULLSCREEN_SCREENS = new Set(["splash", "landing", "login", "otp"]);

// Auth-only screens (unauthenticated users may be here).
const AUTH_SCREENS = new Set(["splash", "landing", "login", "otp", "success"]);

// Protected screens that require an active session.
const PROTECTED_SCREENS = new Set([
  "home", "eventDetail", "qr", "waitingRoom", "countdown", "aiMatching",
  "matchResult", "compatibility", "iceBreaker", "mission", "missionProgress",
  "reward", "chat", "leaderboard", "history", "profile", "settings",
  "venueDashboard", "venueSetup", "venueEvents", "venueCreate",
  "venueEventManage", "venueEventSettings", "venueLive", "venueMatches",
  "venueRedeems", "venueAnalytics",
  "adminDashboard", "adminLive", "adminAnalytics",
]);

const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

const AppInner = () => {
  const { session, sessionLoading } = useAuth();
  const [screen, setScreen] = React.useState("splash");
  const [params, setParams] = React.useState({});

  // Auto-routing based on auth state (business logic \u2014 unchanged).
  React.useEffect(() => {
    if (sessionLoading) return;

    // Signed-in user landing on auth screens \u2192 route to home / onboarding.
    if (session && AUTH_SCREENS.has(screen)) {
      (async () => {
        const { getProfile } = await import("@/lib/db");
        const p = await getProfile(session.user.id);
        const isComplete =
          p &&
          p.name &&
          p.personality?.birthday &&
          p.personality?.tonight &&
          (p.interests?.length || 0) >= 1;
        setScreen(isComplete ? "home" : "createProfile");
      })();
    }

    // Signed-out user on a protected screen \u2192 bounce to landing.
    if (!session && PROTECTED_SCREENS.has(screen)) {
      setScreen("landing");
    }
  }, [session, sessionLoading, screen]);

  const go = React.useCallback((id, p) => {
    if (!id || !SCREENS[id]) return;
    setParams(p || {});
    setScreen(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const Current = SCREENS[screen] || SCREENS.splash;
  const isFullscreen = FULLSCREEN_SCREENS.has(screen);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[--sirgaz-bg] text-white">
      {/* Ambient background \u2014 always present, extremely subtle */}
      <AmbientBackground />

      {/* Page content */}
      <div className="relative z-10 min-h-[100dvh] w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={
              isFullscreen
                ? "relative w-full min-h-[100dvh]"
                : "relative w-full min-h-[100dvh] flex justify-center"
            }
          >
            {isFullscreen ? (
              <Current go={go} params={params} />
            ) : (
              /* Legacy screens \u2014 centered mobile-first column, no phone bezel */
              <div className="relative w-full max-w-[460px] min-h-[100dvh] overflow-hidden">
                <Current go={go} params={params} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Ambient background \u2014 slow, subtle mesh; not a "neon nightclub".   */
/* ------------------------------------------------------------------ */
const AmbientBackground = () => (
  <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#ff2f92]/[0.08] blur-[140px]" />
    <div className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full bg-[#a93cff]/[0.09] blur-[140px]" />
    <div className="absolute bottom-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-[#00e5ff]/[0.05] blur-[160px]" />
    <div className="absolute inset-0 grid-lines opacity-[0.4]" />
    <div
      className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  </div>
);

export default App;
