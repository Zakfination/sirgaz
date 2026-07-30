"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import supabase from "@/lib/supabaseClient";

// Import fungsi secara langsung tanpa namespace dbMerchant
import {
  getMerchantProfile,
  createMerchantProfile,
  getMerchantEvents,
  createMerchantEvent,
  createMission,
  createReward,
} from "@/lib/dbMerchant";

export default function MerchantDashboardPage() {
  const [currentSession, setCurrentSession] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States Event
  const [eventName, setEventName] = useState("");
  const [qrSlug, setQrSlug] = useState("");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startTime, setStartTime] = useState("");
  const [checkinPoints, setCheckinPoints] = useState(10);

  const [submitting, setSubmitting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Merchant Register State
  const [merchantName, setMerchantName] = useState("");

  // Mission & Reward Form States
  const [missionTitle, setMissionTitle] = useState("");
  const [missionPoints, setMissionPoints] = useState(50);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardPoints, setRewardPoints] = useState(100);
  const [rewardStock, setRewardStock] = useState(20);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);

      if (!supabase || !supabase.auth) {
        console.error("Supabase client belum di-initialize dengan benar.");
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentSession(session);

      if (session?.user) {
        await loadMerchantData(session.user.id);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const loadMerchantData = async (userId) => {
    const { merchant: prof } = await getMerchantProfile(userId);
    if (prof) {
      setMerchant(prof);
      const { events: evs } = await getMerchantEvents(prof.id);
      setEvents(evs || []);
      if (evs?.length > 0) setSelectedEvent(evs[0]);
    }
  };

  const handleRegisterMerchant = async (e) => {
    e.preventDefault();
    if (!merchantName.trim()) return;

    setSubmitting(true);
    let user = currentSession?.user;

    if (!user) {
      const { data: authData, error: authErr } =
        await supabase.auth.signInAnonymously();
      if (authErr) {
        alert("Gagal membuat sesi login: " + authErr.message);
        setSubmitting(false);
        return;
      }
      user = authData.user;
      setCurrentSession(authData.session);
    }

    const { merchant: newMerchant, error } = await createMerchantProfile(
      user.id,
      merchantName,
    );

    if (error) {
      alert("Error membuat merchant: " + error.message);
    } else if (newMerchant) {
      setMerchant(newMerchant);
    }
    setSubmitting(false);
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventName || !qrSlug || !merchant) return;
    setSubmitting(true);
    const cleanSlug = qrSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const { event, error } = await createMerchantEvent({
      merchant_id: merchant.id,
      title: eventName,
      name: eventName,
      qr_slug: cleanSlug,
      description,
      venue_name: venueName,
      venue_address: venueAddress,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      checkin_points: Number(checkinPoints) || 10,
      status: "active",
    });

    if (!error && event) {
      const updatedEvents = [
        { ...event, missions: [], rewards: [] },
        ...events,
      ];
      setEvents(updatedEvents);
      setSelectedEvent(updatedEvents[0]);

      // Reset Form Event
      setEventName("");
      setQrSlug("");
      setDescription("");
      setVenueName("");
      setVenueAddress("");
      setStartTime("");
      setCheckinPoints(10);
    } else {
      alert("Gagal membuat event: " + (error?.message || "Terjadi kesalahan"));
    }
    setSubmitting(false);
  };

  const handleAddMission = async (e) => {
    e.preventDefault();
    if (!missionTitle || !selectedEvent) return;
    const { mission } = await createMission(
      selectedEvent.id,
      missionTitle,
      "",
      Number(missionPoints),
    );
    if (mission) {
      const updated = events.map((ev) =>
        ev.id === selectedEvent.id
          ? { ...ev, missions: [...(ev.missions || []), mission] }
          : ev,
      );
      setEvents(updated);
      setSelectedEvent({
        ...selectedEvent,
        missions: [...(selectedEvent.missions || []), mission],
      });
      setMissionTitle("");
    }
  };

  const handleAddReward = async (e) => {
    e.preventDefault();
    if (!rewardTitle || !selectedEvent) return;
    const { reward } = await createReward(
      selectedEvent.id,
      rewardTitle,
      Number(rewardPoints),
      Number(rewardStock),
    );
    if (reward) {
      const updated = events.map((ev) =>
        ev.id === selectedEvent.id
          ? { ...ev, rewards: [...(ev.rewards || []), reward] }
          : ev,
      );
      setEvents(updated);
      setSelectedEvent({
        ...selectedEvent,
        rewards: [...(selectedEvent.rewards || []), reward],
      });
      setRewardTitle("");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading Portal Merchant…
      </div>
    );

  if (!merchant) {
    return (
      <div className="min-h-screen bg-[#0d0d12] text-white p-6 flex flex-col justify-center items-center">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
            Daftar Merchant SirGaZ
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Kelola event, buat QR check-in, & atur misi untuk pengunjungmu.
          </p>
          <form onSubmit={handleRegisterMerchant} className="mt-6 space-y-4">
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Contoh: Club XYZ / Tech Community"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 outline-none text-white text-sm"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 font-semibold text-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Mendaftarkan…" : "Buka Portal Merchant"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0e] text-white p-6 md:p-10 font-sans">
      <div className="flex justify-between items-center pb-6 border-b border-white/10">
        <div>
          <span className="text-xs font-semibold text-pink-500 tracking-widest uppercase">
            Merchant Dashboard
          </span>
          <h1 className="text-2xl font-bold mt-0.5">{merchant.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Form Create Event */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-lg font-semibold mb-4">+ Event Baru</h2>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <input
                type="text"
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value);
                  if (!qrSlug)
                    setQrSlug(
                      e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    );
                }}
                placeholder="Nama Event *"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm"
                required
              />
              <div className="flex items-center bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/40">
                <span>/e/</span>
                <input
                  type="text"
                  value={qrSlug}
                  onChange={(e) => setQrSlug(e.target.value)}
                  placeholder="qr-slug *"
                  className="bg-transparent outline-none text-white text-sm w-full ml-1"
                  required
                />
              </div>

              {/* Input Venue & Waktu */}
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Nama Venue / Lokasi (misal: Main Stage / Cafe ABC)"
                className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-xs"
              />
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Alamat Venue Singkat"
                className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-xs"
              />

              <div className="flex gap-2">
                <div className="w-2/3">
                  <label className="text-[10px] text-white/50 mb-1 block">
                    Waktu Mulai
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs text-white"
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-[10px] text-pink-400 mb-1 block">
                    Poin Check-in
                  </label>
                  <input
                    type="number"
                    value={checkinPoints}
                    onChange={(e) => setCheckinPoints(e.target.value)}
                    placeholder="Poin"
                    className="w-full px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-bold text-pink-400"
                  />
                </div>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi Event"
                rows={2}
                className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-pink-600 font-semibold text-sm cursor-pointer hover:bg-pink-500 transition"
              >
                Publish Event
              </button>
            </form>
          </div>

          {/* List Events */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-sm font-semibold text-white/60 mb-3">
              Event Kamu ({events.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`w-full p-3 rounded-xl text-left border transition cursor-pointer ${
                    selectedEvent?.id === ev.id
                      ? "bg-pink-500/20 border-pink-500"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="font-semibold text-sm">
                    {ev.name || ev.title}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5 flex justify-between">
                    <span>/e/{ev.qr_slug}</span>
                    {ev.venue_name && (
                      <span className="text-pink-400">📍 {ev.venue_name}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Event Details & Manage Missions/Rewards */}
        {selectedEvent ? (
          <div className="lg:col-span-2 space-y-6">
            {/* QR Card */}
            <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-pink-400 font-semibold uppercase">
                  QR Code Event
                </span>
                <h3 className="text-2xl font-bold mt-1">
                  {selectedEvent.name || selectedEvent.title}
                </h3>

                {/* Info Venue & Poin Checkin */}
                <div className="text-xs text-white/70 mt-2 space-y-1">
                  {selectedEvent.venue_name && (
                    <p>
                      📍 <b>Venue:</b> {selectedEvent.venue_name}{" "}
                      {selectedEvent.venue_address &&
                        `(${selectedEvent.venue_address})`}
                    </p>
                  )}
                  {selectedEvent.start_time && (
                    <p>
                      📅 <b>Waktu:</b>{" "}
                      {new Date(selectedEvent.start_time).toLocaleString(
                        "id-ID",
                      )}
                    </p>
                  )}
                  <p>
                    🎁 <b>Poin Check-In Gratis:</b> +
                    {selectedEvent.checkin_points || 10} pt
                  </p>
                </div>

                <code className="text-xs text-pink-300 block mt-3 bg-black/40 px-3 py-1.5 rounded-lg w-fit">
                  https://sirgaz.app/e/{selectedEvent.qr_slug}
                </code>
              </div>
              <div className="p-3 bg-white rounded-2xl shrink-0 self-center md:self-auto">
                <QRCodeSVG
                  value={`https://sirgaz.app/e/${selectedEvent.qr_slug}`}
                  size={110}
                />
              </div>
            </div>

            {/* Config Misi & Rewards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Manage Misi */}
              <div className="bg-[#12121a] border border-white/10 rounded-3xl p-5">
                <h4 className="font-semibold text-sm text-pink-400 mb-3">
                  🎯 Misi Event ({selectedEvent.missions?.length || 0})
                </h4>
                <form onSubmit={handleAddMission} className="space-y-2 mb-4">
                  <input
                    type="text"
                    value={missionTitle}
                    onChange={(e) => setMissionTitle(e.target.value)}
                    placeholder="Contoh: Beli Special Mocktail"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-xs"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={missionPoints}
                      onChange={(e) => setMissionPoints(e.target.value)}
                      placeholder="Poin"
                      className="w-1/2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs"
                      required
                    />
                    <button
                      type="submit"
                      className="w-1/2 py-1.5 bg-pink-600 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      + Misi
                    </button>
                  </div>
                </form>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedEvent.missions?.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 bg-white/5 rounded-lg flex justify-between text-xs"
                    >
                      <span>{m.title}</span>
                      <span className="text-pink-400 font-mono">
                        +{m.points_reward || m.points} pt
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manage Rewards */}
              <div className="bg-[#12121a] border border-white/10 rounded-3xl p-5">
                <h4 className="font-semibold text-sm text-purple-400 mb-3">
                  🎁 Hadiah Penukaran ({selectedEvent.rewards?.length || 0})
                </h4>
                <form onSubmit={handleAddReward} className="space-y-2 mb-4">
                  <input
                    type="text"
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder="Contoh: Free Drink Voucher"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-xs"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={rewardPoints}
                      onChange={(e) => setRewardPoints(e.target.value)}
                      placeholder="Harga Poin"
                      className="w-1/3 px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs"
                      required
                    />
                    <input
                      type="number"
                      value={rewardStock}
                      onChange={(e) => setRewardStock(e.target.value)}
                      placeholder="Stok"
                      className="w-1/3 px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs"
                      required
                    />
                    <button
                      type="submit"
                      className="w-1/3 py-1.5 bg-purple-600 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      + Reward
                    </button>
                  </div>
                </form>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedEvent.rewards?.map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 bg-white/5 rounded-lg flex justify-between text-xs"
                    >
                      <span>
                        {r.title} ({r.stock} stok)
                      </span>
                      <span className="text-purple-400 font-mono">
                        {r.cost_points || r.points_cost} pt
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 p-12 text-center bg-white/5 border border-white/10 rounded-3xl text-white/40">
            Pilih atau buat event baru di sebelah kiri untuk mengelola QR, Misi,
            dan Rewards.
          </div>
        )}
      </div>
    </div>
  );
}
