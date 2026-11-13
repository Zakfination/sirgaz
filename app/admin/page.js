"use client";

// SirGaZ platform admin (super admin only): moderation queue + per-event quota & prices.
// Access is enforced in the database (list_reports / review_report / set_user_suspension /
// update_event_monetization all require super_admin); this page only hides the UI.

import React from "react";
import { AuthProvider, useAuth } from "../authContext";
import {
  isSuperAdmin,
  listReports,
  reviewReport,
  setUserSuspension,
  listAllEvents,
  updateEventMonetization,
  REPORT_REASONS,
  matchErrorMessage,
} from "@/lib/db";

const reasonLabel = (id) => REPORT_REASONS.find((r) => r.id === id)?.label || id;
const fmtDate = (v) => (v ? new Date(v).toLocaleString("id-ID") : "—");
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

const Shell = ({ children }) => (
  <div className="min-h-screen w-full bg-black text-white">
    <div className="max-w-5xl mx-auto px-5 py-8">{children}</div>
  </div>
);

const Login = () => {
  const { sendEmailOtp, verifyEmailOtp, pendingEmail } = useAuth();
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setErr("");
    setBusy(true);
    const r = sent ? await verifyEmailOtp(code) : await sendEmailOtp(email);
    setBusy(false);
    if (r?.error) return setErr(r.error);
    if (!sent) setSent(true);
  };
  return (
    <div className="max-w-sm mx-auto mt-16 glass rounded-3xl p-6">
      <div className="text-[20px] font-semibold">Admin SirGaZ</div>
      <div className="text-[12.5px] text-white/50 mt-1">
        {sent ? `Kode dikirim ke ${pendingEmail}` : "Masuk dengan email admin."}
      </div>
      {!sent ? (
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@sirgaz.com"
          className="mt-4 w-full glass rounded-2xl px-4 h-12 bg-transparent outline-none" />
      ) : (
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Kode 6 digit" inputMode="numeric"
          className="mt-4 w-full glass rounded-2xl px-4 h-12 bg-transparent outline-none tracking-widest" />
      )}
      {err && <div className="mt-2 text-[12px] text-[#FF2F92]">{err}</div>}
      <button onClick={submit} disabled={busy}
        className="mt-4 w-full h-12 rounded-2xl gradient-brand font-semibold disabled:opacity-50">
        {busy ? "Memproses…" : sent ? "Masuk" : "Kirim kode"}
      </button>
    </div>
  );
};

