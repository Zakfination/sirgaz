"use client";

import React from "react";
import { normalizeVibe, getInterestEmoji, getTonightLabel, getTonightEmoji } from "@/lib/vibe";

/**
 * VibeProfile card — reusable across Waiting Room, Match Result, and User Profile.
 * variant: "full" | "compact" | "chip"
 */
export const VibeProfileCard = ({ profile, variant = "full", showBio = true, avatarSize = 64 }) => {
  const v = normalizeVibe(profile);
  if (!v) return null;

  if (variant === "chip") {
    return (
      <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
        {v.avatar_url && <img src={v.avatar_url} className="w-6 h-6 rounded-full object-cover"/>}
        <span className="text-[12px] font-medium">{v.name}</span>
        {v.age && <span className="text-[11px] text-white/50">· {v.age}</span>}
        {v.zodiac && <span className="text-[12px]">{v.zodiac.emoji}</span>}
      </div>
    );
  }

  return (
    <div className={variant === "compact" ? "" : "glass-strong rounded-3xl p-4"}>
      <div className="flex items-center gap-3">
        {v.avatar_url && (
          <div className="rounded-full gradient-brand p-[2px]" style={{ width: avatarSize+4, height: avatarSize+4 }}>
            <img src={v.avatar_url} className="w-full h-full rounded-full object-cover"/>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[16px] font-semibold tracking-tight truncate">{v.name}</span>
            {v.age && <span className="text-[13px] text-white/60">· {v.age}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-white/70 flex-wrap">
            {v.zodiac && <span className="flex items-center gap-0.5"><span>{v.zodiac.emoji}</span> {v.zodiac.name}</span>}
            {v.vibeTitle && <span className="flex items-center gap-0.5"><span>{v.vibeTitle.emoji}</span> {v.vibeTitle.l}</span>}
          </div>
        </div>
      </div>

      {showBio && v.bio && <div className="mt-3 text-[13px] text-white/70 leading-relaxed">{v.bio}</div>}

      {v.interests?.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Interests</div>
          <div className="flex flex-wrap gap-1.5">
            {v.interests.slice(0, 5).map(i => (
              <span key={i} className="text-[11.5px] px-2.5 py-1 rounded-full glass flex items-center gap-1">
                <span>{getInterestEmoji(i)}</span>{i}
              </span>
            ))}
          </div>
        </div>
      )}

      {v.tonight && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Tonight</div>
          <span className="text-[11.5px] px-2.5 py-1 rounded-full gradient-brand-soft flex items-center gap-1 w-fit">
            <span>{getTonightEmoji(v.tonight)}</span>{getTonightLabel(v.tonight)}
          </span>
        </div>
      )}
    </div>
  );
};

/** Reasons list — renders bullet points explaining why users matched */
export const MatchReasons = ({ reasons = [] }) => {
  if (!reasons.length) return null;
  return (
    <div className="space-y-2">
      {reasons.map((r, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="text-[16px] leading-none pt-0.5">{r.icon}</span>
          <div className="flex-1">
            <div className="text-[13px] font-medium leading-snug">{r.label}</div>
            {r.detail && <div className="text-[11px] text-white/55 leading-snug mt-0.5">{r.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
