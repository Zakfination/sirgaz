"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * ScreenShell — the canonical wrapper for every sirgaZ screen.
 *
 * variants:
 *   - "fullscreen": true full-viewport responsive layout (splash, landing, marketing, dashboards)
 *   - "mobile":     centered mobile-first column (max 460px) — used by legacy screens that were
 *                   designed for the old phone frame and haven't been upgraded to responsive yet.
 *                   NO fake phone bezel, NO status bar, NO home indicator.
 *
 * Padding follows the 8pt system by default (px-6 = 24, sm:px-8 = 32).
 */
export const ScreenShell = ({
  variant = "fullscreen",
  children,
  className = "",
  motionKey,
}) => {
  const isMobile = variant === "mobile";

  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`
        relative w-full min-h-[100dvh]
        ${isMobile ? "flex justify-center" : ""}
        ${className}
      `}
    >
      {isMobile ? (
        <div className="relative w-full max-w-[460px] min-h-[100dvh] overflow-hidden">
          {children}
        </div>
      ) : (
        children
      )}
    </motion.div>
  );
};

export default ScreenShell;
