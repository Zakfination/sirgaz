import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL atau Anon Key belum diset di .env.local!");
}

// Export default DAN export named untuk mencegah import mismatch
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
