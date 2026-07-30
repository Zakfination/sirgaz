import supabase from "./supabaseClient";

/**
 * Mengambil profil merchant berdasarkan User ID
 */
export async function getMerchantProfile(userId) {
  try {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return { merchant: data, error: null };
  } catch (error) {
    console.error("Error fetching merchant profile:", error.message);
    return { merchant: null, error };
  }
}

/**
 * Membuat profil merchant baru
 */
export async function createMerchantProfile(userId, name) {
  try {
    const { data, error } = await supabase
      .from("merchants")
      .insert([{ user_id: userId, name }])
      .select()
      .single();

    if (error) throw error;
    return { merchant: data, error: null };
  } catch (error) {
    console.error("Error creating merchant profile:", error.message);
    return { merchant: null, error };
  }
}

/**
 * Mengambil daftar event milik merchant beserta relasi mission & reward
 */
export async function getMerchantEvents(merchantId) {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(
        `
        *,
        missions (*),
        rewards (*)
      `,
      )
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { events: data, error: null };
  } catch (error) {
    console.error("Error fetching merchant events:", error.message);
    return { events: [], error };
  }
}

/**
 * Membuat event baru
 */
export const createMerchantEvent = async (eventData) => {
  if (!supabase)
    return { error: { message: "Supabase client not initialized" } };

  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        merchant_id: eventData.merchant_id,
        title: eventData.title,
        name: eventData.name,
        qr_slug: eventData.qr_slug,
        description: eventData.description,
        venue_name: eventData.venue_name, // 📍 Nama Tempat
        venue_address: eventData.venue_address, // 📍 Alamat
        start_time: eventData.start_time, // 📅 Waktu Mulai
        checkin_points: eventData.checkin_points, // 🎁 Poin Check-in Gratis
        status: eventData.status || "active",
      },
    ])
    .select()
    .single();

  return { event: data, error };
};

/**
 * Menambahkan misi baru pada suatu event
 */
export async function createMission(
  eventId,
  title,
  description = "",
  pointsReward = 0,
) {
  try {
    const { data, error } = await supabase
      .from("missions")
      .insert([
        {
          event_id: eventId,
          title,
          description,
          points_reward: pointsReward,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { mission: data, error: null };
  } catch (error) {
    console.error("Error creating mission:", error.message);
    return { mission: null, error };
  }
}

/**
 * Menambahkan reward baru pada suatu event
 */
export async function createReward(eventId, title, costPoints = 0, stock = 0) {
  try {
    const { data, error } = await supabase
      .from("rewards")
      .insert([
        {
          event_id: eventId,
          title,
          cost_points: costPoints,
          stock,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { reward: data, error: null };
  } catch (error) {
    console.error("Error creating reward:", error.message);
    return { reward: null, error };
  }
}
