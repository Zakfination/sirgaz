"use client";

import React from "react";

/**
 * MAXE CLASS brand mark. Uses the uploaded logo PNG.
 * Variants:
 *   - "full":    logo image (native aspect). Best for hero.
 *   - "stacked": logo image + optional "Anniversary" wordmark below.
 *   - "inline":  small logo + "MAXE CLASS" text lockup for nav bars.
 */
export const MaxeLogo = ({
  variant = "full",
  size = 96,
  glow = false,
  className = "",
  showAnniversary = false,
  alt = "MAXE CLASS",
}) => {
  const img = (
    <img
      src="/brand/maxe-class-logo.png"
      alt={alt}
      width={size}
      height={size}
      className={`object-contain select-none ${glow ? "drop-shadow-[0_0_24px_rgba(196,255,0,0.35)]" : ""}`}
      draggable="false"
    />
  );

  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <img
          src="/brand/maxe-class-logo.png"
          alt={alt}
          width={28}
          height={28}
          className="object-contain"
          draggable="false"
        />
        <div className="leading-none">
          <div className="text-[13px] sm:text-[14px] font-semibold tracking-tight">
            MAXE <span className="text-maxe">CLASS</span>
          </div>
          <div className="mt-0.5 text-[9px] tracking-[0.16em] uppercase text-white/45">
            Anniversary
          </div>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center gap-4 ${className}`}>
        {img}
        {showAnniversary ? (
          <div className="text-[11px] sm:text-[12px] tracking-[0.34em] uppercase text-white/55">
            Anniversary
          </div>
        ) : null}
      </div>
    );
  }

  return <div className={className}>{img}</div>;
};

export default MaxeLogo;
