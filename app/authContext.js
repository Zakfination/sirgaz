"use client";

import React from "react";
import { supabase } from "../lib/supabaseClient";

const AuthCtx = React.createContext(null);

/**
 * Modular auth provider.
 * Default method: EMAIL OTP (passwordless 6-digit code).
 * Phone OTP methods remain exported for future re-enable — flip `AUTH_METHOD` below.
 */
const AUTH_METHOD = "email"; // "email" | "phone"

export const AuthProvider = ({ children }) => {
  const [session, setSession] = React.useState(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);
  const [pendingEmail, setPendingEmail] = React.useState("");
  const [pendingPhone, setPendingPhone] = React.useState("");

  React.useEffect(() => {
    const sb = supabase;

    if (!sb) {
      setSessionLoading(false);
      return;
    }

    // Get initial session
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setSessionLoading(false);
    });

    // Listen for auth changes
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s || null);
      setSessionLoading(false);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  /* ---------------- EMAIL OTP (active) ---------------- */
  const isValidEmail = (e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

  const sendEmailOtp = async (emailRaw) => {
    const sb = supabase;
    if (!sb) return { error: "Auth not configured" };
    const email = String(emailRaw || "")
      .trim()
      .toLowerCase();
    if (!isValidEmail(email)) return { error: "Enter a valid email address" };
    setPendingEmail(email);
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) return { error: error.message };
    return { success: true, email };
  };

  const verifyEmailOtp = async (code) => {
    const sb = supabase;
    if (!sb) return { error: "Auth not configured" };
    if (!pendingEmail)
      return { error: "No email to verify. Please try again." };
    if (!code || String(code).length < 6)
      return { error: "Enter the 6 digit code" };
    const { data, error } = await sb.auth.verifyOtp({
      email: pendingEmail,
      token: String(code),
      type: "email",
    });
    if (error) return { error: error.message };
    setSession(data.session || null);
    return { success: true, user: data.user };
  };

  const resendEmailOtp = async () => {
    if (!pendingEmail) return { error: "No pending email" };
    const sb = supabase;
    if (!sb) return { error: "Auth not configured" };
    const { error } = await sb.auth.signInWithOtp({
      email: pendingEmail,
      options: { shouldCreateUser: true },
    });
    if (error) return { error: error.message };
    return { success: true };
  };

  /* ---------------- PHONE OTP (kept for future re-enable) ---------------- */
  const formatPhone = (raw) => {
    if (!raw) return "";
    let v = String(raw).trim().replace(/\s|-/g, "");
    if (v.startsWith("+")) return v;
    if (v.startsWith("0")) v = v.slice(1);
    return "+62" + v;
  };

  const sendPhoneOtp = async (phoneRaw) => {
    const sb = supabase;
    if (!sb) return { error: "Auth not configured" };
    const phone = formatPhone(phoneRaw);
    if (phone.length < 8) return { error: "Enter a valid phone number" };
    setPendingPhone(phone);
    const { error } = await sb.auth.signInWithOtp({
      phone,
      options: { channel: "sms" },
    });
    if (error) return { error: error.message };
    return { success: true, phone };
  };

  const verifyPhoneOtp = async (code) => {
    const sb = supabase;
    if (!sb) return { error: "Auth not configured" };
    if (!pendingPhone) return { error: "No phone to verify." };
    const { data, error } = await sb.auth.verifyOtp({
      phone: pendingPhone,
      token: String(code),
      type: "sms",
    });
    if (error) return { error: error.message };
    setSession(data.session || null);
    return { success: true, user: data.user };
  };

  const resendPhoneOtp = async () => {
    if (!pendingPhone) return { error: "No pending phone" };
    const sb = supabase;
    if (!sb) return { error: "Auth not configured" };
    const { error } = await sb.auth.signInWithOtp({
      phone: pendingPhone,
      options: { channel: "sms" },
    });
    if (error) return { error: error.message };
    return { success: true };
  };

  /* ---------------- Unified interface ---------------- */
  const sendOtp = AUTH_METHOD === "email" ? sendEmailOtp : sendPhoneOtp;
  const verifyOtp = AUTH_METHOD === "email" ? verifyEmailOtp : verifyPhoneOtp;
  const resendOtp = AUTH_METHOD === "email" ? resendEmailOtp : resendPhoneOtp;
  const pendingIdentifier =
    AUTH_METHOD === "email" ? pendingEmail : pendingPhone;

  const logout = async () => {
    const sb = supabase;
    if (!sb) return;
    await sb.auth.signOut();
    setSession(null);
    setPendingEmail("");
    setPendingPhone("");
  };

  const value = {
    authMethod: AUTH_METHOD,
    session,
    sessionLoading,
    sendOtp,
    verifyOtp,
    resendOtp,
    pendingIdentifier,
    pendingEmail,
    pendingPhone,
    sendEmailOtp,
    verifyEmailOtp,
    resendEmailOtp,
    sendPhoneOtp,
    verifyPhoneOtp,
    resendPhoneOtp,
    formatPhone,
    logout,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const ctx = React.useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
