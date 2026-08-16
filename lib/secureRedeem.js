import { supabase } from "./supabaseClient";

export const secureRedeemReward = async (code) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { data: null, error: "venue authentication required" };

  const response = await fetch("/api/reward/redeem", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { data: null, error: payload.error || "redemption failed" };
  return { data: payload.data || null, error: null };
};
