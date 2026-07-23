# Production Deployment Checklist — sirgaZ

End-to-end path: **Emergent → GitHub → Vercel → Hostinger DNS → sirgaz.com**

---

## 1. GitHub ✅

**Where**: Emergent chat UI → "Save to GitHub" button (or GitHub icon in top bar).

1. Click **Save to GitHub** / **Connect GitHub** in the Emergent app UI
2. Authorize the Emergent GitHub App on your account
3. Choose **Create new repository** → name it exactly **`sirgaz`**
4. Visibility: **Private** (recommended)
5. Click **Push**

When the push completes you will get a repo URL like:

```
https://github.com/<your-username>/sirgaz
```

Save that URL — you'll need it in Step 2.

### Verify
- Open the repo URL in a browser
- Confirm: `/app/page.js`, `/lib/db.js`, `/supabase/schema.sql`, `/supabase/002_venue_profile.sql`, `package.json`, `next.config.js`, `.env.example`, `README.md`, `DEPLOY.md`
- Confirm: `.env` is **NOT** committed (it's in `.gitignore`)
- Confirm: `node_modules/` is **NOT** committed

---

## 2. Vercel ✅

1. Go to **https://vercel.com** → sign in with your GitHub account
2. Click **Add New → Project**
3. Pick the **`sirgaz`** repo → **Import**

### Vercel project config

| Setting | Value |
|---|---|
| **Framework Preset** | **Next.js** (auto-detected) |
| **Root Directory** | `.` (leave as default) |
| **Build Command** | `next build` (leave as default) |
| **Install Command** | `yarn install` (leave as default) |
| **Output Directory** | `.next` (leave as default) |
| **Node.js Version** | **20.x** (default) or 22.x — both work; 22 recommended if you want no Supabase deprecation warning |

---

## 3. Environment Variables ✅

Under **Vercel Project → Settings → Environment Variables**, add these for **Production, Preview, and Development** environments:

| Name | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dmoaeewcsjklgdhaprsq.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_Vz6BlwKknK5aFyw_LLiu6w_X9WL_67X` | Production, Preview, Development |

### Variables you must NOT copy from Emergent

| Emergent var | Reason to skip |
|---|---|
| `MONGO_URL` | Emergent-only local Mongo; not used by any code path in production |
| `DB_NAME` | Same — legacy from the template |
| `NEXT_PUBLIC_BASE_URL` | Emergent-specific preview URL; Vercel provides its own via `VERCEL_URL` |
| `CORS_ORIGINS` | Only referenced in `next.config.js` headers as a fallback (`"*"` if unset); safe to omit |

---

## 4. Supabase ✅

### 4a. Confirm SQL migrations were run

In Supabase → SQL Editor, verify these were previously executed (re-running is safe/idempotent):

- `supabase/schema.sql`
- `supabase/002_venue_profile.sql`

Table Editor should show 7 tables: `venues`, `events`, `event_participants`, `profiles`, `matches`, `missions`, `rewards`.

### 4b. Update Auth URL configuration

Dashboard → **Authentication → URL Configuration**:

**Site URL** (single value — primary origin):
```
https://sirgaz.com
```

**Additional Redirect URLs** (whitelist of allowed callback origins for magic links / OAuth):
```
https://sirgaz.com
https://www.sirgaz.com
https://sirgaz.vercel.app
https://*.vercel.app
http://localhost:3000
```

> Without this update, email OTP magic links will show "Invalid redirect URL" once the domain changes.

### 4c. Confirm Email provider is enabled

Dashboard → Authentication → Providers → **Email** → toggle **Enable Email provider** ON (default). No password sign-in required for our flow.

### 4d. (Optional) Custom SMTP for higher email volume

Supabase default: ~3–4 emails/hour per project (dev-tier).  
For production, configure a real SMTP provider (Resend / SendGrid / Postmark) in Auth → Email → SMTP settings — lifts the limit.

---

## 5. Hostinger DNS → Vercel ✅

### 5a. First deploy on Vercel → assign custom domain

After first successful deploy on Vercel:

1. Vercel Project → **Settings → Domains**
2. Enter `sirgaz.com` → **Add**
3. Also add `www.sirgaz.com` → Vercel will offer to redirect one to the other. Pick the apex (`sirgaz.com`) as canonical.

Vercel will then show you the DNS records to add. **These are the standard values** (verify in Vercel Domain settings before applying):

| Type  | Host / Name | Value                       | TTL    |
|-------|-------------|-----------------------------|--------|
| A     | @           | `76.76.21.21`               | 14400  |
| CNAME | www         | `cname.vercel-dns.com`      | 14400  |

### 5b. Apply in Hostinger

1. Log in to **Hostinger → hPanel → Domains → sirgaz.com**
2. Ensure **Nameservers** are Hostinger's (`ns1.dns-parking.com` / `ns2.dns-parking.com`). If they were changed elsewhere, either revert to Hostinger's or edit DNS at whichever DNS provider currently owns the zone.
3. **DNS / Nameservers → DNS Records**
4. **Delete** any existing A records for `@` and any CNAME for `www` that point elsewhere (parking pages, other hosts)
5. **Add** the two records from the table in 5a
6. **Save**

DNS propagation: 5–30 minutes usually, up to a few hours worst case. Check status at https://dnschecker.org (query `sirgaz.com` type A — should show `76.76.21.21` globally).

---

## 6. sirgaz.com ✅

Once DNS propagates, Vercel automatically:

- Attaches the domain to your project
- Verifies ownership
- Serves the app at `https://sirgaz.com` and `https://www.sirgaz.com`

---

## 7. SSL ✅

Automatic. Vercel issues Let's Encrypt certificates for both `sirgaz.com` and `www.sirgaz.com` within 1–10 minutes of DNS verification. You'll see a green **Valid Configuration** checkmark in **Settings → Domains**.

No manual certificate upload. No manual renewal (Vercel auto-renews before 90-day expiry).

---

## 8. Production verification ✅

Run through this end-to-end sanity check:

1. Open `https://sirgaz.com` in a fresh browser → splash → landing renders, no console errors
2. Click **Sign in** → enter a real email → receive OTP email from Supabase → enter code → lands on Home
3. From Home, jump to **Venue Dashboard** → if first login, redirects to **Venue Setup** with Hevn Station pre-filled → Save & continue
4. **Create Event** → title → Publish → Event Manage → **Open QR** → verify QR renders and downloads a PNG
5. Copy the `/e/{uuid}` URL → open in incognito → verify event landing shows Hevn Station
6. Sign in as a second email → Join → Waiting Room → Countdown → **AI Vibe Match** card renders with reasons list
7. Mission → tick clues → Claim → Reward with QR code
8. In venue tab, go to **Reward Redeems** → paste reward code → verify "✓ Redeemed" flash
9. Verify SSL padlock is green in browser bar
10. Verify `https://www.sirgaz.com` redirects to `https://sirgaz.com` (or vice versa depending on canonical choice)

---

## Post-launch — optional but recommended

- **Vercel Analytics**: Project → Analytics → Enable (free tier)
- **Custom SMTP** in Supabase (see 4d)
- **Vercel Speed Insights**: Project → Speed Insights → Enable
- **Uptime monitoring**: pingdom.com / uptimerobot.com → monitor `https://sirgaz.com`
- **Branch previews**: any PR against `main` auto-deploys to a preview URL like `sirgaz-pr-N.vercel.app` — add these to Supabase Redirect URLs if you use auth in previews (already whitelisted via `https://*.vercel.app`)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel build fails on `next build` | Check Node version is 20.x/22.x; ensure `yarn.lock` exists in repo |
| "Invalid redirect URL" on sign-in | Add the current origin to Supabase Auth → Redirect URLs |
| "email_provider_disabled" | Enable Email provider in Supabase Auth → Providers |
| "Missing NEXT_PUBLIC_SUPABASE_URL" in Vercel logs | Env var not set on Production scope; re-add and redeploy |
| Domain shows Vercel 404 | DNS still propagating; check dnschecker.org |
| Domain shows Hostinger parking page | Old A record still cached / not removed; delete parking record in Hostinger DNS |

---

## Rollback

- **Vercel**: Deployments tab → pick any previous deployment → **Promote to Production**
- **Database**: since RLS-scoped Supabase is the source of truth, code rollbacks don't destroy data. All SQL migrations are additive/idempotent.
