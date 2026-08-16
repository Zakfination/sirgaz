const FRIENDLY_ZODIAC = {
  Aries: ["Leo", "Sagittarius", "Gemini"], Taurus: ["Virgo", "Capricorn", "Cancer"],
  Gemini: ["Libra", "Aquarius", "Aries"], Cancer: ["Scorpio", "Pisces", "Taurus"],
  Leo: ["Aries", "Sagittarius", "Libra"], Virgo: ["Taurus", "Capricorn", "Cancer"],
  Libra: ["Gemini", "Aquarius", "Leo"], Scorpio: ["Cancer", "Pisces", "Virgo"],
  Sagittarius: ["Aries", "Leo", "Aquarius"], Capricorn: ["Taurus", "Virgo", "Pisces"],
  Aquarius: ["Gemini", "Libra", "Sagittarius"], Pisces: ["Cancer", "Scorpio", "Capricorn"],
};

const MUSIC = new Set(["House Music", "Afro", "EDM", "Hip Hop"]);

function zodiac(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const ranges = [
    ["Capricorn",12,22,1,19],["Aquarius",1,20,2,18],["Pisces",2,19,3,20],
    ["Aries",3,21,4,19],["Taurus",4,20,5,20],["Gemini",5,21,6,20],
    ["Cancer",6,21,7,22],["Leo",7,23,8,22],["Virgo",8,23,9,22],
    ["Libra",9,23,10,22],["Scorpio",10,23,11,21],["Sagittarius",11,22,12,21],
  ];
  for (const [name,fm,fd,tm,td] of ranges) {
    if ((fm === tm && m === fm && day >= fd && day <= td) ||
        (fm !== tm && ((m === fm && day >= fd) || (m === tm && day <= td)))) return name;
  }
  return null;
}

function normalize(p) {
  const personality = p?.personality || {};
  return {
    interests: Array.isArray(p?.interests) ? p.interests : [],
    energy: typeof personality.energy === "number" ? personality.energy : 50,
    tonight: personality.tonight || p?.goal || null,
    zodiac: zodiac(personality.birthday),
  };
}

export function computeServerVibeMatch(a, b) {
  const va = normalize(a), vb = normalize(b);
  const shared = [...new Set(va.interests)].filter(x => new Set(vb.interests).has(x));
  const interestPts = Math.min(35, shared.length * 8);
  const diff = Math.abs(va.energy - vb.energy);
  const energyPts = Math.max(0, 25 - Math.round(diff * 0.4));
  const goalPts = va.tonight && va.tonight === vb.tonight ? 20 : 0;
  const sharedMusic = shared.filter(x => MUSIC.has(x));
  const musicPts = Math.min(15, sharedMusic.length * 8);
  const zodiacBonus = va.zodiac && FRIENDLY_ZODIAC[va.zodiac]?.includes(vb.zodiac) ? 5 : 0;
  const reasons = [];
  if (shared.length >= 2) reasons.push({ icon: "✨", label: "Shared Interests", detail: shared.slice(0,3).join(" · ") });
  if (diff <= 20) reasons.push({ icon: "⚡", label: "Similar Energy", detail: "Similar energy" });
  if (goalPts) reasons.push({ icon: "🎯", label: "Same Event Goal", detail: va.tonight });
  if (sharedMusic.length) reasons.push({ icon: "🎵", label: "Music Taste", detail: sharedMusic.join(" · ") });
  if (zodiacBonus) reasons.push({ icon: "✨", label: "Zodiac Bonus", detail: `${va.zodiac} × ${vb.zodiac} (+5%)` });
  const raw = interestPts + energyPts + goalPts + musicPts + zodiacBonus;
  return {
    score: Math.min(99, Math.max(50, raw + 20)),
    breakdown: { interest: Math.floor(interestPts * 100 / 35), music: Math.floor(musicPts * 100 / 15), energy: Math.floor(energyPts * 100 / 25), goal: Math.floor(goalPts * 100 / 20), zodiacBonus, reasons },
  };
}
