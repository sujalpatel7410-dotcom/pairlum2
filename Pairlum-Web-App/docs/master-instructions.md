PAIRLUM 2 — MASTER PROJECT INSTRUCTIONS

You are working on PAIRLUM 2, the fresh active build of Pairlum.

PAIRLUM 2 replaces previous experimental Pairlum builds as the current implementation workspace.

Use the files currently supplied in this project as the implementation base.

If an older document, prototype, comment, or file conflicts with the instructions below:

1. These Project Instructions win.
2. The latest supplied implementation wins over an older prototype.
3. Do not restore outdated Pairlum decisions.
4. Ask only when a genuinely critical product decision cannot be inferred.

---

1. WHAT PAIRLUM IS

Pairlum is a private relationship platform for two people.

It is not:

- a memory-storage app only
- a dating app
- a generic couple-chat app
- a social network
- a therapy replacement
- a productivity dashboard
- an AI companion
- another WhatsApp clone

Pairlum should feel like:

"This belongs to us."

The larger relationship lifecycle is:

Know → Act → Live → Remember → Know Deeper

---

2. INITIAL WEDGE

The immediate launch audience is:

Long-distance couples

Pairlum should solve the biggest software-solvable LDR problem:

The Shared Life Gap

Long-distance couples can message, call and video chat frequently while still feeling disconnected from each other's ordinary everyday lives.

The missing thing is not necessarily communication volume.

It is:

everyday presence.

PAIRLUM'S CORE PROMISE:

Make being apart feel less like being absent.

Pairlum must not pretend software can replace physical presence.

It should help both partners remain naturally embedded in each other's everyday lives.

---

3. CORE PRODUCT OBJECT — SHARED DAY

The central Pairlum experience should increasingly organize around:

Shared Day

A Shared Day brings together small ordinary moments from both partners.

Examples:

- morning photo
- commute
- food
- weather
- voice thought
- random observation
- something funny
- something difficult
- something they miss
- evening moment
- reassurance
- small life update

A Shared Day should make the couple feel:

"I was part of your day even though I wasn't physically there."

This should remain asynchronous-first.

Do not create response pressure.

---

4. CORE PRODUCT LOOP

Use this as the main product loop:

Shared Day
→ Presence
→ Emotional Support
→ Day Story
→ Parallel Memories
→ Reunion
→ Relationship History
→ Pairlum Book

Every major feature should strengthen this loop.

---

5. MOMENT = PRIMITIVE DATA OBJECT

The fundamental content object in Pairlum is:

Moment

A Moment may contain:

- photo
- short video
- voice
- text/thought
- date/time
- creator
- optional caption
- optional mood
- optional metadata

Do not unnecessarily create different storage concepts for every Pairlum experience.

Where practical:

- Shared Day
- Day Story
- Timeline
- Parallel Moments
- Chapters
- Archive
- Reunion stories
- Pairlum Book

should be richer views, groupings or relationships over Moments.

Keep this principle in mind when structuring frontend interfaces for future backend integration.

---

6. INTERACTION PHILOSOPHY

Pairlum should be:

- asynchronous-first
- low friction
- emotionally meaningful
- private
- calm
- easy to use daily
- low pressure
- visual-first

Important:

Do NOT optimize Pairlum for screen time.

Do not introduce:

- streak pressure
- addictive feeds
- infinite scrolling for engagement
- forced replies
- social metrics
- like counts
- follower systems
- public relationship performance

Success means:

the couple feels more present in each other's life.

Not:

they spend more minutes inside the app.

---

7. WHATSAPP / IMESSAGE POSITIONING

Pairlum should complement normal messaging apps.

Do NOT try to replace:

- WhatsApp
- iMessage
- Instagram DMs
- normal calling

Messaging apps handle conversation.

Pairlum handles:

- everyday presence
- tiny moments
- emotional support
- meaningful accumulation
- shared relationship history
- memories
- letters
- reunions
- long-term preservation

---

8. I NEED YOU

"I Need You" is an emotional-support system.

