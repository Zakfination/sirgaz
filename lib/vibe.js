"use client";

/**
 * Vibe helpers — zodiac, age, energy label, match reason generator.
 * NO database schema change: birthday, energy, tonight_here_for live inside `profiles.personality` JSONB.
 */

export const ZODIAC = [
  { name: "Capricorn",   emoji: "♑", from: [12, 22], to: [1, 19] },
  { name: "Aquarius",    emoji: "♒", from: [1, 20],  to: [2, 18] },
  { name: "Pisces",      emoji: "♓", from: [2, 19],  to: [3, 20] },
  { name: "Aries",       emoji: "♈", from: [3, 21],  to: [4, 19] },
  { name: "Taurus",      emoji: "♉", from: [4, 20],  to: [5, 20] },
  { name: "Gemini",      emoji: "♊", from: [5, 21],  to: [6, 20] },
  { name: "Cancer",      emoji: "♋", from: [6, 21],  to: [7, 22] },
  { name: "Leo",         emoji: "♌", from: [7, 23],  to: [8, 22] },
  { name: "Virgo",       emoji: "♍", from: [8, 23],  to: [9, 22] },
  { name: "Libra",       emoji: "♎", from: [9, 23],  to: [10, 22] },
  { name: "Scorpio",     emoji: "♏", from: [10, 23], to: [11, 21] },
  { name: "Sagittarius", emoji: "♐", from: [11, 22], to: [12, 21] },
];

export const getZodiac = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  for (const z of ZODIAC) {
    const [fm, fd] = z.from;
    const [tm, td] = z.to;
    if (fm === tm) {
      if (m === fm && day >= fd && day <= td) return z;
    } else {
      // spans year boundary (Capricorn Dec 22 → Jan 19)
      if ((m === fm && day >= fd) || (m === tm && day <= td)) return z;
    }
  }
  return ZODIAC[0]; // fallback
};

export const getAge = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

/** Energy 0–100 label */
export const getEnergyLabel = (n) => {
  const v = Number(n || 0);
  if (v < 33) return { l: "Chill", emoji: "🌙" };
  if (v < 67) return { l: "Relax", emoji: "✨" };
  return { l: "Hyper", emoji: "🔥" };
};

/** Vibe descriptor (nickname based on energy) */
export const getVibeTitle = (energy) => {
  const v = Number(energy || 0);
  if (v < 25) return { l: "Chill Wave", emoji: "🌊" };
  if (v < 50) return { l: "Slow Burn", emoji: "🕶️" };
  if (v < 75) return { l: "Night Owl", emoji: "🌙" };
  return { l: "Firework", emoji: "🎆" };
};

/** Emoji per interest keyword */
export const INTEREST_EMOJI = {
  "House Music": "🎵", "House": "🎵",
  "Afro": "🥁",
  "EDM": "🎧",
  "Hip Hop": "🎤",
  "Coffee": "☕",
  "Startup": "🚀",
  "Business": "💼",
  "Creative": "🎨",
  "Photography": "📷",
  "Gaming": "🎮",
  "Fitness": "💪",
  "Travel": "✈️",
  "Food": "🍽️",
  "Fashion": "👗",
  "Art": "🖼️",
};
export const getInterestEmoji = (name) => INTEREST_EMOJI[name] || "✨";

export const ALL_VIBE_INTERESTS = [
  "House Music", "Afro", "EDM", "Hip Hop", "Coffee",
  "Startup", "Business", "Creative", "Photography", "Gaming",
  "Fitness", "Travel", "Food", "Fashion", "Art",
];

export const TONIGHT_OPTIONS = [
  { id: "meet",       label: "Meet New People", emoji: "👋" },
  { id: "networking", label: "Networking",      emoji: "🔗" },
  { id: "dating",     label: "Dating",          emoji: "💘" },
  { id: "party",      label: "Party",           emoji: "🎉" },
  { id: "business",   label: "Business",        emoji: "💼" },
  { id: "fun",        label: "Just Having Fun", emoji: "😄" },
];
export const getTonightLabel = (id) => TONIGHT_OPTIONS.find(t => t.id === id)?.label || id;
export const getTonightEmoji = (id) => TONIGHT_OPTIONS.find(t => t.id === id)?.emoji || "✨";

