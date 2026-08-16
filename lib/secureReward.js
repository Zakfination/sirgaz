import { supabase } from "./supabaseClient";

export const secureCreateReward = async (userId, eventId, missionId, patch = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || session.user.id !== userId) return { data: null, error: "unauthorized" };

  const response = await fetch("/api/reward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ eventId, missionId, description: patch.description || null }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { data: null, error: payload.error || "reward creation failed" };
  return { data: payload.data || null, error: null };
};
