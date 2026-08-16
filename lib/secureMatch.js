import { supabase } from "./supabaseClient";

export const secureFindOrCreateMatch = async (eventId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const response = await fetch("/api/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ eventId }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("secure matchmaking failed", response.status);
    return null;
  }

  const payload = await response.json();
  return payload.match || null;
};
