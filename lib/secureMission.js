import { supabase } from "./supabaseClient";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
}

export const secureGetOrCreateMission = async (matchId) => {
  const headers = await authHeaders();
  if (!headers) return null;
  const response = await fetch("/api/mission", { method:"POST", headers:{...headers,"Content-Type":"application/json"}, body:JSON.stringify({matchId}), cache:"no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.data || null;
};

export const secureUpdateMission = async (id, patch) => {
  const headers = await authHeaders();
  if (!headers) return null;
  const response = await fetch("/api/mission", { method:"PATCH", headers:{...headers,"Content-Type":"application/json"}, body:JSON.stringify({missionId:id,patch}), cache:"no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.data || null;
};