/** Read a `profiles` row into a normalized vibe object */
export const normalizeVibe = (profile) => {
  if (!profile) return null;
  const p = profile.personality || {};
  const birthday = p.birthday || null;
  const energy = typeof p.energy === "number" ? p.energy : 50;
  const tonight = p.tonight || profile.goal || null;
  const zodiac = getZodiac(birthday);
  const age = getAge(birthday);
  const vibeTitle = getVibeTitle(energy);
  return {
    id: profile.id,
    name: profile.name || "Guest",
    age,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    interests: profile.interests || [],
    zodiac, energy, tonight, vibeTitle,
    xp: profile.xp || 0,
  };
};

/**
 * Compatibility with human-readable reasons.
 * Zodiac counts as a small optional bonus, never the primary factor.
 */
export const computeVibeMatch = (a, b) => {
  const va = normalizeVibe(a) || {};
  const vb = normalizeVibe(b) || {};
  const reasons = [];

  // Shared interests (0–35 pts)
  const setA = new Set(va.interests || []);
  const setB = new Set(vb.interests || []);
  const shared = [...setA].filter(x => setB.has(x));
  const interestPts = Math.min(35, shared.length * 8);
  if (shared.length >= 2) reasons.push({ icon: "✨", label: "Shared Interests", detail: shared.slice(0, 3).join(" · ") });

  // Energy similarity (0–25 pts) — closer energy = more points
  const diff = Math.abs((va.energy ?? 50) - (vb.energy ?? 50));
  const energyPts = Math.max(0, 25 - Math.round(diff * 0.4));
  if (diff <= 20) reasons.push({ icon: "⚡", label: "Similar Energy", detail: `${va.vibeTitle?.l || "–"} ↔ ${vb.vibeTitle?.l || "–"}` });

  // Same event goal (0–20 pts)
  const goalPts = (va.tonight && vb.tonight && va.tonight === vb.tonight) ? 20 : 0;
  if (goalPts) reasons.push({ icon: "🎯", label: "Same Event Goal", detail: getTonightLabel(va.tonight) });

  // Music taste (subset of interests) (0–15 pts)
  const musicKw = ["House Music", "Afro", "EDM", "Hip Hop"];
  const sharedMusic = shared.filter(x => musicKw.includes(x));
  const musicPts = Math.min(15, sharedMusic.length * 8);
  if (sharedMusic.length) reasons.push({ icon: "🎵", label: "Music Taste", detail: sharedMusic.join(" · ") });

  // Zodiac bonus (fun element, max +5)
  let zodiacBonus = 0;
  if (va.zodiac && vb.zodiac) {
    const friendly = { Aries:["Leo","Sagittarius","Gemini"], Taurus:["Virgo","Capricorn","Cancer"], Gemini:["Libra","Aquarius","Aries"], Cancer:["Scorpio","Pisces","Taurus"], Leo:["Aries","Sagittarius","Libra"], Virgo:["Taurus","Capricorn","Cancer"], Libra:["Gemini","Aquarius","Leo"], Scorpio:["Cancer","Pisces","Virgo"], Sagittarius:["Aries","Leo","Aquarius"], Capricorn:["Taurus","Virgo","Pisces"], Aquarius:["Gemini","Libra","Sagittarius"], Pisces:["Cancer","Scorpio","Capricorn"] };
    if ((friendly[va.zodiac.name] || []).includes(vb.zodiac.name)) {
      zodiacBonus = 5;
      reasons.push({ icon: va.zodiac.emoji, label: "Zodiac Bonus", detail: `${va.zodiac.name} × ${vb.zodiac.name} (+5%)` });
    }
  }

  const raw = interestPts + energyPts + goalPts + musicPts + zodiacBonus;
  const score = Math.min(99, Math.max(50, raw + 20)); // baseline 20 so early UX feels magical, capped 99

  return {
    score,
    reasons,
    breakdown: { interest: interestPts * 100 / 35 | 0, music: musicPts * 100 / 15 | 0, energy: energyPts * 100 / 25 | 0, goal: goalPts * 100 / 20 | 0, zodiacBonus }
  };
};
