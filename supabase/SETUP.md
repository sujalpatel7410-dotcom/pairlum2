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
- The first time you land in `app.html` with no space yet, the Pairing
  screen (Settings → Pairing) offers **Start a new Pairlum** or **I have a
  code**. One partner starts, copies the 6-character code, and sends it to
  the other, who pastes it into **I have a code**.
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
2. **Authentication → URL Configuration → Redirect URLs** → add every origin+path you'll actually open `auth.html` from, e.g.:
   ```
   http://localhost:8743/auth.html
   ```
   and later your real domain's `/auth.html` once you deploy. Without this, Supabase will refuse to send Google's response back to the page.

That's it — reload `auth.html` and "Continue with Google" will work for both signing up and logging in (it's the same button either way).

## 7. Email confirmation (optional)

By default, Supabase requires confirming a new account's email before it has
a session. `auth.html` already handles this (it tells you to check your
email instead of bouncing you into a half-signed-in state). If you'd rather
skip confirmation for quick testing: **Authentication → Providers → Email →
disable "Confirm email"**.

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
npx supabase link --project-ref ytdzopedclxgwxjapnjc
npx supabase functions deploy pairlum-understand
npx supabase secrets set OPENAI_API_KEY=sk-...
```
(`login` opens a browser to approve; `link` connects this folder to your
actual project — the ref is the part of your project URL before
`.supabase.co`.)

**d) Point the app at it**
In `pairlum-config.js`:
```js
understand: {
  url: "https://ytdzopedclxgwxjapnjc.supabase.co/functions/v1/pairlum-understand"
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

- **Membership payments** — choosing a plan just records the choice (see
  `app.js`'s membership overlay, which already says "Preview only: nothing
  is charged"). Wiring a real charge means adding a Razorpay/Stripe account
  and a server-side webhook; ask if you want this built out.
- **Google Photos import** — needs a Google Cloud OAuth client ID in
  `pairlum-config.js`'s `googleClientId`. Until it's set, that button says
  so plainly instead of pretending to work.

Voice "understanding" (transcription/write-up) is no longer a stub — see
step 8 above, the code is fully built, it's just a deploy + OpenAI key away.

Live audio ("I Need You" live listening) *is* real here — it's genuine
peer-to-peer WebRTC, signaled through Supabase Realtime, using Google's free
public STUN servers by default (override via `PAIRLUM_CONFIG.iceServers` if
you need a TURN server for stricter networks).
