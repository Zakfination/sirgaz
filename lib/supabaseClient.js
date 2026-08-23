import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Lazy Supabase client access.
 *
 * IMPORTANT:
 * Next.js can evaluate client modules during the production build/prerender.
 * Creating a Supabase client with undefined environment variables at module
 * load time causes the build to crash ("supabaseUrl is required").
 *
 * Railway provides NEXT_PUBLIC_* variables at build time when configured.
 * We still keep this module defensive so a missing variable produces a clear
 * runtime configuration error instead of breaking unrelated routes at build.
 */
export const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.error(
        "[sirgaZ] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Railway."
      );
    }
    return null;
  }

  return createClient(url, anonKey);
};

/**
 * Backwards-compatible client export.
 * Existing client-only code checks for a falsy client before use.
 * New code should prefer getSupabase() when the client may be evaluated
 * during build/prerender.
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default supabase;
