# Pairlum 2 — Frontend P0 handover

Status as of 27 September 2026. Frontend-first build: no backend, database, payments or cloud storage are connected.

## Files

| File | What it is |
|---|---|
| `index.html` | Landing page for couples, now built around the **existing Pairlum relationship palette** (the same wine/ivory family as the app's own five moods) used with depth across the scroll — no theme toggle any more: one continuous journey from **Warm Ivory** (`#F3E9E4`) → **Muted Blush** (`#E7B8BC`) → **Rose Wine** (`#AE1C40`, the main signature highlight) → **Deep Wine** (`#4A1226`, stronger CTAs and emotional emphasis) → **Dark Burgundy** (`#2A0F1C`) → a **softer neutral** for the Pairlum Book scene (`#F3D8D5`) → **Warm Charcoal** (`#151013`) to close on Shape Pairlum / Start Our Space. Implemented as one flat background colour per chapter (`--zonebg`, set by the existing chapter-tracking JS), not a smeared gradient, so text contrast never dips mid-section; ink flips from dark-on-light to a cream light-ink automatically per chapter (`body.on-dark`, driven by `data-dark` on the darker chapters). The hero keeps its own permanent dark wine→burgundy vignette regardless of scroll position (a deliberate cinematic cold-open), with a small amount of twinkling ivory dust/stars drifting in the atmosphere (brighter as "Welcome to Pairlum" fades in). A second, page-wide two-layer `.stars`/`.stars2` field (fixed, CSS-only, low-opacity, `mix-blend-mode:screen`, ~43 stars total on independent twinkle cycles for an organic feel) keeps that same twinkling-star atmosphere alive across the *entire* scroll, not just the hero — it reads clearly against the dark wine/burgundy chapters and stays intentionally subtle against the light ivory ones (Presence, Book) so text contrast is never affected. Its centrepiece is a dense, lit **sculptural particle heart** sampled directly on the classic implicit heart surface (deep wine base, muted rose undertones, a soft pearl highlight cluster where the light catches it — not a sparse dotted outline). It choreographs the whole hero: on load it starts as almost no particles and gathers itself into the heart slowly and ceremonially (~4.4s); once formed it sits almost still (very slow breathing scale, a touch of idle drift, no beat-like pulse, cursor only gives it a slight tilt/highlight shift/surface ripple); then as the visitor scrolls, the **camera dives through the heart's centre** — particles (wine "you" / muted-gold "them", the site's existing accent pairing) expand outward and rush past on every side as if you're entering it, fading away behind you into Presence/Shared Day. No gold/yellow or bright-pink sparkle, no glitter, no ring/orb/portal/numeral/landscape shapes. "You"/"them" accent pair (day-list dots, Shared Day, Parallel Moments, presence demos, history voice bars, rising hearts) is Rose Wine + the app's own Gold (`#B98A3E`) — the literal existing relationship colours, not new ones. The final "Start Our Space" section keeps a twinkling wine/gold two-star constellation behind the CTA. Cormorant Garamond display + Jost UI throughout. Settings is now just Sound + Quality (no Theme control). 7 scenes (Presence → Start Our Space); custom cursor. App screens keep the Bodoni typography system and five moods, unchanged. |
| `auth.html` | Sign up, log in, forgot password, reset password (`#signup` `#login` `#forgot` `#reset`) |
| `onboarding.html` | First Chapter: you → your person → your story → faces → Create Our Space → invite → first memory → Chapter Complete |
| `join.html` | Where the partner lands from an invite link (`join.html?code=PAIR-XXXXXX`) |
| `world.html` | Our World: World, Archive (Timeline), Together, Us |
| `settings.html` | Settings (`#profile` `#appearance` `#memories` `#privacy` `#membership` `#account`) |
| `pricing.html` | Membership: two paid plans, upgrade context, checkout states (`?plan=digital|book#checkout`) |
| `legal.html` | Privacy in plain words + D1–D8 (`#plain` `#privacy` `#terms` `#refund` `#founding-50` `#book-terms` `#cookies` `#acceptable-use` `#data`) |
| `dna.html` | Our DNA (P1, themed only) |
| `pairlum-core.css` | Five moods, type roles, controls, states, banners, capture form styles |
| `pairlum-core.js` | Shared core: mood/motion, auth adapter, space, invites, billing, media, analytics, pricing config, offline/error banners, dialogs, capture form |
| `assets/` | Official logo: `pairlum-monogram.png`, `pairlum-wordmark.png` (colour, transparent), mask versions, favicons |
| `tools/build_legal.py` | Regenerates `legal.html` from the Legal & Privacy Master .docx (publishes D1–D8 only) |

All files must stay in one folder with `assets/` beside them.

## Backend integration points

Every server call lives in `pairlum-core.js` and is marked `>>> INTEGRATION POINT`. In this build they reject with `{code:'backend_pending'}` and each screen shows an honest “not connected yet” state. Replace the function bodies; callers already await Promises.

| Function | Needed for |
|---|---|
| `PL.auth.signUp / signIn / signOut` | Real accounts (device preview accounts today) |
| `PL.auth.requestReset / resetPassword` | Password reset emails + reset tokens |
| `PL.space.create` | Couple Space on the server |
| `PL.invites.lookup / accept / partnerStatus` | Invite verification, joining, partner connected |
| `PL.billing.startCheckout / confirm / membership` | Checkout redirect, server-confirmed payment, membership + Book eligibility |
| `PL.media.upload` | Cloud photo storage (photos are kept in IndexedDB on this device today) |
| `PL.account.deleteAccount / serverExport` | Account deletion, full account export |
| `PL.analytics.setTransport(fn)` | Analytics vendor (events queue in memory until then) |

Moments stay the single content object: `{id, by, type, text, photo, date, mood, chapter?, fav?, hidden?}` where `photo` is a reference (`idb:…` today, a URL later).

## Pricing

Only in `PL.PRICING` (pairlum-core.js). Exactly two plans: `digital` and `book`. `amount:null` shows “Price announced before launch”.

## Analytics (privacy-safe)

`PL.track(event, props)` accepts only these events, only these props, and only short token values. No memory text, letters, photos or voice ever pass.

`signup_started{method}` · `signup_completed{method}` · `space_created{ldr}` · `invite_sent{channel}` · `partner_joined` · `first_memory_created{kind,source}` · `first_chapter_completed` · `pricing_viewed{source}` · `upgrade_clicked{source,plan}` · `checkout_started{plan}` · `purchase_completed{plan}` (only after server confirmation)

## Previewing states for QA / controlled testing

Add `?state=` to see a state without a backend (analytics are never sent from previews):

- auth: `signup-error`, `email-in-use`, `login-error`, `offline`, `forgot-sent`, `forgot-pending`, `reset-invalid`, `reset-success`
- onboarding: `story`, `invite`, `invite-waiting`, `invite-connected`, `memory`, `reveal`
- join: `checking`, `valid`, `accepting`, `connected`, `invalid`, `expired`, `already_connected`, `space_full`, `own`, `offline`, `pending`, `error`
- pricing checkout (`pricing.html?plan=book&state=…#checkout`): `checkout-loading`, `processing`, `success`, `failed`, `cancelled`, `pending`

## Known dependencies

- Logo: extracted from the official artwork as high-resolution transparent PNGs. Vector (SVG) originals from the designer would be sharper at very large sizes.
- Landing photography: no photos are used. Real candid photos or video (coffee, walks, airports, video-call aftermath) can be added to the Presence and History scenes.
- Pairlum Book viewer: see `BOOK_INTEGRATION.md`.
- Book plan price (currently `null`).
- Legal: D3 §1 and D4 still describe Founding 50 / Early 100 / ₹5,999 rather than the two locked plans; placeholders ([LEGAL NAME / ENTITY] etc.) and counsel review remain.