The response should come from the REAL PARTNER.

Possible formats:

- prerecorded voice
- prerecorded video
- text
- reassurance message

Situations may include:

- I miss you
- I can't sleep
- I'm overthinking
- hard day
- we argued
- I need reassurance
- something amazing happened
- I just need you

CRITICAL:

AI must NEVER impersonate the partner.

Pairlum may help organize or suggest prompts.

It must not generate fake messages pretending to be someone's boyfriend/girlfriend/partner.

---

9. PARALLEL MOMENTS

Parallel Moments combine ordinary Moments from both partners.

Example:

Partner A:
coffee before work

Partner B:
late-night train

Together:

one shared artifact representing the same day lived apart.

Parallel Moments should reinforce:

two separate lives creating one shared story.

Do not overcomplicate this for P0.

Preserve the concept for later deeper implementation.

---

10. RELATIONSHIP HISTORY / MOAT

Pairlum's long-term moat is:

the couple's accumulated relationship history

This includes:

- Moments
- Shared Days
- Day Stories
- Parallel Moments
- Timeline
- Chapters
- Letters
- Reunion history
- imported past memories
- Pairlum Book

The product should become more valuable as the relationship history grows.

---

11. PAIRLUM BOOK

The Pairlum Book is the physical extension of the couple's relationship history.

LOCKED RULE:

The physical Pairlum Book becomes available after the required:

1-year eligibility period on the eligible Book membership.

Do NOT unlock the Book based on:

- 50 memories
- upload count
- activity streak
- number of chapters
- engagement score

Real eligibility will eventually come from backend membership/subscription state.

Frontend-only builds must not pretend eligibility has been server-verified.

---

12. PAID STRUCTURE

Keep EXACTLY TWO paid membership structures:

1. Pairlum Digital Membership
2. Pairlum Membership + Physical Pairlum Book

Do NOT invent additional paid tiers.

Actual pricing remains testable.

Keep price values centralized/easy to change.

Do not restore old pricing figures as permanent rules.

---

13. FIRST CHAPTER

The free first experience is:

First Chapter

It is not framed as a generic "free trial."

The goal is for the couple to experience Pairlum before strong payment pressure.

Core First Chapter journey:

Create account
→ Create Our Space
→ Add relationship basics
→ Invite partner
→ Create first meaningful Moment
→ Experience the beginning of their shared world
→ Chapter Complete
→ understand what continuing Pairlum provides

The emotional feeling should be:

"We started something that belongs to us."

Not:

"Setup complete."

---

14. VISUAL DIRECTION

PAIRLUM must feel:

- intimate
- premium
- emotional
- editorial
- calm
- private
- visual-first
- understated
- modern
- memorable

It must NOT feel:

- generic SaaS
- admin dashboard
- dating app
- gaming interface
- AI product
- childish couple app
- overdecorated romance app

Use authentic couple imagery where appropriate.

Avoid cliché primary branding such as:

- hearts
- infinity symbols
- wedding rings
- hugging icons

Use the supplied official Pairlum logo assets.

Do NOT invent or redesign the Pairlum identity.

---

15. TYPOGRAPHY

Use the latest supplied Pairlum typography system as the implementation reference.

When older typography decisions conflict with the newest typography system:

newest typography system wins.

Maintain strong hierarchy, whitespace and editorial composition.

Do not create random page-specific font systems.

---

16. FIVE THEMES — LOCKED

KEEP ALL FIVE:

1. Soft & Warm
2. Calm & Minimal
3. Deep & Cinematic
4. Blush
5. Midnight

Soft & Warm is DEFAULT.

Do NOT remove Blush.

Do NOT remove Midnight.

All important UI should work properly in every theme.

Theme changes should affect the whole Pairlum world consistently rather than isolated components.

---

17. CURRENT MAIN EXPERIENCE

The main logged-in environment is:

Our World

Do NOT call it "Dashboard" in user-facing Pairlum copy.

Core areas include:

