"use client";

import { createBrowserClient } from "@supabase/ssr";

let _client;

export const getSupabase = () => {
  if (typeof window === "undefined") return null;
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[sirgaZ] Missing Supabase env vars");
    return null;
  }
  _client = createBrowserClient(url, key);
  return _client;
};
