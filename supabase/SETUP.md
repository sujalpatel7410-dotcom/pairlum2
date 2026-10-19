# Connecting Pairlum to a real Supabase backend

Without this, Pairlum runs exactly as it always has: a local-only demo,
with the two of you living as two browser tabs (`?as=mira`). This guide
turns that into a real account system two people can use on two separate
devices — real signup/login, a real invite code to pair, live sync between
devices, and real cloud storage for photos/voice notes.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and create a new project (the free tier is enough to try this).
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema

1. In your project, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` (in this repo) and click **Run**.
3. It's safe to re-run if you ever need to — it only creates things that don't already exist.

**Already set up from an older version?** Don't re-run everything blindly —
run the files in `supabase/migrations/` that you haven't run yet, oldest
first, the same way (SQL Editor → paste → Run). Each one says at the top
what it changes; they're safe to run twice and don't delete existing data.

- `20261015120000_secure_pairing_invites.sql` — switches pairing to secure
  invite links (see section 5). Adds the `pairing_invites` table, retires the
  old 8-character codes (they stop working; nothing is deleted).
- `20261016120000_delete_my_account.sql` — makes Settings → Privacy →
  **Delete my account** actually delete the login (it used to only clear the
  person's content). Adds one function; changes nothing else.
- `20261019120000_lockdown.sql` — closes three ways around the app's own
  checks: the shared record can only be changed through `write_space_data`
  (no direct table writes, not even by someone who left or disconnected);
  only a file's uploader can replace or delete it; and the live-signal
  channel ("I Need You" live listening) is private to the couple. **Run this
  one before loading the updated app** — the app now joins that channel as
  private, which only works once these rules exist.
- `20261019130000_memberships.sql` — plans and Pairlum Book eligibility come
  from the server only. Adds a `memberships` table the app can read but
  never write, and a `my_membership()` function that decides Book
  eligibility (one full year on the Book plan). The app's "Switch plan"
  preview is gone in real accounts; until payments exist, the membership
  screen says plans open soon. To give a test space a plan by hand, see the
  comment at the top of that file.
- `20261019140000_guard.sql` — the server now enforces who may change what
  in the shared record, instead of trusting the app. Once both of you have
  joined, neither can edit, remove or re-credit the other's moments, notes,
  letters, replies, plans, dates, rituals or collections, add something in
  the other's name, or change the other's profile, settings, feelings,
  answers, hearts or recording write-ups. What the app itself lets you do to
  each other's things still works: tick a Someday item, answer an I Need You
  request, edit or remove a chapter, mark a ritual kept, add to a
  collection. A save that breaks a rule isn't thrown away: just those pieces
  are put back and the rest is saved, and the app says "Part of that change
  wasn't saved". The app also shows "Not saved yet" when a change hasn't
  reached the server (offline, or the server refused it) and retries on its
  own. Adds helper functions and replaces `write_space_data`; no data
  changes.

## 3. Turn on Realtime (usually already on)

Supabase enables the `supabase_realtime` publication by default; the schema
adds the `spaces` and `space_members` tables to it automatically. If live
sync doesn't seem to work, double check: **Database → Replication →
`supabase_realtime`** includes both tables.

## 4. Get your API keys

**Project Settings → API**:
- **Project URL** → this is `supabaseUrl`
- **anon public** key → this is `supabaseAnonKey`

(The anon key is meant to be public/client-side — it's safe to ship in a
static file. All real access control happens through the Row Level Security
policies and RPC functions in `schema.sql`, not by hiding this key.)

## 5. Fill in `pairlum-config.js`

```js
supabaseUrl: "https://xxxxxxxx.supabase.co",
supabaseAnonKey: "eyJhbGciOi...",
```

That's it — reload `index.html`/`auth.html`/`app.html`. From here on:

- `auth.html` creates/signs in to a real account.
- **Pairing two accounts:**
  1. Partner A: **Us → Settings → Partner & pairing → Invite your partner**.
     This makes a private link; **Share invite link** opens the phone's
     share sheet (or copies the link), **Copy** copies it.
  2. Partner A sends it any way they like — a message, a chat, an email.
  3. Partner B opens the link. If they aren't signed in, they sign up or
     log in first; the invite is kept in that browser meanwhile.
  4. Partner B sees "*A* invited you to their Pairlum" and taps **Join our
     Pairlum**. Nothing is connected until they tap it.
  5. Partner A's screen updates on its own, and both now share one space.
- About the links: each one works **once**, for **48 hours** (change with
  `inviteValidHours: 1–168` in `pairlum-config.js`). Making a new link
  cancels the previous one; **Cancel invite** stops it immediately. The
  database stores only a fingerprint (hash) of each link, so a link can be
  shown again only on the device that made it — anywhere else, make a new
  one. Got a link but opened Pairlum another way? **Got an invite link from
  your partner?** on the same screen accepts a pasted link.
- If both partners tapped **Invite your partner** before either opened the
  other's link, that's fine: whoever joins steps out of their own empty
  space (it's kept, just no longer active).
- From then on, everything (Shared Day, Letters, I Need You, Our Story,
  Our DNA, photos, voice notes, etc.) syncs live between both partners'
  devices.

## 6. "Continue with Google" (optional)

`auth.html` already has the button; it stays disabled until you connect a
real Google OAuth client in two places:

**a) Google Cloud Console**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create (or pick) a project.
2. **APIs & Services → OAuth consent screen** → set it up (External, app name "Pairlum" or whatever you like).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (find `<your-project-ref>` in your Supabase project URL from step 4 above). Save, and copy the **Client ID** and **Client secret** it gives you.

**b) Supabase Dashboard**
1. **Authentication → Providers → Google** → toggle it on, paste the Client ID and Client secret from above, save.
2. **Authentication → URL Configuration → Redirect URLs** → add each site you open Pairlum from, with a `**` wildcard (section 7 explains why), e.g.:
   ```
   http://localhost:8743/**
   ```
   and later `https://your-domain/**` once you deploy. Without this, Supabase will refuse to send Google's response back to the page.

