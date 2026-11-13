# PRD V2 → implementasi SirGaZ (Supabase)

PRD V2 ("Random Matchmaking & Monetisasi") menulis rancangan dengan MongoDB dan REST `/api/v1`.
Repo ini memakai **Supabase/Postgres + RLS + RPC** (API Mongo lama sudah dimatikan), jadi rancangan
dipetakan seperti di bawah. Semua aturan bisnis dijalankan di database (fungsi `SECURITY DEFINER`),
klien hanya punya akses baca yang dibatasi RLS.

## Koleksi → tabel

| PRD (MongoDB)          | Supabase                                   | Status  |
|------------------------|--------------------------------------------|---------|
| user_profiles          | `profiles` (+ `gender`, `suspended_at`), `profile_private` (+ `seeking`, `birthday`) | Fase 1 |
| events                 | `events` (+ `ends_at`, `free_rerolls`, `reroll_pack_size`, `reroll_pack_price_idr`, `chat_unlock_price_idr`) | Fase 1 |
| event_participants     | `event_participants` (diisi oleh `check_in_to_event`) | Ada |
| event_match_sessions   | `event_match_sessions`                     | Fase 1 |
| event_match_history    | `event_match_history`                      | Fase 1 |
| event_wallets          | `event_wallets`                            | Fase 1 |
| wallet_transactions    | `wallet_transactions` (ledger, `idempotency_key` unik) | Fase 1 |
| user_blocks            | `user_blocks`                              | Fase 1 |
| chat_reports           | `user_reports`                             | Fase 1 |
| payment_orders         | —                                          | Fase 2 |
| chat_unlocks           | —                                          | Fase 2 |
| conversations          | — (chat saat ini memakai `matches` + `messages`) | Fase 2 |
| messages               | `messages`                                 | Ada, digating di fase 2 |
| user_pokes             | —                                          | Fase 2 |

## Endpoint → RPC (`supabase.rpc(...)`, klien di `lib/db.js`)

| PRD endpoint                              | RPC                         |
|-------------------------------------------|-----------------------------|
| POST /matchmaking/start                   | `matchmaking_start(p_event)` — idempoten |
| GET /matchmaking/current                  | `matchmaking_current(p_event)` |
| POST /matchmaking/reroll                  | `matchmaking_reroll(p_event, p_idempotency_key)` |
| GET /matchmaking/history                  | `matchmaking_history(p_event)` |
| GET /matchmaking/quota                    | `matchmaking_quota(p_event)` |
| GET /matchmaking/eligibility              | `matchmaking_eligibility(p_event)` |
| POST /users/:id/block, DELETE …/block     | `block_user(p_user)`, `unblock_user(p_user)` |
| POST /reports                             | `report_user(p_user, p_reason, p_details, p_event, p_block)` |
| POST /admin/events/:id/close              | `close_event(p_event)` (juga dipanggil saat venue set status `ended`) |
| GET /admin/events/:id/match-analytics + reroll-analytics | `event_match_analytics(p_event)` |
| GET /admin/chat/reports (moderasi)        | `select * from user_reports` (RLS: super admin / staf venue) + `review_report(...)` |
| POST /payments/midtrans/webhook           | Fase 2: Edge Function → `credit_paid_rerolls(...)` (service_role saja) |

Jembatan ke alur misi/hadiah yang sudah ada: `matchmaking_confirm(p_event)` membuat baris `matches`
untuk pasangan yang sedang tampil, sehingga `create_mission_for_match` / `complete_mission` tetap jalan.

## Kode error

Fungsi melempar kode PRD sebagai pesan error: `UNAUTHORIZED`, `EVENT_NOT_FOUND`, `EVENT_NOT_LIVE`,
`EVENT_ENDED`, `NOT_EVENT_PARTICIPANT`, `PROFILE_INCOMPLETE`, `ACCOUNT_SUSPENDED`,
`REROLL_QUOTA_EXHAUSTED`, `NO_CANDIDATE_AVAILABLE`, `RATE_LIMITED`, `FORBIDDEN`.
`lib/db.js` mengembalikannya sebagai `code` dan `matchErrorMessage(code)` memberi teks Indonesia.

## Aturan yang ditegakkan di server

- Kelayakan kandidat: peserta event yang sama dengan sesi venue aktif, profil lengkap (nama, foto asli,
  gender, preferensi, umur ≥ 18, ≥ 1 minat), preferensi gender **dua arah** cocok, bukan diri sendiri,
  tidak saling blokir, tidak ditangguhkan.
- Pemilihan acak seragam di server (`order by random()`); orang yang sama boleh muncul lagi, tetapi
  reroll tidak pernah mengembalikan orang yang sedang tampil.
- Match pertama dan pengganti otomatis (setelah blokir) **gratis**; reroll memakai kuota gratis dulu, lalu berbayar.
- Kuota terkunci per baris (`FOR UPDATE`): 10 permintaan paralel dengan sisa 1 kuota → tepat 1 berhasil.
- Kunci idempotensi per tap: permintaan ulang tidak memotong kuota dua kali.
- Event berakhir → kuota tidak bisa dipakai; `close_event` / `expire_ended_events` mencatat `EXPIRE` di ledger.
- Saldo dompet selalu = jumlah ledger (diuji).
- `gender` hanya bisa diisi sekali oleh pengguna; `xp` dan `suspended_at` hanya oleh server.

## Keputusan yang perlu dikonfirmasi produk

1. **Batas umur 18+** — tidak tertulis di PRD, tetapi diterapkan karena ini matchmaking malam hari dengan chat berbayar.
2. **Siapa yang melihat siapa** — profil yang tampil hanya bisa dibaca oleh orang yang melihatnya (tidak timbal balik).
3. **Chat saat ini gratis** setelah "Lihat Kompatibilitas" (alur lama). Fase 2 akan menguncinya di balik `chat_unlocks` Rp49.000 sesuai PRD.
4. **Model bisnis ganda** — langganan venue (Deck) + pembelian pengunjung (PRD); pembagian pendapatan dengan venue belum diatur.

## Fase 2 (belum dikerjakan)

Midtrans (Snap + verifikasi signature di Edge Function, `payment_orders`), paket reroll Rp10.000,
`chat_unlocks` Rp49.000 (pria → wanita, tanpa persetujuan, permanen, tanpa tagihan ganda, kompensasi
kredit), `conversations` permanen, Poke gratis untuk wanita, notifikasi, pengaturan harga di dashboard,
laporan pendapatan, antrean moderasi di UI admin.
