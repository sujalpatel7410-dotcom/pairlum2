# Pairlum — Our World

Built from the supplied Pairlum 2 frontend. Entry point: dist/index.html.

## Delivered
- Original landing, account screens, First Chapter, Our World, Archive/Timeline, Together, Settings, pricing and legal routes.
- Text, photo, audio and video moments; microphone/camera recording where browser permissions allow.
- Memory viewer, author-only edit/delete, favorites, hide, chapters, Recently deleted.
- All five themes; reduced motion; keyboard and focus handling retained.
- Install manifest and icon fallbacks.
- Connected adapters for accounts, invitations, private media, realtime moments/signals/requests, letters, plans, export and account deletion.

## Current live mode
Device preview. One local preview account per browser; no cross-device sharing. A banner explains this. Do not use this preview for irreplaceable memories.

Database migration application was rejected by automatic approval review. No database changes were applied. The app is deliberately not connected to tables that do not exist.

## Prepared cloud activation
1. Obtain approval for supabase/pairlum2-private-world.sql on pairlum-temp-dev.
2. Apply that migration once. It adds frontend tables alongside tmp_pairlum_*; it does not migrate or remove older app data.
3. Review database security advisors and test permissions with two member accounts and one outsider.
4. Copy pairlum-config.example.js to dist/pairlum-config.js.
5. Configure Supabase Auth Site URL and allowed redirect URLs for the final site origin and auth.html. Verify email confirmation and password reset delivery. Google sign-in is not configured.
6. Republish and test the two-account journey, refresh, media uploads, signals and requests.

## Boundaries
- No payment provider or checkout backend is configured; pricing has exactly two plans and unconfirmed prices. No fake purchase or Book eligibility is granted. Physical Book eligibility remains one year on the eligible membership.
- Google Photos/iCloud import, advanced DNA, AI, Book printing/export, shipping and production notifications are not implemented.
- Future sealed letter bodies are protected by database access policy. Recipients see letters once released; there is no pre-release metadata-only inbox yet.
- The embedded official logo rasters in the supplied CSS are corrupt. The live app uses text branding and a simple initial icon pending original logo assets.
- Browser/device QA could not be performed in this environment. Inline JavaScript syntax and local links were checked. Adapter checks cover device auth, password hashing, account isolation, progress, themes, routing, analytics privacy, media validation and remote error propagation.
- Legal text retains unresolved business details from the supplied documents and needs founder review before public launch.

## Hosting
Static dist directory. Use a normal static host or the registered Site. No build dependency is needed. Cloud data security is enforced by Supabase policies after activation, not by browser guards.