That's it — reload `auth.html` and "Continue with Google" will work for both signing up and logging in (it's the same button either way).

## 7. Email confirmation (optional)

By default, Supabase requires confirming a new account's email before it has
a session. `auth.html` already handles this (it tells you to check your
email instead of bouncing you into a half-signed-in state). If you'd rather
skip confirmation for quick testing: **Authentication → Providers → Email →
disable "Confirm email"**.

The confirmation link brings people back to `auth.html` on the site they
signed up from — **only if** that address is allowed. In **Authentication →
URL Configuration**:
- **Site URL**: your real site (while testing locally: `http://localhost:8743/auth.html`).
  Supabase's default here is `http://localhost:3000`, which is *not* where
  Pairlum runs — leaving it means confirmation links open a dead page.
- **Redirect URLs**: add each site you use with a `**` wildcard, e.g.
  `http://localhost:8743/**` and later `https://your-domain/**`. The wildcard
  matters: for a partner signing up from an invite, the confirmation link
  carries their invite (`auth.html?invite=…`), so it still works when the
  email is opened on a different phone or computer — an exact
  `…/auth.html` entry wouldn't match that.

## 8. Voice "understanding" (transcription + write-up)

The full service is already built: `supabase/understanding-schema.sql` (a
table) and `supabase/functions/pairlum-understand/index.ts` (the Edge
Function — transcribes with OpenAI Whisper, then extracts a title/feeling/
topics with GPT-4o-mini). You just need to deploy it.

**a) An OpenAI API key**
1. [platform.openai.com](https://platform.openai.com) → sign up → **Settings → Billing** → add a card (Whisper + GPT-4o-mini are both pay-per-use, no subscription).
2. **API keys** → **Create new secret key** → copy it (starts `sk-...`).

**b) Run the extra table**
Same as step 2 above: SQL Editor → paste `supabase/understanding-schema.sql` → Run.

**c) Install the Supabase CLI and deploy**
From this project's folder:
```
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy pairlum-understand
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:8743,https://pairlum.com,https://www.pairlum.com
```
(`login` opens a browser to approve; `link` connects this folder to your
actual project — the ref is the part of your project URL before
`.supabase.co`. `ALLOWED_ORIGINS` lists the sites allowed to call the
function from a browser; those three are also the default if it's unset.)

**d) Point the app at it**
In `pairlum-config.js`:
```js
understand: {
  url: "https://<your-project-ref>.supabase.co/functions/v1/pairlum-understand"
},
```
(`token` is optional now — app.js sends the signed-in user's real session
token automatically whenever a Supabase backend is connected, which is what
the function checks against each recording's space membership. `token` is
only used as a fallback if there's no real session, e.g. while testing
without `auth.html`.)

**e) Test it**
In the app: Settings → Privacy → turn on "Write up my recordings" → record a
voice note or an "I Need You" message → within ~30 seconds it should show a
title and a feeling chip under it. If it stays on "Pairlum is writing this
up," check the function's logs: **Supabase Dashboard → Edge Functions →
pairlum-understand → Logs**.

Costs: Whisper is ~$0.006/minute of audio, GPT-4o-mini's extraction call is
a fraction of a cent each — this is not expensive at prototype scale, but
it's real metered usage, so it's worth keeping an eye on your OpenAI billing
dashboard once real people are using it.

## What's still a stub

Two things need their own third-party account that only you can create —
they're left as clearly-labeled placeholders, not wired to real money/APIs:

- **Membership payments** — not connected yet. In real accounts the
  membership screen says plans open soon and nothing can be switched; plans
  live in the server-only `memberships` table. Wiring real charges means a
  Razorpay (or Stripe) account plus a server function that creates the
  order and a webhook that, once a payment is confirmed, writes the
  `memberships` row (one year, no auto-renewal) — the app already reads it
  and updates live. Ask when you're ready to build it.
- **Google Photos import** — needs a Google Cloud OAuth client ID in
  `pairlum-config.js`'s `googleClientId` (already set), with the **Google
  Photos Picker API** enabled for that Cloud project and your site listed
  under the client's **Authorized JavaScript origins** (e.g.
  `http://localhost:8743`). Until the ID is set, that button says so plainly
  instead of pretending to work.

Voice "understanding" (transcription/write-up) is no longer a stub — see
step 8 above, the code is fully built, it's just a deploy + OpenAI key away.

Live audio ("I Need You" live listening) *is* real here — it's genuine
peer-to-peer WebRTC, signaled through Supabase Realtime, using Google's free
public STUN server by default. STUN alone connects most home Wi-Fi, but many
mobile networks need a **TURN relay**: get one from a TURN provider and add
it as `iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls:
"turn:…", username: "…", credential: "…" }]` in `pairlum-config.js`.

## Deploying (Netlify)

Upload the project folder as-is — there's no build step. The `_headers` file
at the root is picked up by Netlify automatically and adds security headers
a page can't set for itself (no framing by other sites, HTTPS-only, camera
and microphone limited to Pairlum). After deploying, add the live address to
Supabase's Site URL and Redirect URLs (section 7) and to the Google OAuth
client's origins (section 6).
