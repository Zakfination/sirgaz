import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient = null;
let cachedConfig = "";

/**
 * Build-safe, cached Supabase client accessor.
 *
 * Next.js can evaluate client modules during production build/prerender.
 * Never call createClient(undefined, undefined) at module evaluation time.
 * Railway supplies NEXT_PUBLIC_* values to the browser bundle at build time.
 */
export const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.error(
        "[sirgaZ] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the Railway sirgaZ service."
      );
    }
    return null;
  }

  const config = `${url}|${anonKey}`;
  if (!cachedClient || cachedConfig !== config) {
    cachedClient = createClient(url, anonKey);
    cachedConfig = config;
  }

  return cachedClient;
};

/**
 * Backwards-compatible export for existing client-only modules.
 * New code that can be evaluated during build/prerender should prefer
 * getSupabase().
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default supabase;