- Us Right Now
- The Window
- Shared Day / everyday presence
- Drop
- Signals
- Pulse
- For You
- Archive
- Together
- Us
- Timeline

It should feel like entering a private world shared by two people.

---

18. TIMELINE — LOCKED INTERACTION

The current Timeline interaction must be preserved.

Mobile

Normal tap:

→ Open/view memory.

Tap and hold:

→ subtle haptic when enabled
→ Pairlum action sheet.

Actions:

- Edit
- Add to Chapter
- Favorite
- Hide
- Delete

Long press must not accidentally activate during normal scrolling.

---

19. EDIT MEMORY — LOCKED

For a memory created by the current user:

Edit
→ existing content pre-filled
→ change permitted information
→ Save Changes
→ Timeline updates
→ show:

✓ Memory updated

Do not create a duplicate Moment.

Return the user approximately to the same Timeline position.

---

20. PARTNER MEMORY OWNERSHIP

A user must NOT rewrite the original content created by their partner.

Partner Moments may still allow appropriate shared archive actions such as:

- Add to Chapter
- Favorite
- Hide

Protect authorship and relationship-history authenticity.

---

21. DESKTOP TIMELINE

Desktop must not depend on long-press.

Provide a subtle:

•••

menu with the same permitted actions.

Support:

- mouse
- keyboard
- focus
- Escape
- focus restoration

---

22. PAIRLUM 2 CURRENT EXECUTION PRIORITY

Current priority:

COMPLETE P0 FRONTEND

Do not spend time expanding P1/P2 while P0 remains incomplete.

---

23. P0 INCLUDES

P0 includes launch-critical frontend work such as:

- official branding
- favicon
- remove Claude/prototype links
- remove demo data
- real new-user empty states
- landing routing
- Signup
- Login
- Forgot Password
- Reset Password
- auth frontend states
- First Chapter
- Create Our Space
- partner invite UX
- waiting state
- invalid/expired invite
- partner connected state
- onboarding → World
- first Moment
- memory save states
- Timeline viewer
- Timeline interactions
- edit/save
- delete confirmation
- desktop memory actions
- capture errors/loading
- First Chapter completion
- pricing
- exactly two paid plans
- correct Book eligibility
- upgrade/paywall UI
- checkout frontend states
- Settings cleanup
- logout
- delete-account path
- data-export path
- all five themes
- legal pages
- empty states
- error states
- loading states
- accessibility
- desktop responsiveness
- performance
- analytics hooks
- mobile/desktop QA

---

24. DO NOT EXPAND P1/P2 YET

Do not spend P0 time expanding:

- advanced Our DNA
- sophisticated bulk import/dedupe
- advanced Parallel Moments
- full cinematic Reunion system
- advanced voice letters
- advanced capsules
- complete Book designer
- PDF proofing engine
- Archive Box production system
- shipping system
- advanced AI

Preserve existing concepts but do not expand them unless explicitly asked.

---

25. BACKEND RULE FOR CURRENT PHASE

PAIRLUM 2 is currently being treated as a fresh frontend-first project.

Unless explicitly instructed otherwise:

DO NOT:

- connect Supabase
- connect an old Pairlum backend
- create database tables
- change database schema
- add API secrets
- configure production storage
- build payment backend
- introduce server infrastructure

Where backend functionality will eventually be needed:

- create clean interfaces/hooks
- show correct frontend states
- clearly report backend dependency
- do not fake server verification

---

26. DEMO DATA

Production-facing P0 should not automatically seed fictional couple content.

Remove/avoid automatic fake data such as:

- Alex
- Lisbon
- fake relationship dates
- fake reunions
- fake memories
- fake letters
- fake plans
- fake partner activity

A new couple should experience a genuine beginning.

---

27. EMPTY STATES

Empty Pairlum should still feel beautiful.

Use minimal emotional guidance.

Example direction:

Your story starts here.

Primary action:

Drop your first moment

Do not create generic SaaS empty-state boxes.

---

28. SETTINGS

P0 Settings should expose useful real controls.

Examples:

- profile
- five themes
- reduced motion
- sound
- haptics
- logout
- subscription/billing route
- data export
- account deletion
- Privacy
- Terms

Do not show controls that simply display fake success toasts.

If functionality requires backend support, expose an honest integration-ready frontend state.

---

29. PRIVACY

Pairlum is a private couple space.

Product principles include:

- no public profile by default
- no follower system
- no public like counts
- no sale of intimate/private couple data
- users retain ownership of their memories
- private memories should not be used for AI training according to Pairlum's approved policy
- AI must not impersonate a partner

Treat trust as core product infrastructure.

---

30. LEGAL

Use the supplied legal/privacy documents as the basis for legal frontend pages.

Do NOT invent:

- registered company name
- legal entity
- company address
- jurisdiction
- contact information

where these remain unresolved.

Keep explicit placeholders where the legal source still requires them.

---

31. ANALYTICS

Analytics must measure the relationship-product funnel without reading intimate content.

Useful P0 events include:

- signup_started
- signup_completed
- space_created
- invite_sent
- partner_joined
- first_memory_created
- first_chapter_completed
- pricing_viewed
- upgrade_clicked
- checkout_started
- purchase_completed

Never put:

- private memory text
- letters
- voice content
- intimate photos

into analytics events.

---

32. ACCESSIBILITY

Do not sacrifice usability for aesthetics.

Preserve/support:

- keyboard access
- visible focus
- semantic controls
- clear labels
- Escape handling
- modal focus management
- focus restoration
- reduced motion
- appropriate mobile touch targets
- readable contrast

---

33. DESKTOP

Mobile-first does NOT mean phone UI centered on desktop.

Desktop Pairlum should intentionally use available space while remaining emotionally simple.

Do not turn it into a multi-column SaaS dashboard.

---

34. PERFORMANCE

Keep Pairlum smooth on normal phones.

Be mindful of:

- large photography
- video
- lazy loading
- fonts
- Three.js
- animation
- unnecessary JavaScript
- unnecessary rerenders
- loading too much media at once

Emotional design must remain performant.

---

35. DEVELOPMENT METHOD

Before changing anything:

1. Inspect the existing implementation.
2. Reuse existing components/code.
3. Make the smallest safe change.
4. Preserve approved UI.
5. Preserve existing working functionality.
6. Do not rebuild unrelated features.
7. Do not invent requirements.
8. Test the changed flow.
9. Check mobile and desktop.
10. Check all five themes where relevant.
11. Check reduced motion.
12. Report what changed.

Do not give me code fragments that require manual assembly when you can update the project directly.

---

36. REGRESSION RULE

Never fix one Pairlum feature by breaking another.

Always preserve working:

- navigation
- five themes
- Timeline
- Window
- Signals
- Pulse
- Archive
- Together
- memory creation
- theme picker
- reduced motion
- accessibility

unless explicitly changing that specific system.

---

37. SOURCE CONTROL / FILE RULE

Always work from the latest files currently present in PAIRLUM 2.

Do not silently pull implementations from old Pairlum experiments.

Avoid creating many duplicate files such as:

- final-final
- new-final
- v2-final-2

Update the correct existing source wherever possible.

---

38. WHEN A TASK IS COMPLETE

Run whatever is available:

- build
- typecheck
- lint
- tests

Fix errors introduced by the change.

Report status using:

✅ COMPLETE

⚠️ FRONTEND READY — BACKEND REQUIRED

❌ INCOMPLETE

Never claim backend functionality works if only frontend UI exists.

---

39. CURRENT PRODUCT NORTH STAR

Every major decision should support this:

Pairlum makes being apart feel less like being absent.

And over time:

Two separate lives become one preserved relationship history.

The product should ultimately make a couple feel:

"You were part of my day."

then:

"Look at everything we've lived."

and eventually:

"This is our story."

That accumulated story leads naturally into the Pairlum Book.

---

FINAL RULE

Do not build Pairlum as a collection of features.

Build it as:

one private relationship world where two people remain present in each other's lives and preserve the life they build together.
