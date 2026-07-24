"use client";

import React from "react";

/**
 * PremiumButton — refined button primitive used by v2 screens.
 * Variants:
 *   - primary:  brand gradient, soft glow, white text
 *   - secondary: opaque light surface on dark bg (Airbnb style)
 *   - ghost:    frosted glass, subtle border
 *   - subtle:   text-only with underline animation on hover
 *   - outline:  hairline border, transparent bg
 */
export const PremiumButton = React.forwardRef(function PremiumButton(
  {
    children,
    onClick,
    variant = "primary",
    size = "md",
    className = "",
    icon,
    leadingIcon,
    disabled = false,
    type = "button",
    fullWidth = false,
    loading = false,
    ...rest
  },
  ref,
) {
  const sizes = {
    sm: "h-10 px-4 text-[13px] rounded-xl",
    md: "h-12 px-5 text-[14px] rounded-2xl",
    lg: "h-14 px-6 text-[15px] rounded-2xl",
    xl: "h-16 px-7 text-[16px] rounded-3xl",
  };

  const base =
    "inline-flex items-center justify-center gap-2 font-medium tracking-tight " +
    "transition-all duration-300 ease-out-expo " +
    "disabled:opacity-40 disabled:cursor-not-allowed " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
    "active:scale-[0.98] select-none";

  const variants = {
    primary:
      "gradient-brand text-white shadow-glow-pink hover:shadow-[0_24px_70px_-20px_rgba(255,47,146,0.6)] hover:-translate-y-[1px]",
    secondary:
      "bg-white text-black hover:bg-white/95 hover:-translate-y-[1px] shadow-soft",
    ghost:
      "glass text-white hover:bg-white/[0.08] hover:border-white/10",
    outline:
      "bg-transparent text-white border border-white/12 hover:bg-white/[0.04] hover:border-white/20",
    subtle:
      "bg-transparent text-white/70 hover:text-white px-0",
    danger:
      "bg-red-500/95 text-white hover:bg-red-500 shadow-soft",
  };

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base}
        ${sizes[size] || sizes.md}
        ${variants[variant] || variants.primary}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </span>
      ) : (
        <>
          {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
          {children}
          {icon ? <span className="shrink-0">{icon}</span> : null}
        </>
      )}
    </button>
  );
});

export default PremiumButton;