const ReportsTab = () => {
  const [status, setStatus] = React.useState("OPEN");
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [notes, setNotes] = React.useState({});
  const [busyId, setBusyId] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    const { data, error, code } = await listReports(status === "ALL" ? null : status);
    setLoading(false);
    if (error) return setErr(matchErrorMessage(code, error));
    setItems(data || []);
  }, [status]);
  React.useEffect(() => { load(); }, [load]);

  const decide = async (r, decision, suspend) => {
    setBusyId(r.id);
    const { error, code } = await reviewReport({ reportId: r.id, status: decision, note: notes[r.id], suspend });
    setBusyId(null);
    if (error) return setErr(matchErrorMessage(code, error));
    load();
  };
  const toggleSuspension = async (r) => {
    const suspended = !r.reported?.suspended_at;
    if (!window.confirm(suspended ? `Tangguhkan ${r.reported?.name}?` : `Cabut penangguhan ${r.reported?.name}?`)) return;
    setBusyId(r.id);
    const { error, code } = await setUserSuspension(r.reported.user_id, suspended, notes[r.id]);
    setBusyId(null);
    if (error) return setErr(matchErrorMessage(code, error));
    load();
  };

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED", "ALL"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`h-9 px-4 rounded-full text-[12.5px] ${status === s ? "gradient-brand" : "glass"}`}>{s}</button>
        ))}
      </div>
      {err && <div className="mt-3 text-[12.5px] text-[#FF2F92]">{err}</div>}
      {loading ? (
        <div className="mt-6 text-white/40 text-[13px]">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="mt-6 glass rounded-2xl p-8 text-center text-white/50 text-[13px]">Tidak ada laporan.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/50">
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white">{r.status}</span>
                <span>{fmtDate(r.created_at)}</span>
                {r.event_title && <span>· {r.event_title}</span>}
              </div>
              <div className="mt-2 text-[15px] font-semibold">{reasonLabel(r.reason)}</div>
              {r.details && <div className="mt-1 text-[13px] text-white/75 whitespace-pre-wrap">{r.details}</div>}
              <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[12.5px]">
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/45 text-[11px]">Pelapor</div>
                  <div>{r.reporter?.name || "—"}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2.5">
                  <div className="text-white/45 text-[11px]">Dilaporkan · total {r.reported?.reports_total ?? 0} laporan</div>
                  <div>{r.reported?.name || "—"} {r.reported?.suspended_at && <span className="text-[#FF2F92]">· ditangguhkan</span>}</div>
                </div>
              </div>
              <input value={notes[r.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                placeholder="Catatan keputusan (tercatat di audit log)"
                className="mt-3 w-full glass rounded-xl px-3 h-10 bg-transparent outline-none text-[13px]" />
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "OPEN" && (
                  <>
                    <button disabled={busyId === r.id} onClick={() => decide(r, "DISMISSED", false)} className="h-9 px-4 rounded-full glass text-[12.5px]">Tolak</button>
                    <button disabled={busyId === r.id} onClick={() => decide(r, "REVIEWED", false)} className="h-9 px-4 rounded-full glass text-[12.5px]">Tandai ditinjau</button>
                    <button disabled={busyId === r.id} onClick={() => decide(r, "ACTION_TAKEN", true)} className="h-9 px-4 rounded-full bg-[#FF2F92] text-[12.5px] font-semibold">Tindak & tangguhkan</button>
                  </>
                )}
                <button disabled={busyId === r.id} onClick={() => toggleSuspension(r)} className="h-9 px-4 rounded-full glass text-[12.5px]">
                  {r.reported?.suspended_at ? "Cabut penangguhan" : "Tangguhkan saja"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PricingTab = () => {
  const [events, setEvents] = React.useState([]);
  const [drafts, setDrafts] = React.useState({});
  const [msg, setMsg] = React.useState("");
  const [busyId, setBusyId] = React.useState(null);
  const load = async () => setEvents(await listAllEvents());
  React.useEffect(() => { load(); }, []);
  const field = (e, k) => drafts[e.id]?.[k] ?? e[k];
  const set = (id, k, v) => setDrafts((p) => ({ ...p, [id]: { ...p[id], [k]: v === "" ? "" : Number(v) } }));
  const save = async (e) => {
    const d = drafts[e.id] || {};
    for (const [k, v] of Object.entries(d)) if (v === "" || !Number.isInteger(v) || v < 0) return setMsg(`Nilai ${k} tidak valid`);
    setBusyId(e.id);
    const { error, code } = await updateEventMonetization(e.id, d);
    setBusyId(null);
    if (error) return setMsg(matchErrorMessage(code, error));
    setMsg(`Tersimpan: ${e.title}`);
    setDrafts((p) => ({ ...p, [e.id]: undefined }));
    load();
  };
  const cols = [
    ["free_rerolls", "Ganti gratis"],
    ["reroll_pack_size", "Isi paket"],
    ["reroll_pack_price_idr", "Harga paket (Rp)"],
    ["chat_unlock_price_idr", "Buka chat (Rp)"],
  ];
  return (
    <div>
      <div className="text-[12.5px] text-white/55">
        Perubahan berlaku untuk peserta yang baru masuk event; kuota yang sudah diberikan tidak berubah. Semua perubahan tercatat di audit log.
      </div>
      {msg && <div className="mt-3 text-[12.5px] text-[#00E5FF]">{msg}</div>}
      <div className="mt-4 space-y-3">
        {events.map((e) => (
          <div key={e.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-[15px] font-semibold">{e.title}</div>
              <div className="text-[12px] text-white/45">{e.venue_name} · {e.status} · {fmtDate(e.starts_at)} – {fmtDate(e.ends_at)}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {cols.map(([k, l]) => (
                <label key={k} className="text-[11px] text-white/50">
                  {l}
                  <input type="number" min="0" value={field(e, k)} onChange={(ev) => set(e.id, k, ev.target.value)}
                    className="mt-1 w-full glass rounded-xl px-3 h-10 bg-transparent outline-none text-[14px] text-white" />
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11.5px] text-white/40">Saat ini: paket {rupiah(e.reroll_pack_price_idr)} · chat {rupiah(e.chat_unlock_price_idr)}</div>
              <button onClick={() => save(e)} disabled={!drafts[e.id] || busyId === e.id}
                className="h-9 px-4 rounded-full gradient-brand text-[12.5px] font-semibold disabled:opacity-40">Simpan</button>
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="glass rounded-2xl p-8 text-center text-white/50 text-[13px]">Belum ada event.</div>}
      </div>
    </div>
  );
};

const AdminApp = () => {
  const { session, sessionLoading, logout } = useAuth();
  const [allowed, setAllowed] = React.useState(null);
  const [tab, setTab] = React.useState("reports");
  React.useEffect(() => {
    if (!session) return setAllowed(null);
    isSuperAdmin().then(setAllowed);
  }, [session]);

  if (sessionLoading) return <Shell><div className="text-white/40">Memuat…</div></Shell>;
  if (!session) return <Shell><Login /></Shell>;
  if (allowed === null) return <Shell><div className="text-white/40">Memeriksa akses…</div></Shell>;
  if (!allowed)
    return (
      <Shell>
        <div className="max-w-sm mx-auto mt-16 glass rounded-3xl p-6 text-center">
          <div className="text-[17px] font-semibold">Akses ditolak</div>
          <div className="text-[13px] text-white/55 mt-1">Halaman ini hanya untuk admin SirGaZ.</div>
          <button onClick={logout} className="mt-4 h-10 px-5 rounded-full glass text-[13px]">Keluar</button>
        </div>
      </Shell>
    );
  return (
    <Shell>
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-semibold tracking-tight">Admin SirGaZ</div>
        <button onClick={logout} className="h-9 px-4 rounded-full glass text-[12.5px]">Keluar</button>
      </div>
      <div className="mt-5 flex gap-2">
        {[["reports", "Moderasi laporan"], ["pricing", "Kuota & harga event"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`h-10 px-4 rounded-full text-[13px] ${tab === k ? "gradient-brand" : "glass"}`}>{l}</button>
        ))}
      </div>
      <div className="mt-6">{tab === "reports" ? <ReportsTab /> : <PricingTab />}</div>
    </Shell>
  );
};

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminApp />
    </AuthProvider>
  );
}
