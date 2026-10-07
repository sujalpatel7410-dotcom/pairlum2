/* ==========================================================================
   PAIRLUM — Home / Dashboard prototype
   All content data below is local demo data, held on a centralized SPACE
   state object. No backend calls exist or are pretended — every "shared"
   or "synced" state in this file is either genuinely computed on-device
   (timezones, distance, reunion countdown, localStorage persistence) or is
   clearly demo data kept as a fallback, per P0-CHANGES.md.
   ========================================================================== */
(function(){
  "use strict";

  // Everything this app stores is kept under these names. The one-year demo
  // gives its own prefix here, so its data, its tab-to-tab messages and its
  // media can never mix with (or delete) a real space on the same device.
  var NS = typeof window.PAIRLUM_STORAGE_NS === "string" ? window.PAIRLUM_STORAGE_NS : "";

  /* ------------------------------------------------------------------ */
  /* Demo content data — kept as fallback data, referenced from SPACE    */
  /* ------------------------------------------------------------------ */
  var MOMENTS = [
    { id:"m1", who:"a", type:"photo", photo:"coffee",  caption:"Morning coffee, same mug as always.", time:"10:12 AM · Ahmedabad", size:"hero" },
    { id:"m2", who:"b", type:"photo", photo:"desk",     caption:"Her desk, mid-afternoon light.",       time:"2:47 PM · Berlin",      size:"side" },
    { id:"m5", who:"a", type:"photo", photo:"call",     caption:"Set up the call ten minutes early again.", time:"8:52 PM · Ahmedabad", size:"side" },
    { id:"m3", who:"a", type:"text",  text:"train was late again but I got a seat by the window",       time:"9:05 AM · Ahmedabad",   size:"text" },
    { id:"m6", who:"b", type:"text",  text:"told the barista about you, she wants to meet you now too", time:"4:30 PM · Berlin",      size:"text" },
    { id:"m4", who:"b", type:"voice", caption:"Voice note",                                              time:"1:20 PM · Berlin",     size:"voice", dur:"0:18" }
  ];

  // Plain, feeling-first language — the user's actual thought is "I miss
  // her" or "I just want his voice," not a category name.
  var NEED_YOU = [
    { id:"n1", title:"Hear their voice" },
    { id:"n2", title:"Reassurance" },
    { id:"n3", title:"Stay with me" },
    { id:"n4", title:"Distract me" },
    { id:"n5", title:"Help me sleep" },
    { id:"n6", title:"Just wanted you to know" }
  ];

  var NOTES = [
    { who:"b", text:"saw this and thought of you" },
    { who:"a", text:"hope your meeting went okay" },
    { who:"b", text:"this song is very you" },
    { who:"a", text:"the cafe played our song again" },
    { who:"b", text:"found your handwriting in my old notebook" },
    { who:"a", text:"miss stealing your fries, not even sorry" }
  ];

  // "date" is a chapter's approximate start, used only to position it on the
  // Our Story timeline scrubber — it's never shown as text (the "meta" field
  // still carries the display label), so an approximate date can't mislead.
  // "note" is a short expansion shown when a chapter tile is tapped — a
  // little more of the story, not new facts about the couple.
  var CHAPTERS = [
    { title:"Where it started", meta:"Mar 2022 – Aug 2022", photo:"first-photo", date:"2022-03-12",
      note:"Same city, same group of friends, way too many excuses to end up at the same table." },
    { title:"Long distance begins", meta:"Feb 2024", photo:"desk", date:"2024-02-01",
      note:"Her visa came through two weeks before the flight. We didn't talk about the goodbye until the drive to the airport." },
    { title:"Our first reunion", meta:"Jun 2024", photo:"reunion", date:"2024-06-01",
      note:"Four months apart, then arrivals hall, then neither of us said anything for a good ten seconds." },
    { title:"Summer 2024", meta:"Jun – Aug 2024", photo:"sunset-two", date:"2024-07-01",
      note:"The one stretch where the time zones didn't matter, because we were standing in the same one." },
    { title:"The hard winter", meta:"Dec 2024 – Feb 2025", photo:"rain", date:"2025-01-01",
      note:"The season neither of us likes to talk about much. We got through it in small pieces, most days by phone." },
    { title:"Now", meta:"This year", photo:"bedroom", date:"2026-06-01",
      note:"Still two cities, still a countdown on the home screen, still worth every bit of it." }
  ];

  // "body" only ever gets shown for a letter that's actually unlocked (see
  // the letter-preview click handler) — a locked letter's body stays out of
  // the DOM entirely until its date, never hidden-but-present.
  var LETTERS = [
    { title:"Open on your birthday", state:"Opens 22 Jul", locked:true, from:"Mira", openDate:"2027-07-22" },
    { title:"For your first day at the new job", state:"Opened · 3 Mar", locked:false, from:"Mira",
      body:"You were pacing the kitchen at 6am Ahmedabad time, which meant it was the middle of the night for me and I still picked up. You're going to be so good at this. Call me the second it's over, whatever time it is here." },
    { title:"Read whenever you miss me most", state:"Unlocked anytime", locked:false, from:"Mira",
      body:"If you're reading this, it's probably one of those nights. Here's the thing I need you to remember: the distance is temporary and annoying, not a sign of anything. I'm not going anywhere. Text me even if it's just \"miss you,\" I'll always answer." },
    { title:"For the next hard winter", state:"Unlocked anytime", locked:false, from:"Mira",
      body:"We got through the last one by being stubborn together. If we're in another one now — same plan. Small pieces, most days by phone, no pretending it's easy. I love you on the easy days and the hard ones." },
    { title:"Our five-year letter", state:"Opens on our 5th anniversary", locked:true, from:"Mira", openDate:"2027-03-12" }
  ];

  var PHOTO_CLASSES = ["coffee","commute","desk","train","rain","sky","bedroom","call","airport","reunion","first-photo","sunset-two"];

  // Daily Question — Paired-style prompt the two of you answer separately,
  // then reveal together. "a" is Mira's demo answer; picked deterministically
  // by the day, so it still feels like "today's" question on every reload.
  // Every question has an id that never changes, and an answer is always saved
  // together with the exact question it answered (see saveDailyAnswer), so the
  // list can grow or be reworded later without changing what an old answer
  // was a reply to. New questions are added at the END; ids are never reused.
  var DAILY_QUESTIONS = [
    { id:"q01", q:"What's a small thing I did recently that made you smile?", a:"You texted me the weather in Ahmedabad before I even asked. Tiny, but it was the first thing I checked all day." },
    { id:"q02", q:"What are you looking forward to this week?", a:"Thursday's call — nothing scheduled after, so we can actually talk instead of rushing." },
    { id:"q03", q:"What's something about long distance you've gotten weirdly good at?", a:"Falling asleep on a video call without it feeling awkward." },
    { id:"q04", q:"If we were in the same city tonight, what would we do?", a:"Nothing exciting, honestly. Cook something, argue about the music, fall asleep on the couch." },
    { id:"q05", q:"What's a memory of us you've thought about recently?", a:"The airport goodbye in Feb 2024. Somehow it still gets me, in a good way." },
    { id:"q06", q:"What's one thing you need more of from me right now?", a:"Just more voice notes. I like hearing you more than reading you." },
    { id:"q07", q:"What's something you're proud of this week?", a:"I didn't check the time difference once before calling you today. Just called." },
    { id:"q08", q:"What made today easier than you expected?" },
    { id:"q09", q:"What's a sound from your day you wish I could have heard?" },
    { id:"q10", q:"What did you eat today, and was it any good?" },
    { id:"q11", q:"What's one thing you'd show me if I walked into your room right now?" },
    { id:"q12", q:"What's something small you're looking forward to tomorrow?" },
    { id:"q13", q:"Who made you laugh this week?" },
    { id:"q14", q:"What's the last thing that reminded you of me?" },
    { id:"q15", q:"What's a habit of mine you'd miss if it stopped?" },
    { id:"q16", q:"What would you like us to do on the first evening of the next reunion?" },
    { id:"q17", q:"What's one thing I could do from here that would feel like a hug?" },
    { id:"q18", q:"When did you last feel properly rested?" },
    { id:"q19", q:"What's taking up most of your head this week?" },
    { id:"q20", q:"What's a place near you that you want to take me to?" },
    { id:"q21", q:"What's something you've changed your mind about since we met?" },
    { id:"q22", q:"What do you want more of in the next month?" },
    { id:"q23", q:"What do you want less of in the next month?" },
    { id:"q24", q:"What's a tiny thing I do that makes the distance feel smaller?" },
    { id:"q25", q:"What's a call of ours you still think about?" },
    { id:"q26", q:"What's the best part of your morning routine?" },
    { id:"q27", q:"What's something you're quietly proud of?" },
    { id:"q28", q:"What's a film or show you want us to watch at the same time?" },
    { id:"q29", q:"What song has been in your head lately?" },
    { id:"q30", q:"What's a question you've been meaning to ask me?" },
    { id:"q31", q:"What would a perfect ordinary Sunday with me look like?" },
    { id:"q32", q:"What's something from your childhood you want me to know?" },
    { id:"q33", q:"What's the nicest thing a stranger did for you recently?" },
    { id:"q34", q:"What's harder for you right now than you're letting on?" },
    { id:"q35", q:"What's one thing we should do differently on calls?" },
    { id:"q36", q:"What do you miss that surprised you?" },
    { id:"q37", q:"What's a food you want to cook for me?" },
    { id:"q38", q:"What are you most grateful for this week?" },
    { id:"q39", q:"What's the last photo you took and didn't send me?" },
    { id:"q40", q:"What's something you're nervous about that I can cheer you on for?" },
    { id:"q41", q:"Where do you see us waking up five years from now?" },
    { id:"q42", q:"What's a tradition you'd like us to start?" },
    { id:"q43", q:"What's a small luxury you'd like to share with me?" },
    { id:"q44", q:"What do your friends or family ask about us?" },
    { id:"q45", q:"What's a moment this month when you wished I was beside you?" },
    { id:"q46", q:"What's the best compliment you've had lately?" },
    { id:"q47", q:"What's something you learned this week?" },
    { id:"q48", q:"How do you like to be comforted when you can't be held?" },
    { id:"q49", q:"What's a goodbye of ours that you remember well?" },
    { id:"q50", q:"What's one thing on our someday list you'd do first?" },
    { id:"q51", q:"What do you want me to know before I fall asleep tonight?" },
    { id:"q52", q:"What's the weather like where you are, really?" },
    { id:"q53", q:"What made you feel loved this week?" },
    { id:"q54", q:"What's a part of your day I never get to see?" },
    { id:"q55", q:"What's something silly you want to do together?" },
    { id:"q56", q:"What would you write on a postcard to me today?" },
    { id:"q57", q:"What's a memory of us that always makes you smile?" },
    { id:"q58", q:"What are you tired of pretending is fine?" },
    { id:"q59", q:"What's one promise you'd like us to keep this year?" },
    { id:"q60", q:"What's the first thing you'll say at arrivals?" }
  ];
  function questionById(id){ return DAILY_QUESTIONS.filter(function(x){ return x.id === id; })[0] || null; }
  // The question for a shared day. In order of trust: the question saved with
  // that day's answers; a question the two of you swapped to; otherwise the
  // library's turn for that day (a full pass through the library before any
  // question comes round again).
  function questionForDay(day){ return questionForDayIn(typeof DB !== "undefined" ? DB : null, day); }
  function questionForDayIn(db, day){
    var rec = (db && db.dq && db.dq[day]) || null;
    if(rec && rec._q && rec._q.text) return { id: rec._q.id, q: rec._q.text };
    var picked = (db && db.dqPick && db.dqPick[day]) ? questionById(db.dqPick[day]) : null;
    if(picked) return picked;
    var n = DAILY_QUESTIONS.length, step = 7;
    while(n % step === 0) step += 2;
    return DAILY_QUESTIONS[(Number(day) * step) % n];
  }
  function pickDailyQuestion(){ return questionForDay(sharedDay()); }

  /* ------------------------------------------------------------------ */
  /* Centralized couple-space state model.                               */
  /* Everything the UI needs about "who this couple is" lives here, not  */
  /* scattered through markup. Demo data above is attached as a fallback */
  /* under SPACE.moments / SPACE.needYou / etc. — swap those for an API  */
  /* response and the render functions below need no other changes.     */
  /* ------------------------------------------------------------------ */
  var SETTINGS_KEY = NS + "pairlum-space-settings-v1";

  function defaultSpace(){
    return {
      spaceId: "sp_demo_001",
      currentUser: { id:"u_aarav", name:"Aarav", initial:"A", city:"Ahmedabad", timezone:"Asia/Kolkata", lat:23.0225, lon:72.5714, birthday:"1997-07-22" },
      partner:     { id:"u_mira",  name:"Mira",  initial:"M", city:"Berlin",    timezone:"Europe/Berlin", lat:52.5200, lon:13.4050, birthday:"1999-11-03" },
      relationshipStart: "2022-03-12",
      reunionDate: "2026-11-10",
      totalSharedMoments: 612, // demo aggregate — in production this is a backend count, not derived from local MOMENTS.length
      pairing: {
        status: "joined",        // not_started | invite_sent | waiting | expired | joined
        inviteCode: null,
        inviteSentAt: null,
        joinedAt: "2022-03-12T00:00:00Z"
      },
      // this demo space represents an already-established couple, so it
      // starts true; a fresh space (after Create Our Space) starts false
      // and only flips true when the Import Memories flow actually finishes.
      hasImportedPast: true,
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00",
        nonUrgent: true
      },
      sound: true,
      petals: true, // soft petals drifting behind the page
      tapFeedback: true, // a ring, a tiny vibration and a soft sound on every tap
      motionLevel: null, // "full" | "calm"; null = chosen automatically for the device
      reducedMotionOverride: null, // null = follow OS; "on" / "off" = explicit user choice
      simulateOffline: false,
      // Which kinds of news reach you, and how. "I Need You" is never optional.
      notif: {
        banners: true,      // the small message at the bottom of the screen
        device: false,      // a notification from this device while Pairlum is in the background
        previews: true,     // show the words themselves in a device notification
        types: { notes:true, moments:true, hearts:true, letters:true, memories:true, plans:true, reunion:true, sleep:true, ambient:true, games:true, dates:true, us:true }
      },
      // How Pairlum looks and reads for you, on this device.
      custom: {
        textSize: "md",     // sm | md | lg
        density: "roomy",   // roomy | compact
        clock: "12",        // 12 | 24
        distance: "km",     // km | mi
        nick: "",           // what you call your partner
        homeHidden: [],     // Home cards you switched off
        homeOrder: { today: [], more: [] }
      },
      perf: { photoQuality: "balanced" }, // high | balanced | saver
      privacy: {
        mediaPermissions: {
          partnerCanSaveOriginals: false,
          partnerCanDownloadVideo: true
        }
      },
      devices: [
        { id:"dev_this",  name:"This device",              lastActive:"Active now",    current:true },
        { id:"dev_mac",   name:"Chrome on MacBook Air",     lastActive:"3 days ago",    current:false },
        { id:"dev_ipad",  name:"Pairlum on iPad",           lastActive:"2 weeks ago",   current:false }
      ]
    };
  }

  /* Settings are private to one person on one device, so each partner has
     their own copy (the key ends in their id). Whether the two of you are
     connected is not a private setting: it is kept apart, once, for the space. */
  var PAIRING_KEY = NS + "pairlum-pairing-v1";
  function userSettingsKey(){ return SETTINGS_KEY + "-" + ME; }
  function readJsonKey(k){ try{ var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; }catch(e){ return null; } }
  function loadPersistedSettings(){
    var mine = readJsonKey(userSettingsKey()), pairing = readJsonKey(PAIRING_KEY);
    var legacy = (!mine || !pairing) ? readJsonKey(SETTINGS_KEY) : null; // builds before settings were split
    if(!mine && legacy){
      mine = JSON.parse(JSON.stringify(legacy)); delete mine.pairing;
      // the old shared copy held one nickname for both people; it was typed on the first partner's side
      if(ME !== "u_aarav" && mine.custom) mine.custom.nick = "";
    }
    if(!pairing && legacy && legacy.pairing) pairing = legacy.pairing;
    var out = mine && typeof mine === "object" ? mine : {};
    if(pairing && typeof pairing === "object") out.pairing = pairing;
    return out;
  }

  var settingsFailedAt = 0;
  function saveSpaceSettings(){
    var persisted = {
      hasImportedPast: SPACE.hasImportedPast,
      quietHours: SPACE.quietHours,
      sound: SPACE.sound,
      petals: SPACE.petals,
      tapFeedback: SPACE.tapFeedback,
      motionLevel: SPACE.motionLevel,
      reducedMotionOverride: SPACE.reducedMotionOverride,
      simulateOffline: SPACE.simulateOffline,
      notif: SPACE.notif,
      custom: SPACE.custom,
      perf: SPACE.perf,
      privacy: SPACE.privacy,
      devices: SPACE.devices
    };
    try{
      localStorage.setItem(userSettingsKey(), JSON.stringify(persisted));
      localStorage.setItem(PAIRING_KEY, JSON.stringify(SPACE.pairing));
      return true;
    }catch(e){
      // Say so: a setting that looks changed but is gone after a reload is worse than an error.
      if(Date.now() - settingsFailedAt > 4000){
        settingsFailedAt = Date.now();
        try{ showToast("That setting could not be saved on this device, so it will not last after you close Pairlum.", true); }catch(err){}
      }
      return false;
    }
  }

  function shallowMerge(base, patch){
    if(!patch) return base;
    Object.keys(patch).forEach(function(k){
      if(patch[k] && typeof patch[k] === "object" && !Array.isArray(patch[k]) && base[k] && typeof base[k] === "object"){
        base[k] = shallowMerge(base[k], patch[k]);
      } else {
        base[k] = patch[k];
      }
    });
    return base;
  }

  var NOTES_KEY = NS + "pairlum-notes-sent-v1"; // legacy per-device key, only cleared on delete
  function addSentNote(text){
    markFirst("thinking");
    return mutate(function(db){
      db.notes.unshift({ id: uid("note"), by: ME, text: text, at: Date.now() }); // every note is kept; screens show the newest
    });
  }

  var NEED_REQUESTS_KEY = NS + "pairlum-need-requests-v1";
  function saveSentRequests(){
    return mutate(function(db){
      SPACE.sentRequests.forEach(function(r){
        r.by = ME;
        var found = db.requests.filter(function(x){ return x.id === r.id; })[0];
        if(!found){ db.requests.push(r); return; }
        found.status = r.status;
      });
    });
  }

  // Letters a person actually writes in this prototype — kept separately
  // from the LETTERS demo fallback above so a real letter persists across
  // reloads the same way a captured moment or a sent request does.
  var LETTERS_KEY = NS + "pairlum-letters-written-v1"; // legacy per-device key, only cleared on delete

  /* ================================================================== */
  /* TWO PARTNERS, ONE SHARED SPACE                                      */
  /* Everything either partner creates lives in one shared record, each  */
  /* item tagged with who made it ("by"). In this build the shared       */
  /* record is kept in the browser and synced live between tabs, so two  */
  /* tabs behave like two phones. readShared / writeShared / the         */
  /* "storage" listener are the only three places a real server          */
  /* (Supabase) has to replace — nothing else in the app changes.        */
  /* ================================================================== */
  var ME_KEY = NS + "pairlum-me-v1";
  var SHARED_KEY = NS + "pairlum-shared-space-v1";
  function resolveMe(){
    var m = null;
    try{
      var q = /[?&]as=([a-z_]+)/i.exec(window.location.search);
      if(q) m = /mira/i.test(q[1]) ? "u_mira" : "u_aarav";
    }catch(e){}
    try{ if(m) sessionStorage.setItem(ME_KEY, m); else m = sessionStorage.getItem(ME_KEY); }catch(e){}
    return m === "u_mira" ? "u_mira" : "u_aarav";
  }
  var ME = resolveMe();
  var THEM = ME === "u_aarav" ? "u_mira" : "u_aarav";
  // A key that is private to one person. Older builds kept one copy for the
  // whole browser; the first partner's copy is carried over once.
  function privateKey(base){
    var k = NS + base + "-" + ME;
    if(ME === "u_aarav"){
      try{ if(localStorage.getItem(k) === null){ var old = localStorage.getItem(NS + base); if(old !== null) localStorage.setItem(k, old); } }catch(e){}
    }
    return k;
  }
  function rel(by){ return by === ME ? "a" : "b"; } // "a" = you, "b" = your partner, on whichever phone this is
  function demoBy(who){ return who === "a" ? "u_aarav" : "u_mira"; }
  /* One shared calendar day for both partners, whatever their time zones.
     The space has ONE time zone that decides when its day turns over (kept in
     the shared record as spaceTz, so both phones agree). Today's question,
     how today feels, the garden, Shared Day's "today", Day Story and the day a
     sealed letter opens all use this same day. Each thing you share still
     keeps its own exact time and the city it was shared from. */
  var SPACE_TZ_DEFAULT = "Asia/Kolkata";
  function spaceTz(){
    var tz = (typeof DB !== "undefined" && DB && DB.spaceTz) || SPACE_TZ_DEFAULT;
    try{ new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; }catch(e){ return SPACE_TZ_DEFAULT; }
  }
  function tzParts(ts, tz){
    var o = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle:"h23", year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"numeric", second:"numeric" })
      .formatToParts(new Date(ts)).forEach(function(x){ o[x.type] = Number(x.value); });
    return o;
  }
  // minutes that zone is ahead of UTC at that moment
  function tzOffsetAt(ts, tz){
    var q = tzParts(ts, tz);
    return Math.round((Date.UTC(q.year, q.month - 1, q.day, q.hour % 24, q.minute, q.second) - Math.floor(ts / 1000) * 1000) / 60000);
  }
  // The day number (days since 1970) of a moment, on the space's calendar.
  function sharedDay(ts){
    var q = tzParts(ts === undefined ? Date.now() : ts, spaceTz());
    return String(Math.round(Date.UTC(q.year, q.month - 1, q.day) / 86400000));
  }
  // The exact moment a space day (by number, or "YYYY-MM-DD") begins.
  function spaceDayStart(day){
    var utcMid = typeof day === "string" && day.indexOf("-") > 0
      ? Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
      : Number(day === undefined ? sharedDay() : day) * 86400000;
    var guess = utcMid - tzOffsetAt(utcMid, spaceTz()) * 60000;
    return utcMid - tzOffsetAt(guess, spaceTz()) * 60000;       // second pass settles daylight-saving edges
  }
  function spaceDayIso(ts){ var q = tzParts(ts === undefined ? Date.now() : ts, spaceTz()); return q.year + "-" + (q.month < 10 ? "0" : "") + q.month + "-" + (q.day < 10 ? "0" : "") + q.day; }

  function seedShared(){
    return {
      v: 1,
      moments: MOMENTS.map(function(m){
        var o = {}; Object.keys(m).forEach(function(k){ if(k !== "who") o[k] = m[k]; });
        o.by = demoBy(m.who); o.demo = true; return o;
      }),
      notes: NOTES.map(function(n, i){ return { id:"nd"+i, by:demoBy(n.who), text:n.text, demo:true }; }),
      letters: LETTERS.map(function(l, i){
        var o = {}; Object.keys(l).forEach(function(k){ o[k] = l[k]; });
        o.id = "ld"+i; o.by = "u_mira"; o.demo = true; return o;
      }),
      someday: [
        { id:"sd1", by:"u_mira",  text:"Christmas markets in Berlin, together", done:false },
        { id:"sd2", by:"u_aarav", text:"Cook a full Gujarati thali for two", done:false },
        { id:"sd3", by:"u_mira",  text:"A whole week in the same time zone", done:true }
      ],
      chapters: seedChapters(),
      requests: [], dates: [], feel: {}, hearts: {}, dq: {}
    };
  }
  function seedChapters(){
    return CHAPTERS.map(function(ch, i){
      var o = {}; Object.keys(ch).forEach(function(k){ o[k] = ch[k]; });
      delete o.meta; // date labels are worked out from the chapter dates
      o.id = "chd"+i; o.demo = true; return o;
    });
  }
  function monthYear(iso){
    var p = String(iso).split("-");
    return new Intl.DateTimeFormat("en-US", { month:"short", year:"numeric" }).format(new Date(Number(p[0]), Number(p[1])-1, 1));
  }
  var SHARED_ARRAYS = ["moments","notes","letters","someday","requests","dates","memories","plans","replies"];
  var SHARED_OBJECTS = ["feel","hearts","dq","ambient","prefs","sleep","facts","days","hold","profiles","dna","comfort","dqPick","reacts","understood"];
  /* What is in storage is one of three things: nothing yet (a new space),
     a record this version understands, or something it cannot safely read.
     The third is never overwritten: Pairlum stops and offers recovery. */
  function inspectStored(raw){
    if(raw === null || raw === undefined) return { fresh: true };
    var db = null;
    try{ db = JSON.parse(raw); }catch(e){ return { damage: "unreadable" }; }
    if(!db || typeof db !== "object" || Array.isArray(db)) return { damage: "unreadable" };
    if(db.v !== 1) return { damage: "version", v: db.v };
    var bad = [];
    SHARED_ARRAYS.concat(["chapters","liveLog","ops","mediaGens"]).forEach(function(k){ if(db[k] !== undefined && db[k] !== null && !Array.isArray(db[k])) bad.push(k); });
    SHARED_OBJECTS.concat(["quiz","stats","profileAt"]).forEach(function(k){ if(db[k] !== undefined && db[k] !== null && (typeof db[k] !== "object" || Array.isArray(db[k]))) bad.push(k); });
    SHARED_ARRAYS.forEach(function(k){ if(Array.isArray(db[k]) && db[k].some(function(x){ return !x || typeof x !== "object" || Array.isArray(x); })) bad.push(k); });
    if(bad.length) return { damage: "shape", fields: bad };
    return { db: db };
  }
  function fillSharedDefaults(db){
    if(!Array.isArray(db.chapters)) db.chapters = seedChapters(); // spaces created before chapters were editable
    SHARED_ARRAYS.forEach(function(k){ if(!Array.isArray(db[k])) db[k] = []; });
    if(!db.quiz || typeof db.quiz !== "object") db.quiz = { round: 0, answers: {} };
    if(!db.quiz.answers) db.quiz.answers = {};
    if(db.reunion === undefined) db.reunion = { date: defaultSpace().reunionDate, place: "" }; // null = no date set
    SHARED_OBJECTS.forEach(function(k){ if(!db[k] || typeof db[k] !== "object") db[k] = {}; });
    if(!Array.isArray(db.liveLog)) db.liveLog = [];
    if(!Array.isArray(db.ops)) db.ops = [];             // ids of recent changes, so a lost one can be noticed
    if(!Array.isArray(db.mediaGens)) db.mediaGens = []; // media sets written by a restore, newest first
    // Membership covers the shared space, so it lives in the shared record.
    if(db.membership === undefined) db.membership = { plan: "digital", since: "2026-03-12", demo: true };
    return db;
  }
  var RECOVERY = null; // set when the stored space could not be read; nothing is written while it is set
  function readShared(){
    var raw = null;
    try{ raw = localStorage.getItem(SHARED_KEY); }catch(e){}
    var r = inspectStored(raw);
    if(r.damage){
      if(!RECOVERY) RECOVERY = { reason: r.damage, v: r.v, fields: r.fields || [], raw: raw };
      return fillSharedDefaults(seedShared()); // a stand-in for the screen only; it is never saved
    }
    var db = r.db;
    if(r.fresh){
      db = seedShared();
      try{ localStorage.setItem(SHARED_KEY, JSON.stringify(db)); }catch(e){}
    }
    return fillSharedDefaults(db);
  }
  function writeShared(){
    if(RECOVERY) return false;
    try{ localStorage.setItem(SHARED_KEY, JSON.stringify(DB)); return true; }
    catch(e){ return false; }
  }
  // Every change goes through here: re-read the latest shared record first,
  // so two partners acting in the same second never overwrite each other.
  // What counts as being here with each other: the things you share, send and answer.
  // Changing a setting or a profile field does not grow the garden.
  function connectionMark(db){
    return [db.moments.length, db.notes.length, db.letters.length, db.requests.length, db.memories.length, db.plans.length, db.someday.length, db.replies.length, JSON.stringify(db.reacts)]
      .join("|") + JSON.stringify([db.dq, db.feel, db.hearts, db.quiz, db.hold, db.ambient, db.sleep, db.comfort || null, db.someday.map(function(x){ return x.done ? 1 : 0; }).join("")]);
  }
  var saveFailedAt = 0;
  function noteSaveFailure(){
    saveFailedAt = Date.now();
    try{ showToast("Couldn't save. This device is out of space, so nothing was changed.", true); }catch(e){}
  }
  /* THE ONE PLACE THE SHARED RECORD CHANGES.
     1. Paused rule. While the two of you are not connected, nothing in the
        shared record may be added, edited, replaced or removed. The check
        compares the whole record, not the length of a few lists. The only
        exceptions pass opts.evenIfPaused and are listed here:
          - deleting your own account
          - your own privacy switches (live requests, who may save your media)
          - closing a live-sound log entry that was already running
     2. Lost updates. Each change gets an id that is stored with the record.
        If another tab saves an older copy over it, this tab notices its id
        is missing and applies the change again (see replayLostOps). Two
        changes made at the same moment therefore both survive. A real
        server must do this with record versions; this is the local stand-in.
     Returns true only when the change is in storage (or nothing changed). */
  var RECENT_OPS = [];
  var OPS_KEEP = 300, OPS_REPLAY_MS = 60000;
  function mutate(fn, opts){
    opts = opts || {};
    if(RECOVERY){
      try{ showToast("Nothing can be changed until this space is recovered.", true); }catch(e){}
      return false;
    }
    var opId = opts._replayId || uid("op");
    DB = readShared();
    // Test seam only: lets a test hand this tab an older copy, as if the other
    // tab had saved in the instant between this tab's read and write.
    if(window.__pairlumTestStaleRead){
      try{ DB = fillSharedDefaults(JSON.parse(window.__pairlumTestStaleRead)); }catch(e){}
      window.__pairlumTestStaleRead = null;
    }
    if(DB.ops.indexOf(opId) > -1) return true; // already applied
    var beforeAll = JSON.stringify(DB), before = connectionMark(DB);
    fn(DB);
    var changedAny = JSON.stringify(DB) !== beforeAll;
    if(!changedAny) return true;
    var changedShared = connectionMark(DB) !== before;
    if(!opts.evenIfPaused && typeof SPACE !== "undefined" && SPACE.pairing && SPACE.pairing.status !== "joined"){
      DB = readShared();
      rebuildFromShared();
      saveFailedAt = Date.now();
      try{ showToast("Your space is paused, so nothing was added or changed. Reconnect to share again.", true); }catch(e){}
      return false;
    }
    if(changedShared){
      var dayKey = sharedDay();
      if(!DB.days[dayKey]) DB.days[dayKey] = {};
      DB.days[dayKey][ME] = true;
    }
    DB.ops.push(opId);
    if(DB.ops.length > OPS_KEEP) DB.ops = DB.ops.slice(-OPS_KEEP);
    DB.rev = (DB.rev || 0) + 1;
    var ok = writeShared();
    if(!ok){
      // Nothing was written. Go back to what is really stored, so the screen
      // never shows something that would be gone after a reload.
      DB = readShared();
      noteSaveFailure();
    } else if(!opts._replayId){
      RECENT_OPS.push({ id: opId, fn: fn, evenIfPaused: !!opts.evenIfPaused, at: Date.now(), epoch: DB.epoch || 0 });
      if(RECENT_OPS.length > 40) RECENT_OPS.shift();
    }
    rebuildFromShared();
    if(typeof renderWaiting === "function" && document.getElementById("waitingList")){ renderWaiting(); renderGarden(); }
    return ok;
  }
  // Called when another tab has saved. Any change this tab committed in the
  // last minute that is missing from what is now stored was overwritten by an
  // older copy: apply it again, once.
  function replayLostOps(){
    var now = Date.now(), epoch = DB.epoch || 0, redone = 0;
    RECENT_OPS = RECENT_OPS.filter(function(op){ return now - op.at < OPS_REPLAY_MS && op.epoch === epoch; }); // a restore starts a new epoch
    RECENT_OPS.slice().forEach(function(op){
      if(DB.ops.indexOf(op.id) > -1) return;
      if(mutate(op.fn, { evenIfPaused: op.evenIfPaused, _replayId: op.id })) redone++;
    });
    return redone;
  }
  function rebuildFromShared(){
    applyProfiles();
    // the running total of shared moments, when the space carries one
    if(DB.stats && DB.stats.totalMoments > 0) SPACE.totalSharedMoments = DB.stats.totalMoments;
    SPACE.moments = DB.moments.map(function(m){
      var o = {}; Object.keys(m).forEach(function(k){ o[k] = m[k]; });
      o.who = rel(m.by); return o;
    });
    SPACE.notes = DB.notes.map(function(n){ return { who:rel(n.by), text:n.text }; });
    SPACE.letters = DB.letters.map(function(l){
      var o = {}; Object.keys(l).forEach(function(k){ o[k] = l[k]; });
      // Re-check each dated letter against today, so a sealed letter opens once its date arrives.
      if(o.openDate){
        var d = new Date(o.openDate + "T00:00:00");
        if(!isNaN(d.getTime())){
          o.locked = spaceDayStart(o.openDate) > Date.now();
          if(!o.demo){
            var label = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short" }).format(d);
            o.state = o.locked ? "Opens " + label : "Opened · " + label;
          }
        }
      }
      return o;
    });
    SPACE.sentRequests = DB.requests.filter(function(r){ return r.by === ME; });
    SPACE.customDates = DB.dates;
    SPACE.reunionDate = DB.reunion && reunionParse(DB.reunion.date) ? DB.reunion.date : null;
    SPACE.reunionPlace = (DB.reunion && DB.reunion.place) || "";
    // Chapters in date order. A chapter runs from its start date until the
    // next chapter begins, and its date label is worked out from that.
    var sorted = DB.chapters.slice().sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    SPACE.chapters = sorted.map(function(ch, i){
      var o = {}; Object.keys(ch).forEach(function(k){ o[k] = ch[k]; });
      if(!o.meta){
        var nxt = sorted[i+1];
        o.meta = !nxt ? "Since " + monthYear(o.date)
          : monthYear(o.date) === monthYear(nxt.date) ? monthYear(o.date)
          : monthYear(o.date) + " – " + monthYear(nxt.date);
      }
      return o;
    });
  }

  var SPACE = shallowMerge(defaultSpace(), loadPersistedSettings());
  if(ME === "u_mira"){ var swapUser = SPACE.currentUser; SPACE.currentUser = SPACE.partner; SPACE.partner = swapUser; }
  SPACE.needYou = NEED_YOU;
  var DB = readShared();
  rebuildFromShared();
  SPACE.dailyQuestion = pickDailyQuestion();

  /* -------------------------------------------------------------- */
  /* Daily Question — the person's own answer persists per calendar   */
  /* day; the partner's side stays demo data, same honesty line the   */
  /* rest of this file draws (see DAILY_QUESTIONS above).             */
  /* -------------------------------------------------------------- */
  var DAILY_ANSWER_KEY = NS + "pairlum-daily-answer-v1";
  function todayKey(){ var d = new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  function loadDailyAnswer(){
    var day = DB.dq[sharedDay()];
    return (day && day[ME]) || "";
  }
  // What you are still typing is a private draft on this device. It becomes
  // your answer (and visible to your partner) only when you press the button.
  var DQ_DRAFT_KEY = NS + "pairlum-dq-draft-v1-" + ME;
  function loadDqDraft(){ var d = readJsonKey(DQ_DRAFT_KEY); return d && String(d.day) === String(sharedDay()) && typeof d.text === "string" ? d.text : null; }
  function saveDqDraft(text){ try{ localStorage.setItem(DQ_DRAFT_KEY, JSON.stringify({ day: sharedDay(), text: text })); return true; }catch(e){ return false; } }
  function clearDqDraft(){ try{ localStorage.removeItem(DQ_DRAFT_KEY); }catch(e){} }
  // Returns "saved", "changed" (the question was swapped while you wrote) or "failed".
  function saveDailyAnswer(text, shownQuestion){
    var q = shownQuestion || questionForDay(sharedDay()), result = "saved";
    var ok = mutate(function(db){
      var k = sharedDay(), rec = db.dq[k];
      // Never attach an answer to wording the writer was not looking at. If
      // the day already carries a question (your partner answered under it)
      // and it is not the one you saw, nothing is saved. If nobody has
      // answered yet, your answer and the wording you saw are saved together,
      // even if the question was swapped in the same instant.
      if(rec && rec._q && rec._q.text && rec._q.text !== q.q){ result = "changed"; return; }
      if(!db.dq[k]) db.dq[k] = {};
      // the question travels with its answers, word for word
      if(!db.dq[k]._q) db.dq[k]._q = { id: q.id || "", text: q.q };
      if(String(text).trim()) db.dq[k][ME] = text; else delete db.dq[k][ME];
      if(!db.dq[k][ME] && !db.dq[k][THEM]) delete db.dq[k];
    });
    return !ok ? "failed" : result;
  }
  // Swap today's question for another one. Only while neither of you has
  // answered, and it changes for both of you.
  function canSwapQuestion(){ var d = DB.dq[sharedDay()] || {}; return !d[ME] && !d[THEM]; }
  function swapDailyQuestion(){
    if(!canSwapQuestion()) return false;
    var day = sharedDay(), cur = questionForDay(day), recent = {};
    // nothing the two of you were asked in the last 30 days
    for(var i = 1; i <= 30; i++){ var q = questionForDay(String(Number(day) - i)); if(q && q.id) recent[q.id] = 1; }
    var pool = DAILY_QUESTIONS.filter(function(x){ return x.id !== cur.id && !recent[x.id]; });
    if(!pool.length) pool = DAILY_QUESTIONS.filter(function(x){ return x.id !== cur.id; });
    var at = Math.max(0, DAILY_QUESTIONS.indexOf(questionById(cur.id) || DAILY_QUESTIONS[0]));
    var next = pool.filter(function(x){ return DAILY_QUESTIONS.indexOf(x) > at; })[0] || pool[0];
    var swapped = false;
    var ok = mutate(function(db){
      // checked again against what is actually stored at the moment of saving
      var d = db.dq[day] || {};
      if(d[ME] || d[THEM]) return;
      db.dqPick = {}; db.dqPick[day] = next.id;
      swapped = true;
    });
    SPACE.dailyQuestion = pickDailyQuestion();
    return ok && swapped;
  }
  // Every day the two of you answered, newest first, each with its own question.
  function answeredDays(){
    return Object.keys(DB.dq).filter(function(k){ var d = DB.dq[k] || {}; return d[ME] || d[THEM]; })
      .sort(function(x, y){ return Number(y) - Number(x); })
      .map(function(k){ var d = DB.dq[k]; return { day:k, q: questionForDay(k).q, you: d[ME] || "", them: d[THEM] || "" }; });
  }
  function refreshDqPartner(){
    var day = DB.dq[sharedDay()];
    var theirs = day && day[THEM];
    var node = document.getElementById("dqAnswerPartner");
    if(!node) return;
    // One rule everywhere: their answer is not put on the page, even on the
    // turned-away side of the card, until yours is saved.
    var mine = day && day[ME];
    node.textContent = !mine ? "Shown once you have answered."
      : theirs || (SPACE.partner.name + " hasn't answered yet. It'll appear here the moment they do.");
    node.classList.toggle("is-waiting", !mine || !theirs);
  }

  /* ------------------------------------------------------------------ */
  /* Important Dates — anniversary + both birthdays (computed from real  */
  /* SPACE fields, not separately stored) plus any date the person adds  */
  /* themselves (real localStorage state, like a written letter). Each   */
  /* one recurs every year; "date" below is always the NEXT occurrence,  */
  /* recomputed on load, never a stored one that could drift out of date.*/
  /* ------------------------------------------------------------------ */
  var IMPORTANT_DATES_KEY = NS + "pairlum-important-dates-v1";
  var DATE_REMINDER_DISMISSED_KEY = privateKey("pairlum-date-reminder-dismissed-v1");
  var UPCOMING_REMINDER_WINDOW_DAYS = 14;

  function ordinal(n){
    var s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v-20) % 10] || s[v] || s[0]);
  }

  // Next time month/day (1-indexed month) lands on or after today.
  function nextOccurrence(month, day){
    var today = new Date(); today.setHours(0,0,0,0);
    var year = today.getFullYear();
    var d = new Date(year, month-1, day); d.setHours(0,0,0,0);
    if(d.getTime() < today.getTime()) d = new Date(year+1, month-1, day);
    return d;
  }

  function getImportantDates(){
    var list = [];

    var start = new Date(SPACE.relationshipStart + "T00:00:00");
    var annivNext = nextOccurrence(start.getMonth()+1, start.getDate());
    list.push({
      id:"anniversary", emoji:"🎉", title:"Your anniversary", removable:false, date:annivNext,
      sub: ordinal(annivNext.getFullYear() - start.getFullYear()) + " anniversary"
    });

    if(SPACE.partner.birthday){
      var pb = new Date(SPACE.partner.birthday + "T00:00:00");
      var pbNext = nextOccurrence(pb.getMonth()+1, pb.getDate());
      list.push({
        id:"birthday-partner", emoji:"🎂", title:SPACE.partner.name + "'s birthday", removable:false, date:pbNext,
        sub: "Turns " + (pbNext.getFullYear() - pb.getFullYear())
      });
    }
    if(SPACE.currentUser.birthday){
      var cb = new Date(SPACE.currentUser.birthday + "T00:00:00");
      var cbNext = nextOccurrence(cb.getMonth()+1, cb.getDate());
      list.push({
        id:"birthday-you", emoji:"🎂", title:"Your birthday", removable:false, date:cbNext,
        sub: "Turns " + (cbNext.getFullYear() - cb.getFullYear())
      });
    }

    SPACE.customDates.forEach(function(d){
      list.push({
        id:d.id, emoji:"📌", title:d.title, removable:true,
        date: nextOccurrence(d.month, d.day), sub:"Every year"
      });
    });

    list.sort(function(a,b){ return a.date - b.date; });
    return list;
  }

  function toRad(d){ return d * Math.PI / 180; }
  function haversineKm(lat1, lon1, lat2, lon2){
    var R = 6371;
    var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  function distanceKm(){
    // Calculated only from the city coordinates each partner entered when
    // setting up their space — never live GPS.
    var a = SPACE.currentUser, b = SPACE.partner;
    if(typeof a.lat !== "number" || typeof a.lon !== "number" || typeof b.lat !== "number" || typeof b.lon !== "number") return null;
    return Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon));
  }
  // "5,929 km" or "3,684 mi" — or nothing, when a city isn't one Pairlum can place.
  function distanceText(){
    var km = distanceKm();
    if(km === null) return "";
    var miles = SPACE.custom && SPACE.custom.distance === "mi";
    return Math.round(miles ? km * 0.621371 : km).toLocaleString("en-US") + (miles ? " mi" : " km");
  }

  function daysBetween(fromDate, toDate){
    var ms = toDate.setHours(0,0,0,0) - fromDate.setHours(0,0,0,0);
    return Math.round(ms / 86400000);
  }
  // Shared by Important Dates and locked Letters — one small-countdown voice
  // for "how long until" anywhere in the app.
  function countdownLabel(days){
    return days<=0 ? "Today!" : days===1 ? "Tomorrow" : "in "+days+"d";
  }

  /* ------------------------------------------------------------------ */
  /* IndexedDB — real persistence for captured photo/video/voice Blobs.  */
  /* localStorage only ever holds small JSON metadata; the actual media  */
  /* bytes live here, so a captured-offline moment survives a reload     */
  /* with its real content, not a random placeholder.                    */
  /* ------------------------------------------------------------------ */
  var IDB_NAME = NS + "pairlum-media-v1", IDB_STORE = "media";
  function withMediaDB(cb){
    if(!("indexedDB" in window)){ cb(new Error("no indexedDB")); return; }
    var req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = function(){ req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = function(){ cb(null, req.result); };
    req.onerror = function(){ cb(req.error || new Error("indexedDB open failed")); };
  }
  /* A restore writes its media as a new "generation" under fresh keys
     ("<gen>:<id>") and only then points the saved record at it. Until that
     last step succeeds, every photo, video and recording already on the
     device is exactly where it was. Reads look in the newest generation
     first, then older ones, then the plain id. */
  function mediaGens(){ return (typeof DB !== "undefined" && DB && Array.isArray(DB.mediaGens)) ? DB.mediaGens : []; }
  function mediaKeys(id){ return mediaGens().map(function(g){ return g + ":" + id; }).concat([id]); }
  function mediaWriteKey(id){ var g = mediaGens()[0]; return g ? g + ":" + id : id; }
  function idbPutMedia(id, blob, cb){
    withMediaDB(function(err, db){
      if(err){ if(cb) cb(err); return; }
      try{
        if(window.__pairlumTestFailMediaPut && window.__pairlumTestFailMediaPut(id)) throw new Error("test: media write refused");
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(blob, mediaWriteKey(id));
        tx.oncomplete = function(){ if(cb) cb(null); };
        tx.onerror = tx.onabort = function(){ if(cb) cb(tx.error || new Error("save failed")); };
      }catch(e){ if(cb) cb(e); }
    });
  }
  // All-or-nothing write of many files under explicit keys (used by restore).
  function idbPutMany(entries, cb){
    withMediaDB(function(err, db){
      if(err){ cb(err); return; }
      try{
        var tx = db.transaction(IDB_STORE, "readwrite"), store = tx.objectStore(IDB_STORE), done = false;
        var fail = function(e){ if(done) return; done = true; try{ tx.abort(); }catch(x){} cb(e || tx.error || new Error("save failed")); };
        tx.oncomplete = function(){ if(done) return; done = true; cb(null); };
        tx.onerror = tx.onabort = function(){ fail(tx.error); };
        entries.forEach(function(en, i){
          if(done) return;
          if(window.__pairlumTestFailMediaPut && window.__pairlumTestFailMediaPut(en.key, i)){ fail(new Error("test: media write refused")); return; }
          store.put(en.blob, en.key);
        });
      }catch(e){ cb(e); }
    });
  }
  function idbDeleteKeys(keys, cb){
    withMediaDB(function(err, db){
      if(err){ if(cb) cb(err); return; }
      try{
        var tx = db.transaction(IDB_STORE, "readwrite"), store = tx.objectStore(IDB_STORE);
        keys.forEach(function(k){ store.delete(k); });
        tx.oncomplete = function(){ if(cb) cb(null); };
        tx.onerror = tx.onabort = function(){ if(cb) cb(tx.error || new Error("delete failed")); };
      }catch(e){ if(cb) cb(e); }
    });
  }
  function idbAllKeys(cb){
    withMediaDB(function(err, db){
      if(err) return cb(err, []);
      try{
        var req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).getAllKeys();
        req.onsuccess = function(){ cb(null, (req.result || []).map(String)); };
        req.onerror = function(){ cb(req.error, []); };
      }catch(e){ cb(e, []); }
    });
  }
  function idbGetMedia(id, cb){
    var demoUrl = window.PAIRLUM_DEMO_MEDIA && window.PAIRLUM_DEMO_MEDIA[id];
    if(demoUrl && window.fetch){
      fetch(demoUrl).then(function(r){ return r.blob(); }).then(function(b){ cb(null, b); }, function(e){ cb(e); });
      return;
    }
    withMediaDB(function(err, db){
      if(err) return cb(err);
      try{
        var store = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE), keys = mediaKeys(id), i = 0;
        var step = function(){
          if(i >= keys.length) return cb(null, null);
          var req = store.get(keys[i++]);
          req.onsuccess = function(){ if(req.result) cb(null, req.result); else step(); };
          req.onerror = function(){ cb(req.error); };
        };
        step();
      }catch(e){ cb(e); }
    });
  }
  // Removes a file everywhere it may sit. cb(err) reports a clean-up that did not happen.
  function idbDeleteMedia(id, cb){
    idbDeleteKeys(mediaKeys(id), function(err){
      if(err) noteCleanupFailure(id);
      if(cb) cb(err);
    });
  }
  // A file that should have been removed but could not be is remembered, and
  // removal is tried again the next time Pairlum opens.
  var CLEANUP_KEY = NS + "pairlum-media-cleanup-v1";
  function noteCleanupFailure(id){
    try{ var l = readJsonKey(CLEANUP_KEY) || []; if(l.indexOf(id) < 0) l.push(id); localStorage.setItem(CLEANUP_KEY, JSON.stringify(l.slice(-500))); }catch(e){}
  }
  function retryMediaCleanup(){
    var l = readJsonKey(CLEANUP_KEY) || [];
    if(!l.length) return;
    try{ localStorage.removeItem(CLEANUP_KEY); }catch(e){}
    var stillUsed = {};
    DB.moments.concat(DB.memories, DB.requests).forEach(function(x){ stillUsed[x.id] = 1; });
    l.forEach(function(id){ if(!stillUsed[id]) idbDeleteMedia(id); });
  }
  // Used by Delete Account — wipes every captured media Blob, not just one.
  function idbClearAll(cb){
    withMediaDB(function(err, db){
      if(err){ if(cb) cb(); return; }
      try{
        var req = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).clear();
        req.onsuccess = function(){ if(cb) cb(); };
        req.onerror = function(){ if(cb) cb(); };
      }catch(e){ if(cb) cb(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  function el(tag, cls, html){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(html !== undefined) n.innerHTML = html;
    return n;
  }
  function scrim(){ var d = el("div","moment-scrim"); return d; }
  function photoLayer(name){ return el("div","photo photo--"+name); }
  function whoDot(who){ return '<span class="who-dot who-dot--'+who+'"></span>'; }
  function isOffline(){ return SPACE.simulateOffline || (typeof navigator !== "undefined" && navigator.onLine === false); }
  function uid(prefix){ return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function isPaired(){ return SPACE.pairing.status === "joined"; }
  // Any user-typed text that lands in innerHTML (captions, notes) must be
  // escaped first — Pairlum will eventually store private user content, so
  // this is treated as a real security requirement, not a nice-to-have.
  var ESCAPE_MAP = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
  function escapeHtml(str){
    return String(str == null ? "" : str).replace(/[&<>"']/g, function(c){ return ESCAPE_MAP[c]; });
  }

  /* ------------------------------------------------------------------ */
  /* Centralized state → static markup bindings (replaces hardcoded      */
  /* couple data that used to live directly in app.html)                 */
  /* ------------------------------------------------------------------ */
  function setText(id, text){ var n = document.getElementById(id); if(n) n.textContent = text; }

  function renderSpaceBindings(){
    var cu = SPACE.currentUser, p = SPACE.partner;

    setText("brandCities", cu.city + " ⟷ " + p.city);
    setText("avatarA", cu.initial);
    setText("avatarB", p.initial);
    setText("presenceAvatarA", cu.initial);
    setText("presenceAvatarB", p.initial);
    setText("presenceNameB", p.name);
    setText("presenceLocA", cu.city);
    setText("presenceLocB", p.city);
    setText("presenceDistance", distanceText() ? distanceText() + " apart" : "Two cities apart");
    setText("cityALabel", cu.city);
    setText("cityBLabel", p.city);
    setText("needPrimaryAvatar", p.initial);
    setText("thinkingQuickLabel", "Thinking of " + p.name);
    renderComfort();
    setText("needSecondaryLabel", "Need " + p.name + "? Just say so.");
    setText("needRequestPartnerName", p.name);
    setText("captureFooterPartner", p.name);
    setText("letterFooterPartner", p.name);
    setText("usCoupleNames", cu.name + " & " + p.name);

    var startDate = new Date(SPACE.relationshipStart);
    var startLabel = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long", year:"numeric" }).format(startDate);
    setText("usProfileMeta", cu.city + " · " + p.city + " · together since " + startLabel);

    var years = (Date.now() - startDate.getTime()) / (365.25*86400000);
    setText("statYears", String(Math.floor(years)));
    setText("statMoments", SPACE.totalSharedMoments.toLocaleString("en-US"));

    // Reunion — known to the day, or only to the month, or only to the year.
    var upcomingBlock = document.querySelector(".upcoming");
    var ru = reunionParse(SPACE.reunionDate);
    var reunionEdit = document.getElementById("reunionEditBtn");
    if(reunionEdit) reunionEdit.textContent = ru ? "Change this" : "Set when";
    var where = SPACE.reunionPlace ? "together in " + SPACE.reunionPlace : "in the same city again";
    setText("reunionLine", !ru ? "No date yet for when you're in the same city again."
      : ru.precision === "day" ? "Until you're " + where + "."
      : ru.precision === "month" ? "Sometime in " + ru.label + ", you'll be " + where + "."
      : "Sometime in " + ru.label + ", you'll be " + where + ".");
    var ringHint = document.querySelector(".reunion-ring-hint");
    if(ringHint) ringHint.textContent = !ru ? "Not set" : ru.precision === "day" ? "Tap for the date" : "Day not fixed yet";
    var reunionCountEl = document.getElementById("reunionCount");
    var statEl = document.getElementById("statReunionDays");
    var statLabel = statEl ? statEl.nextElementSibling : null;
    var c = reunionCount(ru);
    if(reunionCountEl){
      reunionCountEl.innerHTML = escapeHtml(c.big) + (c.unit ? "<sup>" + escapeHtml(c.unit) + "</sup>" : "");
      reunionCountEl.classList.toggle("is-wide", c.big.length >= 4); // a year or "This" needs a smaller size to sit inside the ring
    }
    if(statEl) statEl.textContent = c.statBig || c.big;
    if(statLabel) statLabel.textContent = c.statLabel;
    if(!ru){
      var emptyDetail = document.getElementById("reunionDetail");
      if(emptyDetail) emptyDetail.hidden = true;
    }
    if(upcomingBlock) upcomingBlock.hidden = false;
    renderReunionRing(ru ? Math.max(0, daysBetween(new Date(), new Date(ru.start.getTime()))) : REUNION_RING_CYCLE_DAYS);

    var pairingChev = document.getElementById("pairingChev");
    if(pairingChev){
      var labels = { not_started:"Not started →", invite_sent:"Invite sent →", waiting:"Waiting →", expired:"Expired →", left:"Paused →", joined:"Connected →" };
      pairingChev.textContent = labels[SPACE.pairing.status] || "→";
    }

    renderStoryPayoff(startDate, years);
  }

  /* Our Story payoff line — a real-data narrative stat, not a fabricated  */
  /* number. Uses the couple's actual moment count and time together.     */
  function renderStoryPayoff(startDate, years){
    var el = document.getElementById("storyPayoffLine");
    if(!el) return;

    var momentCount = SPACE.totalSharedMoments;
    var momentLabel = momentCount.toLocaleString("en-US") + (momentCount === 1 ? " moment" : " moments");

    var durationLabel;
    if(years >= 1){
      var wholeYears = Math.floor(years);
      durationLabel = wholeYears + (wholeYears === 1 ? " year" : " years") + " together";
    } else {
      var months = Math.max(1, Math.round((Date.now() - startDate.getTime()) / (30*86400000)));
      durationLabel = months + (months === 1 ? " month" : " months") + " together";
    }

    el.textContent = momentLabel + " · " + durationLabel + " · still going.";
  }

  /* ------------------------------------------------------------------ */
  /* Upcoming — interactive reunion ring.                                */
  /* The fill is a decorative "getting closer" visual (not a tracked     */
  /* cycle — see the CYCLE_DAYS comment below); tapping the ring reveals  */
  /* the exact date, which IS real, straight from SPACE.reunionDate.     */
  /* ------------------------------------------------------------------ */
  var REUNION_RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52, matches the SVG circle radius
  var REUNION_RING_CYCLE_DAYS = 120; // purely a visual pace-setter for the fill, not a real cadence

  function renderReunionRing(daysLeft){
    var progress = document.getElementById("reunionRingProgress");
    if(!progress) return;
    var percent = Math.max(0, Math.min(1, 1 - (daysLeft / REUNION_RING_CYCLE_DAYS)));
    var offset = REUNION_RING_CIRCUMFERENCE * (1 - percent);
    progress.style.strokeDasharray = REUNION_RING_CIRCUMFERENCE.toFixed(1);
    progress.style.strokeDashoffset = offset.toFixed(1);

    var detail = document.getElementById("reunionDetail");
    var ruDetail = reunionParse(SPACE.reunionDate);
    if(detail && ruDetail) detail.textContent = ruDetail.label;
  }

  function wireReunionRing(){
    var ring = document.getElementById("reunionRing");
    var detail = document.getElementById("reunionDetail");
    if(!ring || !detail) return;
    ring.addEventListener("click", function(){
      var open = detail.hidden;
      detail.hidden = !open;
      ring.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Shared Day render                                                   */
  /* ------------------------------------------------------------------ */
  // A nudge on each photo moment toward a voice note instead of a quick tap —
  // saying how you feel out loud carries more than an emoji would. Opens the
  // same real capture flow as the + button, just pre-set to "voice".
  /* ---- Hearts — you heart what your partner shared; on your own moments
     you see when your partner loved them. Both sides are real. ---- */
  var HEARTS_KEY = NS + "pairlum-moment-hearts-v1"; // legacy per-device key, only cleared on delete
  var HEART_SVG = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 20.5s-7.2-4.4-9.6-8.7C.6 8.4 2.6 4.5 6.4 4.5c2.1 0 3.6 1.2 4.6 2.7 1-1.5 2.5-2.7 4.6-2.7 3.8 0 5.8 3.9 4 7.3-2.4 4.3-7.6 8.7-7.6 8.7z"/></svg>';
  function heartInner(id, who){
    var h = DB.hearts[id] || {};
    if(who === "b"){
      var on = !!h[ME];
      return '<button type="button" class="moment-heart'+(on?' is-on':'')+'" data-heart-id="'+escapeHtml(id)+'" aria-pressed="'+(on?'true':'false')+'" aria-label="Love this moment">'+HEART_SVG+'</button>';
    }
    return h[THEM] ? '<span class="moment-loved">'+HEART_SVG+escapeHtml(SPACE.partner.name)+' loved this</span>' : '';
  }
  function heartSlotHtml(m){
    if(!m.id) return "";
    return '<span data-heart-slot="'+escapeHtml(m.id)+'" data-heart-who="'+(m.who==="b"?"b":"a")+'">'+heartInner(m.id, m.who)+'</span>';
  }
  function refreshHearts(){
    document.querySelectorAll("[data-heart-slot]").forEach(function(slot){
      slot.innerHTML = heartInner(slot.getAttribute("data-heart-slot"), slot.getAttribute("data-heart-who"));
    });
  }

  var MIC_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  /* One small bar on every moment: the voice it carries, how many answers it
     has, and the way in. Tapping it opens the moment with its thread. */
  function repliesTo(id){ return DB.replies.filter(function(r){ return r.to === id; }).sort(function(x, y){ return (x.at || 0) - (y.at || 0); }); }
  function momentById(id){ return DB.moments.filter(function(m){ return m.id === id; })[0] || null; }
  function momentBarInner(id){
    var m = momentById(id), n = repliesTo(id).length, bits = [];
    if(m && m.voice) bits.push(MIC_SVG + '<span>' + escapeHtml(comfortClock(m.voice.secs || 0)) + '</span>');
    bits.push('<span>' + (n ? n + (n === 1 ? " reply" : " replies") : (m && m.by === ME ? "Open" : "Reply with your voice")) + '</span>');
    var label = (m && m.voice ? "Has a voice note. " : "") + (n ? n + (n === 1 ? " reply. " : " replies. ") : "") + "Open this moment";
    return '<button type="button" class="moment-voice-cta moment-bar'+(m && m.voice ? ' has-voice' : '')+'" data-open-moment="'+escapeHtml(id)+'" aria-label="'+escapeHtml(label)+'">' + bits.join('<i aria-hidden="true">·</i>') + '</button>';
  }
  function momentBarHtml(id){ return id ? '<span class="moment-bar-slot" data-moment-bar="'+escapeHtml(id)+'">'+momentBarInner(id)+'</span>' : ""; }
  function refreshMomentBars(){
    document.querySelectorAll("[data-moment-bar]").forEach(function(slot){
      var id = slot.getAttribute("data-moment-bar");
      slot.innerHTML = momentById(id) ? momentBarInner(id) : "";
    });
  }
  function voiceCtaHtml(m){ return momentBarHtml(m && m.id); }

  function renderSharedDay(){
    var grid = document.getElementById("sharedDayGrid");
    grid.innerHTML = "";

    SPACE.moments.filter(function(m){ return m.demo; }).forEach(function(m){
      var card;
      if(m.type === "photo" && m.size === "hero"){
        card = el("article","moment-card sd-hero");
        card.appendChild(photoLayer(m.photo));
        card.appendChild(scrim());
        card.insertAdjacentHTML("beforeend", heartSlotHtml(m));
        var meta = el("div","moment-meta");
        meta.innerHTML =
          '<span class="moment-tag">'+whoDot(m.who)+(m.who==="a"?"You":escapeHtml(SPACE.partner.name))+'</span>'+
          '<p class="moment-caption">'+escapeHtml(m.caption)+'</p>'+
          '<span class="moment-time">'+escapeHtml(m.time)+'</span>'+
          voiceCtaHtml(m);
        card.appendChild(meta);
        grid.appendChild(card);
      } else if(m.type === "photo" && m.size === "side"){
        var side = document.querySelector(".sd-side") || el("div","sd-side");
        side.className = "sd-side";
        card = el("article","moment-card small");
        card.appendChild(photoLayer(m.photo));
        card.appendChild(scrim());
        card.insertAdjacentHTML("beforeend", heartSlotHtml(m));
        var meta2 = el("div","moment-meta");
        meta2.innerHTML =
          '<span class="moment-tag">'+whoDot(m.who)+(m.who==="a"?"You":escapeHtml(SPACE.partner.name))+'</span>'+
          '<p class="moment-caption">'+escapeHtml(m.caption)+'</p>'+
          '<span class="moment-time">'+escapeHtml(m.time)+'</span>'+
          voiceCtaHtml(m);
        card.appendChild(meta2);
        side.appendChild(card);
        if(!side.parentNode) grid.appendChild(side);
      } else if(m.type === "text"){
        var side3 = document.querySelector(".sd-side") || el("div","sd-side");
        side3.className = "sd-side";
        var t = el("div","moment-text");
        t.innerHTML = '<p>"'+escapeHtml(m.text)+'"</p><span class="moment-time">'+whoDot(m.who)+' '+escapeHtml(m.time)+'</span>'+momentBarHtml(m.id)+heartSlotHtml(m);
        side3.appendChild(t);
        if(!side3.parentNode) grid.appendChild(side3);
      } else if(m.type === "voice"){
        var strip = el("div","sd-strip voice-moment");
        strip.innerHTML =
          '<button class="voice-play" type="button" aria-label="Play voice message" data-voice-play>'+
            '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'+
          '</button>'+
          '<div class="waveform" data-waveform aria-hidden="true"></div>'+
          '<div class="voice-meta"><span class="body-s" style="color:rgba(255,255,255,.7)">'+(m.who==="a"?"You":escapeHtml(SPACE.partner.name))+' · '+escapeHtml(m.dur)+'</span><span class="moment-time">'+escapeHtml(m.time)+'</span></div>';
        strip.insertAdjacentHTML("beforeend", momentBarHtml(m.id));
        grid.appendChild(strip);
        buildWaveform(strip.querySelector("[data-waveform]"), 34);
        if(MEDIA_URLS[m.id]) wireRealVoicePlay(strip.querySelector("[data-voice-play]"), strip.querySelector("[data-waveform]"), new Audio(MEDIA_URLS[m.id]));
        else wireVoicePlay(strip.querySelector("[data-voice-play]"), strip.querySelector("[data-waveform]"));
      }
    });

    syncMomentsDom();
    renderQueuedCards();
  }

  // Moments either partner has shared today (beyond the demo set). Adds
  // only the ones not on screen yet, so it is safe to call on every sync.
  function momentTimeLabel(m){
    var author = m.by === ME ? SPACE.currentUser : SPACE.partner;
    return formatTimeInZone(new Date(m.at || Date.now()), author.timezone) + " · " + author.city;
  }
  function syncMomentsDom(){
    var grid = document.getElementById("sharedDayGrid");
    if(!grid) return;
    var startMs = spaceDayStart();
    // yesterday's cards leave when the shared day turns over
    grid.querySelectorAll("[data-moment-id]").forEach(function(n){
      var id = n.getAttribute("data-moment-id"), m = DB.moments.filter(function(x){ return x.id === id; })[0];
      if(m && (m.at || 0) < startMs && n.parentNode) n.parentNode.removeChild(n);
    });
    DB.moments.filter(function(m){ return !m.demo && (m.at || 0) >= startMs; })
      .sort(function(x, y){ return (x.at||0) - (y.at||0); })
      .forEach(function(m){
        var exists = false;
        grid.querySelectorAll("[data-moment-id]").forEach(function(n){ if(n.getAttribute("data-moment-id") === m.id) exists = true; });
        if(exists) return;
        var refs = prependMoment(m.type, m.caption, null, m.id, { who: rel(m.by), timeLabel: momentTimeLabel(m), noBadge: true });
        if(!refs || !m.hasMedia) return;
        idbGetMedia(m.id, function(err, blob){
          if(err || !blob) return;
          hydrateCardMedia(refs.card, m.type, URL.createObjectURL(blob));
        });
      });
  }
  // Called once a captured moment has actually been sent — this is the
  // point it becomes visible on your partner's phone.
  // Returns true only when the moment is in the stored shared record.
  // Sending the same moment twice (a retry) never makes a second copy.
  function shareMoment(item){
    var ok = mutate(function(db){
      if(db.moments.some(function(m){ return m.id === item.id; })) return;
      var rec = { id:item.id, by:ME, type:item.type, caption:item.caption, hasMedia:!!item.hasMedia, at:item.createdAt || Date.now(), parallel:!!item.parallel };
      if(item.secs){ rec.secs = item.secs; if(item.type === "voice") rec.dur = comfortClock(item.secs); }
      if(item.voice && item.voice.id) rec.voice = { id: item.voice.id, secs: item.voice.secs || 1 };
      db.moments.push(rec);
    });
    if(ok) understandMomentRecordings(item.id);
    if(ok && item.parallel) renderParallel();
    return ok && DB.moments.some(function(m){ return m.id === item.id; });
  }

  function wireMomentReactions(){
    var grid = document.getElementById("sharedDayGrid");
    if(!grid) return;
    grid.addEventListener("click", function(e){
      var heart = e.target.closest("[data-heart-id]");
      if(heart){
        var hid = heart.getAttribute("data-heart-id");
        var on = !((DB.hearts[hid] || {})[ME]);
        var heartSaved = mutate(function(db){
          if(!db.hearts[hid]) db.hearts[hid] = {};
          if(on) db.hearts[hid][ME] = true; else delete db.hearts[hid][ME];
        });
        refreshHearts();
        if(on && heartSaved){
          var fresh = grid.querySelector('[data-heart-id="'+hid+'"]');
          if(fresh) fresh.classList.add("is-pop");
          showToast(SPACE.partner.name + " will see you loved this.");
        }
        return;
      }
      if(!e.target.closest("[data-voice-cta]")) return;
      if(e.target.closest("[data-open-moment]")) return; // handled for the whole page, below
      if(!isPaired()){
        renderPairingOverlay();
        openOverlay("pairingOverlay");
        showToast("Connect with " + SPACE.partner.name + " before adding a moment.");
        return;
      }
      resetCaptureFlow();
      document.querySelectorAll(".capture-type").forEach(function(b){ b.classList.remove("is-selected"); });
      document.querySelector('.capture-type[data-type="voice"]').classList.add("is-selected");
      renderCaptureBody("voice");
      openOverlay("captureOverlay");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Offline-first moment capture — real local queue, real online/offline*/
  /* handling. The actual photo/video/voice Blob persists to IndexedDB   */
  /* (see idbPutMedia/idbGetMedia above), keyed by the moment's id; only  */
  /* lightweight JSON metadata goes to localStorage. That means a moment */
  /* captured while offline keeps its real media across a reload — it    */
  /* never comes back as a random placeholder.                           */
  /* ------------------------------------------------------------------ */
  var QUEUE_META_KEY = privateKey("pairlum-offline-queue-v1");
  var CAPTURE_QUEUE = []; // in-memory: { id, type, caption, mediaUrl, hasMedia, cardEl, status }

  function loadQueueMeta(){
    try{ return JSON.parse(localStorage.getItem(QUEUE_META_KEY)) || []; }catch(e){ return []; }
  }
  // Returns false when the list could not be written. A moment that is not
  // yet saved on this device ("unsaved") is deliberately left out: it only
  // exists while this page is open, and the card says so.
  function saveQueueMeta(){
    try{
      var meta = CAPTURE_QUEUE
        .filter(function(it){ return it.status !== "shared" && it.status !== "unsaved"; })
        .map(function(it){ return { id:it.id, type:it.type, caption:it.caption, status:it.status, createdAt:it.createdAt, hasMedia:!!it.hasMedia, parallel:!!it.parallel, secs: it.secs || 0, voice: it.voice || null }; });
      localStorage.setItem(QUEUE_META_KEY, JSON.stringify(meta));
      return true;
    }catch(e){ return false; }
  }

  function momentStatusBadge(status){
    var badge = el("div","moment-status-badge");
    setBadgeState(badge, status);
    return badge;
  }
  function setBadgeState(badge, status){
    badge.className = "moment-status-badge" + (status === "shared" ? " is-shared" : status === "saving" || status === "queued" || status === "uploading" ? " is-pending" : "");
    badge.setAttribute("data-status", status);
    // Plain, human language only — no "IndexedDB", "queue", "upload",
    // "sync". This is the exact wording asked for: "Saved safely. We'll
    // send it when you're back online." then later "Shared with Mira."
    var pnSafe = escapeHtml(SPACE.partner.name);
    var labels = {
      saving: "Saving on this device…",
      queued: "Saved on this device",
      uploading: "Sending to " + pnSafe + "…",
      shared: "Shared with " + pnSafe,
      failed: "Saved here, not shared yet",
      unsaved: "Not saved yet",
      missing: "Its file is no longer on this device, so it was not shared"
    };
    var extra = "";
    if(status === "queued" && isOffline()){
      extra = '<span style="opacity:.8">. We\'ll send it when you\'re back online.</span>';
    }
    if(status === "failed" || status === "unsaved"){
      extra = ' <button type="button" data-retry-moment="">Retry</button>';
    }
    if(status === "missing"){
      extra = ' <button type="button" data-remove-moment="">Remove</button>';
    }
    badge.innerHTML = '<span class="dot" aria-hidden="true"></span><span>'+labels[status]+'</span>'+extra;
  }

  function prependMoment(type, caption, mediaUrl, queueId, opts){
    // Insert a freshly captured moment at the top of the strip, animated in,
    // carrying a live status badge that reflects the offline/upload pipeline.
    // caption is always escaped before it touches innerHTML — it's
    // user-typed text, and Pairlum stores private user content.
    var safeCaption = escapeHtml(caption);
    var pmOpts = opts || {};
    var pmWho = pmOpts.who === "b" ? "b" : "a";
    var pmName = pmWho === "a" ? "You" : escapeHtml(SPACE.partner.name);
    var pmTime = escapeHtml(pmOpts.timeLabel || ("Just now · " + SPACE.currentUser.city));
    var side = document.querySelector(".sd-side");
    var grid = document.getElementById("sharedDayGrid");
    var host = side || grid;
    if(!host) return null;

    var card;
    if(type === "text"){
      card = el("article","moment-card small");
      var metaT = el("div","moment-meta");
      metaT.innerHTML =
        '<span class="moment-tag">'+whoDot(pmWho)+pmName+'</span>'+
        '<p class="moment-caption">'+safeCaption+'</p>'+
        '<span class="moment-time">'+pmTime+'</span>';
      card.appendChild(el("div","photo","")); // subtle paper backdrop, no image
      card.style.background = "var(--paper-dim)";
      card.appendChild(scrim());
      card.appendChild(metaT);
    } else if(type === "voice"){
      card = el("div","sd-strip voice-moment");
      card.innerHTML =
        '<button class="voice-play" type="button" aria-label="Play voice message" data-voice-play>'+
          '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'+
        '</button>'+
        '<div class="waveform" data-waveform aria-hidden="true"></div>'+
        '<div class="voice-meta"><span class="body-s" style="color:rgba(255,255,255,.7)">'+pmName+' · '+(safeCaption||"Voice note")+'</span><span class="moment-time">'+pmTime+'</span></div>';
      buildWaveform(card.querySelector("[data-waveform]"), 30);
      // Real playback wires only once real audio exists (immediately, or
      // later via hydrateCardMedia() once IndexedDB returns the Blob) —
      // never a simulated fake-play for something the user actually recorded.
      if(mediaUrl){
        var audio = new Audio(mediaUrl);
        wireRealVoicePlay(card.querySelector("[data-voice-play]"), card.querySelector("[data-waveform]"), audio);
      }
    } else if(type === "video"){
      card = el("article","moment-card small");
      var vidWrap = el("div","moment-video-wrap");
      if(mediaUrl){
        var vidEl = document.createElement("video");
        vidEl.className = "moment-video";
        vidEl.src = mediaUrl; vidEl.playsInline = true; vidEl.preload = "metadata"; vidEl.muted = true;
        vidWrap.appendChild(vidEl);
      } else {
        vidWrap.appendChild(photoLayer(PHOTO_CLASSES[Math.floor(Math.random()*PHOTO_CLASSES.length)]));
      }
      card.appendChild(vidWrap);
      card.appendChild(scrim());
      var playOverlay = el("button","moment-video-play");
      playOverlay.type = "button";
      playOverlay.setAttribute("aria-label","Play video");
      playOverlay.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
      if(!mediaUrl) playOverlay.style.display = "none";
      card.appendChild(playOverlay);
      var metaV = el("div","moment-meta");
      metaV.innerHTML =
        '<span class="moment-tag">'+whoDot(pmWho)+pmName+'</span>'+
        '<p class="moment-caption">'+safeCaption+'</p>'+
        '<span class="moment-time">'+pmTime+'</span>';
      card.appendChild(metaV);
      if(mediaUrl) wireVideoPlayOverlay(vidWrap.querySelector("video"), playOverlay);
    } else {
      // photo — use the real selected media when available
      card = el("article","moment-card small");
      if(mediaUrl){
        var photoDiv = el("div","photo");
        photoDiv.style.backgroundImage = "url("+mediaUrl+")";
        card.appendChild(photoDiv);
      } else {
        card.appendChild(photoLayer(PHOTO_CLASSES[Math.floor(Math.random()*PHOTO_CLASSES.length)]));
      }
      card.appendChild(scrim());
      var meta = el("div","moment-meta");
      meta.innerHTML =
        '<span class="moment-tag">'+whoDot(pmWho)+pmName+'</span>'+
        '<p class="moment-caption">'+safeCaption+'</p>'+
        '<span class="moment-time">'+pmTime+'</span>';
      card.appendChild(meta);
    }

    card.style.opacity = "0";
    card.style.transform = "translateY(10px)";
    card.style.transition = "opacity .5s cubic-bezier(.22,.61,.36,1), transform .5s cubic-bezier(.22,.61,.36,1)";
    card.style.position = card.style.position || "relative";
    card.setAttribute("data-moment-id", queueId || "");

    var badge = momentStatusBadge("saving");
    if(!pmOpts.noBadge) card.appendChild(badge);
    if(type !== "voice" && queueId) card.insertAdjacentHTML("beforeend", heartSlotHtml({ id:queueId, who:pmWho }));
    // the way into the moment and its thread (empty until the moment is really shared)
    if(queueId){ var barHost = card.querySelector(".moment-meta") || card; barHost.insertAdjacentHTML("beforeend", momentBarHtml(queueId)); }
    card.addEventListener("click", function(e){
      if(e.target && e.target.hasAttribute && e.target.hasAttribute("data-retry-moment")){
        retryQueueItem(queueId);
      }
      if(e.target && e.target.hasAttribute && e.target.hasAttribute("data-remove-moment")){
        dropQueueItem(queueId);
      }
    });

    host.insertBefore(card, host.firstChild);
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        card.style.opacity = "1";
        card.style.transform = "none";
      });
    });

    return { card: card, badge: badge };
  }

  function wireVideoPlayOverlay(videoEl, playBtn){
    if(!videoEl || !playBtn) return;
    playBtn.addEventListener("click", function(){
      if(videoEl.paused){ videoEl.muted = false; videoEl.play(); playBtn.style.display = "none"; }
    });
    videoEl.addEventListener("pause", function(){ playBtn.style.display = ""; });
    videoEl.addEventListener("ended", function(){ playBtn.style.display = ""; });
  }

  // Fills in the real media (photo/video/voice) on an already-rendered card
  // once its Blob comes back from IndexedDB — used when a pending moment is
  // reconstructed after a reload, since the DOM has to render immediately
  // but the real bytes load asynchronously.
  function hydrateCardMedia(card, type, url){
    if(!card || !url) return;
    if(type === "photo"){
      var photoEl = card.querySelector(".photo");
      if(photoEl) photoEl.style.backgroundImage = "url("+url+")";
    } else if(type === "video"){
      var wrap = card.querySelector(".moment-video-wrap");
      var playBtn = card.querySelector(".moment-video-play");
      if(wrap){
        wrap.innerHTML = "";
        var v = document.createElement("video");
        v.className = "moment-video"; v.src = url; v.playsInline = true; v.preload = "metadata"; v.muted = true;
        wrap.appendChild(v);
        if(playBtn){ playBtn.style.display = ""; wireVideoPlayOverlay(v, playBtn); }
      }
    } else if(type === "voice"){
      var btn = card.querySelector("[data-voice-play]");
      var wf = card.querySelector("[data-waveform]");
      if(btn){ wireRealVoicePlay(btn, wf, new Audio(url)); }
    }
  }

  function renderQueuedCards(){
    // Reconstruct any moment that was still pending when the page last
    // reloaded, so nothing captured offline silently disappears. Metadata
    // comes from localStorage immediately; the real media Blob (if any)
    // is fetched from IndexedDB and hydrated in once it resolves.
    var meta = loadQueueMeta(), waiting = 0, changed = false;
    var settle = function(){
      if(waiting > 0) return;
      if(changed) saveQueueMeta();
      if(CAPTURE_QUEUE.length) window.setTimeout(flushQueue, 500);
    };
    meta.forEach(function(m){
      if(m.status === "shared") return;
      // Already in the shared record: the page closed after it was sent but
      // before this list was updated. It is shared once; it is not sent again.
      if(DB.moments.some(function(x){ return x.id === m.id; })){ changed = true; return; }
      // A step that was in progress when the page closed did not finish.
      // "Sending" and "saving" both go back to "saved here", to be tried again.
      var status = (m.status === "uploading" || m.status === "saving") ? "queued" : m.status;
      if(status !== m.status) changed = true;
      var refs = prependMoment(m.type, m.caption, null, m.id);
      if(!refs) return;
      var item = { id:m.id, type:m.type, caption:m.caption, mediaUrl:null, hasMedia:m.hasMedia, cardEl:refs.card, badgeEl:refs.badge, status:status, createdAt:m.createdAt, parallel:!!m.parallel, secs: m.secs || 0, voice: m.voice || null };
      CAPTURE_QUEUE.push(item);
      setBadgeState(refs.badge, status);
      if(m.hasMedia){
        waiting++;
        idbGetMedia(m.id, function(err, blob){
          waiting--;
          if(err || !blob){
            // The words survived but the file did not. Say so, and never publish a moment with nothing in it.
            item.status = "missing"; changed = true;
            setBadgeState(refs.badge, "missing");
          } else {
            hydrateCardMedia(refs.card, m.type, URL.createObjectURL(blob));
          }
          settle();
        });
      }
      if(m.voice && m.voice.id){
        waiting++;
        idbGetMedia(m.voice.id, function(err, blob){
          waiting--;
          if(err || !blob){ item.status = "missing"; changed = true; setBadgeState(refs.badge, "missing"); }
          settle();
        });
      }
    });
    if(changed && !CAPTURE_QUEUE.length) saveQueueMeta();
    settle();
  }
  function dropQueueItem(id){
    var item = CAPTURE_QUEUE.filter(function(q){ return q.id === id; })[0];
    if(!item) return;
    CAPTURE_QUEUE = CAPTURE_QUEUE.filter(function(q){ return q.id !== id; });
    if(!saveQueueMeta()){ CAPTURE_QUEUE.push(item); showToast("Couldn't remove that just now. Try again.", true); return; }
    idbDeleteMedia(id);
    if(item.voice && item.voice.id) idbDeleteMedia(item.voice.id);
    if(item.cardEl && item.cardEl.parentNode) item.cardEl.parentNode.removeChild(item.cardEl);
  }

  function runUploadPipeline(item){
    if(item.status === "uploading" || item.status === "shared" || item.status === "missing") return; // one attempt at a time
    item.status = "uploading";
    setBadgeState(item.badgeEl, "uploading");
    saveQueueMeta();
    window.setTimeout(function(){
      if(isOffline()){
        item.status = "queued";
        setBadgeState(item.badgeEl, "queued");
        saveQueueMeta();
        return;
      }
      // demo-only: a small chance of a failed upload, so the retry affordance is real and reachable
      var shouldFail = window.__pairlumForceFail === true;
      window.__pairlumForceFail = false;
      if(shouldFail){
        item.status = "failed";
        setBadgeState(item.badgeEl, "failed");
        saveQueueMeta();
        return;
      }
      var publish = function(){
        // Only once the shared record has really been written is it "shared".
        if(!shareMoment(item)){
          item.status = "failed";
          setBadgeState(item.badgeEl, "failed");
          saveQueueMeta();
          return;
        }
        item.status = "shared";
        setBadgeState(item.badgeEl, "shared");
        saveQueueMeta(); // if this write fails the item is recognised as already shared on the next start
        window.setTimeout(function(){
          if(item.badgeEl && item.badgeEl.parentNode){
            item.badgeEl.style.transition = "opacity .6s ease";
            item.badgeEl.style.opacity = "0";
            window.setTimeout(function(){ if(item.badgeEl.parentNode) item.badgeEl.parentNode.removeChild(item.badgeEl); }, 650);
          }
          CAPTURE_QUEUE = CAPTURE_QUEUE.filter(function(q){ return q.id !== item.id; });
        }, 1400);
      };
      var need = [];
      if(item.hasMedia) need.push(item.id);
      if(item.voice && item.voice.id) need.push(item.voice.id);
      if(!need.length) return publish();
      // A photo, clip or voice is only announced when every file it needs is really on this device.
      var checkNext = function(){
        if(!need.length) return publish();
        idbGetMedia(need.shift(), function(err, blob){
          if(item.status !== "uploading") return;
          if(err || !blob){
            item.status = "missing";
            setBadgeState(item.badgeEl, "missing");
            saveQueueMeta();
            showToast("That moment was not shared: its file is no longer on this device.", true);
            return;
          }
          checkNext();
        });
      };
      checkNext();
    }, 900);
  }

  function queueCapture(type, caption, mediaUrl, mediaBlob, parallel, extra){
    var id = uid("mo");
    var hasMedia = !!mediaBlob;
    var ex = extra || {};
    var item = { id:id, type:type, caption:caption, mediaUrl:mediaUrl, hasMedia:hasMedia, status:"saving", createdAt: Date.now(), parallel:!!parallel, secs: ex.secs || 0 };
    if(ex.voiceBlob){ item.voice = { id: uid("vo"), secs: ex.voiceSecs || 1 }; item.voiceBlob = ex.voiceBlob; if(ex.voiceUrl) MEDIA_URLS[item.voice.id] = ex.voiceUrl; }
    markFirst("moment"); if(parallel) markFirst("parallel");
    var refs = prependMoment(type, caption, mediaUrl, id);
    item.cardEl = refs && refs.card;
    item.badgeEl = refs && refs.badge;
    item.blob = mediaBlob || null;     // kept in hand until this device confirms it has it
    CAPTURE_QUEUE.push(item);
    storeCapture(item);
  }

  // Step one of sharing: write the photo, video or voice (and the note that it
  // exists) to this device, and wait to be told that worked. Nothing is called
  // "saved" before that. If it fails the moment stays on screen, marked
  // "Not saved yet", and can be tried again.
  function storeCapture(item){
    item.status = "saving";
    setBadgeState(item.badgeEl, "saving");
    var started = Date.now();
    var finish = function(err){
      window.setTimeout(function(){
        if(!err){ item.status = "queued"; if(!saveQueueMeta()) err = new Error("list not saved"); }
        if(err){
          item.status = "unsaved";
          setBadgeState(item.badgeEl, "unsaved");
          saveQueueMeta();
          showToast("Couldn't save that on this device. It's still here. Free some space, then tap Retry.", true);
          return;
        }
        item.blob = null; item.voiceBlob = null;
        setBadgeState(item.badgeEl, "queued");
        if(isOffline()){
          showToast("Saved on this device. We'll send it when you're back online.");
          return;
        }
        runUploadPipeline(item);
      }, Math.max(0, 350 - (Date.now() - started)));
    };
    // the picture or clip, then the voice that goes with it: both must be confirmed before it is "saved"
    var putVoice = function(err){
      if(err || !item.voice || !item.voiceBlob) return finish(err);
      idbPutMedia(item.voice.id, item.voiceBlob, function(e2){
        if(e2 && item.hasMedia) idbDeleteMedia(item.id); // do not leave half a moment behind
        finish(e2);
      });
    };
    if(item.hasMedia && item.blob) idbPutMedia(item.id, item.blob, putVoice);
    else putVoice(null);
  }

  function retryQueueItem(id){
    var item = CAPTURE_QUEUE.filter(function(q){ return q.id === id; })[0];
    if(!item) return;
    if(item.status === "unsaved"){ storeCapture(item); return; }
    if(isOffline()){
      showToast("Still offline — it'll share automatically once you're back.");
      return;
    }
    runUploadPipeline(item);
  }

  function flushQueue(){
    if(isOffline()) return;
    var pending = CAPTURE_QUEUE.filter(function(q){ return q.status === "queued" || q.status === "failed"; });
    if(!pending.length) return;
    showToast(pending.length > 1 ? "Sharing " + pending.length + " saved moments." : "Sharing your saved moment.");
    pending.forEach(function(item, i){
      window.setTimeout(function(){ runUploadPipeline(item); }, i * 500);
    });
  }

  window.addEventListener("online", function(){ flushQueue(); flushPendingNeedRequests(); });

  /* ------------------------------------------------------------------ */
  /* Waveform                                                             */
  /* ------------------------------------------------------------------ */
  function buildWaveform(container, count){
    if(!container) return;
    container.innerHTML = "";
    for(var i=0;i<count;i++){
      var bar = el("i");
      var h = 6 + Math.round(Math.abs(Math.sin(i*0.6)) * 14 + Math.random()*6);
      bar.style.height = h + "px";
      container.appendChild(bar);
    }
  }
  // Simulated playback — used only for pre-recorded demo voice notes that
  // have no real audio file behind them (Mira's mock messages).
  function wireVoicePlay(btn, waveform){
    if(!btn) return;
    var playing = false;
    btn.addEventListener("click", function(){
      playing = !playing;
      btn.innerHTML = playing
        ? '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
      if(waveform){ waveform.style.opacity = playing ? "1" : ".85"; }
      if(playing){
        showToast("This is a sample voice note, so there is no recording to play. Real ones play here.");
        window.setTimeout(function(){
          playing = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        }, 2600);
      }
    });
  }
  // Real playback — used for anything the user actually recorded in this session.
  function wireRealVoicePlay(btn, waveform, audioEl){
    if(!btn || !audioEl) return;
    btn.addEventListener("click", function(){
      if(audioEl.paused){ audioEl.play(); }
      else { audioEl.pause(); }
    });
    audioEl.addEventListener("play", function(){
      btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
      if(waveform) waveform.style.opacity = "1";
    });
    function reset(){
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
      if(waveform) waveform.style.opacity = ".85";
    }
    audioEl.addEventListener("pause", reset);
    audioEl.addEventListener("ended", reset);
  }

  /* ------------------------------------------------------------------ */
  /* Shared mic-recording controller — used by both Add Moment (voice)   */
  /* and I Need You's request-side optional voice request.               */
  /* ------------------------------------------------------------------ */
  // Every recording in the app goes through here, so the microphone is always
  // let go: when you stop, when the sheet it belongs to is closed (button,
  // backdrop or Escape), and when you leave the page. If the browser is still
  // asking for permission when the sheet closes, the microphone is released
  // the moment it answers.
  var RECORDERS = [];
  function makeRecorder(cb, opts){
    var ro = opts || {};
    var state = { stream:null, mr:null, chunks:[], startedAt:0, timerId:null, active:false, pending:false, cancelled:false };
    var api;
    function release(){
      if(state.stream){ try{ state.stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} }
      window.clearInterval(state.timerId);
      state.active = false; state.pending = false;
      RECORDERS = RECORDERS.filter(function(r){ return r !== api; });
    }
    function start(){
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === "undefined"){
        cb.onError && cb.onError("Voice recording isn't supported in this browser — you can still add a text note.");
        return;
      }
      state.pending = true;
      RECORDERS.push(api);
      navigator.mediaDevices.getUserMedia({ audio: ro.audio || true, video: ro.video || false }).then(function(stream){
        state.pending = false;
        state.stream = stream;
        if(state.cancelled){ release(); return; }      // closed while the browser was still asking
        if(cb.onStream) cb.onStream(stream);           // a clip shows what the camera sees while it records
        state.chunks = [];
        try{ state.mr = ro.recorder ? new MediaRecorder(stream, ro.recorder) : new MediaRecorder(stream); }
        catch(e){
          release();
          cb.onError && cb.onError("Voice recording isn't supported in this browser — you can still add a text note.");
          return;
        }
        state.mr.ondataavailable = function(e){ if(e.data && e.data.size) state.chunks.push(e.data); };
        state.mr.onstop = function(){
          var wasCancelled = state.cancelled;
          release();
          if(wasCancelled) return;                      // discarded: nothing is kept or handed on
          var blob = new Blob(state.chunks, { type: state.mr.mimeType || (ro.video ? "video/webm" : "audio/webm") });
          cb.onStop && cb.onStop(blob, URL.createObjectURL(blob));
        };
        state.mr.start();
        state.active = true;
        state.startedAt = Date.now();
        cb.onStart && cb.onStart();
        state.timerId = window.setInterval(function(){
          cb.onTick && cb.onTick(Math.floor((Date.now()-state.startedAt)/1000));
        }, 250);
      }).catch(function(){
        var wasCancelled = state.cancelled;
        release();
        if(!wasCancelled) cb.onError && cb.onError(ro.video ? "The camera or microphone is blocked. Allow them in your browser settings, or choose a clip from your phone." : "Microphone access was blocked — you can still add a text note.");
      });
    }
    // Stop and keep what was recorded.
    function stop(){ if(state.active && state.mr){ try{ state.mr.stop(); }catch(e){ release(); } } }
    // Stop and throw it away. The microphone is released straight away.
    function cancel(){
      state.cancelled = true;
      var mr = state.active ? state.mr : null;
      release();
      if(mr){ try{ if(mr.state !== "inactive") mr.stop(); }catch(e){} }
      cb.onCancel && cb.onCancel();
    }
    function isActive(){ return state.active; }
    function isBusy(){ return state.active || state.pending; }
    api = { start:start, stop:stop, cancel:cancel, isActive:isActive, isBusy:isBusy, scope: ro.scope || "" };
    return api;
  }
  function recordingIn(scope){ return RECORDERS.some(function(r){ return r.scope === scope && r.isBusy(); }); }
  function cancelRecordings(scope){ RECORDERS.slice().forEach(function(r){ if(!scope || r.scope === scope) r.cancel(); }); }
  // Leaving the page or putting it in the background: finish what is being
  // recorded so it is kept as a draft, and let the microphone go.
  function finishRecordings(){ RECORDERS.slice().forEach(function(r){ if(r.isActive()) r.stop(); else r.cancel(); }); }
  window.addEventListener("pagehide", finishRecordings);
  document.addEventListener("visibilitychange", function(){ if(document.hidden) finishRecordings(); });
  // Called whenever a sheet closes, however it was closed.
  function sheetClosed(id){
    if(id === "momentOverlay"){
      var wasRec = recordingIn(id), hadDraft = !!(momentState.voice || momentState.clip);
      cancelRecordings(id);
      document.querySelectorAll("#momentOverlay audio, #momentOverlay video").forEach(function(m){ try{ m.pause(); if(m.srcObject) m.srcObject = null; }catch(e){} });
      clearReplyDraft();
      if(wasRec || hadDraft) showToast(wasRec ? "Recording stopped. Nothing was sent." : "The reply was discarded. Nothing was sent.");
      return;
    }
    if(id === "voiceFindOverlay"){ stopVoiceFindAudio(); return; }
    if(id === "needOverlay"){ if(comfortAudio){ try{ comfortAudio.pause(); }catch(e){} } return; }
    if(id === "memoryOverlay"){ document.querySelectorAll("#memoryViewMedia audio, #memoryViewMedia video").forEach(function(m){ try{ m.pause(); }catch(e){} }); return; }
    if(id === "comfortOverlay"){
      var was = recordingIn(id);
      cancelRecordings(id);
      if(!comfortState.saved && (was || comfortState.blob)){
        if(comfortState.url){ try{ URL.revokeObjectURL(comfortState.url); }catch(e){} }
        comfortState.blob = null;
        showToast(was ? "Recording stopped. Nothing was saved." : "Recording discarded. Nothing was saved.");
      }
      return;
    }
    if(id !== "captureOverlay" && id !== "needRequestOverlay") return;
    var live = recordingIn(id);
    cancelRecordings(id);
    if(id === "captureOverlay"){
      var unsent = !captureState.submitted && (live || captureState.voiceBlob);
      if(unsent){
        if(captureState.voiceUrl){ try{ URL.revokeObjectURL(captureState.voiceUrl); }catch(e){} }
        showToast(live ? "Recording stopped. Nothing was saved or sent." : "Voice note discarded. Nothing was sent.");
        window.setTimeout(function(){ if(!overlayOpen("captureOverlay")) resetCaptureFlow(); }, 400);
      }
    } else {
      if(!needRequestState.sent && (live || needRequestState.voiceBlob)){
        if(needRequestState.voiceBlobUrl){ try{ URL.revokeObjectURL(needRequestState.voiceBlobUrl); }catch(e){} }
        needRequestState.voiceBlob = null; needRequestState.voiceBlobUrl = null;
        var vb = document.getElementById("needRequestVoiceBtn"); if(vb) vb.classList.remove("is-recording");
        showToast(live ? "Recording stopped. Nothing was saved or sent." : "Voice request discarded. Nothing was sent.");
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* I Need You — request side ("I could use…") + receive side           */
  /* ------------------------------------------------------------------ */
  function renderNeedYou(){
    var grid = document.getElementById("needGrid");
    grid.innerHTML = "";
    SPACE.needYou.forEach(function(item){
      var chip = el("button","need-chip");
      chip.type = "button";
      chip.textContent = item.title;
      chip.addEventListener("click", function(){ openNeedRequest(item.id); });
      grid.appendChild(chip);
    });
    var primary = document.getElementById("needPrimaryBtn");
    if(primary){
      primary.addEventListener("click", function(){ openNeedReveal(); });
    }
    var hist = document.getElementById("needHistoryBtn");
    if(hist) hist.addEventListener("click", function(){ renderNeedHistory(); openOverlay("needHistoryOverlay"); });
    wireComfort();
    renderComfort();
    renderSentLine();
  }

  function renderSentLine(){
    var line = document.getElementById("needSentLine");
    if(!line) return;
    if(!SPACE.sentRequests.length){ line.hidden = true; return; }
    var last = SPACE.sentRequests[SPACE.sentRequests.length-1];
    line.hidden = false;
    var statusWord = last.status === "pending" ? "saved, will send when back online" : "sent";
    var tail = last.status !== "pending" && last.noReply ? ", no reply needed" : "";
    if(last.reply === "here"){ statusWord = SPACE.partner.name + " answered: I'm here"; tail = ""; }
    if(last.reply === "later"){ statusWord = SPACE.partner.name + " saw it and can't right now"; tail = ""; }
    line.textContent = "You said you could use " + last.title.toLowerCase() + " · " + statusWord + tail;
  }

  function markRequestDelivered(reqItem){
    // Internal state only — "delivered" is never surfaced to the sender as
    // a read receipt; it exists so the data model is honest about what a
    // real backend would eventually confirm.
    var reqId = reqItem.id;
    window.setTimeout(function(){
      var live = SPACE.sentRequests.filter(function(r){ return r.id === reqId; })[0];
      if(!live) return;
      live.status = "delivered";
      saveSentRequests();
    }, 1500);
  }

  function flushPendingNeedRequests(){
    if(isOffline()) return;
    var pending = SPACE.sentRequests.filter(function(r){ return r.status === "pending"; });
    if(!pending.length) return;
    pending.forEach(function(r){ r.status = "sent"; markRequestDelivered(r); });
    saveSentRequests();
    renderSentLine();
    showToast(pending.length > 1 ? "Back online — " + pending.length + " requests reached " + SPACE.partner.name + "." : "Back online — that reached " + SPACE.partner.name + ".");
  }

  // The receiving side — what your partner asked for, shown on YOUR phone.
  function latestIncomingRequest(){
    var cutoff = Date.now() - 86400000;
    var list = DB.requests.filter(function(r){
      return r.by === THEM && r.status !== "pending" && !r.reply && (r.sentAt || 0) > cutoff;
    });
    return list.length ? list[list.length-1] : null;
  }
  function renderIncomingRequest(){
    var box = document.getElementById("needIncoming");
    if(!box) return;
    var r = latestIncomingRequest();
    if(!r){ box.hidden = true; box.innerHTML = ""; box.removeAttribute("data-req"); return; }
    if(box.getAttribute("data-req") === r.id && !box.hidden) return; // already showing this one
    var p = SPACE.partner;
    box.setAttribute("data-req", r.id);
    box.innerHTML =
      '<p class="need-incoming-eyebrow">'+escapeHtml(p.name)+' needs you</p>'+
      '<p class="need-incoming-title">'+escapeHtml(p.name)+' could use '+escapeHtml(String(r.title).toLowerCase())+'</p>'+
      (r.note ? '<p class="need-incoming-note">“'+escapeHtml(r.note)+'”</p>' : '')+
      (r.hasVoice ? '<audio class="need-incoming-audio" controls preload="none"></audio>' : '')+
      (r.noReply ? '<p class="need-incoming-hint">No reply needed — only if you want to.</p>' : '')+
      '<div class="need-incoming-actions">'+
        '<button type="button" class="need-incoming-here" data-req-reply="here">I\'m here</button>'+
        '<button type="button" class="need-incoming-later" data-req-reply="later">Not right now</button>'+
      '</div>';
    box.hidden = false;
    if(r.hasVoice){
      idbGetMedia(r.id, function(err, blob){
        var au = box.querySelector("audio");
        if(err || !blob || !au) return;
        au.src = URL.createObjectURL(blob);
      });
    }
  }
  function wireIncomingRequest(){
    var box = document.getElementById("needIncoming");
    if(!box) return;
    box.addEventListener("click", function(e){
      var btn = e.target.closest("[data-req-reply]");
      if(!btn) return;
      var id = box.getAttribute("data-req");
      var kind = btn.getAttribute("data-req-reply");
      var replySaved = mutate(function(db){
        db.requests.forEach(function(r){ if(r.id === id){ r.reply = kind; r.replyAt = Date.now(); } });
      });
      renderIncomingRequest();
      if(!replySaved) return; // the request stays on the card, so the reply can be given again
      showToast(kind === "here" ? "Sent — " + SPACE.partner.name + " knows you're here." : "Okay. " + SPACE.partner.name + " will see that you saw it and can't right now.");
    });
  }

  /* A message for the hard days. Each of you can record one for the other,
     ahead of time. It is real: the card only offers to play something when
     your partner has actually recorded it, and it plays their recording. */
  var comfortAudio = null;
  function comfortClock(secs){ return Math.floor(secs / 60) + ":" + pad2(Math.round(secs) % 60); }
  function renderComfort(){
    var p = SPACE.partner, theirs = DB.comfort[THEM] || null, mine = DB.comfort[ME] || null;
    var btn = document.getElementById("needPrimaryBtn");
    setText("needYouIntro", theirs ? p.name + " left something here for you." : "Say what you need. " + p.name + " will see it.");
    setText("needPrimaryTitle", theirs ? "Play " + p.name + "'s message" : "Nothing from " + p.name + " here yet");
    setText("needPrimarySub", theirs ? "Recorded for you · " + agoLabel(theirs.at) + " · " + comfortClock(theirs.secs)
                                    : "A message " + p.name + " records for your hard days waits here");
    if(btn){ btn.classList.toggle("is-empty", !theirs); btn.disabled = !theirs; }
    var line = document.getElementById("needMineLine");
    if(line){
      line.innerHTML = mine
        ? 'Your message for ' + escapeHtml(p.name) + ': ' + comfortClock(mine.secs) + ', recorded ' + escapeHtml(agoLabel(mine.at)) + '. ' +
          '<span class="need-mine-actions"><button type="button" class="ambient-link" data-comfort="record">Record a new one</button><button type="button" class="ambient-link" data-comfort="remove">Remove</button></span>'
        : '<button type="button" class="ambient-link" data-comfort="record">Record a message for ' + escapeHtml(p.name) + "'s hard days</button>";
    }
    var hist = document.getElementById("needHistoryBtn");
    if(hist) hist.hidden = !DB.requests.length;
  }
  function openNeedReveal(){
    var p = SPACE.partner, theirs = DB.comfort[THEM];
    if(!theirs){ showToast(p.name + " hasn't recorded a message here yet."); return; }
    document.getElementById("needTitle").textContent = "A message from " + p.name;
    document.getElementById("needRevealSub").textContent = p.name + " recorded this before you needed to hear it.";
    document.getElementById("needRevealMeta").textContent = p.name + " · " + comfortClock(theirs.secs);
    document.getElementById("needRevealTimestamp").textContent = "Left for you · " + agoLabel(theirs.at);
    var av = document.querySelector("#needOverlay .need-reveal-avatar"); if(av) av.textContent = p.initial;
    buildWaveform(document.getElementById("needWaveform"), 40);
    // a fresh play button each time, wired to the real recording
    var old = document.getElementById("needVoicePlay"), btn = old.cloneNode(true);
    old.parentNode.replaceChild(btn, old);
    btn.disabled = true;
    if(comfortAudio){ try{ comfortAudio.pause(); }catch(e){} comfortAudio = null; }
    var ready = function(url){
      comfortAudio = new Audio(url);
      btn.disabled = false;
      wireRealVoicePlay(btn, document.getElementById("needWaveform"), comfortAudio);
    };
    if(MEDIA_URLS[theirs.id]) ready(MEDIA_URLS[theirs.id]);
    else idbGetMedia(theirs.id, function(err, blob){
      if(err || !blob){ document.getElementById("needRevealTimestamp").textContent = "This recording isn't on this device."; return; }
      MEDIA_URLS[theirs.id] = URL.createObjectURL(blob);
      ready(MEDIA_URLS[theirs.id]);
    });
    var body = document.getElementById("needRevealBody");
    body.classList.remove("is-revealing");
    void body.offsetWidth; // restart the reveal animation
    body.classList.add("is-revealing");
    openOverlay("needOverlay");
  }

  // After listening: each of these really does what it says.
  function wireNeedResponses(){
    var wrap = document.getElementById("needResponseOptions");
    if(!wrap) return;
    wrap.addEventListener("click", function(e){
      var btn = e.target.closest ? e.target.closest("[data-need-response]") : null;
      if(!btn) return;
      var kind = btn.getAttribute("data-need-response");
      closeOverlay("needOverlay");
      if(kind === "helped"){
        if(!addSentNote("Your message helped today.")) return;
        renderNotes();
        showToast("Sent to " + SPACE.partner.name + ": “Your message helped today.”");
      } else if(kind === "voice"){
        var fab = document.getElementById("fabAdd");
        if(fab && fab.style.display !== "none"){
          fab.click();
          window.setTimeout(function(){ var v = document.querySelector('.capture-type[data-type="voice"]'); if(v) v.click(); }, 60);
        }
      }
    });
  }

  // ---- Recording your own message for their hard days ----
  var comfortState = { recorder:null, blob:null, url:null, secs:0 };
  var COMFORT_MAX_SECONDS = 90;
  function openComfortRecorder(){
    comfortState = { recorder:null, blob:null, url:null, secs:0 };
    setText("comfortTitle", "A message for " + SPACE.partner.name + "'s hard days");
    setText("comfortStatus", "Up to " + COMFORT_MAX_SECONDS + " seconds. " + SPACE.partner.name + " can play it whenever they need to hear you.");
    setText("comfortRecLabel", "Start recording");
    var pv = document.getElementById("comfortPreview"); pv.removeAttribute("src"); pv.hidden = true;
    document.getElementById("comfortRecBtn").classList.remove("is-recording");
    document.getElementById("comfortSave").disabled = true;
    openOverlay("comfortOverlay");
  }
  function wireComfort(){
    var card = document.getElementById("needMineLine");
    if(card) card.addEventListener("click", function(e){
      var b = e.target.closest("[data-comfort]");
      if(!b) return;
      if(b.getAttribute("data-comfort") === "record"){ openComfortRecorder(); return; }
      var mine = DB.comfort[ME];
      if(!mine) return;
      if(mutate(function(db){ delete db.comfort[ME]; })){ idbDeleteMedia(mine.id); delete MEDIA_URLS[mine.id]; showToast("Removed. " + SPACE.partner.name + " can no longer play it."); }
      renderComfort();
    });
    var recBtn = document.getElementById("comfortRecBtn");
    if(!recBtn) return;
    recBtn.addEventListener("click", function(){
      var r = comfortState.recorder;
      if(r && r.isActive()){ r.stop(); return; }
      if(r && r.isBusy()) return;
      comfortState.recorder = makeRecorder({
        onStart: function(){ recBtn.classList.add("is-recording"); setText("comfortRecLabel", "Recording… tap to stop"); document.getElementById("comfortPreview").hidden = true; document.getElementById("comfortSave").disabled = true; },
        onTick: function(sec){
          comfortState.secs = Math.min(sec, COMFORT_MAX_SECONDS);
          setText("comfortStatus", "Recording " + comfortClock(comfortState.secs) + " of " + comfortClock(COMFORT_MAX_SECONDS));
          if(sec >= COMFORT_MAX_SECONDS && comfortState.recorder && comfortState.recorder.isActive()) comfortState.recorder.stop();
        },
        onStop: function(blob, url){
          comfortState.blob = blob; comfortState.url = url; comfortState.secs = Math.max(1, comfortState.secs);
          recBtn.classList.remove("is-recording"); setText("comfortRecLabel", "Record again");
          setText("comfortStatus", "Recorded " + comfortClock(comfortState.secs) + ". Have a listen, then save it.");
          var pv = document.getElementById("comfortPreview"); pv.src = url; pv.hidden = false;
          document.getElementById("comfortSave").disabled = false;
        },
        onError: function(msg){ recBtn.classList.remove("is-recording"); setText("comfortStatus", msg); }
      }, { scope:"comfortOverlay" });
      comfortState.recorder.start();
    });
    document.getElementById("comfortSave").addEventListener("click", function(){
      if(!comfortState.blob) return;
      var save = document.getElementById("comfortSave"), id = uid("cmf"), secs = comfortState.secs, old = DB.comfort[ME];
      save.disabled = true;
      // the recording is stored first; only then does your partner see that it exists
      idbPutMedia(id, comfortState.blob, function(err){
        if(err){ save.disabled = false; showToast("Couldn't save that on this device. Free some space and try again.", true); return; }
        var ok = mutate(function(db){ db.comfort[ME] = { id:id, secs:secs, at:Date.now() }; });
        if(!ok){ idbDeleteMedia(id); save.disabled = false; return; }
        if(old){ idbDeleteMedia(old.id); delete MEDIA_URLS[old.id]; }
        comfortState.saved = true;
        closeOverlay("comfortOverlay");
        renderComfort();
        showToast("Saved. " + SPACE.partner.name + " can play it whenever they need you.");
      });
    });
  }

  // ---- Everything either of you asked for, kept in one quiet list ----
  function renderNeedHistory(){
    var body = document.getElementById("needHistoryBody");
    if(!body) return;
    var p = SPACE.partner.name;
    var fmt = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short", year:"numeric", hour:"numeric", minute:"2-digit" });
    var list = DB.requests.slice().sort(function(x, y){ return (y.sentAt || 0) - (x.sentAt || 0); }).slice(0, 60);
    body.innerHTML = !list.length ? '<p class="dna-empty">Nothing here yet.</p>' : '<ul class="dna-rows">' + list.map(function(r){
      var mine = r.by === ME, who = mine ? "You" : p, other = mine ? p : "you";
      var out = r.status === "pending" ? "Waiting to send"
        : r.reply === "here" ? (mine ? p + " answered: I'm here" : "You answered: I'm here")
        : r.reply === "later" ? (mine ? p + " saw it and couldn't right then" : "You saw it and couldn't right then")
        : r.noReply ? "No reply was needed" : (mine ? "No answer recorded" : "Not answered");
      return '<li><div class="dna-row-copy"><span class="title">'+escapeHtml(who + " could use " + String(r.title).toLowerCase())+'</span>'+
        (r.note ? '<span class="sub">“'+escapeHtml(r.note)+'”</span>' : '')+
        '<span class="sub">'+escapeHtml(fmt.format(new Date(r.sentAt || 0)) + " · " + out)+'</span></div></li>';
    }).join("") + '</ul>';
  }

  // ---- Request side: "I could use…" ----
  var needRequestState = { selectedId:null, voiceBlobUrl:null, recorder:null };

  function renderNeedRequestOptions(){
    var wrap = document.getElementById("needRequestOptions");
    wrap.innerHTML = "";
    SPACE.needYou.forEach(function(item){
      var b = el("button","need-request-option");
      b.type = "button";
      b.textContent = item.title;
      b.setAttribute("data-need-id", item.id);
      b.addEventListener("click", function(){
        needRequestState.selectedId = item.id;
        wrap.querySelectorAll(".need-request-option").forEach(function(o){ o.classList.remove("is-selected"); });
        b.classList.add("is-selected");
        updateNeedRequestSendState();
      });
      wrap.appendChild(b);
    });
  }

  function openNeedRequest(preselectId){
    needRequestState = { selectedId: preselectId || null, voiceBlobUrl:null, voiceBlob:null, recorder:null };
    document.getElementById("needRequestNote").value = "";
    document.getElementById("needNoReplyCheck").checked = true;
    var urg = document.getElementById("needUrgentCheck"); if(urg) urg.checked = false;
    setText("needUrgentText", "This can't wait — reach " + SPACE.partner.name + " even in their quiet hours");
    var voiceStatus = document.getElementById("needRequestVoiceStatus");
    var voiceBtn = document.getElementById("needRequestVoiceBtn");
    voiceStatus.textContent = "";
    voiceBtn.classList.remove("is-recording");
    document.getElementById("needRequestVoiceLabel").textContent = "Add a short voice request";
    renderNeedRequestOptions();
    if(preselectId){
      var match = document.querySelector('[data-need-id="'+preselectId+'"]');
      if(match) match.classList.add("is-selected");
    }
    updateNeedRequestSendState();
    openOverlay("needRequestOverlay");
  }

  function updateNeedRequestSendState(){
    var send = document.getElementById("needRequestSend");
    var hasNote = document.getElementById("needRequestNote").value.trim().length > 0;
    send.disabled = !(needRequestState.selectedId || hasNote || needRequestState.voiceBlobUrl);
  }

  function wireNeedRequest(){
    document.getElementById("needRequestNote").addEventListener("input", updateNeedRequestSendState);

    var voiceBtn = document.getElementById("needRequestVoiceBtn");
    var voiceStatus = document.getElementById("needRequestVoiceStatus");
    var voiceLabel = document.getElementById("needRequestVoiceLabel");
    voiceBtn.addEventListener("click", function(){
      if(needRequestState.recorder && needRequestState.recorder.isActive()){
        needRequestState.recorder.stop();
        return;
      }
      if(needRequestState.recorder && needRequestState.recorder.isBusy()) return;   // still asking for the microphone
      needRequestState.recorder = makeRecorder({
        onStart: function(){
          voiceBtn.classList.add("is-recording");
          voiceLabel.textContent = "Recording… tap to stop";
        },
        onTick: function(sec){
          voiceStatus.textContent = "0:" + (sec < 10 ? "0"+sec : sec);
        },
        onStop: function(blob, url){
          needRequestState.voiceBlobUrl = url;
          needRequestState.voiceBlob = blob;
          voiceBtn.classList.remove("is-recording");
          voiceLabel.textContent = "Re-record voice request";
          voiceStatus.innerHTML = "Voice request ready";
          updateNeedRequestSendState();
        },
        onError: function(msg){
          voiceBtn.classList.remove("is-recording");
          voiceStatus.textContent = msg;
        }
      }, { scope:"needRequestOverlay" });
      needRequestState.recorder.start();
    });

    document.getElementById("needRequestSend").addEventListener("click", function(){
      var note = document.getElementById("needRequestNote").value.trim();
      var noReply = document.getElementById("needNoReplyCheck").checked;
      var item = SPACE.needYou.filter(function(n){ return n.id === needRequestState.selectedId; })[0];
      var title = item ? item.title : (note ? "something on your mind" : "just this");
      var reqItem = {
        id: uid("req"), title:title, note:note, voice: !!needRequestState.voiceBlob,
        hasVoice: !!needRequestState.voiceBlob,
        noReply:noReply, sentAt: Date.now(),
        status: isOffline() ? "pending" : "sent" // pending → sent → delivered (delivered is tracked, never shown, to avoid read-pressure)
      };
      // Persist the actual recorded voice Blob (not just its throwaway object
      // URL) so a voice request survives a reload or an offline session the
      // same way a captured moment's media does — see the moment-capture
      // IndexedDB pipeline above.
      reqItem.urgent = !!(document.getElementById("needUrgentCheck") || {}).checked;
      var sendBtn = document.getElementById("needRequestSend");
      var deliver = function(){
        SPACE.sentRequests.push(reqItem);
        if(!saveSentRequests()) return;      // not saved: the sheet stays open with everything still in it
        needRequestState.sent = true;
        closeOverlay("needRequestOverlay");
        showToast(isOffline()
          ? "Saved on this device. It'll reach " + SPACE.partner.name + " once you're back online."
          : (noReply ? "Sent to " + SPACE.partner.name + " — no reply needed." : "Sent to " + SPACE.partner.name + "."));
        renderSentLine();
        if(!isOffline()) markRequestDelivered(reqItem);
      };
      // The recording is written to this device first; only then is the request sent.
      if(needRequestState.voiceBlob){
        sendBtn.disabled = true;
        idbPutMedia(reqItem.id, needRequestState.voiceBlob, function(err){
          sendBtn.disabled = false;
          if(err){ showToast("Couldn't save your voice on this device, so nothing was sent. Free some space and try again.", true); return; }
          deliver();
        });
      } else deliver();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Thinking of you notes                                                */
  /* ------------------------------------------------------------------ */
  var THINKING_HEART_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M12 20s-7-4.35-9.5-8.5C.5 7.5 3 4 6.5 4c2 0 3.5 1.3 4.5 2.8C12 4.3 13.5 3 15.5 3 19 3 21.5 6.5 19.5 8.5 17 12.65 12 20 12 20z"/></svg>';
  var notesShown = 40; // how many are drawn; every note stays saved
  function renderNotes(){
    var row = document.getElementById("notesRow");
    row.innerHTML = "";
    var hiddenNotes = Math.max(0, SPACE.notes.length - notesShown);
    SPACE.notes.slice(0, notesShown).forEach(function(n){
      var pill = el("span","note-pill");
      // A wordless "Thinking of you" tap has no text — show the same tiny
      // affection signal instead of an empty pill, never a placeholder like
      // "New activity".
      var body = n.text ? escapeHtml(n.text) : (THINKING_HEART_SVG + "Thinking of you");
      pill.innerHTML = whoDot(n.who) + body;
      row.appendChild(pill);
    });
    if(hiddenNotes){
      var more = el("button", "note-pill note-pill--more");
      more.type = "button";
      more.textContent = "Show " + Math.min(hiddenNotes, 60) + " earlier";
      more.addEventListener("click", function(){ notesShown += 60; renderNotes(); });
      row.appendChild(more);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Our Story chapters + Letters                                        */
  /* ------------------------------------------------------------------ */
  function renderChapters(){
    var grid = document.getElementById("chaptersGrid");
    if(!grid) return;
    grid.innerHTML = "";
    if(!SPACE.chapters.length){
      grid.innerHTML = '<div class="tl-empty" style="grid-column:1 / -1">'+emptyArt("chapters")+'<p class="body-m">No chapters yet.</p><p class="body-s">Add the first one — where your story starts.</p></div>';
    }
    SPACE.chapters.forEach(function(c, i){
      var tile = el("article","chapter-tile");
      tile.setAttribute("data-chapter-index", String(i)); // stable target for the Our Story timeline scrubber's "jump to" clicks
      tile.setAttribute("tabindex", "0");
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-expanded", "false");
      if(c.photo && !c.cover){
        tile.appendChild(photoLayer(c.photo));
      } else {
        // No picture of its own: borrow the first memory that falls inside it.
        var cover = el("div","photo chapter-cover");
        var nextCh = SPACE.chapters[i+1];
        var first = DB.memories.filter(function(m){ return m.type === "photo" && m.date >= c.date && (!nextCh || m.date < nextCh.date); })
          .sort(function(x, y){ return x.date < y.date ? -1 : 1; })[0];
        var coverId = c.cover || (first && first.id);
        if(coverId){
          (function(coverEl, id){
            if(MEDIA_URLS[id]){ coverEl.style.backgroundImage = "url("+MEDIA_URLS[id]+")"; return; }
            idbGetMedia(id, function(err, blob){
              if(err || !blob) return;
              MEDIA_URLS[id] = URL.createObjectURL(blob);
              coverEl.style.backgroundImage = "url("+MEDIA_URLS[id]+")";
            });
          })(cover, coverId);
        }
        tile.appendChild(cover);
      }
      tile.appendChild(scrim());
      tile.insertAdjacentHTML("beforeend", '<button type="button" class="chapter-edit" data-chapter-edit="'+escapeHtml(c.id)+'" aria-label="Edit chapter: '+escapeHtml(c.title)+'">Edit</button>');
      var meta = el("div","moment-meta");
      meta.innerHTML =
        '<span class="eyebrow">'+escapeHtml(c.meta)+'</span>'+
        '<p class="moment-caption">'+escapeHtml(c.title)+'</p>'+
        (c.note ? '<span class="chapter-tap-hint">Tap to read more ›</span><p class="chapter-note">'+escapeHtml(c.note)+'</p>' : '');
      tile.appendChild(meta);
      grid.appendChild(tile);
    });

    renderStoryTimeline();
  }

  function wireChapterExpand(){
    var grid = document.getElementById("chaptersGrid");
    if(!grid) return;
    grid.addEventListener("click", function(e){
      var editBtn = e.target.closest("[data-chapter-edit]");
      if(editBtn){ openChapterEditor(editBtn.getAttribute("data-chapter-edit")); return; }
      var tile = e.target.closest(".chapter-tile");
      if(!tile || !tile.querySelector(".chapter-note")) return;
      var open = !tile.classList.contains("is-expanded");
      tile.classList.toggle("is-expanded", open);
      tile.setAttribute("aria-expanded", open ? "true" : "false");
    });
    grid.addEventListener("keydown", function(e){
      if(e.key !== "Enter" && e.key !== " ") return;
      if(e.target.closest("[data-chapter-edit]")) return; // the Edit button handles its own key press
      var tile = e.target.closest(".chapter-tile");
      if(!tile) return;
      e.preventDefault();
      tile.click();
    });

    wireChapterEditorUi();
    var addBtn = document.getElementById("addChapterBtn");
    if(addBtn) addBtn.addEventListener("click", function(){ openChapterEditor(null); });
    var saveBtn = document.getElementById("chapterSave");
    if(saveBtn) saveBtn.addEventListener("click", saveChapterEditor);
    var delBtn = document.getElementById("chapterDelete");
    if(delBtn) delBtn.addEventListener("click", function(){
      if(!chapterEditState.armed){
        chapterEditState.armed = true;
        delBtn.classList.add("is-armed"); delBtn.querySelector("span").textContent = "Tap again to remove";
        return;
      }
      var id = chapterEditState.id;
      if(!mutate(function(db){ db.chapters = db.chapters.filter(function(x){ return x.id !== id; }); })) return;
      renderChapters();
      renderMemoryTimeline();
      closeOverlay("chapterOverlay");
      showToast("Chapter removed. Its memories stay in the timeline.");
    });
  }

  // Chapters belong to both of you — either partner can add or reshape one.
  var chapterEditState = { id:null, armed:false, cover:"" };
  var CHAPTER_IDEAS = ["First hello", "Long distance begins", "Our first reunion", "Moving cities", "The hard winter", "Finally together"];
  // "Feb 2024 – Jun 2024" for a chapter starting on `date`, given every other chapter.
  function chapterSpan(date, exceptId){
    if(!validIso(date)) return "";
    var later = DB.chapters.filter(function(x){ return x.id !== exceptId && x.date > date; }).sort(function(x, y){ return x.date < y.date ? -1 : 1; })[0];
    return !later ? "Since " + monthYear(date) : monthYear(date) === monthYear(later.date) ? monthYear(date) : monthYear(date) + " – " + monthYear(later.date);
  }
  function chapterPhotoMemories(){
    return DB.memories.filter(function(m){ return m.type === "photo"; }).sort(function(x, y){ return x.date < y.date ? 1 : -1; }).slice(0, 18);
  }
  function loadMemoryUrl(id, cb){
    if(MEDIA_URLS[id]){ cb(MEDIA_URLS[id]); return; }
    idbGetMedia(id, function(err, blob){
      if(err || !blob) return;
      MEDIA_URLS[id] = URL.createObjectURL(blob);
      cb(MEDIA_URLS[id]);
    });
  }
  function updateChapterPreview(){
    var title = document.getElementById("chapterTitleInput").value.trim();
    var date = document.getElementById("chapterDateInput").value;
    var note = document.getElementById("chapterNoteInput").value.trim();
    setText("chapterPreviewTitle", title || "Name this chapter");
    setText("chapterPreviewDates", chapterSpan(date, chapterEditState.id) || "Pick the first day");
    setText("chapterPreviewNote", note);
    setText("chapterNoteCount", document.getElementById("chapterNoteInput").value.length + " / 200");
    var span = chapterSpan(date, chapterEditState.id);
    setText("chapterRunsLine", span ? (/^Since/.test(span) ? "Runs from " + span.slice(6) + " until today" : "Runs " + span) + ". Memories are filed under it by their dates." : "It runs until your next chapter starts. Memories are filed under it by their dates.");
    // cover
    var cover = document.getElementById("chapterPreviewCover");
    cover.className = "photo ce-cover";
    cover.style.backgroundImage = "";
    var id = chapterEditState.cover;
    if(!id){
      var ch = chapterEditState.id ? DB.chapters.filter(function(x){ return x.id === chapterEditState.id; })[0] : null;
      if(ch && ch.photo){ cover.classList.add("photo--" + ch.photo); return; }
      var later = DB.chapters.filter(function(x){ return x.id !== chapterEditState.id && x.date > date; }).sort(function(x, y){ return x.date < y.date ? -1 : 1; })[0];
      var first = validIso(date) ? DB.memories.filter(function(m){ return m.type === "photo" && m.date >= date && (!later || m.date < later.date); }).sort(function(x, y){ return x.date < y.date ? -1 : 1; })[0] : null;
      id = first && first.id;
    }
    if(id) loadMemoryUrl(id, function(url){ if((chapterEditState.cover || id) === id || !chapterEditState.cover) cover.style.backgroundImage = "url("+url+")"; });
  }
  function renderChapterCovers(){
    var host = document.getElementById("chapterCovers");
    var mems = chapterPhotoMemories();
    var html = '<button type="button" class="ce-cover-opt ce-cover-auto'+(chapterEditState.cover ? '' : ' is-on')+'" role="option" aria-selected="'+(!chapterEditState.cover)+'" data-cover=""><span>Auto</span></button>';
    mems.forEach(function(m){
      html += '<button type="button" class="ce-cover-opt'+(chapterEditState.cover === m.id ? ' is-on' : '')+'" role="option" aria-selected="'+(chapterEditState.cover === m.id)+'" data-cover="'+escapeHtml(m.id)+'" aria-label="Photo from '+escapeHtml(dayLabel(m.date))+'"></button>';
    });
    if(!mems.length) html += '<span class="ce-help ce-nophotos">Photos you add to Our Story will show up here.</span>';
    host.innerHTML = html;
    host.querySelectorAll("[data-cover]").forEach(function(b){
      var id = b.getAttribute("data-cover");
      if(id) loadMemoryUrl(id, function(url){ b.style.backgroundImage = "url("+url+")"; });
    });
  }
  function renderChapterIdeas(){
    var host = document.getElementById("chapterIdeas");
    var cur = document.getElementById("chapterTitleInput").value.trim();
    host.hidden = !!cur;
    host.innerHTML = cur ? "" : CHAPTER_IDEAS.map(function(t){ return '<button type="button" class="ce-idea" data-idea="'+escapeHtml(t)+'">'+escapeHtml(t)+'</button>'; }).join("");
  }
  function wireChapterEditorUi(){
    var title = document.getElementById("chapterTitleInput"), date = document.getElementById("chapterDateInput"), note = document.getElementById("chapterNoteInput");
    [title, date, note].forEach(function(n){ n.addEventListener("input", function(){ updateChapterPreview(); if(n === title) renderChapterIdeas(); }); });
    document.getElementById("chapterIdeas").addEventListener("click", function(e){
      var b = e.target.closest("[data-idea]"); if(!b) return;
      title.value = b.getAttribute("data-idea"); renderChapterIdeas(); updateChapterPreview(); title.focus();
    });
    document.getElementById("chapterCovers").addEventListener("click", function(e){
      var b = e.target.closest("[data-cover]"); if(!b) return;
      chapterEditState.cover = b.getAttribute("data-cover") || "";
      document.querySelectorAll("#chapterCovers [data-cover]").forEach(function(x){
        var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", on ? "true" : "false");
      });
      updateChapterPreview();
    });
  }
  function openChapterEditor(id){
    var ch = id ? DB.chapters.filter(function(x){ return x.id === id; })[0] : null;
    chapterEditState = { id: ch ? ch.id : null, armed:false, cover: ch && ch.cover ? ch.cover : "" };
    setText("chapterOverlayTitle", ch ? "Edit chapter" : "New chapter");
    document.getElementById("chapterTitleInput").value = ch ? ch.title : "";
    var d = document.getElementById("chapterDateInput");
    d.value = ch ? ch.date : "";
    d.max = isoFromDate(new Date());
    document.getElementById("chapterNoteInput").value = ch ? (ch.note || "") : "";
    setText("chapterFormNote", "");
    var del = document.getElementById("chapterDelete");
    del.hidden = !ch;
    del.classList.remove("is-armed");
    del.querySelector("span").textContent = "Remove chapter";
    renderChapterCovers();
    renderChapterIdeas();
    updateChapterPreview();
    openOverlay("chapterOverlay");
  }
  function saveChapterEditor(){
    var title = document.getElementById("chapterTitleInput").value.trim();
    var date = document.getElementById("chapterDateInput").value;
    var note = document.getElementById("chapterNoteInput").value.trim();
    if(!title){ setText("chapterFormNote", "Give the chapter a name."); return; }
    if(!validIso(date)){ setText("chapterFormNote", "Pick the day this chapter began — not in the future."); return; }
    var id = chapterEditState.id;
    var chapterSaved = mutate(function(db){
      var ch = id ? db.chapters.filter(function(x){ return x.id === id; })[0] : null;
      if(ch){
        if(ch.date !== date) delete ch.meta; // the date label is recalculated from the new dates
        ch.title = title; ch.date = date; ch.note = note; ch.cover = chapterEditState.cover || "";
      } else {
        db.chapters.push({ id: uid("ch"), by: ME, title: title, date: date, note: note, cover: chapterEditState.cover || "" });
        // the chapter before it now ends where this one starts
        db.chapters.forEach(function(x){ if(x.demo && x.date < date) delete x.meta; });
      }
    });
    if(!chapterSaved){ setText("chapterFormNote", "Not saved. Your changes are still here, so you can try again."); return; }
    renderChapters();
    renderMemoryTimeline();
    closeOverlay("chapterOverlay");
    showToast(id ? "Chapter updated." : "Chapter added — memories from then on now sit under it.");
    if(!id){ markFirst("chapter"); celebrate(); }
  }

  /* ------------------------------------------------------------------ */
  /* Our Story — interactive timeline scrubber above the Chapters grid.  */
  /* A dot per chapter, positioned by elapsed time between the first     */
  /* chapter and today, plus a fixed "Today" marker. Hover/focus shows a */
  /* floating date tip; click scrolls to and briefly highlights the      */
  /* matching chapter tile. Purely a navigation/visual aid — it reads no */
  /* new data and changes nothing else about the chapters themselves.    */
  /* ------------------------------------------------------------------ */
  function renderStoryTimeline(){
    var rail = document.getElementById("storyScrubber");
    if(!rail) return;
    var chapters = SPACE.chapters;
    // Clear any previously rendered dots (keep the track + tip elements).
    rail.querySelectorAll(".story-dot").forEach(function(d){ d.remove(); });
    rail.hidden = !chapters.length;
    if(!chapters.length) return;

    var t0 = new Date(chapters[0].date || chapters[0].meta).getTime();
    var now = Date.now();
    var span = Math.max(1, now - t0);

    function pctFor(dateStr){
      var t = new Date(dateStr).getTime();
      var p = (t - t0) / span;
      return Math.max(0, Math.min(1, p)) * 100;
    }

    chapters.forEach(function(c, i){
      if(!c.date) return;
      var dot = el("button","story-dot");
      dot.type = "button";
      dot.style.left = pctFor(c.date) + "%";
      dot.setAttribute("data-chapter-index", String(i));
      dot.setAttribute("data-chapter-label", c.title + " · " + c.meta);
      dot.setAttribute("aria-label", "Jump to: " + c.title + ", " + c.meta);
      dot.setAttribute("role","listitem");
      rail.appendChild(dot);
    });

    // Fixed "today" marker at the right end of the rail.
    var todayDot = el("span","story-dot story-dot--today");
    todayDot.style.left = "100%";
    todayDot.setAttribute("aria-hidden","true");
    rail.appendChild(todayDot);
    spaceStoryDots();
  }
  // Chapters that start close together would stack their dots on top of each
  // other. Nudge them apart so every dot stays separate and tappable; the
  // order along the line never changes.
  function spaceStoryDots(){
    var rail = document.getElementById("storyScrubber");
    if(!rail || rail.hidden) return;
    var w = rail.clientWidth - 12;                 // the track is inset 6px each side
    if(w <= 0) return;
    var dots = Array.prototype.slice.call(rail.querySelectorAll(".story-dot"));
    if(dots.length < 2) return;
    var GAP = Math.min(18, w / (dots.length - 1)); // centre-to-centre
    var items = dots.map(function(d){
      if(!d.hasAttribute("data-pct")) d.setAttribute("data-pct", String(parseFloat(d.style.left) || 0));
      return { el: d, x: Number(d.getAttribute("data-pct")) / 100 * w };
    }).sort(function(p, q){ return p.x - q.x; });
    var i;
    for(i = 1; i < items.length; i++){ if(items[i].x - items[i-1].x < GAP) items[i].x = items[i-1].x + GAP; }
    if(items[items.length - 1].x > w){
      items[items.length - 1].x = w;
      for(i = items.length - 2; i >= 0; i--){ if(items[i+1].x - items[i].x < GAP) items[i].x = items[i+1].x - GAP; }
    }
    items.forEach(function(it){ it.el.style.left = (Math.max(0, it.x) / w * 100) + "%"; });
  }
  window.addEventListener("resize", function(){ spaceStoryDots(); });
  // The rail has no width while Our Story is off screen — space the dots the moment it gets one.
  if(window.ResizeObserver){
    document.addEventListener("DOMContentLoaded", function(){
      var rail = document.getElementById("storyScrubber");
      if(rail) new ResizeObserver(function(){ spaceStoryDots(); }).observe(rail);
    });
  }

  function wireStoryTimeline(){
    var rail = document.getElementById("storyScrubber");
    var tip = document.getElementById("storyScrubberTip");
    if(!rail || !tip) return;

    function showTip(dot){
      var full = dot.getAttribute("data-chapter-label") || "";
      tip.textContent = full;
      tip.style.left = dot.style.left;
      tip.style.setProperty("--tip-arrow", "50%");
      tip.hidden = false;
      // One line only: a long chapter name is shortened so the label never covers the heading above.
      var cut = full.length;
      while((tip.scrollWidth > tip.clientWidth + 1 || tip.offsetWidth > rail.clientWidth) && cut > 8){ cut -= 2; tip.textContent = full.slice(0, cut).replace(/[\s·–-]+$/, "") + "…"; }
      // Keep the label on screen: slide it back inside the rail and let its arrow stay on the dot.
      var rw = rail.clientWidth, tw = tip.offsetWidth, x = dot.offsetLeft;
      if(rw > 0 && tw > 0){
        var c = Math.max(tw / 2, Math.min(rw - tw / 2, x));
        if(tw >= rw) c = rw / 2;
        tip.style.left = c + "px";
        tip.style.setProperty("--tip-arrow", Math.max(10, Math.min(tw - 10, tw / 2 + (x - c))) + "px");
      }
    }
    function hideTip(){ tip.hidden = true; }

    rail.addEventListener("pointerover", function(e){
      var dot = e.target.closest(".story-dot:not(.story-dot--today)");
      if(dot) showTip(dot);
    });
    rail.addEventListener("focusin", function(e){
      var dot = e.target.closest(".story-dot:not(.story-dot--today)");
      if(dot) showTip(dot);
    });
    rail.addEventListener("pointerleave", hideTip);
    rail.addEventListener("focusout", hideTip);

    rail.addEventListener("click", function(e){
      var dot = e.target.closest(".story-dot:not(.story-dot--today)");
      if(!dot) return;
      var idx = dot.getAttribute("data-chapter-index");
      var tile = document.querySelector('.chapter-tile[data-chapter-index="'+idx+'"]');
      if(!tile) return;
      tile.scrollIntoView({ behavior:"smooth", block:"center" });
      tile.classList.add("is-highlighted");
      window.setTimeout(function(){ tile.classList.remove("is-highlighted"); }, 1400);
    });
  }

  function renderLetters(){
    var list = document.getElementById("lettersList");
    if(!list) return;
    list.innerHTML = "";
    SPACE.letters.forEach(function(l, i){
      var li = el("li","letter-item"+(l.locked?" is-sealed":""));
      li.setAttribute("data-letter-index", String(i));
      li.setAttribute("tabindex", "0");
      li.setAttribute("role", "button");
      var countdown = "";
      if(l.locked && l.openDate){
        var days = daysBetween(new Date(), new Date(l.openDate + "T00:00:00"));
        if(days >= 0) countdown = '<span class="letter-countdown">'+countdownLabel(days)+'</span>';
      }
      var extras = "";
      if(l.song) extras += '<span class="letter-extra-icon" title="Has a song">'+
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg></span>';
      if(l.photos && l.photos.length) extras += '<span class="letter-extra-icon" title="Has photos">'+
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5.5-5-7 6"/></svg></span>';
      li.innerHTML =
        '<span class="letter-seal" aria-hidden="true"></span>'+
        '<div class="letter-body"><h4>'+escapeHtml(l.title)+extras+'</h4></div>'+
        '<div class="letter-meta-col">'+
          '<span class="letter-state'+(l.locked?" is-locked":"")+'">'+escapeHtml(l.state)+'</span>'+
          countdown+
        '</div>';
      list.appendChild(li);
    });
  }

  // Tapping an unlocked letter cracks the seal, then opens it as a page of
  // its own. A locked one shakes and says when it opens — never early.
  function wireLetterPreview(){
    var list = document.getElementById("lettersList");
    if(!list) return;

    function showLetter(l){
      document.getElementById("letterPreviewTitle").textContent = l.title;
      document.getElementById("letterPreviewBody").textContent = l.body || "";
      document.getElementById("letterPreviewState").textContent = l.state;
      document.getElementById("letterPreviewSignature").textContent = l.from ? "— " + l.from : "";

      var photosWrap = document.getElementById("letterPreviewPhotos");
      if(photosWrap){
        if(l.photos && l.photos.length){
          photosWrap.innerHTML = l.photos.map(function(src, i){
            var tilt = (i % 2 ? 1 : -1) * (3 + i * 3);
            return '<img class="letter-photo-polaroid" src="'+escapeHtml(src)+'" alt="" style="--tilt:'+tilt+'deg">';
          }).join("");
          photosWrap.hidden = false;
        } else {
          photosWrap.innerHTML = "";
          photosWrap.hidden = true;
        }
      }

      var songWrap = document.getElementById("letterPreviewSong");
      if(songWrap){
        if(l.song && l.song.embedSrc){
          var h = l.song.type === "spotify" ? 80 : 166;
          songWrap.innerHTML = '<iframe src="'+escapeHtml(l.song.embedSrc)+'" height="'+h+'" loading="lazy" ' +
            'allow="encrypted-media; autoplay; clipboard-write; picture-in-picture" title="Song"></iframe>';
          songWrap.hidden = false;
        } else {
          songWrap.innerHTML = "";
          songWrap.hidden = true;
        }
      }

      // Only nudge a reply when someone else wrote the letter — never
      // prompt you to "write back" to your own words.
      var replyRow = document.getElementById("letterPreviewReply");
      var fromSomeoneElse = !!(l.from && l.from !== SPACE.currentUser.name);
      if(replyRow){
        replyRow.hidden = !fromSomeoneElse;
        if(fromSomeoneElse){
          var note = document.getElementById("letterPreviewReplyNote");
          if(note) note.textContent = l.from + " wrote you something. Maybe it's your turn.";
        }
      }
      openOverlay("letterPreviewOverlay");
    }

    function openLetter(li){
      var idx = Number(li.getAttribute("data-letter-index"));
      var l = SPACE.letters[idx];
      if(!l) return;
      // A sealed letter stays sealed for the person it's written to; the
      // writer can still reread their own words.
      if(l.locked && (l.by !== ME || !l.body)){
        li.classList.remove("is-shake");
        void li.offsetWidth;
        li.classList.add("is-shake");
        showToast("Still sealed · " + l.state.replace(/^Opens /, "opens "));
        return;
      }
      // A brief "breaking the seal" beat before the letter itself appears.
      li.classList.add("is-cracking");
      window.setTimeout(function(){
        li.classList.remove("is-cracking");
        showLetter(l);
      }, 320);
    }

    list.addEventListener("click", function(e){
      var li = e.target.closest(".letter-item");
      if(li) openLetter(li);
    });
    list.addEventListener("keydown", function(e){
      if(e.key !== "Enter" && e.key !== " ") return;
      var li = e.target.closest(".letter-item");
      if(!li) return;
      e.preventDefault();
      openLetter(li);
    });

    var replyBtn = document.getElementById("letterPreviewReplyBtn");
    if(replyBtn){
      replyBtn.addEventListener("click", function(){
        closeOverlay("letterPreviewOverlay");
        resetLetterComposer(); restoreLetterDraft();
        openOverlay("letterOverlay");
      });
    }
  }

  // The Letters tab's own tap-to-open gate — once removed, it stays open
  // for the rest of this visit (resets on reload, like a mailbox you
  // already checked today doesn't need re-opening until tomorrow).
  function wireLettersGate(){
    var view = document.getElementById("view-letters");
    var gate = document.getElementById("lettersGate");
    var btn = document.getElementById("lettersGateBtn");
    var content = document.getElementById("lettersContent");
    if(!view || !gate || !btn || !content) return;

    btn.addEventListener("click", function(){
      gate.classList.add("is-opening");
      window.setTimeout(function(){
        view.classList.remove("letters-gated");
        content.classList.add("is-revealing");
        content.addEventListener("animationend", function handler(){
          content.classList.remove("is-revealing");
          content.removeEventListener("animationend", handler);
        });
      }, 300);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Write a Letter — real composer. Unlike a Moment, a letter is          */
  /* deliberate and can wait: it's either unlocked right away or sealed   */
  /* until a chosen date, and it's persisted for real (see LETTERS_KEY    */
  /* above), not just appended to the in-memory demo list.                */
  /* ------------------------------------------------------------------ */
  var letterComposeState = { timing:"anytime", photos:[] };
  // A half-written letter is kept on this device (never shared) until it is sealed or cleared.
  var LETTER_DRAFT_KEY = NS + "pairlum-letter-draft-v1-" + ME;
  function readLetterDraft(){ try{ return JSON.parse(localStorage.getItem(LETTER_DRAFT_KEY)) || null; }catch(e){ return null; } }
  function clearLetterDraft(){ try{ localStorage.removeItem(LETTER_DRAFT_KEY); }catch(e){} idbDeleteKeys(["letterdraft:" + ME]); }
  function saveLetterDraft(){
    var d = {
      title: document.getElementById("letterSubjectInput").value, body: document.getElementById("letterBodyInput").value,
      song: document.getElementById("letterSongInput").value, date: document.getElementById("letterDateInput").value,
      timing: letterComposeState.timing, at: Date.now()
    };
    var note = document.getElementById("letterDraftNote");
    if(!d.title.trim() && !d.body.trim()){ clearLetterDraft(); if(note) note.hidden = true; return; }
    var ok = true;
    try{ localStorage.setItem(LETTER_DRAFT_KEY, JSON.stringify(d)); }catch(e){ ok = false; }
    if(note){
      note.hidden = false;
      note.innerHTML = ok ? 'Draft kept on this device. <button type="button" class="ambient-link" id="letterDraftClear">Clear it</button>'
                          : 'This draft could not be kept: the device is out of space. Seal it before closing.';
    }
  }
  function restoreLetterDraft(){
    var d = readLetterDraft(), note = document.getElementById("letterDraftNote");
    if(note) note.hidden = true;
    if(!d) return;
    document.getElementById("letterSubjectInput").value = d.title || "";
    document.getElementById("letterBodyInput").value = d.body || "";
    document.getElementById("letterSongInput").value = d.song || "";
    document.getElementById("letterDateInput").value = d.date || "";
    letterComposeState.timing = d.timing === "date" ? "date" : "anytime";
    document.getElementById("letterDateRow").hidden = letterComposeState.timing !== "date";
    document.querySelectorAll("#letterTimingGrid .period-chip").forEach(function(chip){
      chip.classList.toggle("is-selected", chip.getAttribute("data-letter-timing") === letterComposeState.timing);
    });
    if(note){ note.hidden = false; note.innerHTML = 'Picked up where you left off' + (d.at ? ' (' + escapeHtml(agoLabel(d.at)) + ')' : '') + '. <button type="button" class="ambient-link" id="letterDraftClear">Start fresh</button>'; }
    updateLetterSendState();
    var state = letterComposeState;
    loadLetterDraftPhotos(function(photos){
      if(state !== letterComposeState || !photos.length || state.photos.length) return;
      state.photos = photos;
      renderLetterPhotoRow();
    });
  }

  function resetLetterComposer(){
    letterComposeState = { timing:"anytime", photos:[] };
    document.getElementById("letterSubjectInput").value = "";
    document.getElementById("letterBodyInput").value = "";
    document.getElementById("letterDateInput").value = "";
    document.getElementById("letterDateRow").hidden = true;
    document.getElementById("letterSongInput").value = "";
    document.getElementById("letterSongHint").textContent = "";
    document.getElementById("letterSongHint").className = "body-s letter-field-hint";
    document.querySelectorAll("#letterTimingGrid .period-chip").forEach(function(chip){
      chip.classList.toggle("is-selected", chip.getAttribute("data-letter-timing") === "anytime");
    });
    renderLetterPhotoRow();
    updateLetterSendState();
  }

  // Recognizes a Spotify track or YouTube video link and turns it into an
  // embeddable player address — no API key, no backend, just the public
  // embed endpoints those two services already offer anyone.
  function parseSongUrl(url){
    var spotifyMatch = url.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/);
    if(spotifyMatch) return { type:"spotify", url:url, embedSrc:"https://open.spotify.com/embed/track/"+spotifyMatch[1] };
    var ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/))([a-zA-Z0-9_-]{6,})/);
    if(ytMatch) return { type:"youtube", url:url, embedSrc:"https://www.youtube.com/embed/"+ytMatch[1] };
    return null;
  }

  // Shrinks a chosen photo client-side before it ever touches storage —
  // there's no server here, so everything a letter carries lives in the
  // browser's own localStorage, and a few full-resolution photos would
  // blow past that budget fast.
  function resizeImageFile(file, maxDim, cb){
    var reader = new FileReader(), finished = false;
    var end = function(v){ if(finished) return; finished = true; cb(v); };
    reader.onerror = function(){ end(null); };
    reader.onload = function(e){
      var img = new Image();
      img.onerror = function(){ end(null); }; // a format this browser cannot open
      img.onload = function(){
        try{
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          end(canvas.toDataURL("image/jpeg", 0.72));
        }catch(err){ end(null); }
      };
      img.src = e.target.result;
    };
    try{ reader.readAsDataURL(file); }catch(e){ end(null); }
  }

  var LETTER_PHOTO_MAX = 3;
  function onLetterPhotoChange(e){
    var files = Array.prototype.slice.call(e.target.files || []).filter(function(f){ return /^image\//.test(f.type); });
    var state = letterComposeState; // photos still decoding belong to THIS letter; a later one never receives them
    state.pending = state.pending || 0;
    var remaining = LETTER_PHOTO_MAX - state.photos.length - state.pending; // places already promised count as taken
    if(files.length > remaining) showToast("Up to 3 photos per letter.");
    files.slice(0, Math.max(0, remaining)).forEach(function(file){
      state.pending++;
      resizeImageFile(file, 640, function(dataUrl){
        state.pending--;
        if(state !== letterComposeState) return;      // that letter was closed or sealed meanwhile
        if(!dataUrl){ showToast("One photo could not be opened, so it was not added."); renderLetterPhotoRow(); return; }
        if(state.photos.length >= LETTER_PHOTO_MAX) return;
        state.photos.push(dataUrl);
        saveLetterDraftPhotos();
        renderLetterPhotoRow();
      });
    });
    try{ e.target.value = ""; }catch(err){}
  }
  // The photos of a letter in progress are kept with its draft, privately, on this device.
  var LETTER_DRAFT_MEDIA = "letterdraft:" + ME;
  function saveLetterDraftPhotos(){
    var photos = letterComposeState.photos.slice();
    if(!photos.length){ idbDeleteKeys([LETTER_DRAFT_MEDIA]); return; }
    idbPutMany([{ key: LETTER_DRAFT_MEDIA, blob: new Blob([JSON.stringify(photos)], { type: "application/json" }) }], function(){});
  }
  function loadLetterDraftPhotos(cb){
    withMediaDB(function(err, db){
      if(err) return cb([]);
      try{
        var req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(LETTER_DRAFT_MEDIA);
        req.onsuccess = function(){
          if(!req.result || !req.result.text) return cb([]);
          req.result.text().then(function(t){ var a = []; try{ a = JSON.parse(t); }catch(e){} cb(Array.isArray(a) ? a.filter(function(x){ return typeof x === "string" && /^data:image\//.test(x); }).slice(0, LETTER_PHOTO_MAX) : []); }, function(){ cb([]); });
        };
        req.onerror = function(){ cb([]); };
      }catch(e){ cb([]); }
    });
  }

  // Rebuilds the thumbnail row — current photos plus an "Add" tile while
  // there's still room for more, up to 3.
  function renderLetterPhotoRow(){
    var row = document.getElementById("letterPhotoRow");
    if(!row) return;
    var thumbs = letterComposeState.photos.map(function(src, i){
      return '<span class="letter-photo-thumb"><img src="'+escapeHtml(src)+'" alt="">'+
        '<button type="button" class="letter-photo-remove" data-photo-index="'+i+'" aria-label="Remove photo">✕</button></span>';
    }).join("");
    var addTile = (letterComposeState.photos.length + (letterComposeState.pending || 0)) < LETTER_PHOTO_MAX
      ? '<label class="letter-photo-add"><input type="file" accept="image/*" multiple id="letterPhotoInput" hidden>'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>'+
        '<span>Add</span></label>'
      : "";
    row.innerHTML = thumbs + addTile;
    var input = document.getElementById("letterPhotoInput");
    if(input) input.addEventListener("change", onLetterPhotoChange);
    row.querySelectorAll(".letter-photo-remove").forEach(function(btn){
      btn.addEventListener("click", function(){
        letterComposeState.photos.splice(Number(btn.getAttribute("data-photo-index")), 1);
        saveLetterDraftPhotos();
        renderLetterPhotoRow();
      });
    });
  }

  function updateLetterSendState(){
    var send = document.getElementById("letterSend");
    if(!send) return;
    var title = document.getElementById("letterSubjectInput").value.trim();
    var body = document.getElementById("letterBodyInput").value.trim();
    var dateOk = letterComposeState.timing !== "date" || !!document.getElementById("letterDateInput").value;
    send.disabled = !(title && body && dateOk);
  }

  function letterStateLabel(timing, dateVal){
    if(timing !== "date" || !dateVal) return "Unlocked anytime";
    var d = new Date(dateVal + "T00:00:00");
    var label = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short" }).format(d);
    return d.getTime() > Date.now() ? "Opens " + label : "Opens " + label + " · past due, opens now";
  }

  function wireLetterComposer(){
    document.querySelectorAll("[data-action='open-letter']").forEach(function(btn){
      btn.addEventListener("click", function(){ resetLetterComposer(); restoreLetterDraft(); openOverlay("letterOverlay"); });
    });

    document.getElementById("letterSubjectInput").addEventListener("input", updateLetterSendState);
    ["letterSubjectInput","letterBodyInput","letterSongInput","letterDateInput"].forEach(function(id){
      document.getElementById(id).addEventListener("input", saveLetterDraft);
    });
    document.getElementById("letterTimingGrid").addEventListener("click", function(){ window.setTimeout(saveLetterDraft, 0); });
    document.getElementById("letterDraftNote").addEventListener("click", function(e){
      if(!e.target.closest("#letterDraftClear")) return;
      clearLetterDraft(); resetLetterComposer(); this.hidden = true; updateLetterSendState();
    });
    document.getElementById("letterBodyInput").addEventListener("input", updateLetterSendState);
    document.getElementById("letterDateInput").addEventListener("input", updateLetterSendState);

    document.getElementById("letterSongInput").addEventListener("input", function(){
      var hint = document.getElementById("letterSongHint");
      var val = this.value.trim();
      if(!val){ hint.textContent = ""; hint.className = "body-s letter-field-hint"; return; }
      var parsed = parseSongUrl(val);
      hint.textContent = parsed
        ? (parsed.type === "spotify" ? "Spotify" : "YouTube") + " link recognized — it'll play right in the letter."
        : "Paste a Spotify or YouTube song link.";
      hint.className = "body-s letter-field-hint" + (parsed ? " is-ok" : " is-warn");
    });
    renderLetterPhotoRow();

    document.querySelectorAll("#letterTimingGrid .period-chip").forEach(function(chip){
      chip.addEventListener("click", function(){
        document.querySelectorAll("#letterTimingGrid .period-chip").forEach(function(c){ c.classList.remove("is-selected"); });
        chip.classList.add("is-selected");
        letterComposeState.timing = chip.getAttribute("data-letter-timing");
        document.getElementById("letterDateRow").hidden = letterComposeState.timing !== "date";
        updateLetterSendState();
      });
    });

    document.getElementById("letterSend").addEventListener("click", function(){
      var title = document.getElementById("letterSubjectInput").value.trim();
      var body = document.getElementById("letterBodyInput").value.trim();
      var dateVal = document.getElementById("letterDateInput").value;
      var locked = letterComposeState.timing === "date" && !!dateVal && spaceDayStart(dateVal) > Date.now();
      var songVal = document.getElementById("letterSongInput").value.trim();
      var songParsed = songVal ? parseSongUrl(songVal) : null;
      var letter = {
        id: uid("let"), title:title, body:body, from: SPACE.currentUser.name, openDate: letterComposeState.timing === "date" ? dateVal : null,
        state: letterStateLabel(letterComposeState.timing, dateVal), locked: locked, createdAt: Date.now(),
        song: songParsed, photos: letterComposeState.photos.slice()
      };
      letter.by = ME;
      var letterSaved = mutate(function(db){ db.letters.unshift(letter); });
      renderLetters();
      if(!letterSaved){ saveLetterDraft(); showToast("That letter was not sealed. Your words are still here; try fewer or smaller photos.", true); return; }
      clearLetterDraft();
      closeOverlay("letterOverlay");
      markFirst("letter");
      var toastMsg = locked
        ? "Sealed — " + SPACE.partner.name + " can open it on " + new Intl.DateTimeFormat("en-US",{day:"numeric",month:"long"}).format(new Date(dateVal+"T00:00:00")) + "."
        : "Added — " + SPACE.partner.name + " can open it anytime.";
      if(songVal && !songParsed) toastMsg += " Couldn't recognize that song link, so it wasn't added.";
      showToast(toastMsg);
    });
  }

  /* ------------------------------------------------------------------ */
  /* View navigation                                                      */
  /* ------------------------------------------------------------------ */
  // Swipe order — this array IS the navigation order, both for tap and for
  // the horizontal drag gesture below.
  var VIEW_ORDER = ["home","story","letters","us"];

  /* ------------------------------------------------------------------ */
  /* Mobile swipe navigation (Instagram-style horizontal paging)          */
  /*                                                                      */
  /* Only active under the same breakpoint the bottom nav already uses    */
  /* (max-width:859px). Desktop keeps the original tap → smooth-scroll    */
  /* behavior untouched. The track is dragged 1:1 with the pointer on     */
  /* every pointermove — this is a real finger-follow gesture, not a      */
  /* touchend-only setView() call.                                        */
  /* ------------------------------------------------------------------ */
  var SWIPE_EXCLUDE_SELECTOR = [
    ".overlay", "form", "textarea", "input", "select",
    "video", "audio", "input[type='range']",
    ".notes-row", ".history-row",      // horizontally-scrollable content
    "[data-no-page-swipe]"
  ].join(",");

  var swipeNav = (function(){
    var track = null, mainEl = null, ro = null;
    var mode = false;          // true once viewport matches the mobile breakpoint
    var currentIndex = 0;
    var drag = null;
    var THRESHOLD = 10;        // px of movement before we decide the gesture's axis
    var AXIS_RATIO = 1.2;      // horizontal must beat vertical by this factor to lock
    var DIST_RATIO = 0.22;     // fraction of viewport width that counts as "far enough"
    var VEL_MIN = 0.35;        // px/ms — a fast flick completes navigation even if short
    var EDGE_RESISTANCE = 0.32;

    function isActive(){ return mode; }
    function width(){ return (mainEl && mainEl.getBoundingClientRect().width) || window.innerWidth; }
    function baseOffset(i){ return -(i * width()); }

    function applyNavClasses(name){
      document.querySelectorAll(".view").forEach(function(v){
        v.classList.toggle("is-active", v.getAttribute("data-view-panel") === name);
      });
      document.querySelectorAll("[data-view]").forEach(function(btn){
        btn.classList.toggle("is-active", btn.getAttribute("data-view") === name);
      });
    }

    // Off-screen panels are fully unmounted from interaction/AT while in
    // swipe mode — they're still visually present (so a drag can reveal a
    // sliver of them) but shouldn't be tabbable or announced.
    function applyInert(){
      var views = document.querySelectorAll(".view");
      views.forEach(function(v, i){
        if(mode && i !== currentIndex){
          v.setAttribute("inert","");
          v.setAttribute("aria-hidden","true");
        } else {
          v.removeAttribute("inert");
          v.removeAttribute("aria-hidden");
        }
      });
    }

    // The track is a flex ROW, so by default its height equals its TALLEST
    // child — that would leave dead scrollable space under every view
    // shorter than the tallest one. Pin the track's height to only the
    // active view's height instead, and keep it in sync as that view's
    // content changes (moments added, overlays affecting layout, etc).
    // Height (and the overflow:hidden that actually clips) live on #main —
    // the untransformed viewport — not on the track that gets translated.
    // See the CSS comment above .view-track for why those two roles can't
    // share one element.
    function syncHeight(){
      if(!mainEl) return;
      if(!mode){ mainEl.style.height = ""; if(ro) ro.disconnect(); return; }
      var views = document.querySelectorAll(".view");
      var activeEl = views[currentIndex];
      if(!activeEl) return;
      if(!ro){
        ro = new ResizeObserver(function(){
          var el = document.querySelectorAll(".view")[currentIndex];
          if(el && mainEl) mainEl.style.height = el.getBoundingClientRect().height + "px";
        });
      }
      ro.disconnect();
      ro.observe(activeEl);
      mainEl.style.height = activeEl.getBoundingClientRect().height + "px";
    }

    function goToIndex(index, animate, resetScroll){
      index = Math.max(0, Math.min(VIEW_ORDER.length - 1, index));
      currentIndex = index;
      var name = VIEW_ORDER[index];
      applyNavClasses(name);
      if(track){
        track.classList.remove("is-dragging");
        if(mode){
          if(animate === false){
            track.style.transition = "none";
            track.style.transform = "translateX(" + baseOffset(index) + "px)";
            void track.offsetHeight; // force reflow so the next animated call isn't skipped
            track.style.transition = "";
          } else {
            track.style.transition = "";
            track.style.transform = "translateX(" + baseOffset(index) + "px)";
          }
        } else {
          track.style.transform = "";
          track.style.transition = "";
        }
      }
      applyInert();
      syncHeight();
      if(resetScroll){
        window.scrollTo({top:0, behavior: (mode || prefersReducedMotion()) ? "auto" : "smooth"});
      }
    }

    function updateMode(){
      mode = window.matchMedia("(max-width:859px)").matches;
      document.body.classList.toggle("swipe-mode", mode);
      goToIndex(currentIndex, false, false);
    }

    function excludedTarget(target){
      return !!(target && target.closest && target.closest(SWIPE_EXCLUDE_SELECTOR));
    }

    function onDown(e){
      if(!mode) return;
      if(e.pointerType === "mouse" && typeof e.button === "number" && e.button !== 0) return;
      if(excludedTarget(e.target)) return;
      drag = { id:e.pointerId, sx:e.clientX, sy:e.clientY, px:e.clientX, pt:performance.now(), dx:0, vel:0, locked:null };
    }

    function onMove(e){
      if(!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if(drag.locked === null){
        if(Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        // Gesture-intent lock: only commit to a horizontal page-swipe once
        // horizontal movement clearly dominates vertical movement.
        drag.locked = Math.abs(dx) > Math.abs(dy) * AXIS_RATIO;
        if(!drag.locked){ drag = null; return; } // vertical intent — leave it to native scroll
        track.classList.add("is-dragging");
      }
      e.preventDefault();
      var now = performance.now();
      drag.vel = (e.clientX - drag.px) / Math.max(1, now - drag.pt);
      drag.px = e.clientX; drag.pt = now;
      drag.dx = dx;
      var atStart = currentIndex === 0 && dx > 0;
      var atEnd = currentIndex === VIEW_ORDER.length - 1 && dx < 0;
      var eff = (atStart || atEnd) ? dx * EDGE_RESISTANCE : dx; // resistance at the ends, never wraps
      track.style.transform = "translateX(" + (baseOffset(currentIndex) + eff) + "px)";
    }

    function finishDrag(){
      if(!drag) return;
      track.classList.remove("is-dragging");
      if(!drag.locked){ drag = null; return; }
      var w = width();
      var dx = drag.dx, vel = drag.vel;
      var atStart = currentIndex === 0 && dx > 0;
      var atEnd = currentIndex === VIEW_ORDER.length - 1 && dx < 0;
      var target = currentIndex;
      if(!atStart && !atEnd){
        var distanceEnough = Math.abs(dx) > w * DIST_RATIO;
        var velocityEnough = Math.abs(vel) > VEL_MIN;
        if(distanceEnough || velocityEnough){
          target = dx < 0 ? currentIndex + 1 : currentIndex - 1;
        }
      }
      var changed = target !== currentIndex;
      drag = null;
      goToIndex(target, true, changed);
    }

    function onUp(e){ if(drag && drag.id === e.pointerId) finishDrag(); }
    function onCancel(e){ if(drag && drag.id === e.pointerId) finishDrag(); }

    function init(){
      track = document.getElementById("viewTrack");
      mainEl = document.getElementById("main");
      if(!track || !mainEl) return;
      currentIndex = Math.max(0, VIEW_ORDER.indexOf(
        (document.querySelector(".view.is-active") || {}).getAttribute
          ? document.querySelector(".view.is-active").getAttribute("data-view-panel")
          : "home"
      ));
      updateMode();
      var mql = window.matchMedia("(max-width:859px)");
      if(mql.addEventListener) mql.addEventListener("change", updateMode);
      else if(mql.addListener) mql.addListener(updateMode);
      window.addEventListener("resize", function(){
        if(mode) goToIndex(currentIndex, false, false);
      });
      track.addEventListener("pointerdown", onDown);
      track.addEventListener("pointermove", onMove);
      track.addEventListener("pointerup", onUp);
      track.addEventListener("pointercancel", onCancel);
    }

    return {
      init: init,
      isActive: isActive,
      goToIndex: goToIndex,
      indexOf: function(name){ return VIEW_ORDER.indexOf(name); }
    };
  })();

  function setView(name){
    var idx = swipeNav.indexOf(name);
    if(idx === -1) return;
    swipeNav.goToIndex(idx, true, true);
  }

  function wireNav(){
    document.querySelectorAll("[data-view]").forEach(function(btn){
      btn.addEventListener("click", function(){ setView(btn.getAttribute("data-view")); });
    });
    document.querySelectorAll("[data-view-link]").forEach(function(a){
      a.addEventListener("click", function(e){
        e.preventDefault();
        setView(a.getAttribute("data-view-link"));
      });
    });
    swipeNav.init();
  }

  /* ------------------------------------------------------------------ */
  /* Overlay / modal handling (focus trap + ESC + return focus)          */
  /* ------------------------------------------------------------------ */
  /* One modal stack for every sheet.
     - A closed sheet, and everything behind the top sheet, is inert: it
       cannot be reached by Tab, a screen reader or a stray click.
     - Each sheet remembers where focus came from and gives it back.
     - The page only scrolls again when the last sheet has closed.
     The photo viewer and the full-screen Book sit above the stack; while
     either is open, the sheets and the page behind them are inert too. */
  var MODAL_STACK = [];
  var MODAL_BACKGROUND = ["#app > header", "#swipeDots", "#main", "#fabAdd", "#app > nav.bottom-nav", ".skip-link"];
  function setInert(node, on){
    if(!node) return;
    if(on){ node.setAttribute("inert", ""); node.setAttribute("aria-hidden", "true"); }
    else { node.removeAttribute("inert"); node.removeAttribute("aria-hidden"); }
  }
  function focusablesIn(root){
    return Array.prototype.filter.call(root.querySelectorAll('a[href], button, input, select, textarea, audio[controls], video[controls], [tabindex]'), function(n){
      if(n.disabled || n.getAttribute("tabindex") === "-1" || n.type === "hidden") return false;
      if(n.closest("[inert], [hidden]")) return false;
      if(!n.getClientRects().length) return false;
      return window.getComputedStyle(n).visibility !== "hidden";
    });
  }
  function topModal(){ var t = MODAL_STACK[MODAL_STACK.length - 1]; return t ? document.getElementById(t.id) : null; }
  function syncModals(){
    // the stack follows what is really open
    MODAL_STACK = MODAL_STACK.filter(function(m){ var o = document.getElementById(m.id); return o && o.classList.contains("is-open"); });
    document.querySelectorAll(".overlay.is-open").forEach(function(o){
      if(!MODAL_STACK.some(function(m){ return m.id === o.id; })) MODAL_STACK.push({ id: o.id, returnFocus: null });
    });
    var pv = document.getElementById("photoViewer"), pvOpen = !!pv && pv.classList.contains("is-open");
    var book = document.querySelector(".bookv"), bookOpen = !!book && book.classList.contains("is-open");
    var top = topModal(), above = pvOpen || bookOpen;
    document.querySelectorAll(".overlay").forEach(function(o){ setInert(o, o !== top || above); });
    if(pv) setInert(pv, !pvOpen);
    if(book) setInert(book, !bookOpen || pvOpen);
    var appInBookWay = bookOpen && book && !document.getElementById("app").contains(book);
    MODAL_BACKGROUND.forEach(function(sel){ var n = document.querySelector(sel); if(n) setInert(n, !!top || above); });
    document.body.style.overflow = (top || pvOpen) ? "hidden" : "";
    if(appInBookWay){ /* the Book locks scrolling itself (bookv-lock) */ }
  }
  function focusInto(overlay){
    var want = overlay.querySelector("[autofocus]") || focusablesIn(overlay)[0];
    if(!want){ want = overlay.querySelector(".sheet") || overlay; want.setAttribute("tabindex", "-1"); }
    try{ want.focus({ preventScroll: true }); }catch(e){ try{ want.focus(); }catch(e2){} }
  }

  function openOverlay(id){
    var overlay = document.getElementById(id);
    if(!overlay) return;
    var from = document.activeElement;
    MODAL_STACK = MODAL_STACK.filter(function(m){ return m.id !== id; });
    MODAL_STACK.push({ id: id, returnFocus: from && from !== document.body ? from : null });
    overlay.classList.add("is-open");
    syncModals();
    focusInto(overlay);
  }

  function closeOverlay(id){
    var overlay = document.getElementById(id);
    if(!overlay) return;
    var wasOpen = overlay.classList.contains("is-open");
    var entry = MODAL_STACK.filter(function(m){ return m.id === id; })[0];
    var wasTop = topModal() === overlay;
    overlay.classList.remove("is-open");
    syncModals();
    sheetClosed(id);
    if(!wasOpen) return;
    var back = entry && entry.returnFocus, next = topModal();
    if(wasTop || !next){
      if(back && back.focus && document.contains(back) && !back.closest("[inert]") && back.getClientRects().length){ try{ back.focus({ preventScroll: true }); }catch(e){} }
      else if(next) focusInto(next);
    }
  }

  function trapHandler(e){
    var pv = document.getElementById("photoViewer");
    if(pv && pv.classList.contains("is-open")) return; // the photo viewer has its own keys
    var openOne = topModal();
    if(!openOne) return;
    if(e.key === "Escape"){
      closeOverlay(openOne.id);
      return;
    }
    if(e.key === "Tab"){
      var focusables = focusablesIn(openOne);
      if(!focusables.length){ e.preventDefault(); return; }
      var first = focusables[0], last = focusables[focusables.length-1];
      if(!openOne.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
      else if(e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if(!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    }
  }
  // Arrow keys for groups of radios and tabs: one stop in the Tab order, arrows move the choice.
  function groupKeys(e){
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].indexOf(e.key) < 0) return;
    var item = e.target.closest ? e.target.closest('[role="radio"], [role="tab"]') : null;
    if(!item) return;
    var group = item.closest('[role="radiogroup"], [role="tablist"]');
    if(!group) return;
    var role = item.getAttribute("role");
    var items = Array.prototype.filter.call(group.querySelectorAll('[role="' + role + '"]'), function(n){ return !n.disabled && n.getClientRects().length; });
    var i = items.indexOf(item), n = items.length;
    if(i < 0 || n < 2) return;
    var j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? (i - 1 + n) % n : (i + 1) % n;
    e.preventDefault();
    items[j].focus();
    items[j].click();
  }
  function wireModalState(){
    document.addEventListener("keydown", trapHandler);
    document.addEventListener("keydown", groupKeys);
    if(window.MutationObserver){
      var mo = new MutationObserver(function(){ syncModals(); });
      document.querySelectorAll(".overlay, #photoViewer").forEach(function(o){ mo.observe(o, { attributes: true, attributeFilter: ["class"] }); });
      // the full-screen Book is created later, by book.js
      new MutationObserver(function(){
        var book = document.querySelector(".bookv");
        if(book && !book.__pairlumWatched){ book.__pairlumWatched = true; mo.observe(book, { attributes: true, attributeFilter: ["class"] }); syncModals(); }
      }).observe(document.body, { childList: true, subtree: false });
      var appEl = document.getElementById("app");
      if(appEl) new MutationObserver(function(){
        var book = document.querySelector(".bookv");
        if(book && !book.__pairlumWatched){ book.__pairlumWatched = true; mo.observe(book, { attributes: true, attributeFilter: ["class"] }); syncModals(); }
      }).observe(appEl, { childList: true, subtree: false });
    }
    syncModals();
  }

  function wireOverlays(){
    wireModalState();
    document.querySelectorAll(".overlay").forEach(function(overlay){
      overlay.addEventListener("click", function(e){
        if(e.target === overlay) closeOverlay(overlay.id);
      });
    });
    document.querySelectorAll("[data-close-overlay]").forEach(function(btn){
      btn.addEventListener("click", function(){ closeOverlay(btn.getAttribute("data-close-overlay")); });
    });
    document.querySelectorAll("[data-action='open-capture']").forEach(function(btn){
      btn.addEventListener("click", function(){
        if(!isPaired()){
          renderPairingOverlay();
          openOverlay("pairingOverlay");
          showToast("Connect with " + SPACE.partner.name + " before adding a moment.");
          return;
        }
        resetCaptureFlow(); openOverlay("captureOverlay");
      });
    });
    document.querySelectorAll("[data-action='open-import']").forEach(function(btn){
      btn.addEventListener("click", function(){ resetImportFlow(); openOverlay("importOverlay"); });
    });
    document.querySelectorAll("[data-action='open-pairing']").forEach(function(btn){
      btn.addEventListener("click", function(){ renderPairingOverlay(); openOverlay("pairingOverlay"); });
    });
    document.querySelectorAll("[data-action='open-notifications']").forEach(function(btn){
      btn.addEventListener("click", function(){ renderNotifOverlay(); openOverlay("notifOverlay"); });
    });
    document.querySelectorAll("[data-action='open-privacy']").forEach(function(btn){
      btn.addEventListener("click", function(){ renderPrivacyMain(); openOverlay("privacyOverlay"); });
    });
    document.querySelectorAll("[data-action='open-appearance']").forEach(function(btn){
      btn.addEventListener("click", function(){ renderAppearanceOverlay(); openOverlay("appearanceOverlay"); });
    });
    document.querySelectorAll("[data-action='toast']").forEach(function(btn){
      btn.addEventListener("click", function(e){
        e.preventDefault();
        showToast(btn.getAttribute("data-toast") || "Noted.");
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Appearance — the 5 locked Pairlum moods. Picking one sets            */
  /* data-mood on <html> and persists it to localStorage; the <head>      */
  /* inline script re-applies it before first paint on later visits.      */
  /* ------------------------------------------------------------------ */
  var MOOD_KEY = privateKey("pairlum-mood-v1");
  var MOODS = [
    { id:"warm",     name:"Soft & Warm" },
    { id:"calm",     name:"Calm & Minimal" },
    { id:"deep",     name:"Deep & Cinematic" },
    { id:"blush",    name:"Blush" },
    { id:"midnight", name:"Midnight" }
  ];

  function loadMood(){
    try{ return localStorage.getItem(MOOD_KEY) || "warm"; }catch(e){ return "warm"; }
  }
  function saveMood(id){
    try{ localStorage.setItem(MOOD_KEY, id); }catch(e){}
  }
  function applyMood(id, opts){
    opts = opts || {};
    if(id === "warm") document.documentElement.removeAttribute("data-mood");
    else document.documentElement.setAttribute("data-mood", id);
    saveMood(id);
    renderAppearanceOverlay();
    if(!opts.silent){
      var mood = MOODS.filter(function(m){ return m.id === id; })[0];
      showToast("Now in " + (mood ? mood.name : id) + ".");
    }
  }
  function renderAppearanceOverlay(){
    var grid = document.getElementById("moodGrid");
    if(!grid) return;
    var current = loadMood();
    grid.querySelectorAll(".mood-option").forEach(function(opt){
      var selected = opt.getAttribute("data-mood-id") === current;
      opt.classList.toggle("is-selected", selected);
      opt.setAttribute("aria-checked", selected ? "true" : "false");
    });
  }
  function wireAppearancePicker(){
    applyMood(loadMood(), { silent:true });
    document.querySelectorAll("#moodGrid .mood-option").forEach(function(opt){
      opt.addEventListener("click", function(){ applyMood(opt.getAttribute("data-mood-id")); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  var toastTimer = null;
  function showToast(msg, important){
    // After a failed save, a cheerful "sent" line must not cover the warning.
    if(!important && Date.now() - saveFailedAt < 3200) return;
    var t = document.getElementById("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("is-shown");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function(){ t.classList.remove("is-shown"); }, 2800);
  }

  /* ------------------------------------------------------------------ */
  /* Add Moment capture — real photo/video selection, real voice         */
  /* recording, real preview/cancel, and the offline capture pipeline.   */
  /* ------------------------------------------------------------------ */
  var captureState = { type:"voice", file:null, mediaUrl:null, voiceBlob:null, voiceUrl:null, recorder:null };
  var VOICE_MAX_SECONDS = 60;                    // a voice attached to a photo or clip, and a voice reply
  var CLIP_MIN_SECONDS = 5, CLIP_MAX_SECONDS = 30; // short pieces of real life, not productions
  var parallelCapture = false; // true while the sheet is open from the Parallel Moments card

  function resetCaptureFlow(startWith){
    var first = startWith || "voice"; // voice comes first
    parallelCapture = false;
    var pn = document.getElementById("captureParallelNote"); if(pn) pn.hidden = true;
    var pin = document.getElementById("capturePhotoInput"); if(pin) pin.removeAttribute("capture");
    captureState = { type:first, file:null, mediaUrl:null, voiceBlob:null, voiceUrl:null, recorder:null };
    document.querySelectorAll(".capture-type").forEach(function(b){ b.classList.toggle("is-selected", b.getAttribute("data-type") === first); });
    renderCaptureBody(first);
    document.getElementById("captureStatusLine").hidden = true;
    updateCaptureSubmitState();
  }

  function renderCaptureBody(type){
    var body = document.getElementById("captureBody");
    cancelRecordings("captureOverlay");   // switching to photo, video or text ends any recording in progress
    captureState.type = type;
    captureState.file = null; captureState.mediaUrl = null;
    captureState.voiceBlob = null; captureState.voiceUrl = null;
    captureState.secs = 0; captureState.attachBlob = null; captureState.attachUrl = null; captureState.attachSecs = 0;
    var MIC = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    // A photo or a clip can carry your voice: what you would have said if they were standing next to you.
    var attachHtml =
      '<div class="capture-attach" id="captureAttach">'+
        '<button type="button" class="capture-attach-btn" id="captureAttachBtn">'+MIC+'<span id="captureAttachLabel">Add your voice</span></button>'+
        '<span class="capture-attach-timer" id="captureAttachTimer" aria-live="off"></span>'+
        '<audio id="captureAttachPreview" class="capture-voice-preview" controls hidden></audio>'+
        '<button type="button" class="ambient-link" id="captureAttachRemove" hidden>Remove the voice</button>'+
      '</div>';

    if(type === "text"){
      body.innerHTML = '<textarea class="capture-textarea" id="captureTextInput" placeholder="A line about today…" maxlength="220"></textarea>';
      document.getElementById("captureTextInput").addEventListener("input", updateCaptureSubmitState);
    } else if(type === "voice"){
      body.innerHTML =
        '<button type="button" class="capture-record-btn" id="captureRecordBtn">'+
          '<span class="capture-record-dot" aria-hidden="true"></span>'+
          '<span id="captureRecordLabel">Tap to record</span>'+
        '</button>'+
        '<div id="captureRecordTimer" class="capture-record-timer"></div>'+
        '<audio id="captureVoicePreview" class="capture-voice-preview" controls style="display:none"></audio>'+
        '<textarea class="capture-textarea" id="captureVoiceCaption" style="margin-top:12px;min-height:60px;font-size:.95rem" placeholder="Add a line (optional)" maxlength="140"></textarea>';
      wireCaptureRecorder();
      document.getElementById("captureVoiceCaption").addEventListener("input", updateCaptureSubmitState);
    } else if(type === "video"){
      body.innerHTML =
        '<div class="capture-surface" id="captureSurfaceVideo">'+
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>'+
          '<span class="body-s">Choose a short clip from your phone</span>'+
        '</div>'+
        '<div class="capture-clip-row">'+
          '<button type="button" class="capture-attach-btn" id="captureClipRec"><span class="capture-record-dot" aria-hidden="true"></span><span id="captureClipRecLabel">Record a clip here</span></button>'+
          '<span class="capture-attach-timer" id="captureClipTimer" aria-live="off"></span>'+
        '</div>'+
        '<p class="body-s capture-clip-note" id="captureClipNote">'+CLIP_MIN_SECONDS+' to '+CLIP_MAX_SECONDS+' seconds of real life. It does not need to look good.</p>'+
        attachHtml+
        '<textarea class="capture-textarea" id="captureMediaCaption" style="margin-top:12px;min-height:60px;font-size:.95rem" placeholder="Add a line (optional)" maxlength="140"></textarea>';
      document.getElementById("captureSurfaceVideo").addEventListener("click", function(e){ if(e.currentTarget.classList.contains("has-file") || e.currentTarget.classList.contains("is-live")) return; document.getElementById("captureVideoInput").click(); });
      document.getElementById("captureMediaCaption").addEventListener("input", updateCaptureSubmitState);
      wireCaptureClipRecorder();
      wireCaptureAttach();
    } else {
      body.innerHTML =
        '<div class="capture-surface" id="captureSurfacePhoto">'+
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.2"/></svg>'+
          '<span class="body-s">Tap to choose a photo from today</span>'+
        '</div>'+
        attachHtml+
        '<textarea class="capture-textarea" id="captureMediaCaption" style="margin-top:12px;min-height:60px;font-size:.95rem" placeholder="Add a line (optional)" maxlength="140"></textarea>';
      document.getElementById("captureSurfacePhoto").addEventListener("click", function(e){ if(e.currentTarget.classList.contains("has-file")) return; document.getElementById("capturePhotoInput").click(); });
      document.getElementById("captureMediaCaption").addEventListener("input", updateCaptureSubmitState);
      wireCaptureAttach();
    }
    updateCaptureSubmitState();
  }

  function showMediaPreview(surfaceId, url, isVideo){
    var surface = document.getElementById(surfaceId);
    if(!surface) return;
    surface.classList.add("has-file");
    surface.innerHTML =
      (isVideo
        ? '<video class="capture-preview-video" src="'+url+'" muted playsinline></video>'
        : '<img class="capture-preview-img" src="'+url+'" alt="">') +
      '<button type="button" class="capture-preview-remove" id="'+surfaceId+'Remove" aria-label="Remove">✕</button>';
    document.getElementById(surfaceId+"Remove").addEventListener("click", function(e){
      e.stopPropagation();
      captureState.file = null; captureState.mediaUrl = null;
      renderCaptureBody(captureState.type);
    });
  }
  // The voice that goes with a photo or clip. Up to a minute; it stops by itself.
  function wireCaptureAttach(){
    var btn = document.getElementById("captureAttachBtn");
    if(!btn) return;
    var label = document.getElementById("captureAttachLabel"), timer = document.getElementById("captureAttachTimer");
    var preview = document.getElementById("captureAttachPreview"), remove = document.getElementById("captureAttachRemove");
    var rec = null;
    btn.addEventListener("click", function(){
      if(rec && rec.isActive()){ rec.stop(); return; }
      if(rec && rec.isBusy()) return;
      if(recordingIn("captureOverlay")) return; // a clip is being recorded
      rec = makeRecorder({
        onStart: function(){ btn.classList.add("is-recording"); label.textContent = "Recording… tap to stop"; preview.hidden = true; remove.hidden = true; captureState.attachSecs = 0; },
        onTick: function(sec){
          captureState.attachSecs = Math.min(sec, VOICE_MAX_SECONDS);
          timer.textContent = comfortClock(captureState.attachSecs) + " / " + comfortClock(VOICE_MAX_SECONDS);
          if(sec >= VOICE_MAX_SECONDS && rec.isActive()) rec.stop();
        },
        onStop: function(blob, url){
          captureState.attachBlob = blob; captureState.attachUrl = url; captureState.attachSecs = Math.max(1, captureState.attachSecs);
          btn.classList.remove("is-recording"); label.textContent = "Record it again";
          timer.textContent = comfortClock(captureState.attachSecs);
          preview.src = url; preview.hidden = false; remove.hidden = false;
        },
        onError: function(msg){ btn.classList.remove("is-recording"); label.textContent = "Add your voice"; timer.textContent = ""; showToast(msg); }
      }, { scope:"captureOverlay" });
      rec.start();
    });
    remove.addEventListener("click", function(){
      if(captureState.attachUrl){ try{ URL.revokeObjectURL(captureState.attachUrl); }catch(e){} }
      captureState.attachBlob = null; captureState.attachUrl = null; captureState.attachSecs = 0;
      preview.removeAttribute("src"); preview.hidden = true; remove.hidden = true; timer.textContent = ""; label.textContent = "Add your voice";
    });
  }
  // How long a chosen video is. cb(seconds) or cb(null) when the browser cannot read it.
  function clipSeconds(url, cb){
    var v = document.createElement("video"), done = false;
    var end = function(val){ if(done) return; done = true; v.removeAttribute("src"); cb(val); };
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = function(){
      if(isFinite(v.duration)) return end(v.duration);
      // some recordings only reveal their length after a seek
      v.ondurationchange = function(){ if(isFinite(v.duration)) end(v.duration); };
      try{ v.currentTime = 1e7; }catch(e){ end(null); }
    };
    v.onerror = function(){ end(null); };
    window.setTimeout(function(){ end(null); }, 4000);
    v.src = url;
  }
  // Records a clip with the camera. Stops by itself at the limit. Shared by "add a moment" and "reply with a clip".
  function makeClipRecorder(ui, scope, onDone){
    var rec = null, secs = 0;
    var idle = function(text){ ui.btn.classList.remove("is-recording"); ui.label.textContent = text; };
    ui.btn.addEventListener("click", function(){
      if(rec && rec.isActive()){
        if(secs < CLIP_MIN_SECONDS){ ui.note.textContent = "Keep going a little: a clip is at least " + CLIP_MIN_SECONDS + " seconds."; return; }
        rec.stop(); return;
      }
      if(rec && rec.isBusy()) return;
      if(recordingIn(scope)) return;
      rec = makeRecorder({
        onStream: function(stream){ ui.live(stream); },
        onStart: function(){ secs = 0; ui.btn.classList.add("is-recording"); ui.label.textContent = "Recording… tap to stop"; },
        onTick: function(sec){
          secs = Math.min(sec, CLIP_MAX_SECONDS);
          ui.timer.textContent = comfortClock(secs) + " / " + comfortClock(CLIP_MAX_SECONDS);
          if(sec >= CLIP_MAX_SECONDS && rec.isActive()) rec.stop();
        },
        onStop: function(blob, url){ idle("Record it again"); ui.live(null); ui.timer.textContent = comfortClock(Math.max(1, secs)); onDone(blob, url, Math.max(1, secs)); },
        onCancel: function(){ ui.live(null); },
        onError: function(msg){ idle(ui.idleText); ui.live(null); ui.timer.textContent = ""; ui.note.textContent = msg; }
      }, { scope: scope, video: { facingMode: "environment", width: { ideal: 720 } }, recorder: { videoBitsPerSecond: 1200000 } });
      rec.start();
    });
  }
  function wireCaptureClipRecorder(){
    var surface = document.getElementById("captureSurfaceVideo");
    makeClipRecorder({
      btn: document.getElementById("captureClipRec"), label: document.getElementById("captureClipRecLabel"),
      timer: document.getElementById("captureClipTimer"), note: document.getElementById("captureClipNote"), idleText: "Record a clip here",
      live: function(stream){
        if(stream){
          surface.classList.remove("has-file"); surface.classList.add("is-live");
          surface.innerHTML = '<video class="capture-preview-video" muted playsinline autoplay></video>';
          surface.firstChild.srcObject = stream;
        } else {
          surface.classList.remove("is-live");
          var v = surface.querySelector("video"); if(v) v.srcObject = null;
        }
      }
    }, "captureOverlay", function(blob, url, secs){
      captureState.file = blob; captureState.mediaUrl = url; captureState.secs = secs;
      showMediaPreview("captureSurfaceVideo", url, true);
      updateCaptureSubmitState();
    });
  }

  function wireCaptureFileInputs(){
    document.getElementById("capturePhotoInput").addEventListener("change", function(e){
      var file = e.target.files[0];
      if(!file) return;
      try{ e.target.value = ""; }catch(err){} // so the same photo can be chosen again later
      var reader = new FileReader();
      reader.onload = function(ev){
        captureState.file = file;
        captureState.mediaUrl = ev.target.result;
        showMediaPreview("captureSurfacePhoto", captureState.mediaUrl, false);
        updateCaptureSubmitState();
      };
      reader.readAsDataURL(file);
    });
    document.getElementById("captureVideoInput").addEventListener("change", function(e){
      var file = e.target.files[0];
      if(!file) return;
      var url = URL.createObjectURL(file), input = e.target;
      clipSeconds(url, function(secs){
        try{ input.value = ""; }catch(err){}
        var note = document.getElementById("captureClipNote");
        if(secs !== null && secs > CLIP_MAX_SECONDS + 0.5){
          URL.revokeObjectURL(url);
          if(note) note.textContent = "That clip is " + Math.round(secs) + " seconds. Clips here are up to " + CLIP_MAX_SECONDS + " seconds: trim it in your gallery, or record one here.";
          return;
        }
        if(note) note.textContent = CLIP_MIN_SECONDS + " to " + CLIP_MAX_SECONDS + " seconds of real life. It does not need to look good.";
        captureState.file = file;
        captureState.mediaUrl = url;
        captureState.secs = secs === null ? 0 : Math.max(1, Math.round(secs));
        showMediaPreview("captureSurfaceVideo", captureState.mediaUrl, true);
        updateCaptureSubmitState();
      });
    });
  }

  function wireCaptureRecorder(){
    var btn = document.getElementById("captureRecordBtn");
    var label = document.getElementById("captureRecordLabel");
    var timer = document.getElementById("captureRecordTimer");
    var preview = document.getElementById("captureVoicePreview");
    btn.addEventListener("click", function(){
      if(captureState.recorder && captureState.recorder.isActive()){
        captureState.recorder.stop();
        return;
      }
      if(captureState.recorder && captureState.recorder.isBusy()) return;   // still asking for the microphone
      captureState.recorder = makeRecorder({
        onStart: function(){
          btn.classList.add("is-recording");
          label.textContent = "Recording… tap to stop";
          preview.style.display = "none";
        },
        onTick: function(sec){
          var m = Math.floor(sec/60), s = sec % 60;
          captureState.secs = sec;
          timer.textContent = m + ":" + (s<10?"0"+s:s);
        },
        onStop: function(blob, url){
          captureState.voiceBlob = blob;
          captureState.voiceUrl = url;
          captureState.secs = Math.max(1, captureState.secs || 0);
          btn.classList.remove("is-recording");
          label.textContent = "Re-record";
          preview.src = url;
          preview.style.display = "block";
          updateCaptureSubmitState();
        },
        onError: function(msg){
          btn.classList.remove("is-recording");
          label.textContent = msg;
        }
      }, { scope:"captureOverlay" });
      captureState.recorder.start();
    });
  }

  function updateCaptureSubmitState(){
    var submit = document.getElementById("captureSubmit");
    if(!submit) return;
    var ready = false;
    if(captureState.type === "text"){
      var ta = document.getElementById("captureTextInput");
      ready = !!(ta && ta.value.trim());
    } else if(captureState.type === "voice"){
      ready = !!captureState.voiceUrl;
    } else {
      ready = !!captureState.mediaUrl;
    }
    submit.disabled = !ready;
  }

  function wireCapture(){
    var types = document.querySelectorAll(".capture-type");
    types.forEach(function(btn){
      btn.addEventListener("click", function(){
        types.forEach(function(b){ b.classList.remove("is-selected"); });
        btn.classList.add("is-selected");
        renderCaptureBody(btn.getAttribute("data-type"));
      });
    });
    wireCaptureFileInputs();

    document.getElementById("captureSubmit").addEventListener("click", function(){
      var type = captureState.type;
      var caption, mediaUrl = null, mediaBlob = null;

      if(type === "text"){
        caption = document.getElementById("captureTextInput").value.trim();
      } else if(type === "voice"){
        var vc = document.getElementById("captureVoiceCaption");
        caption = (vc && vc.value.trim()) || "Voice note";
        mediaUrl = captureState.voiceUrl;
        mediaBlob = captureState.voiceBlob;
      } else {
        var mc = document.getElementById("captureMediaCaption");
        caption = (mc && mc.value.trim()) || (type === "video" ? "A little piece of today." : "A tiny piece of today.");
        mediaUrl = captureState.mediaUrl;
        mediaBlob = captureState.file; // a File is a Blob — this is what actually persists to IndexedDB
      }

      var extra = { secs: (type === "voice" || type === "video") ? (captureState.secs || 0) : 0 };
      if((type === "photo" || type === "video") && captureState.attachBlob){
        extra.voiceBlob = captureState.attachBlob; extra.voiceUrl = captureState.attachUrl; extra.voiceSecs = captureState.attachSecs || 1;
      }
      captureState.submitted = true;
      closeOverlay("captureOverlay");
      queueCapture(type, caption, mediaUrl, mediaBlob, type === "photo" && parallelCapture, extra);
      renderDayStory();
      window.setTimeout(resetCaptureFlow, 400);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Import Memories — real, 4 steps:                                    */
  /*   1 choose photos/videos  →  2 dates are read from each file        */
  /*   3 review (fix a date, add a line, leave one out)  →  4 done       */
  /* Each memory is filed by the date it was TAKEN, so it lands in the   */
  /* right place on the Our Story timeline, not at "today".              */
  /* ------------------------------------------------------------------ */
  var importState = { step:1, items:[], busy:false };
  var importRun = 0; // every import session has a number; work from an older session is thrown away when it comes back
  var IMPORT_MAX_FILES = 60;
  var IMPORT_MAX_DIM = 1600;

  function pad2(n){ return (n < 10 ? "0" : "") + n; }
  function isoFromDate(d){ return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()); }
  function validIso(s, allowFuture){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if(!m) return false;
    var d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2])-1 && d.getDate() === Number(m[3]) &&
      Number(m[1]) >= 1990 && (allowFuture || d.getTime() <= Date.now() + 86400000);
  }

  // Reads the "date taken" a camera writes inside a JPEG (EXIF). Only the
  // first part of the file is read; nothing leaves the device.
  function parseExifDate(v){
    if(v.byteLength < 12 || v.getUint16(0) !== 0xFFD8) return null;
    var off = 2;
    while(off + 4 <= v.byteLength){
      var marker = v.getUint16(off);
      if((marker & 0xFF00) !== 0xFF00) break;
      var size = v.getUint16(off + 2);
      if(marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966){
        var t = off + 10;
        var le = v.getUint16(t) === 0x4949;
        var u16 = function(o){ return v.getUint16(o, le); };
        var u32 = function(o){ return v.getUint32(o, le); };
        var readIfd = function(o, want){
          var n = u16(o), out = {};
          for(var i = 0; i < n; i++){
            var e = o + 2 + i*12, tag = u16(e);
            if(want.indexOf(tag) >= 0) out[tag] = { count: u32(e+4), valOff: e+8 };
          }
          return out;
        };
        var str = function(ent){
          var o = ent.count > 4 ? t + u32(ent.valOff) : ent.valOff, s = "";
          for(var k = 0; k < ent.count - 1 && k < 32; k++) s += String.fromCharCode(v.getUint8(o + k));
          return s;
        };
        var ifd0 = readIfd(t + u32(t + 4), [0x8769, 0x0132]), raw = null;
        if(ifd0[0x8769]){
          var ex = readIfd(t + u32(ifd0[0x8769].valOff), [0x9003, 0x9004]);
          var ent = ex[0x9003] || ex[0x9004];
          if(ent) raw = str(ent);
        }
        if(!raw && ifd0[0x0132]) raw = str(ifd0[0x0132]);
        var m = /^(\d{4}):(\d{2}):(\d{2})/.exec(raw || "");
        var iso = m ? m[1] + "-" + m[2] + "-" + m[3] : null;
        return validIso(iso) ? iso : null;
      }
      off += 2 + size;
    }
    return null;
  }
  function readExifDate(file, cb){
    if(!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)){ cb(null); return; }
    var fr = new FileReader();
    fr.onload = function(){ var iso = null; try{ iso = parseExifDate(new DataView(fr.result)); }catch(e){} cb(iso); };
    fr.onerror = function(){ cb(null); };
    fr.readAsArrayBuffer(file.slice(0, 262144));
  }
  // Phones and chat apps usually put the date in the file name
  // (IMG_20240614_…, 2024-06-14 18.22.01, IMG-20240614-WA0003).
  function dateFromFileName(name){
    var m = /(?:^|[^0-9])((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[^0-9]|$)/.exec(name || "");
    var iso = m ? m[1] + "-" + m[2] + "-" + m[3] : null;
    return validIso(iso) ? iso : null;
  }
  // Shrinks a photo so a whole album fits; falls back to the original
  // file if this browser can't open the format (some HEIC files).
  function shrinkImage(file, cb){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      try{
        var scale = Math.min(1, importMaxDim() / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function(blob){ URL.revokeObjectURL(url); cb(blob || file, !!blob); }, "image/jpeg", 0.85);
      }catch(e){ URL.revokeObjectURL(url); cb(file, false); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(file, false); };
    img.src = url;
  }

  function resetImportFlow(){
    importRun++;
    importState.items.forEach(function(it){ if(it.url) URL.revokeObjectURL(it.url); });
    importState = { step:1, items:[], busy:false };
    var input = document.getElementById("importFileInput");
    if(input) input.value = "";
    setText("importPickNote", "");
    setImportGoogleLink(null);
    googleImport.run++; // cancels any Google Photos session still waiting
    if(googleClientId()) loadGoogleSignIn(function(){}); // ready before the button is tapped
    goToImportStep(1);
  }

  /* ---- Google Photos ------------------------------------------------ */
  /* Google no longer lets any app read a whole library. The only route  */
  /* is Google's own picker: the person chooses photos on Google's page, */
  /* and Pairlum receives just those. Needs a Google client ID, set in   */
  /* PAIRLUM_CONFIG, in pairlum-config.js.                               */
  var GOOGLE_PICKER_API = "https://photospicker.googleapis.com/v1";
  var GOOGLE_PICKER_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
  var googleImport = { run: 0 };
  function googleClientId(){
    return (window.PAIRLUM_CONFIG && window.PAIRLUM_CONFIG.googleClientId) || "";
  }
  function loadGoogleSignIn(cb){
    if(window.google && google.accounts && google.accounts.oauth2){ cb(null); return; }
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = function(){ cb(null); };
    s.onerror = function(){ cb(new Error("load")); };
    document.head.appendChild(s);
  }
  function setImportGoogleLink(uri){
    var link = document.getElementById("importGoogleLink");
    if(!link) return;
    link.hidden = !uri;
    if(uri) link.setAttribute("href", uri); else link.removeAttribute("href");
  }
  function googleImportFailed(msg){
    setImportGoogleLink(null);
    goToImportStep(1);
    setText("importPickNote", msg);
  }
  function googleFetch(token, url, opts){
    var o = opts || {};
    o.headers = { "Authorization": "Bearer " + token, "Content-Type": "application/json" };
    return fetch(url, o).then(function(res){
      if(!res.ok) throw new Error("google " + res.status);
      return res;
    });
  }
  function startGooglePhotosImport(){
    if(!googleClientId()){
      setText("importPickNote", "Google Photos isn't switched on for this app yet. Use “From this phone or computer” for now.");
      return;
    }
    setText("importPickNote", "Opening Google sign-in…");
    loadGoogleSignIn(function(err){
      if(err){ setText("importPickNote", "Couldn't reach Google. Check your connection and try again."); return; }
      var client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId(),
        scope: GOOGLE_PICKER_SCOPE,
        callback: function(resp){
          if(!resp || resp.error || !resp.access_token){ setText("importPickNote", "Google sign-in was cancelled."); return; }
          runGooglePickerSession(resp.access_token);
        }
      });
      client.requestAccessToken();
    });
  }
  function runGooglePickerSession(token){
    var run = ++googleImport.run;
    var alive = function(){ return run === googleImport.run; };
    var line = document.getElementById("organizeLine");
    goToImportStep(2);
    if(line) line.textContent = "Getting Google Photos ready…";
    googleFetch(token, GOOGLE_PICKER_API + "/sessions", { method:"POST", body: JSON.stringify({ pickingConfig: { maxItemCount: String(IMPORT_MAX_FILES) } }) })
      .then(function(res){ return res.json(); })
      .then(function(session){
        if(!alive()) return;
        setImportGoogleLink(session.pickerUri + "/autoclose");
        if(line) line.textContent = "Tap the button, choose your photos in Google Photos, then come back here.";
        var every = Math.max(2, parseFloat((session.pollingConfig || {}).pollInterval) || 5) * 1000;
        var stopAt = Date.now() + 10 * 60 * 1000;
        (function poll(){
          if(!alive()) return;
          if(Date.now() > stopAt){ googleImportFailed("Google Photos timed out. Try again when you're ready."); return; }
          googleFetch(token, GOOGLE_PICKER_API + "/sessions/" + encodeURIComponent(session.id))
            .then(function(res){ return res.json(); })
            .then(function(s){
              if(!alive()) return;
              if(s.mediaItemsSet){ collectGoogleItems(token, session.id, alive); return; }
              window.setTimeout(poll, every);
            })
            .catch(function(){ if(alive()) googleImportFailed("Lost the connection to Google Photos. Try again."); });
        })();
      })
      .catch(function(){ if(alive()) googleImportFailed("Google Photos didn't open. Try again in a moment."); });
  }
  function collectGoogleItems(token, sessionId, alive){
    var line = document.getElementById("organizeLine");
    setImportGoogleLink(null);
    var items = [];
    var page = function(pageToken){
      var url = GOOGLE_PICKER_API + "/mediaItems?sessionId=" + encodeURIComponent(sessionId) + "&pageSize=100" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
      return googleFetch(token, url).then(function(res){ return res.json(); }).then(function(data){
        items = items.concat(data.mediaItems || []);
        return data.nextPageToken ? page(data.nextPageToken) : null;
      });
    };
    page(null).then(function(){
      if(!alive()) return;
      items = items.slice(0, IMPORT_MAX_FILES);
      var files = [], failed = 0, i = 0;
      (function nextItem(){
        if(!alive()) return;
        if(i >= items.length){
          googleFetch(token, GOOGLE_PICKER_API + "/sessions/" + encodeURIComponent(sessionId), { method:"DELETE" }).catch(function(){});
          if(!files.length){ googleImportFailed(items.length ? "Couldn't download those from Google Photos." : "Nothing was chosen in Google Photos."); return; }
          importState.note = failed ? failed + " couldn't be downloaded" : "";
          var keepNote = importState.note;
          startImport(files);
          importState.note = [keepNote, importState.note].filter(Boolean).join(" · ");
          return;
        }
        var it = items[i++], mf = it.mediaFile || {};
        if(line) line.textContent = "Bringing in " + i + " of " + items.length + " from Google Photos…";
        var isVideo = it.type === "VIDEO" || /^video\//.test(mf.mimeType || "");
        fetch(mf.baseUrl + (isVideo ? "=dv" : "=d"), { headers: { "Authorization": "Bearer " + token } })
          .then(function(res){ if(!res.ok) throw new Error("download"); return res.blob(); })
          .then(function(blob){
            var taken = it.createTime ? new Date(it.createTime) : null;
            var f = new File([blob], mf.filename || ("google-" + it.id + (isVideo ? ".mp4" : ".jpg")),
              { type: mf.mimeType || blob.type, lastModified: taken && !isNaN(taken.getTime()) ? taken.getTime() : Date.now() });
            if(taken && !isNaN(taken.getTime())) f._pairlumDate = isoFromDate(taken);
            files.push(f);
          })
          .catch(function(){ failed++; })
          .then(nextItem);
      })();
    }).catch(function(){ if(alive()) googleImportFailed("Couldn't read your Google Photos choice. Try again."); });
  }

  function goToImportStep(n){
    importState.step = n;
    document.querySelectorAll(".import-step").forEach(function(s){
      s.hidden = Number(s.getAttribute("data-step")) !== n;
    });
    document.querySelectorAll("[data-step-indicator]").forEach(function(ind){
      var idx = Number(ind.getAttribute("data-step-indicator"));
      ind.classList.toggle("is-done", idx < n);
      ind.classList.toggle("is-active", idx === n);
    });
    var back = document.getElementById("importBack");
    var next = document.getElementById("importNext");
    back.style.visibility = (n === 3) ? "visible" : "hidden";
    back.textContent = "Choose again";
    next.style.display = (n === 1 || n === 2) ? "none" : "";
    if(n === 3) updateImportReviewState();
    if(n === 4){ next.textContent = "See them in Our Story"; next.disabled = false; }
  }

  /* WHAT IDENTIFIES A FILE: its contents, not its name. Each imported file
     gets a fingerprint of its bytes (SHA-256). Two different photos that share
     a name and size are both kept; the same photo under a new name is caught.
     Memories imported by older builds only have "name|size" and are matched
     that way. Very large videos are fingerprinted from their first and last
     4 MB plus their size, so a phone is not asked to hold the whole file. */
  var HASH_FULL_MAX = 64 * 1048576, HASH_EDGE = 4 * 1048576;
  function existingSourceKeys(){
    var keys = { hash: {}, legacy: {} };
    DB.memories.forEach(function(m){ if(m.hash) keys.hash[m.hash] = true; else if(m.src) keys.legacy[m.src] = true; });
    return keys;
  }
  function hexOf(buf){ return Array.prototype.map.call(new Uint8Array(buf), function(b){ return (b < 16 ? "0" : "") + b.toString(16); }).join(""); }
  function fileFingerprint(file, cb){
    var whole = file.size <= HASH_FULL_MAX;
    var part = whole ? file : new Blob([file.slice(0, HASH_EDGE), file.slice(Math.max(HASH_EDGE, file.size - HASH_EDGE))]);
    var fail = function(){ cb(null); };
    try{
      part.arrayBuffer().then(function(buf){
        var tag = (whole ? "s:" : "e" + file.size + ":");
        if(window.crypto && crypto.subtle && crypto.subtle.digest){
          crypto.subtle.digest("SHA-256", buf).then(function(d){ cb(tag + hexOf(d)); }, function(){ cb("c:" + file.size + ":" + crc32(new Uint8Array(buf)).toString(16)); });
        } else cb("c:" + file.size + ":" + crc32(new Uint8Array(buf)).toString(16));
      }, fail);
    }catch(e){ fail(); }
  }

  function startImport(fileList){
    setImportGoogleLink(null);
    var run = ++importRun; // this session; anything still decoding for an earlier one is ignored
    importState.items.forEach(function(it){ if(it.url) URL.revokeObjectURL(it.url); });
    var files = Array.prototype.slice.call(fileList || []).filter(function(f){ return /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|webm)$/i.test(f.name); });
    if(!files.length){ if(importState.step !== 1) goToImportStep(1); setText("importPickNote", "No photos or videos in that selection."); return; }
    var note = "";
    if(files.length > IMPORT_MAX_FILES){
      note = "Took the first " + IMPORT_MAX_FILES + " — bring the rest in next.";
      files = files.slice(0, IMPORT_MAX_FILES);
    }
    var seen = existingSourceKeys(), skipped = 0, unreadable = 0, queue = files;
    importState.items = [];
    importState.skipped = 0;
    importState.unreadable = 0;
    importState.note = note;
    importState.busy = true;
    goToImportStep(2);
    var line = document.getElementById("organizeLine");
    var i = 0;
    var current = function(){ return run === importRun && importState.step === 2; };
    (function nextFile(){
      if(!current()) return; // the person closed or restarted
      if(i >= queue.length){
        importState.busy = false;
        importState.skipped = skipped;
        importState.unreadable = unreadable;
        if(!importState.items.length){
          goToImportStep(1);
          setText("importPickNote", unreadable ? "Those files could not be read." : "Those are already in Our Story.");
          return;
        }
        importState.items.sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
        renderImportReview();
        goToImportStep(3);
        return;
      }
      var f = queue[i++];
      if(line) line.textContent = "Reading " + i + " of " + queue.length + "…";
      var isVideo = /^video\//.test(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);
      fileFingerprint(f, function(hash){
        if(!current()) return;
        if(!hash){ unreadable++; window.setTimeout(nextFile, 0); return; }
        if(seen.hash[hash]){ skipped++; window.setTimeout(nextFile, 0); return; } // the very same bytes are already here
        seen.hash[hash] = true;
        readExifDate(f, function(exifIso){
          if(!current()) return;
          // Order of trust: the camera's own date, then the date Google
          // Photos holds for it, then the file name, then the file's date.
          var cloudIso = exifIso ? null : (validIso(f._pairlumDate) ? f._pairlumDate : null);
          var nameIso = (exifIso || cloudIso) ? null : dateFromFileName(f.name);
          var iso = exifIso || cloudIso || nameIso || isoFromDate(new Date(f.lastModified || Date.now()));
          var source = exifIso ? "camera" : cloudIso ? "google" : nameIso ? "name" : "file";
          var done = function(blob, preview){
            if(!current()) return; // decoded for a session that is over: nothing is added, nothing is kept
            importState.items.push({
              id: uid("mem"), src: f.name + "|" + f.size, hash: hash, type: isVideo ? "video" : "photo",
              date: iso, dateSource: source, caption: "", blob: blob, preview: preview,
              // the untouched file, when what is shown is a smaller copy of it
              original: (!isVideo && blob !== f) ? f : null,
              likelyDuplicate: !!seen.legacy[f.name + "|" + f.size],
              url: URL.createObjectURL(blob), keep: true
            });
            window.setTimeout(nextFile, 0);
          };
          if(isVideo) done(f, true); else shrinkImage(f, done);
        });
      });
    })();
  }

  function monthLabel(iso){
    var p = iso.split("-");
    return new Intl.DateTimeFormat("en-US", { month:"long", year:"numeric" }).format(new Date(Number(p[0]), Number(p[1])-1, 1));
  }
  function dayLabel(iso){
    var p = iso.split("-");
    return new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short", year:"numeric" }).format(new Date(Number(p[0]), Number(p[1])-1, Number(p[2])));
  }
  function posterFor(id, preview){
    var d = window.PAIRLUM_DEMO_POSTERS;
    return (d && d[id]) || (typeof preview === "string" && /^(data:image|blob:|https?:|[\w.\/-]+\.(?:jpe?g|png|webp))/i.test(preview) ? preview : "");
  }
  function mediaThumbHtml(type, url, preview, poster){
    if(!url || preview === false) return '<span class="imp-nopreview">No preview</span>';
    return type === "video"
      ? '<video src="'+escapeHtml(url)+'"'+(poster ? ' poster="'+escapeHtml(poster)+'"' : '')+' muted playsinline preload="'+(poster ? 'none' : 'metadata')+'"></video>'
      : '<img src="'+escapeHtml(url)+'" alt="" decoding="async">';
  }

  function renderImportReview(){
    var list = document.getElementById("reviewList");
    if(!list) return;
    var todayIso = isoFromDate(new Date());
    list.innerHTML = importState.items.map(function(it){
      var hint = it.dateSource === "camera" ? "Date from the camera"
        : it.dateSource === "google" ? "Date from Google Photos"
        : it.dateSource === "name" ? "Date from the file name"
        : "No date inside this one — please check";
      if(it.type === "photo" && it.preview === false) hint += ". This browser cannot show this format, so the file is kept exactly as it is";
      if(it.likelyDuplicate) hint += ". A file with this name and size was imported before; leave it out if it is the same one";
      return '<li class="imp-item'+(it.keep?'':' is-out')+(it.dateSource==="file"?' needs-check':'')+'" data-imp-id="'+it.id+'">'+
        '<div class="imp-thumb">'+mediaThumbHtml(it.type, it.url, it.preview)+'</div>'+
        '<div class="imp-fields">'+
          '<label class="visually-hidden" for="d_'+it.id+'">Date taken</label>'+
          '<input type="date" class="imp-date" id="d_'+it.id+'" value="'+escapeHtml(it.date)+'" max="'+todayIso+'" data-imp-date>'+
          '<span class="imp-hint">'+hint+'</span>'+
          '<label class="visually-hidden" for="c_'+it.id+'">A line about this memory</label>'+
          '<input type="text" class="imp-caption" id="c_'+it.id+'" maxlength="80" placeholder="Add a line (optional)" value="'+escapeHtml(it.caption)+'" data-imp-caption>'+
        '</div>'+
        '<button type="button" class="imp-toggle" data-imp-toggle aria-pressed="'+(it.keep?'true':'false')+'">'+(it.keep?'Leave out':'Put back')+'</button>'+
      '</li>';
    }).join("");
    updateImportReviewState();
  }
  function importItem(id){ return importState.items.filter(function(x){ return x.id === id; })[0]; }
  function updateImportReviewState(){
    var keep = importState.items.filter(function(x){ return x.keep; });
    var bad = keep.filter(function(x){ return !validIso(x.date); }).length;
    var check = keep.filter(function(x){ return x.dateSource === "file"; }).length;
    var next = document.getElementById("importNext");
    if(next){
      next.textContent = keep.length ? "Add " + keep.length + " to Our Story" : "Nothing selected";
      next.disabled = !keep.length || bad > 0;
    }
    var parts = [keep.length + " of " + importState.items.length + " going in"];
    if(check) parts.push(check + " with a date to check");
    if(bad) parts.push(bad + " need a valid date");
    if(importState.skipped) parts.push(importState.skipped + " already in Our Story, skipped");
    if(importState.unreadable) parts.push(importState.unreadable + " could not be read");
    var origN = keepOriginalsOn() ? keep.filter(function(x){ return x.original; }).length : 0;
    parts.push(origN ? "original files kept too" : "saved as resized copies (originals are not kept)");
    if(importState.note) parts.push(importState.note);
    setText("importReviewSummary", parts.join(" · "));
  }

  function keepOriginalsOn(){ return !(SPACE.perf && SPACE.perf.keepOriginals === false); }
  function finishImport(){
    var keep = importState.items.filter(function(x){ return x.keep && validIso(x.date); });
    if(!keep.length || importState.saving) return;
    var run = importRun;
    // Store every photo first, and only then announce the memories — so
    // the other partner never sees a memory whose photo isn't there yet.
    var next = document.getElementById("importNext");
    next.disabled = true; next.textContent = "Adding…";
    importState.saving = true;
    var retryable = function(msg){
      // nothing was added; the same selection is still here and the button works again
      importState.saving = false;
      updateImportReviewState();
      showToast(msg, true);
    };
    var keys = keep.map(function(it){ return mediaWriteKey(it.id); });
    // all the photos go in together or not at all
    idbPutMany(keep.map(function(it, n){ return { key: keys[n], blob: it.blob }; }), function(err){
      if(err) return retryable("Couldn't save those: this device is out of space. Nothing was added. Free some space and tap Add again.");
      if(run !== importRun){ idbDeleteKeys(keys); importState.saving = false; return; } // the sheet was closed meanwhile
      // originals are extra: one that does not fit is skipped, and said so
      var withOrig = keepOriginalsOn() ? keep.filter(function(it){ return it.original; }) : [], left = withOrig.length, lost = 0;
      var commit = function(){
        if(run !== importRun){ idbDeleteKeys(keys.concat(withOrig.map(function(it){ return mediaWriteKey("orig:" + it.id); }))); importState.saving = false; return; }
        commitImport(keep, keys, lost, retryable);
      };
      if(!left) return commit();
      withOrig.forEach(function(it){
        idbPutMedia("orig:" + it.id, it.original, function(e){
          it.originalKept = !e;
          if(e) lost++;
          if(--left === 0) commit();
        });
      });
    });
  }
  function commitImport(keep, keys, lostOriginals, retryable){
    var ok = mutate(function(db){
      keep.forEach(function(it){
        if(db.memories.some(function(m){ return m.id === it.id; })) return; // a retry never adds a second copy
        db.memories.push({ id:it.id, by:ME, type:it.type, date:it.date, dateSource:it.dateSource,
          caption:it.caption.trim(), src:it.src, hash:it.hash, preview:it.preview, hasOriginal: !!it.originalKept, at:Date.now() });
      });
    });
    if(!ok){
      // not saved: take back the files just written, keep the selection for another try
      idbDeleteKeys(keys.concat(keep.filter(function(it){ return it.originalKept; }).map(function(it){ return mediaWriteKey("orig:" + it.id); })));
      keep.forEach(function(it){ it.originalKept = false; });
      return retryable("Not added: the change could not be saved. Your selection is still here, so you can try again.");
    }
    importState.saving = false;
    keep.forEach(function(it){ MEDIA_URLS[it.id] = it.url; it.url = null; });
    var years = keep.map(function(x){ return x.date.slice(0,4); }).sort();
    var span = years[0] === years[years.length-1] ? years[0] : years[0] + "–" + years[years.length-1];
    setText("importDoneTitle", keep.length + (keep.length === 1 ? " memory" : " memories") + " just joined Our Story");
    var keptN = keep.filter(function(it){ return it.originalKept; }).length;
    setText("importDoneSub", "From " + span + ", each one filed under the day it happened. " + SPACE.partner.name + " can see them too." +
      (keptN ? " " + keptN + " original file" + (keptN === 1 ? " was" : "s were") + " kept as well." : "") +
      (lostOriginals ? " " + lostOriginals + " original" + (lostOriginals === 1 ? "" : "s") + " did not fit on this device, so only the resized cop" + (lostOriginals === 1 ? "y was" : "ies were") + " saved." : ""));
    SPACE.hasImportedPast = true;
    markFirst("import");
    saveSpaceSettings();
    renderFirstChapter();
    renderMemoryTimeline();
    goToImportStep(4);
    celebrate();
  }

  function wireImportFlow(){
    var input = document.getElementById("importFileInput");
    var pick = document.getElementById("importPickBtn");
    if(pick && input) pick.addEventListener("click", function(){ input.click(); });
    if(input) input.addEventListener("change", function(){ startImport(input.files); });
    var gBtn = document.getElementById("importGoogleBtn");
    if(gBtn) gBtn.addEventListener("click", startGooglePhotosImport);

    var list = document.getElementById("reviewList");
    if(list){
      list.addEventListener("input", function(e){
        var li = e.target.closest("[data-imp-id]");
        if(!li) return;
        var it = importItem(li.getAttribute("data-imp-id"));
        if(!it) return;
        if(e.target.hasAttribute("data-imp-date")){
          it.date = e.target.value;
          it.dateSource = "you";
          li.classList.remove("needs-check");
          li.classList.toggle("is-invalid", !validIso(it.date));
          var hint = li.querySelector(".imp-hint");
          if(hint) hint.textContent = validIso(it.date) ? "Date set by you" : "Pick a real date, not in the future";
        } else if(e.target.hasAttribute("data-imp-caption")){
          it.caption = e.target.value;
        }
        updateImportReviewState();
      });
      list.addEventListener("click", function(e){
        var btn = e.target.closest("[data-imp-toggle]");
        if(!btn) return;
        var li = btn.closest("[data-imp-id]");
        var it = importItem(li.getAttribute("data-imp-id"));
        if(!it) return;
        it.keep = !it.keep;
        li.classList.toggle("is-out", !it.keep);
        btn.textContent = it.keep ? "Leave out" : "Put back";
        btn.setAttribute("aria-pressed", it.keep ? "true" : "false");
        updateImportReviewState();
      });
    }

    document.getElementById("importNext").addEventListener("click", function(){
      if(importState.step === 3){ finishImport(); return; }
      if(importState.step === 4){
        closeOverlay("importOverlay");
        setView("story");
        var tl = document.getElementById("memoryTimeline");
        if(tl && tl.scrollIntoView) window.setTimeout(function(){ tl.scrollIntoView({ block:"start" }); }, 60);
      }
    });
    document.getElementById("importBack").addEventListener("click", function(){
      if(importState.step === 3) resetImportFlow();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Our Story timeline — every imported memory and every shared moment, */
  /* grouped chapter → month → day, in date order. Built from the shared */
  /* record, so both partners see the same timeline.                     */
  /* ------------------------------------------------------------------ */
  var MEDIA_URLS = {};          // id → object URL, so media is read from storage only once
  // The one-year demo (demo-year.js) brings its own pictures, already as addresses.
  (function(){ var d = window.PAIRLUM_DEMO_MEDIA; if(d) Object.keys(d).forEach(function(id){ MEDIA_URLS[id] = d[id]; }); })();
  var TL_ORDER_KEY = privateKey("pairlum-timeline-order-v1");
  function timelineOrder(){
    try{ return localStorage.getItem(TL_ORDER_KEY) === "newest" ? "newest" : "oldest"; }catch(e){ return "oldest"; }
  }
  function chapterFor(iso){
    var found = null;
    SPACE.chapters.forEach(function(ch){ if(ch.date <= iso && (!found || ch.date > found.date)) found = ch; });
    return found ? found.title : "Before us";
  }
  function timelineEntries(){
    var out = DB.memories.map(function(m){
      return { id:m.id, kind:"memory", by:m.by, type:m.type, date:m.date, caption:m.caption, preview:m.preview, hasMedia:true, sort:m.date + "|" + (m.at||0) };
    });
    DB.moments.forEach(function(m){
      if(m.demo || !m.at) return;
      var iso = spaceDayIso(m.at); // the day on your shared calendar, the same for both of you
      out.push({ id:m.id, kind:"moment", by:m.by, type:m.type, date:iso, caption:m.caption, dur:m.dur || "", hasMedia:!!m.hasMedia, voice: !!m.voice, replies: repliesTo(m.id).length, sort:iso + "|" + m.at });
    });
    out.sort(function(x, y){ return x.sort < y.sort ? -1 : x.sort > y.sort ? 1 : 0; });
    return out;
  }
  var tlFilter = "all", tlCollapsed = {};
  function renderMemoryTimeline(){
    var host = document.getElementById("memoryTimeline");
    if(!host) return;
    var entries = timelineEntries();
    var orderBtn = document.getElementById("tlOrderBtn");
    var order = timelineOrder();
    if(orderBtn){
      orderBtn.hidden = entries.length < 2;
      orderBtn.textContent = order === "oldest" ? "Showing oldest first" : "Showing newest first";
    }
    setText("tlCount", entries.length ? entries.length + (entries.length === 1 ? " memory" : " memories") : "");
    if(!entries.length){
      host.innerHTML = '<div class="tl-empty">'+emptyArt("timeline")+'<p class="body-m">Nothing here yet.</p>'+
        '<p class="body-s">Bring in photos from before Pairlum and each one settles into place by the day it was taken.</p></div>';
      return;
    }
    // ---- Photos-style collections: All / Photos / Videos / Words --------
    var counts = { all:entries.length, photo:0, video:0, voice:0, text:0 };
    entries.forEach(function(en){ if(counts[en.type] != null) counts[en.type]++; });
    if(tlFilter !== "all" && !counts[tlFilter]) tlFilter = "all";
    var ICONS = {
      all:   '<path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z"/>',
      photo: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
      video: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>',
      voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
      text:  '<path d="M5 5h14v10H11l-4 4v-4H5z"/><path d="M8.5 9h7M8.5 12h4.5"/>'
    };
    var NAMES = { all:"Everything", photo:"Photos", video:"Videos", voice:"Voice", text:"Words" };
    var cols = document.getElementById("tlCollections");
    if(cols){
      cols.hidden = !entries.length;
      cols.innerHTML = ["all","photo","video","voice","text"].map(function(k){
        return '<button type="button" class="tl-col'+(tlFilter===k?' is-on':'')+'" data-tl-filter="'+k+'" aria-pressed="'+(tlFilter===k)+'"'+(k !== "all" && !counts[k] ? ' disabled' : '')+'>'+
          '<span class="tl-col-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[k]+'</svg></span>'+
          '<span class="tl-col-name">'+NAMES[k]+'</span><span class="tl-col-n">'+counts[k]+'</span></button>';
      }).join("");
    }
    var shown = tlFilter === "all" ? entries : entries.filter(function(x){ return x.type === tlFilter; });
    if(order === "newest") shown = shown.slice().reverse();

    // ---- years strip -----------------------------------------------------
    var years = [];
    shown.forEach(function(en){ var y = en.date.slice(0,4); if(years.indexOf(y) < 0) years.push(y); });
    var yearsEl = document.getElementById("tlYears");
    if(yearsEl){
      yearsEl.hidden = years.length < 2;
      yearsEl.innerHTML = years.map(function(y){ return '<button type="button" class="tl-year" data-tl-year="'+y+'">'+y+'</button>'; }).join("");
    }

    // ---- month groups, Photos-style --------------------------------------
    var groups = [], byMonth = {};
    shown.forEach(function(en){
      var m = en.date.slice(0,7);
      if(!byMonth[m]){ byMonth[m] = { key:m, items:[], first:en.date }; groups.push(byMonth[m]); }
      byMonth[m].items.push(en);
    });
    var html = "";
    groups.forEach(function(g){
      var collapsed = !!tlCollapsed[g.key];
      var chap = chapterFor(g.first);
      html += '<section class="tl-group" data-tl-month="'+g.key+'" data-tl-year-of="'+g.key.slice(0,4)+'">'+
        '<button type="button" class="tl-month-head" data-tl-toggle="'+g.key+'" aria-expanded="'+(!collapsed)+'">'+
          '<span class="tl-month-name">'+escapeHtml(monthLabel(g.first))+'</span>'+
          '<span class="tl-month-chap">'+escapeHtml(chap)+'</span>'+
          '<span class="tl-month-count">'+g.items.length+'</span>'+
          '<svg class="tl-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'+
        '</button>'+
        '<div class="tl-grid"'+(collapsed?' hidden':'')+'>';
      g.items.forEach(function(en){
        var isText = en.type === "text", isVoice = en.type === "voice";
        var day = String(Number(en.date.slice(8,10)));
        if(isVoice){
          html += '<button type="button" class="tl-item tl-item--voice" data-tl-id="'+escapeHtml(en.id)+'" data-tl-kind="'+en.kind+'" aria-label="'+escapeHtml("Voice note, "+dayLabel(en.date)+(en.dur ? ", "+en.dur : ""))+'">'+
            '<span class="tl-voice"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">'+ICONS.voice+'</svg>'+
            '<span class="tl-voice-dur">'+escapeHtml(en.dur || "Voice")+'</span></span>'+
            '<span class="tl-day-badge">'+day+'</span><span class="tl-by">'+whoDot(rel(en.by))+'</span></button>';
          return;
        }
        html += '<button type="button" class="tl-item'+(isText?' tl-item--text':'')+'" data-tl-id="'+escapeHtml(en.id)+'" data-tl-kind="'+en.kind+'" aria-label="'+escapeHtml((en.type === "video" ? "Video" : isText ? "Words" : "Photo")+", "+dayLabel(en.date)+(en.caption ? ": "+en.caption : ""))+'">'+
          (isText ? '<span class="tl-text">“'+escapeHtml(en.caption)+'”</span>'
                  : '<span class="tl-media" data-tl-media="'+escapeHtml(en.id)+'" data-tl-type="'+en.type+'"></span>')+
          (en.type === "video" ? '<span class="tl-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></span>' : '')+
          '<span class="tl-day-badge">'+day+'</span>'+
          (en.voice || en.replies ? '<span class="tl-voice-badge" aria-hidden="true">'+(en.voice ? MIC_SVG : '')+(en.replies ? '<b>'+en.replies+'</b>' : '')+'</span>' : '')+
          '<span class="tl-by">'+whoDot(rel(en.by))+'</span>'+
        '</button>';
      });
      html += '</div></section>';
    });
    if(!groups.length) html = '<div class="tl-empty"><p class="body-m">Nothing in '+escapeHtml(NAMES[tlFilter].toLowerCase())+' yet.</p></div>';
    host.innerHTML = html;

    host.querySelectorAll("[data-tl-media]").forEach(function(slot){
      var id = slot.getAttribute("data-tl-media"), type = slot.getAttribute("data-tl-type");
      var poster = "";
      if(type === "video"){ var mem = DB.memories.filter(function(x){ return x.id === id; })[0]; poster = posterFor(id, mem && mem.preview); }
      var paint = function(url){ slot.innerHTML = mediaThumbHtml(type, url, true, poster); };
      if(MEDIA_URLS[id]){ paint(MEDIA_URLS[id]); return; }
      idbGetMedia(id, function(err, blob){
        if(err || !blob){ slot.innerHTML = '<span class="imp-nopreview">Photo not on this device</span>'; return; }
        MEDIA_URLS[id] = URL.createObjectURL(blob);
        paint(MEDIA_URLS[id]);
      });
    });
  }

  var memoryViewState = { id:null, armed:false };
  function openMemoryViewer(id, kind){
    var en = timelineEntries().filter(function(x){ return x.id === id; })[0];
    if(!en) return;
    memoryViewState = { id:id, armed:false };
    var mine = en.by === ME && kind === "memory";
    var media = document.getElementById("memoryViewMedia");
    var voiceHtml = function(url){ return '<div class="mv-voice"><p class="mv-voice-label">Voice note'+(en.dur ? ' · '+escapeHtml(en.dur) : '')+'</p><audio src="'+escapeHtml(url)+'" controls preload="metadata"></audio></div>'; };
    if(en.type === "text"){
      media.innerHTML = '<p class="mv-text">“'+escapeHtml(en.caption)+'”</p>';
    } else if(en.type === "voice"){
      if(MEDIA_URLS[id]) media.innerHTML = voiceHtml(MEDIA_URLS[id]);
      else {
        media.innerHTML = '<span class="imp-nopreview">Finding the recording…</span>';
        idbGetMedia(id, function(err, blob){
          if(memoryViewState.id !== id) return;
          if(err || !blob){ media.innerHTML = '<span class="imp-nopreview">This recording is not on this device</span>'; return; }
          MEDIA_URLS[id] = URL.createObjectURL(blob);
          media.innerHTML = voiceHtml(MEDIA_URLS[id]);
        });
      }
    } else if(MEDIA_URLS[id]){
      media.innerHTML = en.type === "video"
        ? '<video src="'+escapeHtml(MEDIA_URLS[id])+'"'+(posterFor(id, en.preview) ? ' poster="'+escapeHtml(posterFor(id, en.preview))+'"' : '')+' controls playsinline></video>'
        : '<img src="'+escapeHtml(MEDIA_URLS[id])+'" alt="">';
    } else {
      media.innerHTML = '<span class="imp-nopreview">Photo not on this device</span>';
    }
    setText("memoryViewDate", dayLabel(en.date) + " · " + chapterFor(en.date));
    setText("memoryViewBy", (en.by === ME ? "You" : SPACE.partner.name) + (kind === "memory" ? " added this" : " shared this"));
    var cap = document.getElementById("memoryViewCaption");
    cap.textContent = en.type === "text" ? "" : (en.caption || "");
    cap.hidden = !cap.textContent || mine;
    var edit = document.getElementById("memoryViewEdit");
    edit.hidden = !mine;
    if(mine){
      var d = document.getElementById("memoryViewDateInput");
      d.value = en.date; d.max = isoFromDate(new Date());
      document.getElementById("memoryViewCaptionInput").value = en.caption || "";
      document.getElementById("memoryViewDelete").textContent = "Remove";
    }
    openOverlay("memoryOverlay");
  }
  function wireMemoryTimeline(){
    var host = document.getElementById("memoryTimeline");
    if(host) host.addEventListener("click", function(e){
      var btn = e.target.closest("[data-tl-id]");
      if(!btn) return;
      if(btn.getAttribute("data-tl-kind") === "moment") openMoment(btn.getAttribute("data-tl-id")); // the moment, with the voice and the answers around it
      else openMemoryViewer(btn.getAttribute("data-tl-id"), btn.getAttribute("data-tl-kind"));
    });
    var tlRoot = document.getElementById("tlCollections");
    if(tlRoot) tlRoot.addEventListener("click", function(e){
      var b = e.target.closest("[data-tl-filter]");
      if(b && !b.disabled){ tlFilter = b.getAttribute("data-tl-filter"); renderMemoryTimeline(); }
    });
    var yrs = document.getElementById("tlYears");
    if(yrs) yrs.addEventListener("click", function(e){
      var b = e.target.closest("[data-tl-year]");
      if(!b) return;
      var target = document.querySelector('#memoryTimeline [data-tl-year-of="'+b.getAttribute("data-tl-year")+'"]');
      if(target) target.scrollIntoView({ behavior: motionAllowed() ? "smooth" : "auto", block:"start" });
    });
    if(host) host.addEventListener("click", function(e){
      var h = e.target.closest("[data-tl-toggle]");
      if(!h) return;
      var key = h.getAttribute("data-tl-toggle"), open = h.getAttribute("aria-expanded") !== "true";
      tlCollapsed[key] = !open;
      h.setAttribute("aria-expanded", open ? "true" : "false");
      var grid = h.parentNode.querySelector(".tl-grid"); if(grid) grid.hidden = !open;
    });
    var orderBtn = document.getElementById("tlOrderBtn");
    if(orderBtn) orderBtn.addEventListener("click", function(){
      try{ localStorage.setItem(TL_ORDER_KEY, timelineOrder() === "oldest" ? "newest" : "oldest"); }catch(e){}
      renderMemoryTimeline();
    });
    var save = document.getElementById("memoryViewSave");
    if(save) save.addEventListener("click", function(){
      var iso = document.getElementById("memoryViewDateInput").value;
      var cap = document.getElementById("memoryViewCaptionInput").value.trim();
      if(!validIso(iso)){ showToast("Pick a real date, not in the future."); return; }
      var id = memoryViewState.id;
      // Only the person who added a memory can change it.
      var memSaved = mutate(function(db){
        db.memories.forEach(function(m){ if(m.id === id && m.by === ME){ m.date = iso; m.caption = cap; m.dateSource = "you"; } });
      });
      if(!memSaved) return; // the sheet stays open with what you typed
      renderMemoryTimeline();
      closeOverlay("memoryOverlay");
      showToast("Saved — moved to " + dayLabel(iso) + ".");
    });
    var del = document.getElementById("memoryViewDelete");
    if(del) del.addEventListener("click", function(){
      if(!memoryViewState.armed){
        memoryViewState.armed = true;
        del.textContent = "Tap again to remove for both of you";
        return;
      }
      var id = memoryViewState.id;
      // The record goes first. The file is removed only once nothing saved points to it.
      if(!mutate(function(db){ db.memories = db.memories.filter(function(m){ return !(m.id === id && m.by === ME); }); })) return;
      if(!DB.memories.some(function(m){ return m.id === id; })){ idbDeleteMedia(id); idbDeleteKeys(["orig:" + id]); delete MEDIA_URLS[id]; }
      renderMemoryTimeline();
      closeOverlay("memoryOverlay");
      showToast("Removed from Our Story.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Parallel Moments — settle-in on scroll                              */
  /* ------------------------------------------------------------------ */
  function wireParallax(){
    var block = document.getElementById("parallelBlock");
    if(!block || !("IntersectionObserver" in window)){
      if(block) block.classList.add("is-in-view");
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          block.classList.add("is-in-view");
        }
      });
    }, { threshold: .4 });
    io.observe(block);
  }

  /* ------------------------------------------------------------------ */
  /* Parallel Moments — each of you shares a photo from RIGHT NOW and    */
  /* the two sit side by side, with both local clocks running live.      */
  /* ------------------------------------------------------------------ */
  var PARALLEL_TOGETHER_MS = 15 * 60 * 1000;
  function latestParallel(who){
    return DB.moments.filter(function(m){ return m.parallel && m.by === who && m.type === "photo" && m.hasMedia; })
      .sort(function(x, y){ return (y.at || 0) - (x.at || 0); })[0] || null;
  }
  function agoText(ts){
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if(s < 45) return "just now";
    var m = Math.round(s / 60);
    if(m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if(h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.round(h / 24);
    return d + (d === 1 ? " day ago" : " days ago");
  }
  function gapText(ms){
    var m = Math.round(ms / 60000);
    if(m < 1) return "within a minute of each other";
    if(m < 60) return m + (m === 1 ? " minute" : " minutes") + " apart";
    var h = Math.round(m / 60);
    return h + (h === 1 ? " hour" : " hours") + " apart";
  }
  function parallelHalfHtml(side, person, m, isMe){
    var cls = "parallel-half parallel-half--" + side;
    var head = '<span class="place">'+escapeHtml(person.city)+'</span>'+
               '<span class="time" data-par-clock="'+side+'"></span>';
    if(m){
      return '<div class="'+cls+'" data-par-id="'+escapeHtml(m.id)+'"><div class="photo par-photo"></div><div class="moment-scrim"></div>'+
        '<div class="moment-meta">'+head+'<span class="par-ago" data-par-at="'+(m.at||0)+'">'+(isMe ? "You" : escapeHtml(person.name))+' · '+agoText(m.at||Date.now())+'</span></div></div>';
    }
    if(isMe){
      return '<button type="button" class="'+cls+' parallel-half--empty" data-parallel-share>'+
        '<span class="par-empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.2-1.6h6.2L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.2"/></svg></span>'+
        '<div class="moment-meta">'+head+'<span class="par-ago">Tap to share yours</span></div></button>';
    }
    return '<div class="'+cls+' parallel-half--empty parallel-half--waiting">'+
      '<span class="par-empty-ic par-wait" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></span>'+
      '<div class="moment-meta">'+head+'<span class="par-ago">Waiting for '+escapeHtml(person.name)+'</span></div></div>';
  }
  function renderParallel(){
    var frame = document.getElementById("parallelFrame");
    if(!frame) return;
    var me = SPACE.currentUser, them = SPACE.partner;
    var mine = latestParallel(ME), theirs = latestParallel(THEM);
    var html;
    if(!mine && !theirs){
      // Nothing shared yet — show the idea with the example pictures, clocks already live.
      html = '<div class="parallel-half parallel-half--a" data-par-example><div class="photo photo--ahmedabad-morn"></div><div class="moment-scrim"></div><div class="moment-meta"><span class="place">'+escapeHtml(me.city)+'</span><span class="time" data-par-clock="a"></span><span class="par-ago">Example</span></div></div>'+
             '<div class="parallel-half parallel-half--b" data-par-example><div class="photo photo--berlin-night"></div><div class="moment-scrim"></div><div class="moment-meta"><span class="place">'+escapeHtml(them.city)+'</span><span class="time" data-par-clock="b"></span><span class="par-ago">Example</span></div></div>';
    } else {
      html = parallelHalfHtml("a", me, mine, true) + parallelHalfHtml("b", them, theirs, false);
    }
    var together = mine && theirs && Math.abs((mine.at||0) - (theirs.at||0)) <= PARALLEL_TOGETHER_MS;
    frame.innerHTML = html + '<div class="parallel-seam" aria-hidden="true"></div>' +
      (together ? '<span class="par-together" role="status"><span aria-hidden="true">✦</span> Same moment</span>' : '');
    frame.classList.toggle("is-together", !!together);
    [[mine,"a"],[theirs,"b"]].forEach(function(pair){
      var m = pair[0]; if(!m) return;
      var layer = frame.querySelector('.parallel-half--'+pair[1]+' .par-photo');
      if(layer) loadMemoryUrl(m.id, function(url){ layer.style.backgroundImage = "url("+url+")"; });
    });
    var cap = document.getElementById("parallelCaption");
    if(cap){
      cap.textContent = mine && theirs ? "Shared " + gapText(Math.abs((mine.at||0) - (theirs.at||0))) + ". Two places, one moment."
        : mine ? them.name + " hasn't shared their side yet. It'll appear right next to yours."
        : theirs ? them.name + " shared their side. Add yours and see them together."
        : "Share a photo from right now. " + them.name + "'s sits right beside it.";
    }
    var btn = document.getElementById("parallelShare");
    if(btn) btn.textContent = mine ? "Share a new one" : "Share your side, right now";
    updateParallelLive(new Date());
  }
  function updateParallelLive(now){
    var a = formatTimeInZone(now, SPACE.currentUser.timezone), b = formatTimeInZone(now, SPACE.partner.timezone);
    document.querySelectorAll("[data-par-clock]").forEach(function(n){ n.textContent = n.getAttribute("data-par-clock") === "a" ? a : b; });
    document.querySelectorAll("[data-par-at]").forEach(function(n){
      var ts = Number(n.getAttribute("data-par-at")); if(!ts) return;
      var who = n.textContent.split(" · ")[0];
      n.textContent = who + " · " + agoText(ts);
    });
    var live = document.getElementById("parallelLiveText");
    if(live) live.textContent = SPACE.currentUser.city + " " + a + "  ·  " + SPACE.partner.city + " " + b;
  }
  function openParallelCapture(){
    if(!isPaired()){
      renderPairingOverlay(); openOverlay("pairingOverlay");
      showToast("Connect with " + SPACE.partner.name + " before adding a moment.");
      return;
    }
    resetCaptureFlow("photo");
    parallelCapture = true;
    var pn = document.getElementById("captureParallelNote");
    if(pn){ pn.hidden = false; pn.textContent = "This goes on Parallel Moments, right beside " + SPACE.partner.name + "'s."; }
    var pin = document.getElementById("capturePhotoInput"); if(pin) pin.setAttribute("capture", "environment"); // a live shot on phones
    openOverlay("captureOverlay");
  }
  function wireParallel(){
    var block = document.getElementById("parallelBlock");
    if(!block) return;
    block.addEventListener("click", function(e){
      if(e.target.closest("[data-parallel-share], #parallelShare")) openParallelCapture();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Notes composer                                                       */
  /* ------------------------------------------------------------------ */
  function wireNoteForm(){
    var form = document.getElementById("noteForm");
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var input = document.getElementById("noteInput");
      var val = input.value.trim();
      if(!val) return;
      if(!addSentNote(val)) return; // your words stay in the box
      renderNotes();
      input.value = "";
      showToast("Sent — a small signal, not a message " + SPACE.partner.name + " has to answer.");
    });

    // The wordless one-tap version of the exact same thing — Thinking of
    // You never requires typing to begin with; the note field is just for
    // when you want to add a little more.
    var quickBtn = document.getElementById("thinkingQuickBtn");
    if(quickBtn){
      quickBtn.addEventListener("click", function(){
        if(!addSentNote("")) return;
        renderNotes();
        quickBtn.disabled = true;
        var label = document.getElementById("thinkingQuickLabel");
        var prevLabel = label ? label.textContent : "";
        if(label) label.textContent = "Sent";
        showToast("Sent — no reply needed.");
        window.setTimeout(function(){
          quickBtn.disabled = false;
          if(label) label.textContent = prevLabel;
        }, 1600);
      });
    }

    var wish = document.getElementById("wishForm");
    if(wish){
      wish.addEventListener("submit", function(e){
        e.preventDefault();
        var input = document.getElementById("wishInput");
        var val = input.value.trim();
        if(!val) return;
        // This prototype has no server to send this to — opening a real
        // email to the founders is the honest version of "send", not a
        // toast pretending something was delivered with no network call.
        var mailto = "mailto:pairlum.co@gmail.com?subject=" + encodeURIComponent("Shape Pairlum") + "&body=" + encodeURIComponent(val);
        window.location.href = mailto;
        input.value = "";
        showToast("Opening your email to send this to the founders.");
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Important Dates (Us page) + the Home reminder banner for whichever  */
  /* one is coming up soonest.                                           */
  /* ------------------------------------------------------------------ */
  function renderImportantDates(){
    var list = document.getElementById("datesList");
    if(!list) return;
    list.innerHTML = "";
    var dates = getImportantDates();
    dates.forEach(function(d){
      var days = daysBetween(new Date(), new Date(d.date));
      var li = el("li","date-card");
      li.setAttribute("data-date-id", d.id);
      li.innerHTML =
        '<span class="date-card-emoji" aria-hidden="true">'+d.emoji+'</span>'+
        '<div class="date-card-body">'+
          '<p class="date-card-title">'+escapeHtml(d.title)+'</p>'+
          '<span class="date-card-sub">'+escapeHtml(d.sub)+'</span>'+
        '</div>'+
        '<span class="date-card-countdown">'+countdownLabel(days)+'</span>'+
        (d.removable ? '<button type="button" class="date-card-remove" data-remove-date="'+escapeHtml(d.id)+'" aria-label="Remove">✕</button>' : '');
      list.appendChild(li);
    });

    renderUpcomingReminder(dates);
  }

  function wireImportantDates(){
    var list = document.getElementById("datesList");
    var addBtn = document.getElementById("addDateBtn");
    var overlay = document.getElementById("addDateOverlay");
    var form = document.getElementById("addDateForm");
    if(list){
      list.addEventListener("click", function(e){
        var removeBtn = e.target.closest("[data-remove-date]");
        if(removeBtn){
          var id = removeBtn.getAttribute("data-remove-date");
          mutate(function(db){ db.dates = db.dates.filter(function(d){ return !(d.id === id && (!d.by || d.by === ME)); }); });
          renderImportantDates();
          return;
        }
        var card = e.target.closest(".date-card");
        if(card){
          var d = getImportantDates().filter(function(x){ return x.id === card.getAttribute("data-date-id"); })[0];
          if(d) showToast(d.emoji + " " + d.title + " — " + d.sub.toLowerCase() + ".");
        }
      });
    }
    if(addBtn && overlay){
      addBtn.addEventListener("click", function(){
        form.reset();
        openOverlay("addDateOverlay");
      });
    }
    if(form){
      form.addEventListener("submit", function(e){
        e.preventDefault();
        var title = document.getElementById("addDateTitle").value.trim();
        var dateVal = document.getElementById("addDateInput").value;
        if(!title || !dateVal) return;
        var parts = dateVal.split("-"); // YYYY-MM-DD — only month/day are kept, since every important date here recurs yearly
        if(!mutate(function(db){ db.dates.push({ id: uid("date"), by: ME, title: title, month: Number(parts[1]), day: Number(parts[2]) }); })) return;
        renderImportantDates();
        closeOverlay("addDateOverlay");
        showToast("Added — repeats every year.");
      });
    }
  }

  // The single soonest date, shown as a dismissible banner near the top of
  // Home. Dismissing it is remembered per occurrence (id + year), so it
  // stays dismissed until that date rolls around again next year.
  function renderUpcomingReminder(dates){
    var banner = document.getElementById("upcomingReminder");
    if(!banner) return;
    var dismissed = {};
    try{ dismissed = JSON.parse(localStorage.getItem(DATE_REMINDER_DISMISSED_KEY)) || {}; }catch(e){}

    var soonest = null, soonestDays = Infinity;
    dates.forEach(function(d){
      var days = daysBetween(new Date(), new Date(d.date));
      var occurrenceKey = d.id + "-" + d.date.getFullYear();
      if(days >= 0 && days <= UPCOMING_REMINDER_WINDOW_DAYS && !dismissed[occurrenceKey] && days < soonestDays){
        soonest = d; soonestDays = days;
      }
    });

    if(!soonest){ banner.hidden = true; return; }
    var when = soonestDays === 0 ? "today" : soonestDays === 1 ? "tomorrow" : "in " + soonestDays + " days";
    document.getElementById("upcomingReminderText").textContent = soonest.emoji + " " + soonest.title + " is " + when + ".";
    banner.setAttribute("data-occurrence-key", soonest.id + "-" + soonest.date.getFullYear());
    banner.hidden = false;
  }

  function wireUpcomingReminder(){
    var banner = document.getElementById("upcomingReminder");
    var dismissBtn = document.getElementById("upcomingReminderDismiss");
    if(!banner || !dismissBtn) return;
    dismissBtn.addEventListener("click", function(){
      var key = banner.getAttribute("data-occurrence-key");
      if(key){
        var dismissed = {};
        try{ dismissed = JSON.parse(localStorage.getItem(DATE_REMINDER_DISMISSED_KEY)) || {}; }catch(e){}
        dismissed[key] = true;
        try{ localStorage.setItem(DATE_REMINDER_DISMISSED_KEY, JSON.stringify(dismissed)); }catch(e){}
      }
      banner.hidden = true;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Daily Question — Paired-style flip card. Your own answer is real,   */
  /* persisted per calendar day (see loadDailyAnswer/saveDailyAnswer     */
  /* above); the partner's side is demo data, same as the rest of the    */
  /* couple-content in this file. Revealing requires answering first.    */
  /* ------------------------------------------------------------------ */
  function renderDailyQuestion(){
    SPACE.dailyQuestion = pickDailyQuestion();
    var dq = SPACE.dailyQuestion;
    if(!dq) return;
    var swap = document.getElementById("dqSwapBtn"); if(swap) swap.hidden = !canSwapQuestion();
    var arch = document.getElementById("dqArchiveBtn"); if(arch) arch.hidden = !answeredDays().length;
    setText("dqQuestionFront", dq.q);
    setText("dqQuestionBack", dq.q);
    setText("dqAnswerPartnerLabel", SPACE.partner.name);
    refreshDqPartner();

    var saved = loadDailyAnswer(), draft = loadDqDraft();
    var input = document.getElementById("dqAnswerInput");
    var reveal = document.getElementById("dqRevealBtn");
    if(input){
      var want = draft !== null ? draft : saved;
      if(input.value !== want) input.value = want; // never disturbs what is being typed
      if(reveal) reveal.disabled = !want.trim();
    }
    var back = document.getElementById("dqFlipInner");
    // the turned side is not reachable by keyboard or screen reader until it is the side showing
    var faces = back ? back.querySelectorAll(".dq-face") : [];
    if(faces.length === 2){
      var flipped = back.classList.contains("is-flipped");
      setInert(faces[0], flipped); setInert(faces[1], !flipped);
    }
  }

  function wireDailyQuestion(){
    var flipInner = document.getElementById("dqFlipInner");
    var input = document.getElementById("dqAnswerInput");
    var reveal = document.getElementById("dqRevealBtn");
    var flipBack = document.getElementById("dqFlipBackBtn");
    if(!flipInner || !input || !reveal) return;

    input.addEventListener("input", function(){
      var val = input.value.trim();
      saveDqDraft(input.value);
      reveal.disabled = !val;
    });

    reveal.addEventListener("click", function(){
      var val = input.value.trim();
      if(!val) return;
      var res = saveDailyAnswer(input.value, SPACE.dailyQuestion);
      if(res === "failed") return;                       // the words stay in the box; the message says why
      if(res === "changed"){
        renderDailyQuestion();
        showToast("Today's question changed while you were writing. Your words are still here.", true);
        return;
      }
      clearDqDraft();
      setText("dqAnswerYou", val);
      refreshDqPartner();
      flipInner.classList.add("is-flipped");
      renderDailyQuestion();
      markFirst("dq");
    });

    if(flipBack){
      flipBack.addEventListener("click", function(){
        flipInner.classList.remove("is-flipped");
        renderDailyQuestion();
      });
    }
    var swap = document.getElementById("dqSwapBtn");
    if(swap) swap.addEventListener("click", function(){
      if(swapDailyQuestion()){ renderDailyQuestion(); showToast("A different question for today, for both of you."); }
      else { renderDailyQuestion(); showToast("One of you has already answered today's question."); }
    });
    var arch = document.getElementById("dqArchiveBtn");
    if(arch) arch.addEventListener("click", function(){ renderDqArchive(60); openOverlay("dqArchiveOverlay"); });
  }
  function renderDqArchive(limit){
    var body = document.getElementById("dqArchiveBody");
    if(!body) return;
    var all = answeredDays(), p = SPACE.partner.name;
    var fmt = new Intl.DateTimeFormat("en-US", { weekday:"short", day:"numeric", month:"short", year:"numeric", timeZone:"UTC" });
    body.innerHTML = !all.length ? '<p class="dna-empty">Nothing answered yet. Today\'s question is on Home.</p>'
      : '<ul class="dq-archive">' + all.slice(0, limit).map(function(d){
          // today keeps the rule from Home: answer first, then see theirs
          var isToday = String(d.day) === String(sharedDay());
          var mineHtml = d.you ? escapeHtml(d.you) : '<i>'+(isToday ? 'Not answered yet' : 'No answer that day')+'</i>';
          var theirsHtml = (isToday && !d.you) ? '<i>'+(d.them ? 'Answered. Shown once you answer.' : 'Not answered yet')+'</i>'
                         : d.them ? escapeHtml(d.them) : '<i>'+(isToday ? 'Not answered yet' : 'No answer that day')+'</i>';
          return '<li><span class="dq-archive-day">'+escapeHtml(fmt.format(new Date(Number(d.day) * 86400000)))+'</span>'+
            '<p class="dq-archive-q">'+escapeHtml(d.q)+'</p>'+
            '<p class="dq-archive-a"><b>You</b> '+mineHtml+'</p>'+
            '<p class="dq-archive-a"><b>'+escapeHtml(p)+'</b> '+theirsHtml+'</p></li>';
        }).join("") + '</ul>' +
        (all.length > limit ? '<div class="confirm-actions"><button type="button" class="btn-ghost" id="dqArchiveMore">Show earlier answers</button></div>' : '');
    var more = document.getElementById("dqArchiveMore");
    if(more) more.addEventListener("click", function(){ renderDqArchive(limit + 120); });
  }

  /* ------------------------------------------------------------------ */
  /* Today feels — one-tap feeling check-in in the presence card. Yours  */
  /* is real and saved per calendar day; your partner's is demo data and */
  /* only shows once you've shared your own (same answer-first rule as   */
  /* the Daily Question, so nobody is just watched).                     */
  /* ------------------------------------------------------------------ */
  var FEEL_KEY = NS + "pairlum-feeling-v1"; // legacy per-device key, only cleared on delete
  var FEELINGS = [
    { id:"calm",    label:"Calm" },
    { id:"happy",   label:"Happy" },
    { id:"busy",    label:"Busy" },
    { id:"tired",   label:"Tired" },
    { id:"missing", label:"Missing you" },
    { id:"rough",   label:"Rough day" }
  ];
  function feelingLabel(id){
    var f = FEELINGS.filter(function(x){ return x.id === id; })[0];
    return f ? f.label : "";
  }
  function feelingOf(userId){
    var day = DB.feel[sharedDay()];
    return (day && day[userId]) || null;
  }
  function renderFeeling(){
    var chips = document.getElementById("feelChips");
    var line = document.getElementById("feelLine");
    var label = document.getElementById("feelLabel");
    if(!chips || !line) return;
    var mine = feelingOf(ME), theirs = feelingOf(THEM), p = SPACE.partner;
    chips.innerHTML = FEELINGS.map(function(f){
      var on = f.id === mine;
      return '<button type="button" class="feel-chip'+(on?' is-on':'')+'" data-feel="'+f.id+'" aria-pressed="'+(on?'true':'false')+'">'+escapeHtml(f.label)+'</button>';
    }).join("");
    line.hidden = false;
    if(mine){
      if(label) label.textContent = "Today feels";
      line.innerHTML = 'You: <b>'+escapeHtml(feelingLabel(mine))+'</b> <span class="feel-sep">·</span> '+escapeHtml(p.name)+': '+
        (theirs ? '<b>'+escapeHtml(feelingLabel(theirs))+'</b>' : 'not shared yet');
    } else {
      if(label) label.textContent = "How does today feel?";
      line.textContent = theirs ? p.name + " has shared theirs. Share yours to see it." : "Share yours — " + p.name + " will see it.";
    }
  }
  function wireFeeling(){
    var chips = document.getElementById("feelChips");
    if(!chips) return;
    chips.addEventListener("click", function(e){
      var btn = e.target.closest("[data-feel]");
      if(!btn) return;
      var id = btn.getAttribute("data-feel");
      var same = feelingOf(ME) === id;
      var feelSaved = mutate(function(db){
        var k = sharedDay();
        if(!db.feel[k]) db.feel[k] = {};
        if(same) delete db.feel[k][ME]; else db.feel[k][ME] = id;
      });
      renderFeeling();
      if(!same && feelSaved) showToast(id === "rough" || id === "tired" || id === "missing"
        ? "Shared with " + SPACE.partner.name + " — no reply needed."
        : "Shared with " + SPACE.partner.name + ".");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Our someday list — things to do together. Either partner can add or */
  /* tick one off; only the person who added an item can remove it.      */
  /* ------------------------------------------------------------------ */
  var SOMEDAY_KEY = NS + "pairlum-someday-v1"; // legacy per-device key, only cleared on delete
  function renderSomeday(){
    var list = document.getElementById("somedayList");
    if(!list) return;
    var all = DB.someday;
    var open = all.filter(function(x){ return !x.done; });
    var done = all.filter(function(x){ return x.done; });
    list.innerHTML = open.concat(done).map(function(it){
      var mine = it.by === ME;
      var by = mine ? "You" : SPACE.partner.name;
      return '<li class="someday-item'+(it.done?' is-done':'')+'">'+
        '<button type="button" class="someday-check" data-someday-toggle="'+escapeHtml(it.id)+'" aria-pressed="'+(it.done?'true':'false')+'" aria-label="'+(it.done?'Mark as not done yet':'Mark as done together')+'">'+
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>'+
        '<div class="someday-body"><p class="someday-text">'+escapeHtml(it.text)+'</p>'+
          '<span class="someday-by">'+whoDot(rel(it.by))+escapeHtml(by)+' added this</span></div>'+
        (mine ? '<button type="button" class="date-card-remove" data-someday-remove="'+escapeHtml(it.id)+'" aria-label="Remove">✕</button>' : '')+
      '</li>';
    }).join("");
    var count = document.getElementById("somedayCount");
    if(count) count.textContent = all.length ? done.length + " of " + all.length + " done together" : "";
  }
  function wireSomeday(){
    var list = document.getElementById("somedayList");
    var form = document.getElementById("somedayForm");
    if(!list || !form) return;
    list.addEventListener("click", function(e){
      var t = e.target.closest("[data-someday-toggle]");
      var r = e.target.closest("[data-someday-remove]");
      if(t){
        var id = t.getAttribute("data-someday-toggle"), nowDone = false;
        var sdSaved = mutate(function(db){
          db.someday.forEach(function(x){ if(x.id === id){ x.done = !x.done; nowDone = x.done; } });
        });
        if(nowDone && sdSaved) showToast("Done together — that one's yours now.");
      } else if(r){
        var rid = r.getAttribute("data-someday-remove");
        mutate(function(db){ db.someday = db.someday.filter(function(x){ return !(x.id === rid && x.by === ME); }); });
      } else return;
      renderSomeday();
    });
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var input = document.getElementById("somedayInput");
      var val = input.value.trim();
      if(!val) return;
      if(!mutate(function(db){ db.someday.unshift({ id: uid("sd"), by: ME, text: val, done:false, at: Date.now() }); })) return;
      renderSomeday();
      input.value = "";
      showToast("Added — " + SPACE.partner.name + " can see it too.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sound of where they are — each partner can record up to 30 seconds  */
  /* of the sound around them (rain, a café, their room). The other can  */
  /* play it on a soft loop in the background while using the app, so it */
  /* feels a little like being in the same room. One clip per partner;   */
  /* a new one replaces the old. Nothing ever plays by itself.           */
  /* ------------------------------------------------------------------ */
  var AMBIENT_MAX_SECONDS = 30;
  var AMBIENT_VOLUME_KEY = privateKey("pairlum-ambient-volume-v1");
  var ambient = { audio:null, playingId:null, rec:null, blob:null, url:null, secs:0 };
  function ambientVolume(){
    var v = 45;
    try{ var raw = localStorage.getItem(AMBIENT_VOLUME_KEY); if(raw !== null && !isNaN(Number(raw))) v = Number(raw); }catch(e){}
    return Math.max(0, Math.min(100, v));
  }
  function stopAmbient(){
    if(ambient.audio){ try{ ambient.audio.pause(); }catch(e){} ambient.audio = null; }
    ambient.playingId = null;
  }
  function playAmbient(clip){
    if(liveListenBusy()){ showToast("Stop the live sound first."); return; }
    var url = MEDIA_URLS[clip.id];
    if(!url){ showToast("Still loading that sound — try again in a second."); return; }
    stopAmbient();
    var au = new Audio(url);
    au.loop = true;
    au.volume = ambientVolume() / 100;
    ambient.audio = au;
    ambient.playingId = clip.id;
    var started = au.play();
    if(started && started.catch) started.catch(function(){
      if(ambient.audio === au){ stopAmbient(); renderAmbient(); showToast("Couldn't start the sound — tap play once more."); }
    });
  }
  function renderAmbient(){
    var card = document.getElementById("ambientCard");
    if(!card) return;
    var p = SPACE.partner, theirs = DB.ambient[THEM] || null, mine = DB.ambient[ME] || null;

    // If the clip that was playing has been replaced or removed, stop it.
    if(ambient.playingId && (!theirs || theirs.id !== ambient.playingId)) stopAmbient();
    var playing = !!(theirs && ambient.playingId === theirs.id);

    setText("ambientEyebrow", "Where " + p.name + " is");
    var playBtn = document.getElementById("ambientPlayBtn");
    var vol = document.getElementById("ambientVolume");
    if(theirs){
      setText("ambientTitle", theirs.label || ("The sound around " + p.name));
      setText("ambientMeta", (playing ? "Playing softly on a loop" : "Shared " + agoLabel(theirs.at) + " · " + theirs.secs + " sec") );
      playBtn.disabled = false;
      if(!MEDIA_URLS[theirs.id]){
        idbGetMedia(theirs.id, function(err, blob){
          if(err || !blob) return;
          MEDIA_URLS[theirs.id] = URL.createObjectURL(blob);
        });
      }
    } else {
      setText("ambientTitle", "Nothing shared yet");
      setText("ambientMeta", "When " + p.name + " shares the sound around them, you can play it here in the background.");
      playBtn.disabled = true;
    }
    playBtn.classList.toggle("is-playing", playing);
    playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
    playBtn.setAttribute("aria-label", playing ? "Stop the background sound" : "Play " + p.name + "'s sound in the background");
    playBtn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
    var listeningLive = LS.listen.state === "live";
    if(vol){ vol.hidden = !(playing || listeningLive); vol.value = String(ambientVolume()); }

    var pill = document.getElementById("ambientPill");
    if(pill){
      pill.hidden = !playing || liveAnyActive();
      if(playing) setText("ambientPillText", "Playing " + p.name + "'s sound");
    }
    renderLive();

    var recOpen = !document.getElementById("ambientRec").hidden;
    document.getElementById("ambientMine").hidden = recOpen;
    var shareBtn = document.getElementById("ambientShareBtn");
    var removeBtn = document.getElementById("ambientRemoveBtn");
    if(mine){
      setText("ambientMineLine", "You're sharing: " + (mine.label || "the sound around you") + " · " + agoLabel(mine.at));
      shareBtn.textContent = "Record a new one";
      removeBtn.hidden = false;
    } else {
      setText("ambientMineLine", p.name + " can't hear where you are yet.");
      shareBtn.textContent = "Share the sound around you";
      removeBtn.hidden = true;
    }
  }
  function closeAmbientRecorder(){
    if(ambient.rec && ambient.rec.isActive()){ ambient.discard = true; ambient.rec.stop(); }
    if(ambient.url){ URL.revokeObjectURL(ambient.url); }
    ambient.blob = null; ambient.url = null; ambient.secs = 0;
    document.getElementById("ambientRec").hidden = true;
    renderAmbient();
  }
  function setAmbientRecStage(stage){
    // stage: "recording" | "review" | "error"
    document.getElementById("ambientRecStop").hidden = stage !== "recording";
    document.getElementById("ambientReview").hidden = stage !== "review";
  }
  function startAmbientRecording(){
    var rec = document.getElementById("ambientRec");
    var status = document.getElementById("ambientRecStatus");
    stopAmbient(); // don't record your partner's sound back to them
    rec.hidden = false;
    document.getElementById("ambientLabelInput").value = "";
    setAmbientRecStage("error");
    status.textContent = "Asking for the microphone…";
    renderAmbient();
    ambient.discard = false;
    ambient.rec = makeRecorder({
      onStart: function(){
        setAmbientRecStage("recording");
        status.textContent = "Recording the sound around you… 0:00 of 0:" + AMBIENT_MAX_SECONDS;
      },
      onTick: function(sec){
        ambient.secs = Math.min(sec, AMBIENT_MAX_SECONDS);
        status.textContent = "Recording the sound around you… 0:" + pad2(ambient.secs) + " of 0:" + AMBIENT_MAX_SECONDS;
        if(sec >= AMBIENT_MAX_SECONDS && ambient.rec && ambient.rec.isActive()) ambient.rec.stop();
      },
      onStop: function(blob, url){
        if(ambient.discard){ URL.revokeObjectURL(url); return; }
        ambient.blob = blob; ambient.url = url;
        ambient.secs = Math.max(1, ambient.secs);
        status.textContent = "Recorded " + ambient.secs + " seconds. Have a listen, then share it.";
        document.getElementById("ambientPreview").src = url;
        setAmbientRecStage("review");
      },
      onError: function(msg){
        setAmbientRecStage("error");
        status.textContent = /blocked/i.test(msg)
          ? "The microphone is blocked. Allow it in your browser settings, then try again."
          : "This browser can't record sound.";
      }
    }, {
      // This is the sound of a place, not speech: noise removal would erase
      // exactly what is being shared, so it stays off, at a higher quality.
      audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:true, channelCount:1 },
      recorder: { audioBitsPerSecond: 128000 }
    });
    ambient.rec.start();
  }
  function shareAmbientRecording(){
    if(!ambient.blob) return;
    var id = uid("amb");
    var label = document.getElementById("ambientLabelInput").value.trim();
    var blob = ambient.blob, secs = ambient.secs, url = ambient.url;
    var btn = document.getElementById("ambientSendBtn");
    btn.disabled = true;
    // Store the sound first, then announce it, so it is there when your partner taps play.
    idbPutMedia(id, blob, function(err){
      btn.disabled = false;
      if(err){ showToast("Couldn't save that — this device is out of space."); return; }
      var old = DB.ambient[ME];
      if(!mutate(function(db){ db.ambient[ME] = { id:id, label:label, secs:secs, at:Date.now() }; })){
        // Not shared. The recording stays in the sheet to try again, the copy
        // just written is taken back, and the one already shared is untouched.
        idbDeleteMedia(id);
        return;
      }
      if(old && old.id !== id){ idbDeleteMedia(old.id); delete MEDIA_URLS[old.id]; }
      MEDIA_URLS[id] = url;
      ambient.blob = null; ambient.url = null;
      document.getElementById("ambientRec").hidden = true;
      renderAmbient();
      showToast("Shared — " + SPACE.partner.name + " can play it whenever they like.");
    });
  }
  function wireAmbient(){
    var card = document.getElementById("ambientCard");
    if(!card) return;
    document.getElementById("ambientPlayBtn").addEventListener("click", function(){
      var theirs = DB.ambient[THEM];
      if(!theirs) return;
      if(ambient.playingId === theirs.id) stopAmbient(); else playAmbient(theirs);
      renderAmbient();
    });
    document.getElementById("ambientVolume").addEventListener("input", function(e){
      var v = Number(e.target.value);
      try{ localStorage.setItem(AMBIENT_VOLUME_KEY, String(v)); }catch(err){}
      if(ambient.audio) ambient.audio.volume = v / 100;
    });
    document.getElementById("ambientPillStop").addEventListener("click", function(){ stopAmbient(); renderAmbient(); });
    document.getElementById("ambientShareBtn").addEventListener("click", startAmbientRecording);
    document.getElementById("ambientRecStop").addEventListener("click", function(){ if(ambient.rec) ambient.rec.stop(); });
    document.getElementById("ambientRecCancel").addEventListener("click", closeAmbientRecorder);
    document.getElementById("ambientAgainBtn").addEventListener("click", function(){
      if(ambient.url) URL.revokeObjectURL(ambient.url);
      ambient.blob = null; ambient.url = null;
      startAmbientRecording();
    });
    document.getElementById("ambientSendBtn").addEventListener("click", shareAmbientRecording);
    document.getElementById("ambientRemoveBtn").addEventListener("click", function(){
      var old = DB.ambient[ME];
      if(!old) return;
      if(!mutate(function(db){ delete db.ambient[ME]; })) return;
      idbDeleteMedia(old.id); delete MEDIA_URLS[old.id];
      renderAmbient();
      showToast("Removed — " + SPACE.partner.name + " can no longer play it.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* LIVE listening — hear where your partner is, right now.             */
  /* Works for BOTH partners, and both ways at once: each direction is   */
  /* its own session with its own permission.                            */
  /*   LS.listen = I am hearing my partner                               */
  /*   LS.share  = my partner is hearing me (my microphone)              */
  /* Consent rule: whoever owns the microphone must tap Allow EVERY      */
  /* time. Nothing is remembered, nothing auto-accepts, an unanswered    */
  /* request expires, and either of you can end either direction.        */
  /* While your microphone is live, you see it on every screen.          */
  /*                                                                     */
  /* Audio travels directly between the two devices (WebRTC). The small  */
  /* set-up messages go through liveSend/liveReceive — in this build via */
  /* the browser (two tabs); with a server, that pair is what gets       */
  /* swapped for the realtime channel.                                   */
  /* ------------------------------------------------------------------ */
  var LIVE_SIGNAL_KEY = NS + "pairlum-live-signal-v1";
  var LIVE_ASK_TIMEOUT_MS = 60000;           // an unanswered request expires
  var LIVE_MAX_MS = 15 * 60 * 1000;          // a session never runs on forgotten
  var LIVE_COOLDOWN_MS = 2 * 60 * 1000;      // after a "not now", wait before asking again
  var LIVE_HIDDEN_STOP_MS = 2 * 60 * 1000;   // sharer's app in the background this long → stop
  var LIVE_AUDIO_BITRATE = 96000;            // about three times a phone call; still small on mobile data
  // Two ways to share a microphone. The person sharing picks one, and can
  // switch while live.
  //   background — the place itself: rain, a café, a room. Clean-up filters
  //                stay off, because they would erase exactly that.
  //   voice      — the person: noise removal, echo control and level
  //                balancing are on, so speech is clear over a noisy room.
  var LIVE_MODES = {
    background: { label:"surroundings", hint:"music",  bitrate: LIVE_AUDIO_BITRATE, noise:false },
    voice:      { label:"voice",        hint:"speech", bitrate: 40000,              noise:true  }
  };
  function liveMicConstraints(mode){
    var voice = mode === "voice";
    return { audio: {
      echoCancellation: voice || liveListenBusy(),
      noiseSuppression: voice,
      autoGainControl: true,
      channelCount: 1, sampleRate: 48000
    } };
  }
  var liveCooldownUntil = 0;
  var liveHiddenTimer = null;
  var livePillKey = "";

  function newLiveSession(role){
    return { role:role, state:"idle", id:null, mode:"background", pc:null, stream:null, owned:[], audio:null, startedAt:0, pendingIce:[], askTimer:null, connectTimer:null, tick:null, needsTap:false };
  }
  /* MICROPHONE OWNERSHIP FOR LIVE SOUND
     Every stream opened for live sound is listed in LIVE_STREAMS from the
     moment the browser hands it over until its tracks are stopped, and it
     belongs to exactly one session (s.owned). Ending a session stops every
     stream it owns, whichever step it had reached. A stream that arrives
     after its session ended is stopped on arrival. */
  var LIVE_STREAMS = [];
  var LIVE_CONNECT_TIMEOUT_MS = 30000; // a connection that has not formed by then is given up
  function liveStopStream(stream){
    if(!stream) return;
    try{ stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
    var i = LIVE_STREAMS.indexOf(stream);
    if(i > -1) LIVE_STREAMS.splice(i, 1);
  }
  function liveIsCurrent(s){ return LS[liveSlotKey(s)] === s && s.state !== "idle"; }
  function liveOpenMic(s, mode){
    return navigator.mediaDevices.getUserMedia(liveMicConstraints(mode)).then(function(stream){
      LIVE_STREAMS.push(stream);
      if(!liveIsCurrent(s)){
        liveStopStream(stream); // the session ended while the permission prompt was open
        var gone = new Error("session ended"); gone.stale = true; throw gone;
      }
      s.owned.push(stream);
      return stream;
    });
  }
  function liveArmDeadline(s){
    window.clearTimeout(s.connectTimer);
    s.connectTimer = window.setTimeout(function(){
      if(!liveIsCurrent(s) || s.state !== "connecting") return;
      liveEnd(s, s.role === "sharer" ? "The live sound could not connect, so it was stopped. Your microphone is off." : "The live sound could not connect. Try again in a moment.");
    }, window.__pairlumTestConnectMs || LIVE_CONNECT_TIMEOUT_MS); // (the override exists only so a test need not wait 30 seconds)
  }
  // Ends both directions and stops every live-sound microphone, whatever
  // state it is in. Used when the relationship state changes (pause, leave,
  // disconnect, account deletion) and when the page goes away.
  function liveShutdown(message){
    var had = false;
    [LS.listen, LS.share].forEach(function(s){
      if(s.state === "idle") return;
      had = true;
      liveSend(s, s.state === "asking" ? "cancel" : s.state === "incoming" ? "decline" : "end");
      liveReset(s);
    });
    LIVE_STREAMS.slice().forEach(liveStopStream);
    if(had && message) showToast(message, true);
    return had;
  }
  var LS = { listen: newLiveSession("listener"), share: newLiveSession("sharer") };
  function liveSlotKey(s){ return s.role === "sharer" ? "share" : "listen"; }
  function liveAnyActive(){ return LS.listen.state !== "idle" || LS.share.state !== "idle"; }
  function liveListenBusy(){ return LS.listen.state === "connecting" || LS.listen.state === "live"; }

  // Each partner's own switch: whether live requests may reach them at all.
  function liveRequestsAllowed(userId){
    var pr = DB.prefs[userId];
    return !(pr && pr.liveRequests === false);
  }
  function liveIceServers(){
    var cfg = window.PAIRLUM_CONFIG && window.PAIRLUM_CONFIG.iceServers;
    return Array.isArray(cfg) ? cfg : [{ urls: "stun:stun.l.google.com:19302" }];
  }
  function liveSupported(){
    return typeof window.RTCPeerConnection !== "undefined" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  // "sharer" names whose microphone the message is about, so each side
  // can file it under the right direction.
  function liveSendRaw(id, sharerId, type, data){
    var msg = { id:id, sharer:sharerId, type:type, from:ME, to:THEM, data:data || null, n: Date.now() + ":" + Math.random() };
    try{ localStorage.setItem(LIVE_SIGNAL_KEY, JSON.stringify(msg)); }catch(e){}
  }
  function liveSend(s, type, data){ liveSendRaw(s.id, s.role === "sharer" ? ME : THEM, type, data); }
  window.addEventListener("storage", function(e){
    if(e.key !== LIVE_SIGNAL_KEY || !e.newValue) return;
    var msg = null;
    try{ msg = JSON.parse(e.newValue); }catch(err){}
    if(msg && msg.to === ME && msg.from === THEM) liveReceive(msg);
  });

  function liveReset(s){
    // Every finished session is logged once, by the person whose microphone it was.
    if(s.state === "live" && s.role === "sharer" && s.startedAt){
      var entry = { id:s.id, sharer:ME, listener:THEM, at:s.startedAt, secs: Math.max(1, Math.round((Date.now() - s.startedAt) / 1000)) };
      // every session is kept; the list on the privacy screen shows the newest
      mutate(function(db){ if(!db.liveLog.some(function(x){ return x.id === entry.id; })) db.liveLog.push(entry); }, { evenIfPaused: true });
    }
    if(s.role === "sharer") window.clearTimeout(liveHiddenTimer);
    window.clearTimeout(s.askTimer);
    window.clearTimeout(s.connectTimer);
    window.clearInterval(s.tick);
    if(s.pc){ try{ s.pc.onicecandidate = null; s.pc.ontrack = null; s.pc.onconnectionstatechange = null; s.pc.close(); }catch(e){} }
    // microphone off: every stream this session ever opened, not only the one in use
    s.owned.slice().forEach(liveStopStream);
    liveStopStream(s.stream);
    s.owned = []; s.stream = null;
    if(s.audio){ try{ s.audio.pause(); s.audio.srcObject = null; }catch(e){} }
    LS[liveSlotKey(s)] = newLiveSession(s.role);
    if(document.getElementById("ambientCard")) renderAmbient(); else renderLive();
  }
  // End one direction for both sides. `quiet` = the other side already knows.
  function liveEnd(s, message, quiet){
    if(s.state === "idle") return;
    if(!quiet) liveSend(s, "end");
    liveReset(s);
    if(message) showToast(message);
  }
  function liveClock(s){
    var sec = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
    return Math.floor(sec / 60) + ":" + pad2(sec % 60);
  }

  function livePillRows(){
    var p = escapeHtml(SPACE.partner.name), rows = [], sh = LS.share, li = LS.listen;
    var btn = function(slot, act, label, primary){
      return '<button type="button"'+(primary?' class="live-pill-yes"':'')+' data-live-slot="'+slot+'" data-live-act="'+act+'">'+label+'</button>';
    };
    // Your own microphone always comes first.
    if(sh.state === "incoming") rows.push({ text: p + " would like to listen to where you are, live.", btns: btn("share","allow","Share surroundings",true) + btn("share","allow-voice","Share my voice",true) + btn("share","decline","Not now") });
    else if(sh.state === "connecting") rows.push({ text: "Turning your microphone on…", btns: btn("share","stop","Cancel"), mic:true });
    else if(sh.state === "live") rows.push({ text: 'Your microphone is live (' + LIVE_MODES[sh.mode].label + ') · ' + p + ' is listening · <span data-live-clock="share"></span>',
      btns: btn("share", sh.mode === "voice" ? "mode-background" : "mode-voice", sh.mode === "voice" ? "Switch to surroundings" : "Switch to voice") + btn("share","stop","Stop sharing"), mic:true });
    if(li.state === "asking") rows.push({ text: "Asking " + p + " to share live…", btns: btn("listen","cancel","Cancel") });
    else if(li.state === "connecting") rows.push({ text: "Connecting to " + p + "…", btns: btn("listen","stop","Cancel") });
    else if(li.state === "live" && li.needsTap) rows.push({ text: p + " is sharing live.", btns: btn("listen","tap","Tap to listen",true) + btn("listen","stop","Stop") });
    else if(li.state === "live") rows.push({ text: '<span class="ambient-pill-bars" aria-hidden="true"><i></i><i></i><i></i></span> Listening live to ' + p + ' (' + LIVE_MODES[li.mode].label + ') · <span data-live-clock="listen"></span>', btns: btn("listen","stop","Stop") });
    return rows;
  }
  function renderLive(){
    var p = SPACE.partner;
    var pill = document.getElementById("livePill");
    var host = document.getElementById("livePillRows");
    var ask = document.getElementById("liveAskBtn");
    var status = document.getElementById("liveStatus");
    if(!pill || !host || !ask) return;
    var sh = LS.share, li = LS.listen;

    // Rebuild the buttons only when something actually changed, so a tap
    // is never swallowed by the once-a-second clock update.
    var key = sh.state + "|" + li.state + "|" + li.needsTap + "|" + sh.mode + "|" + li.mode;
    if(key !== livePillKey){
      livePillKey = key;
      var rows = livePillRows();
      var both = sh.state === "live" && li.state === "live";
      host.innerHTML = rows.map(function(r){
        return '<div class="live-pill-row'+(r.mic?' is-mic':'')+'">'+(r.mic?'<span class="live-dot" aria-hidden="true"></span>':'')+
          '<span class="live-pill-text">'+r.text+'</span><span class="live-pill-actions">'+r.btns+'</span></div>';
      }).join("") + (both ? '<p class="live-pill-note">You can hear each other. Headphones stop the echo.</p>' : '');
      pill.classList.toggle("is-mic", sh.state === "connecting" || sh.state === "live");
      pill.hidden = !rows.length;
    }
    host.querySelectorAll("[data-live-clock]").forEach(function(n){
      n.textContent = liveClock(n.getAttribute("data-live-clock") === "share" ? sh : li);
    });

    var ambientPill = document.getElementById("ambientPill");
    if(ambientPill && liveAnyActive()) ambientPill.hidden = true;

    ask.disabled = li.state !== "idle" || !liveSupported() || !!sleepState(THEM);
    if(status){
      status.textContent = !liveSupported() ? "Live listening isn't supported in this browser."
        : li.state === "live" ? "You're listening live."
        : li.state === "asking" ? "Waiting for " + p.name + " to answer…"
        : li.state === "connecting" ? "Connecting…"
        : sleepState(THEM) ? p.name + " said good night, so live requests are paused."
        : "Or hear it live. " + p.name + " is asked every time.";
    }
  }

  function liveWatch(s, pc){
    pc.onicecandidate = function(e){ if(e.candidate && pc === s.pc) liveSend(s, "ice", e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
    pc.onconnectionstatechange = function(){
      if(pc !== s.pc) return;
      var cs = pc.connectionState;
      if(cs === "connected" && s.state === "connecting"){
        window.clearTimeout(s.connectTimer);
        s.state = "live";
        s.startedAt = Date.now();
        s.tick = window.setInterval(function(){
          if(Date.now() - s.startedAt > LIVE_MAX_MS){
            liveEnd(s, s.role === "sharer" ? "Live sound ended after 15 minutes. Your microphone is off." : "Live sound ended after 15 minutes. Ask again any time.");
            return;
          }
          renderLive();
        }, 1000);
        renderAmbient();
        showToast(s.role === "sharer" ? SPACE.partner.name + " can hear where you are now." : "You're listening live to " + SPACE.partner.name + ".");
      } else if(cs === "failed" || cs === "closed"){
        liveEnd(s, "The live sound dropped.");
      }
    };
  }
  // Ask the audio codec (Opus) for a richer, steadier stream than its
  // speech default: higher bitrate, and no cutting out during quiet moments.
  function liveTuneSdp(sdp){
    return String(sdp).replace(/a=fmtp:(\d+) ([^\r\n]*useinbandfec=1[^\r\n]*)/g, function(line, pt, params){
      var keep = params.split(";").filter(function(kv){ return !/^\s*(maxaveragebitrate|usedtx|stereo)=/.test(kv); });
      return "a=fmtp:" + pt + " " + keep.concat(["maxaveragebitrate=" + LIVE_AUDIO_BITRATE, "usedtx=0", "stereo=0"]).join(";");
    });
  }
  function liveTuneSender(pc, mode){
    var m = LIVE_MODES[mode] || LIVE_MODES.background;
    pc.getSenders().forEach(function(sender){
      if(!sender.track || sender.track.kind !== "audio") return;
      try{ sender.track.contentHint = m.hint; }catch(e){} // ambience or speech
      try{
        var params = sender.getParameters();
        if(!params.encodings || !params.encodings.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = m.bitrate;
        sender.setParameters(params).catch(function(){});
      }catch(e){}
    });
  }
  function liveFlushIce(s){
    var list = s.pendingIce; s.pendingIce = [];
    list.forEach(function(cand){ if(s.pc) s.pc.addIceCandidate(cand).catch(function(){}); });
  }
  // When sound goes both ways, the microphone would pick the partner's
  // sound back up from the speaker. Echo control is switched on for that case.
  function liveEchoControl(on){
    var st = LS.share.stream;
    if(!st) return;
    st.getAudioTracks().forEach(function(t){
      if(LS.share.mode === "voice") return; // voice mode already has echo control on
      if(t.applyConstraints) t.applyConstraints({ echoCancellation: on, noiseSuppression: false, autoGainControl: true }).catch(function(){});
    });
  }

  // ---- I want to listen ----
  function liveAsk(){
    var s = LS.listen;
    if(s.state !== "idle" || !liveSupported() || !isPaired()) return;
    if(Date.now() < liveCooldownUntil){ showToast("Give it a little while before asking again."); return; }
    s.state = "asking"; s.id = uid("live");
    liveSend(s, "ask");
    s.askTimer = window.setTimeout(function(){
      if(LS.listen !== s || s.state !== "asking") return;
      liveSend(s, "cancel");
      liveReset(s);
      liveCooldownUntil = Date.now() + LIVE_COOLDOWN_MS;
      showToast(SPACE.partner.name + " didn't answer — maybe later.");
    }, LIVE_ASK_TIMEOUT_MS);
    renderLive();
  }
  function liveListenerAccept(s, offer){
    window.clearTimeout(s.askTimer);
    s.state = "connecting";
    liveArmDeadline(s);
    stopAmbient(); // the live sound replaces the recorded loop
    liveEchoControl(true);
    var pc = new RTCPeerConnection({ iceServers: liveIceServers() });
    s.pc = pc;
    liveWatch(s, pc);
    pc.ontrack = function(e){
      if(pc !== s.pc) return;
      var au = new Audio();
      au.autoplay = true;
      au.srcObject = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
      au.volume = ambientVolume() / 100;
      s.audio = au;
      var started = au.play();
      if(started && started.catch) started.catch(function(){ if(s.audio === au){ s.needsTap = true; renderLive(); } });
    };
    pc.setRemoteDescription(offer)
      .then(function(){ liveFlushIce(s); return pc.createAnswer(); })
      .then(function(answer){ return pc.setLocalDescription({ type: answer.type, sdp: liveTuneSdp(answer.sdp) }); })
      .then(function(){ if(pc === s.pc) liveSend(s, "answer", { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
      .catch(function(){ if(pc === s.pc) liveEnd(s, "Couldn't connect the live sound. Try again."); });
    renderAmbient();
  }

  // ---- my microphone ----
  function liveAllow(mode){
    var s = LS.share;
    if(s.state !== "incoming") return;
    window.clearTimeout(s.askTimer);
    s.mode = mode === "voice" ? "voice" : "background";
    s.state = "connecting";
    liveArmDeadline(s); // runs from the first moment, so a prompt or a stalled connection cannot hold the microphone
    renderLive();
    // Voice clean-up filters stay off on purpose — they would erase the rain
    // or café hum this is meant to carry. Echo control only when both ways.
    liveOpenMic(s, s.mode).then(function(stream){
      if(s.state !== "connecting"){ liveStopStream(stream); return; }
      s.stream = stream;
      var pc = new RTCPeerConnection({ iceServers: liveIceServers() });
      s.pc = pc;
      stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });
      liveWatch(s, pc);
      return pc.createOffer().then(function(offer){ return pc.setLocalDescription({ type: offer.type, sdp: liveTuneSdp(offer.sdp) }); })
        .then(function(){ if(pc === s.pc && liveIsCurrent(s)) liveSend(s, "offer", { type: pc.localDescription.type, sdp: pc.localDescription.sdp, mode: s.mode }); });
    }).catch(function(err){
      if(err && err.stale) return;          // already ended and cleaned up
      if(!liveIsCurrent(s)) return;
      var hadMic = s.owned.length > 0;
      liveSend(s, hadMic ? "end" : "decline");
      liveReset(s);                          // stops whatever was opened
      showToast(hadMic ? "The live sound could not start. Your microphone is off." : "The microphone is blocked, so nothing was shared.");
    });
  }
  // Switch mode while live: open the microphone again with the new
  // settings and swap it into the same connection — no new permission
  // needed from the listener, and no gap they would notice.
  function liveSetMode(mode){
    var s = LS.share;
    if(s.state !== "live" || !s.pc || s.mode === mode || s.switching) return;
    s.switching = true;
    var prev = s.mode;
    // The old microphone feed is closed first: a browser keeps one set of
    // clean-up filters per microphone, so the new settings only take hold
    // on a fresh feed. The listener hears a blink of silence.
    var old = s.stream;
    s.owned = s.owned.filter(function(x){ return x !== old; });
    liveStopStream(old);
    s.stream = null;
    liveOpenMic(s, mode).then(function(stream){
      // from here the new stream is owned by the session: any ending stops it
      if(s.state !== "live" || !s.pc) return;
      var track = stream.getAudioTracks()[0];
      var sender = s.pc.getSenders().filter(function(x){ return x.track && x.track.kind === "audio"; })[0] || s.pc.getSenders()[0];
      if(!sender || !track) throw new Error("nothing to switch");
      return sender.replaceTrack(track).then(function(){
        if(!liveIsCurrent(s) || s.state !== "live") return; // ended during the swap: liveReset already stopped the stream
        s.stream = stream;
        s.mode = mode;
        liveTuneSender(s.pc, mode);
        liveSend(s, "mode", { mode: mode });
        s.switching = false;
        renderLive();
        showToast(mode === "voice" ? "Voice mode — background noise is being removed." : "Surroundings mode — sharing the room as it sounds.");
      });
    }).catch(function(err){
      if(err && err.stale) return;
      s.switching = false; s.mode = prev;
      // Nothing is being sent, so end it. liveEnd stops every stream the session owns, the new one included.
      if(liveIsCurrent(s)) liveEnd(s, "Couldn't switch mode, so sharing stopped. Your microphone is off.");
    });
  }
  function liveDecline(){
    var s = LS.share;
    if(s.state !== "incoming") return;
    liveSend(s, "decline");
    liveReset(s);
    showToast("That's okay — nothing was shared.");
  }

  function liveReceive(msg){
    var p = SPACE.partner.name;
    var s = msg.sharer === ME ? LS.share : LS.listen; // which direction this is about
    if(msg.type === "ask"){
      if(msg.sharer !== ME) return;
      if(s.state !== "idle" || !liveSupported() || !isPaired() || !liveRequestsAllowed(ME) || sleepState(ME)){
        // busy, unable or switched off: answered exactly like a "not now"
        liveSendRaw(msg.id, ME, "decline");
        return;
      }
      s.state = "incoming"; s.id = msg.id;
      s.askTimer = window.setTimeout(function(){ if(LS.share === s && s.state === "incoming") liveReset(s); }, LIVE_ASK_TIMEOUT_MS);
      renderLive();
      return;
    }
    if(msg.id !== s.id){
      // An offer for a request this side already gave up: tell the sharer, so their microphone is released at once.
      if(msg.type === "offer" && msg.sharer === THEM) liveSendRaw(msg.id, THEM, "end");
      return;
    }
    // The listener changed their mind. Honoured in every state, not only before you answered.
    if(msg.type === "cancel" && s.role === "sharer" && s.state !== "idle"){
      var micWasOn = s.state !== "incoming";
      liveReset(s);
      if(micWasOn) showToast(p + " cancelled. Your microphone is off.");
    }
    else if(msg.type === "decline" && s.role === "listener"){
      liveReset(s);
      liveCooldownUntil = Date.now() + LIVE_COOLDOWN_MS;
      showToast(p + " can't share right now.");
    }
    else if(msg.type === "offer" && s.role === "listener" && s.state === "asking"){
      s.mode = msg.data && msg.data.mode === "voice" ? "voice" : "background";
      liveListenerAccept(s, { type: msg.data.type, sdp: msg.data.sdp });
    }
    else if(msg.type === "mode" && s.role === "listener" && msg.data){
      s.mode = msg.data.mode === "voice" ? "voice" : "background";
      renderLive();
    }
    else if(msg.type === "answer" && s.role === "sharer" && s.pc){
      var pc = s.pc;
      pc.setRemoteDescription(msg.data).then(function(){ liveFlushIce(s); liveTuneSender(pc, s.mode); }).catch(function(){ if(pc === s.pc) liveEnd(s, "Couldn't connect the live sound. Try again."); });
    }
    else if(msg.type === "ice" && msg.data){
      if(s.pc && s.pc.remoteDescription && s.pc.remoteDescription.type) s.pc.addIceCandidate(msg.data).catch(function(){});
      else s.pendingIce.push(msg.data);
    }
    else if(msg.type === "end"){
      var wasLive = s.state === "live";
      liveEnd(s, wasLive ? (s.role === "sharer" ? p + " stopped listening. Your microphone is off." : p + " stopped sharing.") : null, true);
    }
  }

  function wireLive(){
    var ask = document.getElementById("liveAskBtn");
    if(!ask) return;
    ask.addEventListener("click", liveAsk);
    document.getElementById("livePillRows").addEventListener("click", function(e){
      var b = e.target.closest("[data-live-act]");
      if(!b) return;
      var s = LS[b.getAttribute("data-live-slot")], act = b.getAttribute("data-live-act");
      if(act === "allow") liveAllow("background");
      else if(act === "allow-voice") liveAllow("voice");
      else if(act === "mode-voice") liveSetMode("voice");
      else if(act === "mode-background") liveSetMode("background");
      else if(act === "decline") liveDecline();
      else if(act === "cancel"){ if(s.state !== "idle"){ liveSend(s, "cancel"); liveReset(s); } }
      else if(act === "tap"){
        if(s.audio) s.audio.play().then(function(){ s.needsTap = false; renderLive(); }).catch(function(){});
      }
      else if(act === "stop") liveEnd(s, s.role === "sharer" ? "Stopped. Your microphone is off." : "Stopped listening.");
    });
    document.getElementById("ambientVolume").addEventListener("input", function(e){
      if(LS.listen.audio) LS.listen.audio.volume = Number(e.target.value) / 100;
    });
    // If the person sharing puts Pairlum in the background, they can no
    // longer see the "microphone is live" notice — so it stops by itself.
    document.addEventListener("visibilitychange", function(){
      window.clearTimeout(liveHiddenTimer);
      var s = LS.share;
      if(document.hidden && (s.state === "live" || s.state === "connecting")){
        liveHiddenTimer = window.setTimeout(function(){
          if(LS.share === s && s.state !== "idle") liveEnd(s, "Live sound stopped because Pairlum was in the background. Your microphone is off.");
        }, LIVE_HIDDEN_STOP_MS);
      }
    });
    // Closing or leaving the page always ends both directions and frees the microphone.
    window.addEventListener("pagehide", function(){ liveShutdown(); });
    renderLive();
  }

  /* ------------------------------------------------------------------ */
  /* TIME & DISTANCE — three things a long-distance couple leans on:     */
  /*   1. the next reunion date, set together                            */
  /*   2. plans (a call, a movie night) shown in BOTH time zones         */
  /*   3. good night / good morning, so each knows when the other sleeps */
  /* All three live in the shared record, so both partners see the same. */
  /* ------------------------------------------------------------------ */

  // ---- time-zone helpers -------------------------------------------
  // How far a time zone is from UTC at a given moment (handles daylight saving).
  function tzOffsetMs(ts, tz){
    var parts = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle:"h23", year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"numeric", second:"numeric" })
      .formatToParts(new Date(ts)).forEach(function(x){ parts[x.type] = x.value; });
    var asUtc = Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    return asUtc - Math.floor(ts / 1000) * 1000;
  }
  // "2026-10-08T21:30" as typed by someone living in `tz` → the real moment.
  function wallToUtc(str, tz){
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(str || "");
    if(!m) return NaN;
    var guess = Date.UTC(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]), Number(m[5]));
    var first = guess - tzOffsetMs(guess, tz);
    return guess - tzOffsetMs(first, tz);
  }
  function utcToWall(ts, tz){
    var d = new Date(ts + tzOffsetMs(ts, tz));
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth()+1) + "-" + pad2(d.getUTCDate()) + "T" + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  }
  function whenInZone(ts, tz){
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday:"short", day:"numeric", month:"short", hour:"numeric", minute:"2-digit", hour12: clock12() }).format(new Date(ts));
  }
  function untilLabel(ts){
    var mins = Math.round((ts - Date.now()) / 60000);
    if(mins <= 0) return "now";
    if(mins < 60) return "in " + mins + " min";
    var hrs = Math.round(mins / 60);
    if(hrs < 24) return "in " + hrs + " h";
    return "in " + Math.round(hrs / 24) + " d";
  }

  // ---- 1. reunion — a day, a month or just a year --------------------
  // Stored as "2026-12-20", "2026-12" or "2027": whatever the couple knows.
  function reunionParse(value){
    var v = String(value || ""), m;
    if((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v))){
      if(!validIso(v, true)) return null;
      var d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
      return { precision:"day", value:v, start:d, end:d,
        label: new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long", year:"numeric" }).format(d) };
    }
    if((m = /^(\d{4})-(\d{2})$/.exec(v))){
      var mo = Number(m[2]);
      if(mo < 1 || mo > 12) return null;
      var s = new Date(Number(m[1]), mo-1, 1);
      return { precision:"month", value:v, start:s, end:new Date(Number(m[1]), mo, 0),
        label: new Intl.DateTimeFormat("en-US", { month:"long", year:"numeric" }).format(s) };
    }
    if((m = /^(\d{4})$/.exec(v))){
      return { precision:"year", value:v, start:new Date(Number(m[1]), 0, 1), end:new Date(Number(m[1]), 11, 31), label:m[1] };
    }
    return null;
  }
  // What the big number says. A day counts days; a month counts months;
  // a year just shows the year — it never pretends to a precision you don't have.
  function reunionCount(ru){
    if(!ru) return { big:"—", unit:"", statLabel:"to reunion" };
    var now = new Date();
    if(ru.precision === "day"){
      var days = Math.max(0, daysBetween(new Date(), new Date(ru.start.getTime())));
      return { big:String(days), unit: days === 1 ? "day" : "days", statLabel: (days === 1 ? "day" : "days") + " to reunion" };
    }
    if(ru.precision === "month"){
      var months = (ru.start.getFullYear() - now.getFullYear()) * 12 + (ru.start.getMonth() - now.getMonth());
      if(months <= 0) return { big:"This", unit:"month", statBig:"This month", statLabel:"reunion" };
      return { big:String(months), unit: months === 1 ? "month" : "months", statLabel: (months === 1 ? "month" : "months") + " to reunion" };
    }
    if(ru.start.getFullYear() <= now.getFullYear()) return { big:"This", unit:"year", statBig:"This year", statLabel:"reunion" };
    return { big:ru.label, unit:"", statLabel:"reunion year" };
  }
  var reunionEditPrecision = "day";
  function setReunionPrecision(p){
    reunionEditPrecision = p;
    document.querySelectorAll("#reunionPrecision [data-reunion-precision]").forEach(function(b){
      var on = b.getAttribute("data-reunion-precision") === p;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.getElementById("reunionDayRow").hidden = p !== "day";
    document.getElementById("reunionMonthRow").hidden = p !== "month";
    document.getElementById("reunionYearRow").hidden = p === "day";
    setText("reunionFormNote", "");
  }
  function openReunionEditor(){
    var now = new Date(), ru = reunionParse(SPACE.reunionDate);
    var d = document.getElementById("reunionDateInput");
    d.min = isoFromDate(now);
    d.value = ru && ru.precision === "day" ? ru.value : "";
    var monthSel = document.getElementById("reunionMonthSelect");
    monthSel.innerHTML = Array.apply(null, Array(12)).map(function(_, i){
      return '<option value="'+pad2(i+1)+'">'+new Intl.DateTimeFormat("en-US", { month:"long" }).format(new Date(2026, i, 1))+'</option>';
    }).join("");
    var yearSel = document.getElementById("reunionYearSelect"), years = "";
    for(var y = now.getFullYear(); y <= now.getFullYear() + 8; y++) years += '<option value="'+y+'">'+y+'</option>';
    yearSel.innerHTML = years;
    var base = ru ? ru.start : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    monthSel.value = pad2(base.getMonth() + 1);
    yearSel.value = String(Math.min(Math.max(base.getFullYear(), now.getFullYear()), now.getFullYear() + 8));
    document.getElementById("reunionPlaceInput").value = SPACE.reunionPlace || "";
    setReunionPrecision(ru ? ru.precision : "day");
    document.getElementById("reunionClear").hidden = !ru;
    openOverlay("reunionOverlay");
  }
  function wireReunionEditor(){
    var btn = document.getElementById("reunionEditBtn");
    if(!btn) return;
    btn.addEventListener("click", openReunionEditor);
    document.getElementById("reunionPrecision").addEventListener("click", function(e){
      var b = e.target.closest("[data-reunion-precision]");
      if(b) setReunionPrecision(b.getAttribute("data-reunion-precision"));
    });
    document.getElementById("reunionSave").addEventListener("click", function(){
      var now = new Date(), value = "", p = reunionEditPrecision;
      var place = document.getElementById("reunionPlaceInput").value.trim();
      var year = document.getElementById("reunionYearSelect").value;
      if(p === "day"){
        value = document.getElementById("reunionDateInput").value;
        if(!validIso(value, true) || value < isoFromDate(now)){ setText("reunionFormNote", "Pick today or a day still to come."); return; }
      } else if(p === "month"){
        value = year + "-" + document.getElementById("reunionMonthSelect").value;
        if(value < now.getFullYear() + "-" + pad2(now.getMonth() + 1)){ setText("reunionFormNote", "That month has already passed."); return; }
      } else {
        value = year;
      }
      if(!mutate(function(db){ db.reunion = { date: value, place: place, by: ME, at: Date.now() }; })){ setText("reunionFormNote", "Not saved. Your choice is still here, so you can try again."); return; }
      renderSpaceBindings();
      closeOverlay("reunionOverlay");
      var ru = reunionParse(value), c = reunionCount(ru);
      showToast(p === "day" ? "Saved — " + c.big + " " + c.unit + " to go." : "Saved — sometime in " + ru.label + ". Narrow it down whenever you know more.");
      celebrate();
    });
    document.getElementById("reunionClear").addEventListener("click", function(){
      if(!mutate(function(db){ db.reunion = null; })) return;
      renderSpaceBindings();
      closeOverlay("reunionOverlay");
      showToast("Cleared. Set it again whenever you know.");
    });
  }

  // ---- 2. plans in both time zones ----------------------------------
  var PLAN_KEEP_MS = 2 * 60 * 60 * 1000; // a plan stays listed for 2 hours after it starts
  var planReminded = {};
  function upcomingPlans(){
    var cutoff = Date.now() - PLAN_KEEP_MS;
    return DB.plans.filter(function(p){ return p.at > cutoff; }).sort(function(x, y){ return x.at - y.at; });
  }
  function renderPlans(){
    var list = document.getElementById("plansList");
    if(!list) return;
    var me = SPACE.currentUser, p = SPACE.partner, plans = upcomingPlans();
    if(!plans.length){
      list.innerHTML = '<li class="plan-empty">'+emptyArt("plans")+'<span>Nothing planned yet. Add a call or a movie night and it shows in both your time zones.</span></li>';
      return;
    }
    list.innerHTML = plans.map(function(pl){
      var started = pl.at <= Date.now();
      return '<li class="plan-item">'+
        '<div class="plan-body">'+
          '<p class="plan-title">'+escapeHtml(pl.title)+'</p>'+
          '<p class="plan-when"><b>'+escapeHtml(whenInZone(pl.at, me.timezone))+'</b> your time</p>'+
          '<p class="plan-when">'+escapeHtml(whenInZone(pl.at, p.timezone))+' for '+escapeHtml(p.name)+'</p>'+
        '</div>'+
        '<div class="plan-side">'+
          '<span class="date-card-countdown">'+(started ? "Now" : escapeHtml(untilLabel(pl.at)))+'</span>'+
          (pl.by === ME ? '<button type="button" class="date-card-remove" data-plan-remove="'+escapeHtml(pl.id)+'" aria-label="Remove plan">✕</button>' : '')+
        '</div>'+
      '</li>';
    }).join("");
  }
  function updatePlanPreview(){
    var val = document.getElementById("planWhenInput").value;
    var ts = wallToUtc(val, SPACE.currentUser.timezone);
    setText("planPreview", isNaN(ts) ? "" : "That's " + whenInZone(ts, SPACE.partner.timezone) + " for " + SPACE.partner.name + ".");
  }
  function wirePlans(){
    var addBtn = document.getElementById("addPlanBtn");
    if(!addBtn) return;
    addBtn.addEventListener("click", function(){
      document.getElementById("planTitleInput").value = "";
      var w = document.getElementById("planWhenInput");
      w.min = utcToWall(Date.now(), SPACE.currentUser.timezone);
      w.value = "";
      setText("planWhenLabel", "When, in your time (" + SPACE.currentUser.city + ")");
      setText("planPreview", ""); setText("planFormNote", "");
      openOverlay("planOverlay");
    });
    document.getElementById("planIdeas").addEventListener("click", function(e){
      var chip = e.target.closest("[data-plan-idea]");
      if(chip) document.getElementById("planTitleInput").value = chip.getAttribute("data-plan-idea");
    });
    document.getElementById("planWhenInput").addEventListener("input", updatePlanPreview);
    document.getElementById("planSave").addEventListener("click", function(){
      var title = document.getElementById("planTitleInput").value.trim();
      var ts = wallToUtc(document.getElementById("planWhenInput").value, SPACE.currentUser.timezone);
      if(!title){ setText("planFormNote", "Give the plan a name."); return; }
      if(isNaN(ts) || ts < Date.now() - 60000){ setText("planFormNote", "Pick a time that's still to come."); return; }
      if(!mutate(function(db){ db.plans.push({ id: uid("plan"), by: ME, title: title, at: ts }); })){ setText("planFormNote", "Not saved. Your plan is still here, so you can try again."); return; }
      renderPlans();
      closeOverlay("planOverlay");
      showToast("Added — " + SPACE.partner.name + " sees it in their own time.");
      celebrate();
    });
    document.getElementById("plansList").addEventListener("click", function(e){
      var r = e.target.closest("[data-plan-remove]");
      if(!r) return;
      var id = r.getAttribute("data-plan-remove");
      mutate(function(db){ db.plans = db.plans.filter(function(x){ return !(x.id === id && x.by === ME); }); });
      renderPlans();
    });
    // While the app is open: one gentle heads-up 15 minutes before a plan.
    window.setInterval(function(){
      renderPlans();
      upcomingPlans().forEach(function(pl){
        var mins = (pl.at - Date.now()) / 60000;
        if(mins > 0 && mins <= 15 && !planReminded[pl.id]){
          planReminded[pl.id] = true;
          notify({ type:"plans", text: pl.title + " with " + SPACE.partner.name + " " + untilLabel(pl.at) + ".", view:"home", target:"plansBlock" });
        }
      });
    }, 30000);
  }

  // ---- 3. good night / good morning ---------------------------------
  var SLEEP_EXPIRES_MS = 12 * 60 * 60 * 1000; // a forgotten "good night" wears off by itself
  function sleepState(userId){
    var s = DB.sleep[userId];
    return s && s.asleep && (Date.now() - s.at) < SLEEP_EXPIRES_MS ? s : null;
  }
  function renderSleep(){
    var btn = document.getElementById("sleepBtn");
    if(!btn) return;
    var p = SPACE.partner, mine = sleepState(ME), theirs = sleepState(THEM);
    btn.textContent = mine ? "Good morning — I'm up" : "Say good night";
    btn.setAttribute("aria-pressed", mine ? "true" : "false");
    setText("sleepLine", mine ? p.name + " knows you're asleep. Live requests are paused."
      : theirs ? p.name + " said good night " + agoLabel(theirs.at) + ". It's " + formatTimeInZone(new Date(), p.timezone) + " there."
      : "");
    var av = document.getElementById("presenceAvatarB");
    if(av) av.classList.toggle("is-asleep", !!theirs);
    var mineAv = document.getElementById("presenceAvatarA");
    if(mineAv) mineAv.classList.toggle("is-asleep", !!mine);
  }
  function wireSleep(){
    var btn = document.getElementById("sleepBtn");
    if(!btn) return;
    btn.addEventListener("click", function(){
      var going = !sleepState(ME);
      if(!mutate(function(db){ db.sleep[ME] = { asleep: going, at: Date.now() }; })){ renderSleep(); return; }
      if(going && LS.share.state === "incoming") liveDecline();
      renderSleep();
      renderLive();
      showToast(going ? "Good night sent to " + SPACE.partner.name + "." : "Good morning sent to " + SPACE.partner.name + ".");
    });
  }

  /* ------------------------------------------------------------------ */
  /* SMALL TOUCHES — the quiet details: petals drifting behind the page, */
  /* a greeting, the count of days together, and a little flutter when   */
  /* affection is sent or arrives. All of it is decoration: it never     */
  /* blocks a tap, and it switches off with Reduced motion or the        */
  /* "Falling petals" setting.                                           */
  /* ------------------------------------------------------------------ */
  // Small line drawings for the "nothing here yet" moments, drawn in the
  // theme's own soft accent so they follow all five themes.
  function emptyArt(kind){
    var open = '<svg class="empty-art" viewBox="0 0 72 56" width="72" height="56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    var heart = '<path d="M36 33c-3.4-2.4-6-4.8-6-7.6a3.2 3.2 0 0 1 6-1.5 3.2 3.2 0 0 1 6 1.5c0 2.8-2.6 5.2-6 7.6z"/>';
    if(kind === "timeline") return open +
      '<rect x="10" y="12" width="30" height="34" rx="3" transform="rotate(-7 25 29)"/>' +
      '<rect x="32" y="10" width="30" height="34" rx="3" transform="rotate(6 47 27)"/>' +
      '<path d="M41 27c-2.2-1.6-4-3.2-4-5.1a2.1 2.1 0 0 1 4-1 2.1 2.1 0 0 1 4 1c0 1.9-1.8 3.5-4 5.1z" transform="translate(6 2)"/></svg>';
    if(kind === "plans") return open +
      '<rect x="14" y="12" width="44" height="36" rx="4"/><path d="M14 22h44M26 8v8M46 8v8"/>' + heart.replace('d="', 'transform="translate(0 6)" d="') + '</svg>';
    return open + // chapters: an open book
      '<path d="M36 16c-5-4-13-5-22-3v30c9-2 17-1 22 3 5-4 13-5 22-3V13c-9-2-17-1-22 3z"/><path d="M36 16v30"/></svg>';
  }
  function motionAllowed(){
    return !document.body.classList.contains("reduced-motion") && !prefersReducedMotion();
  }
  function renderPetals(){
    var layer = document.getElementById("petals");
    if(!layer) return;
    var on = SPACE.petals !== false && motionAllowed();
    layer.hidden = !on;
    if(!on){ layer.innerHTML = ""; return; }
    var full = motionLevel() === "full";
    var want = full ? "full" : "calm";
    if(layer.childElementCount && layer.getAttribute("data-level") === want) return; // already drifting
    layer.setAttribute("data-level", want);
    // Calm: few, slow and faint. Full: more of them, in three depths.
    var small = window.innerWidth < 640;
    var count = full ? (small ? 20 : 32) : (small ? 9 : 14), html = "";
    for(var i = 0; i < count; i++){
      var left = (i * 97 / count + (i % 3) * 4.3) % 100;      // spread across the width
      var size = 10 + (i * 7) % 9;                            // 10–18px
      var fall = 22 + (i * 5) % 16;                           // 22–37s to cross the screen
      var delay = -((i * 37) % (fall * 10)) / 10;             // start mid-fall, not all at the top
      var sway = 5 + (i * 3) % 6;                             // 5–10s side-to-side
      html += '<span class="petal'+(i % 4 === 0 ? ' petal--gold' : '')+(full && i % 5 === 2 ? ' petal--near' : '')+(full && i % 5 === 4 ? ' petal--far' : '')+'" style="left:'+left.toFixed(1)+'%;--size:'+size+'px;--fall:'+fall+'s;--delay:'+delay.toFixed(1)+'s;--sway:'+sway+'s;--drift:'+(i % 2 ? 26 : -22)+'px"><i></i></span>';
    }
    if(full){
      // a few hearts rising slowly, far in the background
      for(var j = 0; j < (small ? 5 : 8); j++){
        html += '<span class="float-heart" style="left:'+((j * 23 + 9) % 96)+'%;--size:'+(12 + (j * 5) % 10)+'px;--rise:'+(30 + (j * 7) % 18)+'s;--delay:'+(-(j * 6.5)).toFixed(1)+'s"></span>';
      }
    }
    layer.innerHTML = html;
  }
  // A handful of petals lifting off a button or card — for sending or
  // receiving affection. Gone in under two seconds.
  function petalBurst(target, n){
    if(!motionAllowed() || SPACE.petals === false || !target || !target.getBoundingClientRect) return;
    var r = target.getBoundingClientRect();
    if(!r.width && !r.height) return;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for(var i = 0; i < (n || 6); i++){
      var p = document.createElement("span");
      p.className = "petal-burst" + (i % 3 === 0 ? " petal--gold" : "");
      p.style.left = cx + "px"; p.style.top = cy + "px";
      document.body.appendChild(p);
      var angle = (-90 + (i - ((n || 6) - 1) / 2) * 26) * Math.PI / 180;
      var dist = 46 + (i * 17) % 34;
      var dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
      if(!p.animate){ p.remove(); continue; }
      var anim = p.animate([
        { transform: "translate(-50%,-50%) rotate(0deg) scale(.6)", opacity: 0 },
        { transform: "translate(calc(-50% + " + (dx * .6) + "px), calc(-50% + " + (dy * .7) + "px)) rotate(" + (60 + i * 30) + "deg) scale(1)", opacity: .9, offset: .35 },
        { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + (dy + 26) + "px)) rotate(" + (150 + i * 40) + "deg) scale(.9)", opacity: 0 }
      ], { duration: 1300 + i * 70, easing: "cubic-bezier(.22,.61,.36,1)" });
      anim.onfinish = (function(node){ return function(){ node.remove(); }; })(p);
    }
  }

  // Greeting + days together, on the presence card.
  function togetherStats(){
    var start = new Date(SPACE.relationshipStart + "T00:00:00"), now = new Date();
    var days = daysBetween(new Date(start.getTime()), new Date()) + 1; // the first day counts as day 1
    var months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    var sameDay = now.getDate() === start.getDate();
    return { days: days, months: months, years: Math.floor(months / 12), monthiversary: sameDay && months > 0, anniversary: sameDay && months > 0 && months % 12 === 0 };
  }
  function renderLittleLine(){
    var node = document.getElementById("littleLine");
    if(!node) return;
    var me = SPACE.currentUser, p = SPACE.partner, t = togetherStats();
    var hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: me.timezone, hour:"numeric", hourCycle:"h23" }).format(new Date()));
    var greet = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 22 ? "Good evening" : "Good night";
    var ru = reunionParse(SPACE.reunionDate);
    var special = "";
    if(ru && ru.precision === "day" && ru.value === isoFromDate(new Date())) special = "Today's the day you see " + p.name + ".";
    else if(t.anniversary) special = "Today is your " + ordinal(t.years) + " anniversary.";
    else if(t.monthiversary) special = t.months + " months together today.";
    else if(t.days % 100 === 0) special = t.days.toLocaleString("en-US") + " days together today.";
    node.innerHTML = '<span class="little-greet">' + escapeHtml(greet + ", " + me.name) + '</span>' +
      (special ? '<span class="little-special">' + escapeHtml(special) + '</span>'
               : '<span class="little-days">Day ' + t.days.toLocaleString("en-US") + ' together</span>');
    node.classList.toggle("is-special", !!special);
  }
  function wireSmallTouches(){
    renderPetals();
    renderLittleLine();
    window.setInterval(renderLittleLine, 60000);
    var toggle = document.getElementById("petalsToggle");
    if(toggle){
      var paint = function(){ var chev = toggle.querySelector(".chev"); if(chev) chev.textContent = (SPACE.petals !== false ? "On" : "Off") + " →"; };
      paint();
      toggle.addEventListener("click", function(){
        SPACE.petals = SPACE.petals === false;
        saveSpaceSettings();
        paint();
        renderPetals();
        showToast(SPACE.petals ? "Petals are drifting again." : "Petals turned off.");
      });
    }
    // Reduced motion switched on or off elsewhere → petals follow.
    var motionBtn = document.getElementById("reducedMotionToggle");
    if(motionBtn) motionBtn.addEventListener("click", function(){ window.setTimeout(renderPetals, 0); });
    // Sending affection: a few petals lift from the button you tapped.
    var quick = document.getElementById("thinkingQuickBtn");
    if(quick) quick.addEventListener("click", function(){ petalBurst(quick, 7); });
    var noteForm = document.getElementById("noteForm");
    if(noteForm) noteForm.addEventListener("submit", function(){
      if(document.getElementById("noteInput").value.trim()) petalBurst(noteForm.querySelector("button"), 5);
    }, true);
    var grid = document.getElementById("sharedDayGrid");
    if(grid) grid.addEventListener("click", function(e){
      var heart = e.target.closest("[data-heart-id]");
      if(heart && !heart.classList.contains("is-on")) petalBurst(heart, 5);
    }, true);
    var sleepBtn = document.getElementById("sleepBtn");
    if(sleepBtn) sleepBtn.addEventListener("click", function(){ petalBurst(sleepBtn, 4); });
  }

  /* ------------------------------------------------------------------ */
  /* MOTION — small, quiet movement that makes the app feel alive:       */
  /* sections settle in as you scroll, numbers count up once, the        */
  /* reunion ring draws itself, new items arrive softly, and your        */
  /* partner's avatar glows when they were just here. Everything is      */
  /* skipped under Reduced motion, and nothing is ever hidden without    */
  /* being revealed again.                                               */
  /* ------------------------------------------------------------------ */
  function countUp(node, to, ms){
    if(!node || !isFinite(to) || to <= 0) return;
    var t0 = null, final = node.nodeValue !== undefined && node.nodeType === 3 ? node.nodeValue : node.textContent;
    var set = function(v){ if(node.nodeType === 3) node.nodeValue = v; else node.textContent = v; };
    var step = function(ts){
      if(t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms), eased = 1 - Math.pow(1 - k, 3);
      if(k >= 1){ set(final); return; }               // always land on the exact original text
      set(Math.round(to * eased).toLocaleString("en-US"));
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }
  function markNew(selector){
    window.setTimeout(function(){
      var n = document.querySelector(selector);
      if(!n || !motionAllowed()) return;
      n.classList.remove("is-new"); void n.offsetWidth; n.classList.add("is-new");
    }, 0);
  }
  function wireVisuals(){
    var atmos = document.querySelector(".atmos");
    if(atmos && !atmos.querySelector(".star")){
      var stars = "";
      for(var s = 0; s < 44; s++){
        stars += '<span class="star" style="left:'+((s * 37 + 11) % 100)+'%;top:'+((s * 53 + 7) % 100)+'%;--tw:'+(2.4 + (s % 7) * .6).toFixed(1)+'s;--d:'+(-(s % 9) * .7).toFixed(1)+'s;--sz:'+(s % 6 === 0 ? 3 : s % 3 === 0 ? 2 : 1.4)+'px"></span>';
      }
      atmos.insertAdjacentHTML("beforeend", stars);
    }
    // The top bar gains a soft shadow once the page has scrolled under it.
    var bar = document.querySelector(".topbar");
    if(bar){
      var onScroll = function(){ bar.classList.toggle("is-scrolled", window.scrollY > 6); };
      window.addEventListener("scroll", onScroll, { passive:true });
      onScroll();
    }
  }
  function wireMotion(){
    wireVisuals();
    if(!motionAllowed()) return;

    // 1. Sections settle in as they scroll into view (once each).
    if("IntersectionObserver" in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(!en.isIntersecting) return;
          // A very tall section (a year of memories in the timeline) can never have 6% of itself
          // on screen at once — a good strip of it showing is enough to bring it in.
          var strip = en.intersectionRect ? en.intersectionRect.height : 0;
          if(en.intersectionRatio < 0.06 && strip < Math.min(140, window.innerHeight * 0.18)) return;
          en.target.classList.add("is-in");
          io.unobserve(en.target);
          // the "one after another" arrival is a one-time thing: once it has
          // played, the class comes off so it never slows a tap or replays
          (function(sec){ window.setTimeout(function(){
            sec.querySelectorAll(".stagger").forEach(function(n){ n.classList.remove("stagger"); });
          }, 1600); })(en.target);
          if(en.target.querySelector && en.target.querySelector("#reunionRingProgress")) drawReunionRing();
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: [0, 0.02, 0.06, 0.12, 0.25] });
      document.querySelectorAll("#chaptersGrid, #datesList, #somedayList, #plansList, #needGrid, .us-stats, .settings-list, #memoryTimeline .tl-grid, #lettersList, .history-row").forEach(function(n){ n.classList.add("stagger"); });
      document.querySelectorAll(".view .section, .view .shared-day").forEach(function(sec, i){
        sec.classList.add("reveal");
        io.observe(sec);
      });
      // Safety net: if anything is still waiting after a while (an odd
      // browser, a hidden tab), show it rather than leave it invisible.
      window.setTimeout(function(){
        document.querySelectorAll(".reveal:not(.is-in)").forEach(function(n){
          var r = n.getBoundingClientRect();
          if(r.top < window.innerHeight && r.bottom > 0) n.classList.add("is-in");
        });
      }, 2500);
    }

    // 2. The reunion ring draws itself the first time you see it.
    var ringDrawn = false;
    function drawReunionRing(){
      var ring = document.getElementById("reunionRingProgress");
      if(!ring || ringDrawn) return;
      ringDrawn = true;
      var target = ring.style.strokeDashoffset;
      ring.style.transition = "none";
      ring.style.strokeDashoffset = ring.style.strokeDasharray || target;
      void ring.getBoundingClientRect();
      ring.style.transition = "stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)";
      ring.style.strokeDashoffset = target;
      var count = document.getElementById("reunionCount");
      if(count && count.firstChild && count.firstChild.nodeType === 3 && /^\d+$/.test(count.firstChild.nodeValue)) countUp(count.firstChild, Number(count.firstChild.nodeValue), 1100);
    }

    // 3. Numbers count up once when the app opens.
    var days = document.querySelector("#littleLine .little-days");
    if(days){
      var m = /([\d,]+)/.exec(days.textContent);
      if(m){
        var to = Number(m[1].replace(/,/g, "")), full = days.textContent, t0 = null;
        var tick = function(ts){
          if(t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / 1200), eased = 1 - Math.pow(1 - k, 3);
          days.textContent = k >= 1 ? full : "Day " + Math.round(to * eased).toLocaleString("en-US") + " together";
          if(k < 1) window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      }
    }
    ["statYears","statMoments"].forEach(function(id){
      var n = document.getElementById(id);
      if(n && /^[\d,]+$/.test(n.textContent)) countUp(n, Number(n.textContent.replace(/,/g, "")), 1000);
    });

    // 4. Things you just added arrive softly (only the new one, only once).
    var quick = document.getElementById("thinkingQuickBtn");
    if(quick) quick.addEventListener("click", function(){ markNew("#notesRow .note-pill:first-child"); });
    var noteForm = document.getElementById("noteForm");
    if(noteForm) noteForm.addEventListener("submit", function(){ markNew("#notesRow .note-pill:first-child"); });
    var somedayForm = document.getElementById("somedayForm");
    if(somedayForm) somedayForm.addEventListener("submit", function(){ markNew("#somedayList .someday-item:first-child"); });
    var feel = document.getElementById("feelChips");
    if(feel) feel.addEventListener("click", function(e){ if(e.target.closest("[data-feel]")) markNew("#feelChips .feel-chip.is-on"); });
    var someday = document.getElementById("somedayList");
    if(someday) someday.addEventListener("click", function(e){
      var t = e.target.closest("[data-someday-toggle]");
      if(t) markNew('#somedayList [data-someday-toggle="' + t.getAttribute("data-someday-toggle") + '"]');
    });
  }

  /* ------------------------------------------------------------------ */
  /* FULL MOTION — the richest level of animation, on by default.        */
  /* Settings → "Animations" switches between Full and Calm; very        */
  /* low-powered devices start on Calm. Reduced motion still turns       */
  /* everything off.                                                     */
  /* ------------------------------------------------------------------ */
  function motionLevel(){
    if(SPACE.motionLevel === "full" || SPACE.motionLevel === "calm") return SPACE.motionLevel;
    var weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    return weak ? "calm" : "full";
  }
  function applyMotionLevel(){
    document.body.classList.toggle("motion-full", motionLevel() === "full" && motionAllowed());
    renderPetals();
  }
  // A shower of petals across the whole screen, for the moments worth
  // marking: a reunion set, a plan made, memories brought in.
  function celebrate(){
    sfx("success"); haptic("success");
    if(!motionAllowed() || SPACE.petals === false) return;
    var n = motionLevel() === "full" ? 34 : 16, w = window.innerWidth, hgt = window.innerHeight;
    for(var i = 0; i < n; i++){
      var p = document.createElement("span");
      p.className = "petal-burst petal-shower" + (i % 3 === 0 ? " petal--gold" : "");
      var size = 9 + (i * 5) % 10;
      p.style.width = p.style.height = size + "px";
      p.style.left = ((i * 61 + 17) % 100) + "%"; p.style.top = "-24px";
      document.body.appendChild(p);
      if(!p.animate){ p.remove(); continue; }
      var drift = ((i % 2 ? 1 : -1) * (30 + (i * 13) % 70));
      var anim = p.animate([
        { transform: "translate(0,0) rotate(0deg)", opacity: 0 },
        { opacity: .85, offset: .12 },
        { transform: "translate(" + (drift * .6) + "px," + (hgt * .55) + "px) rotate(" + (160 + i * 20) + "deg)", opacity: .8, offset: .6 },
        { transform: "translate(" + drift + "px," + (hgt + 60) + "px) rotate(" + (320 + i * 30) + "deg)", opacity: 0 }
      ], { duration: 2600 + (i * 97) % 1500, delay: (i * 43) % 700, easing: "cubic-bezier(.3,.5,.5,1)", fill: "both" });
      anim.onfinish = (function(node){ return function(){ node.remove(); }; })(p);
    }
  }
  function bigHeart(x, y){
    if(!motionAllowed()) return;
    var hEl = document.createElement("span");
    hEl.className = "big-heart";
    hEl.innerHTML = '<svg viewBox="0 0 24 24" width="92" height="92"><path d="M12 20.5s-7.2-4.4-9.6-8.7C.6 8.4 2.6 4.5 6.4 4.5c2.1 0 3.6 1.2 4.6 2.7 1-1.5 2.5-2.7 4.6-2.7 3.800 0 5.800 3.900 4 7.300-2.400 4.300-7.600 8.700-7.600 8.700z"/></svg>';
    hEl.style.left = x + "px"; hEl.style.top = y + "px";
    document.body.appendChild(hEl);
    if(!hEl.animate){ hEl.remove(); return; }
    hEl.animate([
      { transform: "translate(-50%,-50%) scale(0) rotate(-12deg)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1.15) rotate(4deg)", opacity: .95, offset: .3 },
      { transform: "translate(-50%,-50%) scale(1) rotate(0deg)", opacity: .95, offset: .55 },
      { transform: "translate(-50%,-80%) scale(1.05)", opacity: 0 }
    ], { duration: 950, easing: "cubic-bezier(.22,.61,.36,1)" }).onfinish = function(){ hEl.remove(); };
  }
  function splitHeadings(){
    document.querySelectorAll(".view .section .disp-1, .view .section .disp-2, .view .section h2.disp-3, .view .shared-day .disp-2").forEach(function(hd){
      if(hd.id || hd.childElementCount || hd.getAttribute("data-split")) return; // never touch headings the app rewrites
      var words = hd.textContent.trim().split(/\s+/);
      if(!words[0] || words.length > 9) return;
      hd.setAttribute("data-split", "1");
      hd.setAttribute("aria-label", hd.textContent.trim());
      hd.innerHTML = words.map(function(w, i){
        return '<span class="w" aria-hidden="true"><span style="transition-delay:' + (i * 70) + 'ms">' + escapeHtml(w) + '</span></span>';
      }).join(" ");
    });
  }
  function wireFullMotion(){
    applyMotionLevel();

    // Settings: Animations → Full / Calm
    var toggle = document.getElementById("motionLevelToggle");
    if(toggle){
      var paint = function(){ var chev = toggle.querySelector(".chev"); if(chev) chev.textContent = (motionLevel() === "full" ? "Full" : "Calm") + " →"; };
      paint();
      toggle.addEventListener("click", function(){
        SPACE.motionLevel = motionLevel() === "full" ? "calm" : "full";
        saveSpaceSettings();
        applyMotionLevel();
        paint();
        showToast(SPACE.motionLevel === "full" ? "Animations set to Full." : "Animations set to Calm.");
      });
    }
    var reduced = document.getElementById("reducedMotionToggle");
    if(reduced) reduced.addEventListener("click", function(){ window.setTimeout(applyMotionLevel, 0); });
    if(!motionAllowed()) return;

    splitHeadings();

    // A thin line along the top shows how far down the page you are.
    var app = document.getElementById("app");
    if(app){
      var bar = document.createElement("div");
      bar.className = "scroll-progress"; bar.setAttribute("aria-hidden", "true");
      app.appendChild(bar);
      var queued = false;
      var update = function(){
        queued = false;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
      };
      window.addEventListener("scroll", function(){ if(!queued){ queued = true; window.requestAnimationFrame(update); } }, { passive:true });
      update();
    }

    // Double-tap (or double-click) a moment your partner shared to love it.
    var grid = document.getElementById("sharedDayGrid");
    if(grid){
      var lastTap = { t:0, el:null };
      var love = function(card, x, y){
        var btn = card.querySelector("[data-heart-id]");
        if(!btn) return; // your own moment, or nothing to love
        bigHeart(x, y);
        if(!btn.classList.contains("is-on")) btn.click();
      };
      grid.addEventListener("dblclick", function(e){
        if(e.target.closest("button")) return;
        var card = e.target.closest(".moment-card, .moment-text");
        if(card) love(card, e.clientX, e.clientY);
      });
      grid.addEventListener("touchend", function(e){
        if(e.target.closest("button")) return;
        var card = e.target.closest(".moment-card, .moment-text");
        var now = Date.now(), t = e.changedTouches && e.changedTouches[0];
        if(card && t && lastTap.el === card && now - lastTap.t < 320){ love(card, t.clientX, t.clientY); lastTap.t = 0; return; }
        lastTap = { t: now, el: card };
      }, { passive:true });
    }

    // The main photo leans gently toward the pointer (mouse only).
    if(window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches){
      document.addEventListener("mousemove", function(e){
        var card = e.target.closest ? e.target.closest(".sd-hero") : null;
        document.querySelectorAll(".sd-hero.is-tilting").forEach(function(n){ if(n !== card){ n.classList.remove("is-tilting"); n.style.transform = ""; } });
        if(!card || !document.body.classList.contains("motion-full")) return;
        var r = card.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
        card.classList.add("is-tilting");
        card.style.transform = "perspective(900px) rotateY(" + (dx * 5).toFixed(2) + "deg) rotateX(" + (-dy * 5).toFixed(2) + "deg)";
      }, { passive:true });
    }

    // A special day greets you with a shower when the app opens.
    var line = document.getElementById("littleLine");
    if(line && line.classList.contains("is-special")) window.setTimeout(celebrate, 900);
  }

  /* ------------------------------------------------------------------ */
  /* EVERY TAP ANSWERS BACK — a soft ring where you touched, a tiny      */
  /* vibration (phones that support it) and a quiet sound. The sound     */
  /* follows the existing Sound setting; the ring and vibration follow   */
  /* "Tap feedback". Sounds are made on the device — no audio files.     */
  /* ------------------------------------------------------------------ */
  var sfxCtx = null;
  function sfxNote(freq, start, dur, vol, type){
    var osc = sfxCtx.createOscillator(), gain = sfxCtx.createGain(), t = sfxCtx.currentTime + start;
    osc.type = type || "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(sfxCtx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  var SFX = {
    tap:     [[520, 0, .06, .030]],
    nav:     [[392, 0, .07, .030]],
    close:   [[330, 0, .08, .026]],
    toggle:  [[440, 0, .05, .030], [587, .05, .07, .030]],
    confirm: [[523, 0, .09, .040], [784, .07, .16, .040]],
    love:    [[392, 0, .28, .032], [523, .04, .30, .032], [659, .08, .36, .032]],
    arrive:  [[659, 0, .16, .040], [880, .11, .30, .036]],
    success: [[523, 0, .12, .036], [659, .09, .12, .036], [784, .18, .14, .036], [1047, .27, .34, .034]]
  };
  function sfx(name){
    if(!SPACE.sound || !SFX[name]) return;
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      if(!sfxCtx) sfxCtx = new Ctx();
      if(sfxCtx.state === "suspended") sfxCtx.resume();
      SFX[name].forEach(function(n){ sfxNote(n[0], n[1], n[2], n[3]); });
    }catch(e){}
  }
  var HAPTIC = { tap: 8, nav: 8, close: 6, toggle: 10, confirm: [10, 30, 14], love: [12, 40, 18], success: [12, 40, 12, 40, 20] };
  function haptic(name){
    if(SPACE.tapFeedback === false || !navigator.vibrate) return;
    try{ navigator.vibrate(HAPTIC[name] || 8); }catch(e){}
  }
  function tapRing(x, y, strong){
    if(SPACE.tapFeedback === false || !motionAllowed()) return;
    var r = document.createElement("span");
    r.className = "tap-ring" + (strong ? " tap-ring--strong" : "");
    r.style.left = x + "px"; r.style.top = y + "px";
    document.body.appendChild(r);
    window.setTimeout(function(){ r.remove(); }, 520);
  }
  // What kind of tap was that? Decides the sound and the vibration.
  function tapKind(el){
    if(el.closest("[data-heart-id], #thinkingQuickBtn, #sleepBtn")) return "love";
    if(el.closest(".sheet-close, [data-close-overlay], .date-card-remove, .btn-ghost, .live-pill button:not(.live-pill-yes)")) return "close";
    if(el.closest(".nav-btn, .swipe-dot, [data-view-link]")) return "nav";
    if(el.closest(".toggle-switch, .settings-list button, .feel-chip, .period-chip, .need-chip, .someday-check, [data-quiz-pick]")) return "toggle";
    if(el.closest(".btn-primary, button[type=submit], .live-pill-yes, .fab")) return "confirm";
    return "tap";
  }
  function wireTapFeedback(){
    document.addEventListener("pointerdown", function(e){
      var el = e.target.closest ? e.target.closest("button, a, [role=button], summary, .chapter-tile, .date-card, select, input[type=range]") : null;
      if(!el || el.disabled) return;
      var kind = tapKind(el);
      tapRing(e.clientX, e.clientY, kind === "love" || kind === "confirm");
      haptic(kind);
    }, { capture:true, passive:true });
    // The sound waits for the tap to complete: browsers only allow audio
    // once a tap has actually finished, so this is the earliest it can play.
    document.addEventListener("click", function(e){
      var el = e.target.closest ? e.target.closest("button, a, [role=button], summary, .chapter-tile, .date-card") : null;
      if(el && !el.disabled) sfx(tapKind(el));
    }, { capture:true, passive:true });
    var toggle = document.getElementById("tapFeedbackToggle");
    if(toggle){
      var paint = function(){ var chev = toggle.querySelector(".chev"); if(chev) chev.textContent = (SPACE.tapFeedback !== false ? "On" : "Off") + " →"; };
      paint();
      toggle.addEventListener("click", function(){
        SPACE.tapFeedback = SPACE.tapFeedback === false;
        saveSpaceSettings(); paint();
        showToast(SPACE.tapFeedback ? "Tap feedback on." : "Tap feedback off.");
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* KNOW EACH OTHER — a five-question game. Each of you answers for     */
  /* yourself and guesses what the other will say. Nothing is shown      */
  /* until you have both played; then you see how well you guessed.      */
  /* ------------------------------------------------------------------ */
  var QUIZ_SETS = [
    [ { q:"A perfect lazy Sunday is…", o:["Sleeping in","A long walk","Cooking something slow","A film marathon"] },
      { q:"When I'm stressed, I want…", o:["To talk it through","Quiet company","A distraction","To be left alone a while"] },
      { q:"My comfort food is closest to…", o:["Something sweet","Something spicy","Home cooking","Whatever's fastest"] },
      { q:"On a call, I'd rather…", o:["Talk for hours","Do our own thing together","Watch something","Keep it short and often"] },
      { q:"The best small gift is…", o:["A handwritten note","Flowers","Food I love","Something I mentioned once"] } ],
    [ { q:"In the morning I am…", o:["Up and cheerful","Slow but fine","Not to be spoken to","It depends on the coffee"] },
      { q:"My ideal trip together is…", o:["A beach","Mountains","A city to wander","Staying in, honestly"] },
      { q:"I feel most loved when you…", o:["Say it out loud","Make time for me","Help without being asked","Remember small things"] },
      { q:"After an argument I need…", o:["To fix it right away","A little space first","A hug, if we were close","To laugh about something"] },
      { q:"The thing I miss most is…", o:["Your voice","Eating together","Just being in the same room","Falling asleep nearby"] } ],
    [ { q:"If we had one free evening together…", o:["Dinner out","Cook at home","A long drive","Do nothing, together"] },
      { q:"I say I'm fine when I'm actually…", o:["Fine","Tired","Upset but not ready","Hungry"] },
      { q:"The song choice in the car goes to…", o:["Me, always","You, always","Whoever's driving","We argue every time"] },
      { q:"I'm most myself when…", o:["I'm with you","I'm with friends","I'm on my own","I'm busy with work I like"] },
      { q:"For our next reunion, first thing…", o:["A very long hug","Food","Sleep","Go straight out somewhere"] } ]
  ];
  var quizPlay = { step:0, self:[], guess:[] };
  function quizRound(){ return DB.quiz.round || 0; }
  function quizSet(){ return QUIZ_SETS[quizRound() % QUIZ_SETS.length]; }
  function quizEntry(userId){ var r = DB.quiz.answers[quizRound()]; return r ? r[userId] : null; }
  function quizScore(guesser, about){
    var g = quizEntry(guesser), s = quizEntry(about);
    if(!g || !s) return 0;
    return g.guess.filter(function(v, i){ return v === s.self[i]; }).length;
  }
  function renderQuizCard(){
    var body = document.getElementById("quizBody");
    if(!body) return;
    var p = SPACE.partner, mine = quizEntry(ME), theirs = quizEntry(THEM), set = quizSet();
    if(mine && theirs){
      var youGot = quizScore(ME, THEM), theyGot = quizScore(THEM, ME);
      body.innerHTML =
        '<p class="quiz-score">You guessed <b>'+youGot+' of '+set.length+'</b> · '+escapeHtml(p.name)+' guessed <b>'+theyGot+' of '+set.length+'</b></p>'+
        '<ul class="quiz-results">'+set.map(function(item, i){
          var right = mine.guess[i] === theirs.self[i];
          return '<li class="quiz-result'+(right?' is-right':'')+'"><span class="quiz-q">'+escapeHtml(item.q)+'</span>'+
            '<span class="quiz-a">'+escapeHtml(p.name)+': <b>'+escapeHtml(item.o[theirs.self[i]])+'</b>'+
            (right ? ' · you knew' : ' · you guessed “'+escapeHtml(item.o[mine.guess[i]])+'”')+'</span></li>';
        }).join("")+'</ul>'+
        '<button type="button" class="btn-primary" id="quizNextBtn">Play the next five</button>';
    } else if(mine){
      body.innerHTML = '<p class="body-m">Your answers are in. Waiting for '+escapeHtml(p.name)+' — no rush.</p>';
    } else {
      body.innerHTML = '<p class="body-m">Five quick questions. Answer for yourself, guess for '+escapeHtml(p.name)+'.'+(theirs ? ' '+escapeHtml(p.name)+' has already played.' : '')+'</p>'+
        '<button type="button" class="btn-primary" id="quizPlayBtn">Play</button>';
    }
  }
  function renderQuizStep(){
    var set = quizSet(), i = quizPlay.step, item = set[i], p = SPACE.partner;
    setText("quizStepLabel", "Question " + (i + 1) + " of " + set.length);
    setText("quizQuestion", item.q);
    var row = function(kind, label, picked){
      return '<p class="quiz-row-label">'+label+'</p><div class="quiz-options" role="group" aria-label="'+label+'">'+item.o.map(function(opt, k){
        return '<button type="button" class="period-chip'+(picked === k ? ' is-selected' : '')+'" data-quiz-pick="'+kind+'" data-quiz-value="'+k+'" aria-pressed="'+(picked === k ? 'true':'false')+'">'+escapeHtml(opt)+'</button>';
      }).join("")+'</div>';
    };
    document.getElementById("quizOptions").innerHTML = row("self", "For you", quizPlay.self[i]) + row("guess", escapeHtml(p.name) + " will say", quizPlay.guess[i]);
    var next = document.getElementById("quizNext");
    next.disabled = quizPlay.self[i] === undefined || quizPlay.guess[i] === undefined;
    next.textContent = i === set.length - 1 ? "Finish" : "Next";
  }
  function wireQuiz(){
    var card = document.getElementById("quizBody");
    if(!card) return;
    card.addEventListener("click", function(e){
      if(e.target.closest("#quizPlayBtn")){
        quizPlay = { step:0, self:[], guess:[] };
        renderQuizStep();
        openOverlay("quizOverlay");
      } else if(e.target.closest("#quizNextBtn")){
        var from = quizRound();
        mutate(function(db){ if((db.quiz.round || 0) === from) db.quiz.round = from + 1; });
        renderQuizCard();
      }
    });
    document.getElementById("quizOptions").addEventListener("click", function(e){
      var b = e.target.closest("[data-quiz-pick]");
      if(!b) return;
      quizPlay[b.getAttribute("data-quiz-pick")][quizPlay.step] = Number(b.getAttribute("data-quiz-value"));
      renderQuizStep();
    });
    document.getElementById("quizNext").addEventListener("click", function(){
      var set = quizSet();
      if(quizPlay.step < set.length - 1){ quizPlay.step++; renderQuizStep(); return; }
      var round = quizRound(), entry = { self: quizPlay.self.slice(), guess: quizPlay.guess.slice(), at: Date.now() };
      if(!mutate(function(db){
        if(!db.quiz.answers[round]) db.quiz.answers[round] = {};
        db.quiz.answers[round][ME] = entry;
      })) return; // your picks stay on screen
      closeOverlay("quizOverlay");
      renderQuizCard();
      if(quizEntry(THEM)){ celebrate(); showToast("You've both played — see how well you know each other."); }
      else showToast("Saved. " + SPACE.partner.name + " will see it's their turn.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* A DATE FOR TONIGHT — ideas that work across a distance. One a day,  */
  /* another on request, and one tap turns it into a plan.               */
  /* ------------------------------------------------------------------ */
  var DATE_IDEAS = [
    { t:"Cook the same recipe", k:"ritual", d:"Pick one dish, cook it on a call, eat together." },
    { t:"Watch the same film", k:"playful", d:"Count down, press play together, keep the call on." },
    { t:"A walk on a call", k:"ritual", d:"Headphones in, each walking your own streets." },
    { t:"Order each other dinner", k:"playful", d:"Choose what the other eats tonight. No vetoes." },
    { t:"Twenty questions, properly", k:"deep", d:"Ones you've never asked. Take turns." },
    { t:"Fall asleep on a call", k:"ritual", d:"No talking needed. Just there." },
    { t:"Show me your day", k:"photo", d:"A slow video tour of where you spent today." },
    { t:"Build a playlist together", k:"music", d:"Ten songs each for the next reunion drive." },
    { t:"Read to each other", k:"deep", d:"A chapter, a poem, an old letter." },
    { t:"Plan the next reunion", k:"deep", d:"Day one, hour by hour. Be unreasonable." },
    { t:"Sunrise and sunset", k:"photo", d:"One of you has morning, one evening. Share the sky." },
    { t:"Play a game online", k:"playful", d:"Anything silly. Loser writes a letter." },
    { t:"Dress up for dinner", k:"ritual", d:"Properly. Candles, plates, the lot." },
    { t:"Old photos night", k:"photo", d:"Go back through the timeline and tell the stories." }
  ];
  var dateIdeaOffset = 0;
  // "k" is the kind of idea — Our DNA's "more / less like this" works on it.
  function currentDateIdea(){ var pool = dateIdeaPool(); return pool[(Number(sharedDay()) + dateIdeaOffset) % pool.length]; }
  function renderDateIdea(){
    var idea = currentDateIdea();
    setText("dateIdeaTitle", idea.t);
    setText("dateIdeaDesc", idea.d);
  }
  function wireDateIdea(){
    var another = document.getElementById("dateIdeaAnother");
    if(!another) return;
    another.addEventListener("click", function(){
      dateIdeaOffset++;
      renderDateIdea();
      var card = document.getElementById("dateIdeaCard");
      if(card && motionAllowed()){ card.classList.remove("is-new"); void card.offsetWidth; card.classList.add("is-new"); }
    });
    document.getElementById("dateIdeaPlan").addEventListener("click", function(){
      document.getElementById("addPlanBtn").click();
      document.getElementById("planTitleInput").value = currentDateIdea().t;
    });
  }

  /* ------------------------------------------------------------------ */
  /* LITTLE THINGS TO REMEMBER — each of you writes down the small       */
  /* things about yourself worth knowing from far away. You read theirs; */
  /* only you can change yours.                                          */
  /* ------------------------------------------------------------------ */
  var FACT_FIELDS = [
    { k:"drink",   label:"Coffee or tea order" },
    { k:"comfort", label:"Comfort food" },
    { k:"flower",  label:"Favourite flower" },
    { k:"sizes",   label:"Sizes (ring, shoe, clothes)" },
    { k:"sad",     label:"When I'm low, I need" },
    { k:"gift",    label:"A gift I'd never buy myself" }
  ];
  function renderFacts(){
    var theirs = document.getElementById("factsTheirs"), mine = document.getElementById("factsMine");
    if(!theirs || !mine) return;
    var p = SPACE.partner, tf = DB.facts[THEM] || {}, mf = DB.facts[ME] || {};
    setText("factsTheirsTitle", "About " + p.name);
    theirs.innerHTML = FACT_FIELDS.map(function(f){
      var v = tf[f.k];
      return '<li class="fact-item'+(v ? '' : ' is-empty')+'"><span class="fact-label">'+escapeHtml(f.label)+'</span><span class="fact-value">'+(v ? escapeHtml(v) : 'Not shared yet')+'</span></li>';
    }).join("");
    // don't rebuild the inputs while you are typing in one of them
    if(mine.contains(document.activeElement)) return;
    mine.innerHTML = FACT_FIELDS.map(function(f){
      return '<label class="fact-edit"><span class="fact-label">'+escapeHtml(f.label)+'</span>'+
        '<input type="text" class="imp-caption" maxlength="60" data-fact="'+f.k+'" value="'+escapeHtml(mf[f.k] || "")+'" placeholder="Tell '+escapeHtml(p.name)+'…"></label>';
    }).join("");
  }
  function wireFacts(){
    var mine = document.getElementById("factsMine");
    if(!mine) return;
    mine.addEventListener("change", function(e){
      var input = e.target.closest("[data-fact]");
      if(!input) return;
      var key = input.getAttribute("data-fact"), val = input.value.trim();
      if(!mutate(function(db){
        if(!db.facts[ME]) db.facts[ME] = {};
        if(val) db.facts[ME][key] = val; else delete db.facts[ME][key];
      })) return;
      showToast("Saved — " + SPACE.partner.name + " can see it.");
    });
  }

  /* ================================================================== */
  /* REASONS TO COME BACK — built on pull, never on guilt.               */
  /*   · For you:       what your partner left that you haven't seen     */
  /*   · On this day:   a memory from this date in an earlier year       */
  /*   · Hold together: press and hold at the same moment, feel it       */
  /*   · Our garden:    grows on days you both show up; nothing wilts    */
  /* ================================================================== */

  // ---- For you ------------------------------------------------------
  var SEEN_KEY = NS + "pairlum-seen-v1-" + ME;
  function loadSeen(){
    var s = null;
    try{ s = JSON.parse(localStorage.getItem(SEEN_KEY)); }catch(e){}
    if(!s){
      // first visit on this device: start from now, so old things don't arrive as "new"
      var now = Date.now();
      s = { notes:now, moments:now, letters:now, memories:now, ambient:now };
      try{ localStorage.setItem(SEEN_KEY, JSON.stringify(s)); }catch(e){}
    }
    return s;
  }
  var SEEN = loadSeen();
  function markSeen(key){
    SEEN[key] = Date.now();
    try{ localStorage.setItem(SEEN_KEY, JSON.stringify(SEEN)); }catch(e){}
    renderWaiting();
  }
  function waitingItems(){
    var p = SPACE.partner.name, out = [], day = sharedDay();
    var newer = function(list, key, field){ return list.filter(function(x){ return x.by === THEM && (x[field] || 0) > (SEEN[key] || 0); }).length; };
    var req = latestIncomingRequest();
    if(req) out.push({ k:"request", text: p + " could use " + String(req.title).toLowerCase(), view:"home", target:"needIncoming" });
    var dq = DB.dq[day] || {};
    if(dq[THEM] && !dq[ME]) out.push({ k:"dq", text: p + " answered today's question", view:"home", target:"dqFlip" });
    var qz = DB.quiz.answers[DB.quiz.round || 0] || {};
    if(qz[THEM] && !qz[ME]) out.push({ k:"quiz", text: "Your turn in Know each other", view:"home", target:"quizCard" });
    var feel = DB.feel[day] || {};
    if(feel[THEM] && !feel[ME]) out.push({ k:"feel", text: p + " shared how today feels", view:"home", target:"feelBlock" });
    var n = newer(DB.notes, "notes", "at");
    if(n) out.push({ k:"notes", seen:"notes", text: n === 1 ? p + " was thinking of you" : p + " thought of you " + n + " times", view:"home", target:"notesRow" });
    var m = newer(DB.moments, "moments", "at");
    if(m) out.push({ k:"moments", seen:"moments", text: m === 1 ? "A new moment from " + p : m + " new moments from " + p, view:"home", target:"sharedDayGrid" });
    var amb = DB.ambient[THEM];
    if(amb && amb.at > (SEEN.ambient || 0)) out.push({ k:"ambient", seen:"ambient", text: "A new sound from where " + p + " is", view:"home", target:"ambientCard" });
    var l = newer(DB.letters, "letters", "createdAt");
    if(l) out.push({ k:"letters", seen:"letters", text: l === 1 ? "A letter from " + p : l + " letters from " + p, view:"letters", target:"lettersList" });
    var today = isoFromDate(new Date());
    if(DB.letters.some(function(x){ return x.by === THEM && x.openDate === spaceDayIso(); })) out.push({ k:"opens", text: "A sealed letter opens today", view:"letters", target:"lettersList" });
    var mem = newer(DB.memories, "memories", "at");
    if(mem) out.push({ k:"memories", seen:"memories", text: mem === 1 ? p + " added a memory" : p + " added " + mem + " memories", view:"story", target:"memoryTimeline" });
    var soon = upcomingPlans().filter(function(pl){ return pl.at > Date.now() && pl.at - Date.now() < 3 * 60 * 60 * 1000; })[0];
    if(soon) out.push({ k:"plan", text: soon.title + " " + untilLabel(soon.at), view:"home", target:"plansBlock" });
    return out;
  }
  function renderWaiting(){
    var strip = document.getElementById("waitingStrip"), list = document.getElementById("waitingList");
    if(!strip || !list) return;
    var items = waitingItems();
    strip.hidden = !items.length;
    list.innerHTML = items.map(function(it){
      return '<button type="button" class="waiting-chip" data-waiting="'+it.k+'" data-waiting-view="'+it.view+'" data-waiting-target="'+it.target+'"'+(it.seen ? ' data-waiting-seen="'+it.seen+'"' : '')+'>'+
        '<span class="waiting-dot" aria-hidden="true"></span>'+escapeHtml(it.text)+'</button>';
    }).join("");
    setText("waitingCount", items.length ? String(items.length) : "");
    // small dots on the tabs that hold something new
    ["letters","story"].forEach(function(view){
      var has = items.some(function(it){ return it.view === view; });
      document.querySelectorAll('.nav-btn[data-view="'+view+'"]').forEach(function(b){ b.classList.toggle("has-new", has); });
    });
  }
  function wireWaiting(){
    var list = document.getElementById("waitingList");
    if(!list) return;
    list.addEventListener("click", function(e){
      var chip = e.target.closest("[data-waiting]");
      if(!chip) return;
      var view = chip.getAttribute("data-waiting-view"), target = document.getElementById(chip.getAttribute("data-waiting-target"));
      var seenKey = chip.getAttribute("data-waiting-seen");
      if(view !== "home") setView(view);
      if(view === "letters"){ var gate = document.getElementById("lettersGateBtn"), v = document.getElementById("view-letters"); if(gate && v && v.classList.contains("letters-gated")) gate.click(); }
      window.setTimeout(function(){
        revealUsTabFor(target);
        if(target && target.scrollIntoView) target.scrollIntoView({ block:"center" });
        if(target && motionAllowed()){ target.classList.remove("is-pointed"); void target.offsetWidth; target.classList.add("is-pointed"); }
        if(seenKey) markSeen(seenKey);
      }, view === "home" ? 0 : 380);
    });
    window.setInterval(renderWaiting, 60000);
    // Looking at something for a couple of seconds counts as having seen it.
    if("IntersectionObserver" in window){
      var watch = { notesRow:"notes", sharedDayGrid:"moments", ambientCard:"ambient", lettersList:"letters", memoryTimeline:"memories" };
      var timers = {};
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          var key = watch[en.target.id];
          window.clearTimeout(timers[key]);
          if(!en.isIntersecting) return;
          timers[key] = window.setTimeout(function(){
            if(document.hidden) return;
            if(waitingItems().some(function(it){ return it.seen === key; })) markSeen(key);
          }, 2500);
        });
      }, { threshold: 0.35 });
      Object.keys(watch).forEach(function(id){ var n = document.getElementById(id); if(n) io.observe(n); });
    }
  }

  // ---- On this day --------------------------------------------------
  function renderOnThisDay(){
    var card = document.getElementById("onThisDay");
    if(!card) return;
    if(!card.getAttribute("data-wired")){
      card.setAttribute("data-wired", "1");
      card.addEventListener("click", function(){ var id = card.getAttribute("data-memory"); if(id) openMemoryViewer(id, "memory"); });
    }
    var now = new Date(), md = pad2(now.getMonth() + 1) + "-" + pad2(now.getDate()), year = now.getFullYear();
    var hits = DB.memories.filter(function(m){ return m.type === "photo" && m.date.slice(5) === md && Number(m.date.slice(0, 4)) < year; })
      .sort(function(x, y){ return x.date < y.date ? 1 : -1; });
    card.hidden = !hits.length;
    if(!hits.length) return;
    var m = hits[0], years = year - Number(m.date.slice(0, 4));
    if(card.getAttribute("data-memory") === m.id) return;
    card.setAttribute("data-memory", m.id);
    setText("onThisDayWhen", years === 1 ? "One year ago today" : years + " years ago today");
    setText("onThisDayCaption", m.caption || dayLabel(m.date));
    var slot = document.getElementById("onThisDayMedia");
    var paint = function(url){ slot.innerHTML = mediaThumbHtml("photo", url, true); };
    if(MEDIA_URLS[m.id]) paint(MEDIA_URLS[m.id]);
    else idbGetMedia(m.id, function(err, blob){ if(err || !blob) return; MEDIA_URLS[m.id] = URL.createObjectURL(blob); paint(MEDIA_URLS[m.id]); });
  }

  // ---- Hold together ------------------------------------------------
  // Each of you presses and holds the heart. The moment you are both
  // holding, both phones pulse. It only works while you are both here.
  var HOLD_SIGNAL_KEY = NS + "pairlum-hold-signal-v1";
  var hold = { mine:false, theirsAt:0, together:false, since:0, beat:null, tick:null, toldAt:0 };
  function holdSend(on){
    try{ localStorage.setItem(HOLD_SIGNAL_KEY, JSON.stringify({ from:ME, to:THEM, on:on, n: Date.now() + ":" + Math.random() })); }catch(e){}
  }
  function holdTheirs(){ return Date.now() - hold.theirsAt < 2200; }
  function holdClock(ms){ var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + pad2(s % 60); }
  function renderHold(){
    var btn = document.getElementById("holdBtn"), line = document.getElementById("holdLine");
    if(!btn || !line) return;
    var p = SPACE.partner.name, theirs = holdTheirs(), both = hold.mine && theirs;
    btn.classList.toggle("is-holding", hold.mine);
    btn.classList.toggle("is-calling", !hold.mine && theirs);
    btn.classList.toggle("is-together", both);
    line.textContent = both ? "Together · " + holdClock(Date.now() - hold.since)
      : hold.mine ? "Holding… waiting for " + p
      : theirs ? p + " is holding. Hold yours."
      : "Press and hold. If " + p + " holds too, you'll both feel it.";
    var best = DB.hold.best || 0;
    setText("holdBest", best ? "Longest together: " + holdClock(best * 1000) : "");
  }
  function holdCheck(){
    var both = hold.mine && holdTheirs();
    if(both && !hold.together){
      hold.together = true; hold.since = Date.now();
      sfx("love"); haptic("success");
      petalBurst(document.getElementById("holdBtn"), 10);
    } else if(!both && hold.together){
      hold.together = false;
      var secs = Math.round((Date.now() - hold.since) / 1000);
      if(secs >= 1){
        mutate(function(db){ db.hold.best = Math.max(db.hold.best || 0, secs); db.hold.last = secs; db.hold.at = Date.now(); });
        showToast("You held together for " + holdClock(secs * 1000) + ".");
        if(secs >= 5) celebrate();
      }
    }
    if(both && Math.floor((Date.now() - hold.since) / 1000) % 2 === 0) haptic("love");
    renderHold();
  }
  function holdStart(){
    if(hold.mine || !isPaired()) return;
    hold.mine = true;
    holdSend(true);
    hold.beat = window.setInterval(function(){ holdSend(true); }, 700);
    holdCheck();
  }
  function holdStop(){
    if(!hold.mine) return;
    hold.mine = false;
    window.clearInterval(hold.beat);
    holdSend(false);
    holdCheck();
  }
  function wireHold(){
    var btn = document.getElementById("holdBtn");
    if(!btn) return;
    btn.addEventListener("pointerdown", function(e){ e.preventDefault(); try{ btn.setPointerCapture(e.pointerId); }catch(err){} holdStart(); });
    ["pointerup","pointercancel","lostpointercapture"].forEach(function(ev){ btn.addEventListener(ev, holdStop); });
    btn.addEventListener("contextmenu", function(e){ e.preventDefault(); });
    btn.addEventListener("keydown", function(e){ if((e.key === " " || e.key === "Enter") && !e.repeat){ e.preventDefault(); holdStart(); } });
    btn.addEventListener("keyup", function(e){ if(e.key === " " || e.key === "Enter") holdStop(); });
    window.addEventListener("blur", holdStop);
    window.addEventListener("pagehide", holdStop);
    window.addEventListener("storage", function(e){
      if(e.key !== HOLD_SIGNAL_KEY || !e.newValue) return;
      var msg = null;
      try{ msg = JSON.parse(e.newValue); }catch(err){}
      if(!msg || msg.to !== ME || msg.from !== THEM) return;
      var was = holdTheirs();
      hold.theirsAt = msg.on ? Date.now() : 0;
      if(msg.on && !was && !hold.mine && Date.now() - hold.toldAt > 15000){
        hold.toldAt = Date.now();
        sfx("arrive"); haptic("confirm");
        showToast(SPACE.partner.name + " is holding the heart. Hold yours.");
      }
      holdCheck();
    });
    hold.tick = window.setInterval(function(){ if(hold.mine || hold.together || hold.theirsAt) holdCheck(); }, 500);
    renderHold();
  }

  // ---- Our garden ---------------------------------------------------
  // One count only: days on which you BOTH did something here. It never
  // goes down and nothing wilts — a missed day simply doesn't add a day.
  var GARDEN_DAYS_PER_BLOOM = 3;
  function togetherDays(){
    return Object.keys(DB.days).filter(function(k){ return DB.days[k][ME] && DB.days[k][THEM]; }).length;
  }
  function flowerSvg(i, stage){
    // stage: "bloom" | 0 | 1 | 2  (seed, sprout, bud)
    var gold = i % 3 === 1, colour = gold ? "var(--gold-soft)" : "var(--wine-soft)";
    var stem = '<path d="M20 58V' + (stage === "bloom" ? 26 : stage === 2 ? 30 : stage === 1 ? 40 : 52) + '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
    var leaf = stage === 0 ? '' : '<path d="M20 46c-6-1-9-5-9-9 5 0 9 3 9 9z" fill="currentColor" opacity=".55"/>';
    var head = "";
    if(stage === "bloom"){
      for(var k = 0; k < 5; k++) head += '<ellipse cx="20" cy="12" rx="5.2" ry="8.5" fill="' + colour + '" transform="rotate(' + (k * 72) + ' 20 20)"/>';
      head += '<circle cx="20" cy="20" r="3.6" fill="var(--wine)"/>';
    } else if(stage === 2){
      head = '<ellipse cx="20" cy="24" rx="4.5" ry="7" fill="' + colour + '"/>';
    } else if(stage === 0){
      head = '<ellipse cx="20" cy="55" rx="4" ry="2.4" fill="currentColor" opacity=".5"/>';
    }
    return '<svg class="garden-flower' + (stage === "bloom" ? " is-bloom" : " is-growing") + '" style="--i:' + i + '" viewBox="0 0 40 60" width="34" height="51" aria-hidden="true">' + stem + leaf + head + '</svg>';
  }
  function renderGarden(){
    var bed = document.getElementById("gardenBed");
    if(!bed) return;
    var p = SPACE.partner.name, td = togetherDays();
    var blooms = Math.floor(td / GARDEN_DAYS_PER_BLOOM), stage = td % GARDEN_DAYS_PER_BLOOM, shown = Math.min(blooms, 20), html = "";
    for(var i = 0; i < shown; i++) html += flowerSvg(i, "bloom");
    html += flowerSvg(shown, stage);
    bed.innerHTML = html;
    var toGo = GARDEN_DAYS_PER_BLOOM - stage;
    setText("gardenCount", td === 1 ? "1 day you've both been here" : td + " days you've both been here");
    setText("gardenNext", (blooms > 20 ? (blooms - 20) + " more flowers than fit here. " : "") + (toGo === 1 ? "One more day together until the next flower opens." : toGo + " more days together until the next flower opens."));
    var today = DB.days[sharedDay()] || {};
    setText("gardenToday", today[ME] && today[THEM] ? "Today counts — you've both been here."
      : today[ME] ? "You've been here today. It counts once " + p + " drops by."
      : today[THEM] ? p + " has been here today. Do anything and today counts."
      : "Nothing wilts if a day is missed.");
  }

  /* ------------------------------------------------------------------ */
  /* Live sync — when your partner does something, this phone updates    */
  /* on its own and says so in one quiet line. With a real server this   */
  /* listener becomes the realtime subscription.                         */
  /* ------------------------------------------------------------------ */
  function agoLabel(ts){
    var mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if(mins < 1) return "just now";
    if(mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if(hrs < 24) return hrs + " h ago";
    return Math.round(hrs / 24) + " d ago";
  }
  function renderPresenceLine(){
    var node = document.getElementById("presenceLine");
    if(!node) return;
    var p = SPACE.partner, latest = null;
    DB.moments.forEach(function(m){ if(m.by === THEM && m.at && (!latest || m.at > latest.at)) latest = { at:m.at, text:p.name + " shared a little piece of the day" }; });
    DB.notes.forEach(function(n){ if(n.by === THEM && n.at && (!latest || n.at > latest.at)) latest = { at:n.at, text:p.name + " was thinking of you" }; });
    node.textContent = latest ? latest.text + " · " + agoLabel(latest.at) + "." : "Your space — just you and " + p.name + ".";
    var avatarB = document.getElementById("presenceAvatarB");
    if(avatarB) avatarB.classList.toggle("is-recent", !!latest && (Date.now() - latest.at) < 10 * 60 * 1000);
  }
  function renderShared(){
    renderNotes();
    renderFeeling();
    syncMomentsDom();
    refreshHearts();
    renderIncomingRequest();
    renderSentLine();
    renderDailyQuestion(); // wording, swap button and their answer follow the stored record; your typing is kept
    refreshMomentBars();
    if(document.getElementById("momentOverlay") && document.getElementById("momentOverlay").classList.contains("is-open")) renderMomentThread();
    if(document.getElementById("voiceFindOverlay") && document.getElementById("voiceFindOverlay").classList.contains("is-open")) renderVoiceFind();
    renderLetters();
    renderImportantDates();
    renderSomeday();
    renderPresenceLine();
    renderParallel();
    renderDayStory();
    renderChapters();
    renderMemoryTimeline();
    renderAmbient();
    renderSpaceBindings();
    renderPlans();
    renderSleep();
    renderLittleLine();
    renderQuizCard();
    renderFacts();
    renderWaiting();
    renderOnThisDay();
    renderGarden();
    renderHold();
    renderMore();
  }
  function ids(list){ var o = {}; list.forEach(function(x){ o[x.id] = x; }); return o; }
  // Everything your partner just did, as a list of small pieces of news.
  // Each one goes through notify(), which decides — from your own
  // Notifications settings and quiet hours — whether it shows now, waits
  // quietly in the bell, or isn't kept at all.
  function announcePartnerActivity(prev, next){
    var p = SPACE.partner.name, ev = [];
    var add = function(type, text, view, target, extra){
      var o = { type:type, text:text, view:view || "home", target:target || "" };
      if(extra) Object.keys(extra).forEach(function(k){ o[k] = extra[k]; });
      ev.push(o);
    };
    var pm = ids(prev.moments), pn = ids(prev.notes), pr = ids(prev.requests), pl = ids(prev.letters);
    next.letters.forEach(function(l){ if(l.by === THEM && !pl[l.id]) add("letters", p + " wrote you a letter.", "letters", "lettersList"); });
    var loved = false;
    Object.keys(next.hearts).forEach(function(id){
      if(next.hearts[id][THEM] && !((prev.hearts[id] || {})[THEM])) loved = true;
    });
    if(loved) add("hearts", p + " loved your moment.", "home", "sharedDayGrid");
    var newMoments = 0;
    next.moments.forEach(function(m){ if(m.by === THEM && !pm[m.id]) newMoments++; });
    if(newMoments) add("moments", newMoments === 1 ? p + " shared a moment." : p + " shared " + newMoments + " moments.", "home", "sharedDayGrid");
    var pmem = ids(prev.memories || []), newMem = 0;
    next.memories.forEach(function(m){ if(m.by === THEM && !pmem[m.id]) newMem++; });
    if(newMem) add("memories", p + " added " + newMem + (newMem === 1 ? " memory" : " memories") + " to Our Story.", "story", "memoryTimeline");
    var warm = loved;
    next.notes.forEach(function(n){
      if(n.by === THEM && !pn[n.id]){ warm = true; add("notes", n.text ? p + ": " + n.text : p + " is thinking of you.", "home", "notesRow"); }
    });
    next.requests.forEach(function(r){
      var before = pr[r.id];
      if(r.by === THEM && r.status !== "pending" && (!before || before.status === "pending")) add("need", p + " could use " + String(r.title).toLowerCase() + ".", "home", "needIncoming", { urgent: !!r.urgent });
      if(r.by === ME && r.reply === "here" && before && before.reply !== "here") add("need", p + " answered: I'm here.", "home", "needSentLine", { urgent: !!r.urgent });
      if(r.by === ME && r.reply === "later" && before && before.reply !== "later") add("need", p + " saw it and can't right now.", "home", "needSentLine", { urgent: false });
    });
    var prep = ids(prev.replies || []), mineMoments = {};
    next.moments.forEach(function(m){ if(m.by === ME) mineMoments[m.id] = 1; });
    (next.replies || []).forEach(function(r){
      if(r.by !== THEM || prep[r.id]) return;
      add("moments", p + (mineMoments[r.to] ? " answered your moment" : " added to the moment") + (r.kind === "clip" ? " with a clip." : " with a voice note."), "home", "sharedDayGrid", { moment: r.to });
    });
    Object.keys(next.reacts || {}).forEach(function(id){
      var now = (next.reacts[id] || {})[THEM], was = ((prev.reacts || {})[id] || {})[THEM];
      if(now && now !== was && REACTION_LABEL[now]) add("hearts", p + " " + REACTION_LABEL[now] + ".", "home", "sharedDayGrid", { moment: id });
    });
    var pplans = ids(prev.plans || []);
    next.plans.forEach(function(x){ if(x.by === THEM && !pplans[x.id]) add("plans", p + " added a plan: " + x.title + ".", "home", "plansBlock"); });
    var pr0 = prev.reunion, nr0 = next.reunion, reunionSet = nr0 && nr0.by === THEM && (!pr0 || pr0.date !== nr0.date);
    if(reunionSet){ var nru = reunionParse(nr0.date); add("reunion", p + " set your reunion" + (nru ? ": " + nru.label : "") + ".", "home", "reunionRing"); }
    var ns = (next.sleep || {})[THEM], ps = (prev.sleep || {})[THEM];
    if(ns && (!ps || ps.at !== ns.at)) add("sleep", ns.asleep ? p + " said good night." : p + " is awake — good morning.", "home", "sleepLine");
    var na = next.ambient[THEM], pa = (prev.ambient || {})[THEM];
    if(na && (!pa || pa.id !== na.id)) add("ambient", p + " shared the sound of where they are.", "home", "ambientCard");
    var qr = next.quiz.round || 0, qNow = (next.quiz.answers[qr] || {})[THEM], qBefore = ((prev.quiz && prev.quiz.answers[qr]) || {})[THEM];
    if(qNow && !qBefore) add("games", (next.quiz.answers[qr] || {})[ME] ? p + " played too — see how well you know each other." : p + " played Know each other. Your turn.", "home", "quizCard");
    var day = sharedDay(), dqNow = (next.dq[day] || {})[THEM], dqBefore = ((prev.dq || {})[day] || {})[THEM];
    if(dqNow && !dqBefore) add("games", p + " answered today's question.", "home", "dqFlip");
    moreAnnounce(prev, next, add);
    if(warm) petalBurst(document.getElementById("presenceAvatarB"), 8);
    if(reunionSet && !isQuietNow()) celebrate();
    notifyAll(ev);
  }
  window.addEventListener("storage", function(e){
    if(e.key !== SHARED_KEY) return;
    var prev = DB;
    DB = readShared();
    if(RECOVERY){ showRecoveryScreen(); return; }
    replayLostOps();
    rebuildFromShared();
    renderShared();
    announcePartnerActivity(prev, DB);
  });
  // The connection is one fact for the space: when the other tab pauses,
  // leaves or reconnects, this tab follows, and any live sound ends.
  window.addEventListener("storage", function(e){
    if(e.key !== PAIRING_KEY || !e.newValue) return;
    var next = readJsonKey(PAIRING_KEY);
    if(!next || typeof next !== "object") return;
    SPACE.pairing = next;
    if(!isPaired()) liveShutdown("The space was paused, so live sound stopped. Your microphone is off.");
    renderSpaceBindings();
    applyPairingGate();
  });

  // Two-partner preview: which partner this tab is. A real login replaces this.
  function wireViewingAs(){
    var box = document.getElementById("viewingAs");
    if(!box) return;
    var me = SPACE.currentUser, p = SPACE.partner;
    setText("viewingAsName", me.name);
    var link = document.getElementById("viewingAsOpen");
    if(link){
      link.textContent = "Open " + p.name + "'s side in a new tab";
      link.setAttribute("href", window.location.pathname + "?as=" + (THEM === "u_mira" ? "mira" : "aarav"));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reduced motion                                                       */
  /* ------------------------------------------------------------------ */
  function prefersReducedMotion(){
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function wireReducedMotion(){
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function apply(){
      var on = SPACE.reducedMotionOverride ? SPACE.reducedMotionOverride === "on" : mq.matches;
      document.body.classList.toggle("reduced-motion", on);
    }
    apply();
    if(mq.addEventListener) mq.addEventListener("change", function(){ if(!SPACE.reducedMotionOverride) apply(); });
  }

  /* ------------------------------------------------------------------ */
  /* Live clocks — real IANA timezones via Intl.DateTimeFormat, so DST    */
  /* shifts (and any future zone-rule change) are handled automatically. */
  /* ------------------------------------------------------------------ */
  function formatTimeInZone(date, timeZone){
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", hour12: clock12(), timeZone: timeZone
    }).format(date);
  }

  var shownSpaceDay = null;
  // Runs every half minute and when you come back to the page: if the shared
  // day has turned over (or its time zone changed), everything that depends on
  // "today" is rebuilt, so yesterday never lingers.
  function checkSharedDay(){
    var day = sharedDay();
    if(shownSpaceDay === null){ shownSpaceDay = day; return; }
    if(day === shownSpaceDay) return;
    shownSpaceDay = day;
    rebuildFromShared();
    renderTodayLabel();
    renderShared();
    renderDailyQuestion();
    var flip = document.getElementById("dqFlipInner"); if(flip) flip.classList.remove("is-flipped");
    if(typeof renderWaiting === "function") renderWaiting();
    if(typeof renderGarden === "function") renderGarden();
    if(typeof renderDateIdea === "function") renderDateIdea();
  }
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) checkSharedDay(); });
  function tickClocks(){
    checkSharedDay();
    var now = new Date();
    var a = formatTimeInZone(now, SPACE.currentUser.timezone);
    var b = formatTimeInZone(now, SPACE.partner.timezone);
    document.getElementById("clockA").textContent = a;
    document.getElementById("clockB").textContent = b;
    var pa = document.getElementById("presenceClockA"), pb = document.getElementById("presenceClockB");
    if(pa) pa.textContent = a;
    if(pb) pb.textContent = b;
    // Only the real, computed time is shown here — Pairlum has no weather
    // or environment data, and doesn't pretend to know what it's like where
    // someone is unless they've actually said so.
    updateParallelLive(now);
    var wa = document.getElementById("cityAWeather"), wb = document.getElementById("cityBWeather");
    if(wa) wa.textContent = a;
    if(wb) wb.textContent = b;
  }

  function renderTodayLabel(){
    var e = document.getElementById("todayEyebrow");
    if(!e) return;
    e.textContent = new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: spaceTz()
    }).format(new Date());
  }

  /* ------------------------------------------------------------------ */
  /* Day Story — memories accumulating, not task progress                */
  /* ------------------------------------------------------------------ */
  function renderDayStory(){
    var wrap = document.getElementById("dayStoryTimeline");
    if(!wrap) return;

    // Only today, on your shared calendar, and only what is really there.
    var start = spaceDayStart();
    var today = DB.moments.filter(function(m){ return m.at ? m.at >= start : !!m.demo; });
    var has = function(type, who){ return today.some(function(m){ return m.type === type && (!who || m.by === who); }); };
    var pm = latestParallel(ME), pt = latestParallel(THEM);
    var parallelToday = !!(pm && pt && pm.at >= start && pt.at >= start);
    var steps = [
      { label:"Your photo", meta:"", done: has("photo", ME) },
      { label:"A few words", meta:"", done: has("text") },
      { label:SPACE.partner.name + "’s photo", meta:"", done: has("photo", THEM) },
      { label:"A voice note", meta:"", done: has("voice") || today.some(function(m){ return !!m.voice; }) },
      { label:"Parallel Moment", meta:"", done: parallelToday }
    ];
    var doneCount = steps.filter(function(x){ return x.done; }).length;
    steps.push({ label:"Day Story", meta: doneCount ? "forming" : "not started", done:false });

    wrap.innerHTML = "";
    steps.forEach(function(s){
      var row = el("div","day-story-item" + (s.done ? " is-done" : ""));
      row.innerHTML =
        '<span class="day-story-dot" aria-hidden="true"></span>' +
        '<span class="day-story-label">'+ escapeHtml(s.label) +'</span>' +
        (s.meta ? '<span class="day-story-meta">'+ escapeHtml(s.meta) +'</span>' : '');
      wrap.appendChild(row);
    });

    var chapterEl = document.getElementById("dayStoryChapter");
    if(chapterEl){
      var monthDay = new Intl.DateTimeFormat("en-US",{ month:"long", day:"numeric", timeZone: spaceTz() }).format(new Date());
      var weekday = new Intl.DateTimeFormat("en-US",{ weekday:"long", timeZone: spaceTz() }).format(new Date());
      chapterEl.textContent = "“" + monthDay + " — " + weekday + " apart”";
    }
  }

  /* ------------------------------------------------------------------ */
  /* First Chapter — one contextual action, driven by real pairing state.*/
  /* The "invite" case is handled by applyPairingGate()/spacePausedNotice */
  /* instead, so this only ever runs once the couple is actually joined. */
  /* ------------------------------------------------------------------ */
  function renderFirstChapter(){
    var banner = document.getElementById("firstChapterBanner");
    var textEl = document.getElementById("firstChapterText");
    var ctaEl = document.getElementById("firstChapterCta");
    if(!banner || !textEl || !ctaEl) return;

    if(!isPaired()){
      banner.style.display = "none";
      return;
    }

    var hasImportedPast = SPACE.hasImportedPast;
    var todayMomentCount = SPACE.moments.length;

    banner.style.display = "";
    if(!hasImportedPast){
      textEl.textContent = "Your story goes back further than today.";
      ctaEl.textContent = "Bring your history →";
      ctaEl.setAttribute("data-action", "open-import");
    } else if(todayMomentCount === 0){
      textEl.textContent = "Nothing shared yet today.";
      ctaEl.textContent = "Add today's moment →";
      ctaEl.setAttribute("data-action", "open-capture");
    } else {
      banner.style.display = "none";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pairing gate — Shared Day, Parallel Moments, Day Story, I Need You  */
  /* and Thinking of You are all couple-only. When the pairing status    */
  /* isn't "joined", none of that content renders — a single, honest     */
  /* "Shared Day is paused" notice takes its place instead.               */
  /* ------------------------------------------------------------------ */
  function applyPairingGate(){
    var wrap = document.getElementById("coupleLiveWrap");
    var notice = document.getElementById("spacePausedNotice");
    var noticeText = document.getElementById("spacePausedText");
    var fab = document.getElementById("fabAdd");
    if(!wrap || !notice) return;

    var paired = isPaired();
    wrap.hidden = !paired;
    notice.hidden = paired;

    if(!paired){
      var p = SPACE.partner;
      var copy = {
        not_started: "Invite " + p.name + " to bring Shared Day to life — nothing shows here until you both explicitly join the same space.",
        invite_sent: "Waiting on " + p.name + " to accept your invite before Shared Day can start.",
        waiting: "Waiting on " + p.name + " to accept your invite before Shared Day can start.",
        expired: "Your invite to " + p.name + " expired. Send a new one to bring Shared Day back.",
        left: "You stepped away from this Pairlum. Nothing here was lost — rejoin whenever you're ready."
      }[SPACE.pairing.status] || ("Connect with " + p.name + " to bring Shared Day back to life.");
      if(noticeText) noticeText.textContent = copy;
    }

    if(fab) fab.style.display = paired ? "" : "none";
    renderFirstChapter();
  }

  /* ------------------------------------------------------------------ */
  /* Partner & Pairing — full invite/join state machine                  */
  /* ------------------------------------------------------------------ */
  function genInviteCode(){
    var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var out = "";
    for(var i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  function renderPairingOverlay(){
    var body = document.getElementById("pairingBody");
    var status = SPACE.pairing.status;
    var p = SPACE.partner;
    var html = "";

    // Plain-language status line — never "space_id" / "pairing" /
    // "synchronization". This is the whole story in three lines:
    // Invite Mira to your Pairlum → Waiting for Mira → Mira is here.
    var badge = {
      not_started: '<span class="pairing-status-badge pairing-status-badge--none">Not started</span>',
      invite_sent: '<span class="pairing-status-badge pairing-status-badge--waiting">Waiting for ' + escapeHtml(p.name) + '</span>',
      waiting:     '<span class="pairing-status-badge pairing-status-badge--waiting">Waiting for ' + escapeHtml(p.name) + '</span>',
      expired:     '<span class="pairing-status-badge pairing-status-badge--expired">Invite expired</span>',
      joined:      '<span class="pairing-status-badge pairing-status-badge--joined">' + escapeHtml(p.name) + ' is here — connected</span>'
    }[status];

    html += '<div class="pairing-state">' + badge;

    if(status === "not_started"){
      html +=
        '<h3 class="disp-3" style="margin-top:10px">Invite '+escapeHtml(p.name)+' to your Pairlum</h3>'+
        '<p class="body-m">This is a private space just for the two of you. Nothing shows here until '+escapeHtml(p.name)+' joins too.</p>'+
        '<button class="btn-primary" id="pairingCreateBtn" type="button" style="width:100%;margin-top:6px">Invite '+escapeHtml(p.name)+' →</button>';
    } else if(status === "invite_sent" || status === "waiting"){
      html +=
        '<h3 class="disp-3" style="margin-top:10px">Waiting for '+escapeHtml(p.name)+'</h3>'+
        '<p class="body-m">Share this code or link with '+escapeHtml(p.name)+'. Your Shared Day starts as soon as '+escapeHtml(p.name)+' opens it and joins.</p>'+
        '<div class="invite-code-box"><span class="code">'+ escapeHtml(SPACE.pairing.inviteCode || "——————") +'</span><button type="button" id="pairingCopyBtn">Copy</button></div>'+
        '<div class="confirm-actions">'+
          '<button class="btn-ghost" id="pairingResendBtn" type="button">Resend invite</button>'+
          '<button class="btn-danger" id="pairingCancelBtn" type="button">Cancel invite</button>'+
        '</div>'+
        '<div class="pairing-demo-note">There\'s no second device to actually accept this in a prototype, so this button stands in for '+escapeHtml(p.name)+' opening the invite. <button type="button" id="pairingSimulateBtn">Simulate: '+escapeHtml(p.name)+' accepts (demo only)</button></div>';
    } else if(status === "expired"){
      html +=
        '<h3 class="disp-3" style="margin-top:10px">Your invite to '+escapeHtml(p.name)+' expired</h3>'+
        '<p class="body-m">It wasn\'t accepted in time — no harm done. Send a new one whenever you\'re ready.</p>'+
        '<button class="btn-primary" id="pairingResendExpiredBtn" type="button" style="width:100%;margin-top:6px">Send a new invite →</button>';
    } else if(status === "left"){
      html +=
        '<h3 class="disp-3" style="margin-top:10px">You left this Pairlum</h3>'+
        '<p class="body-m">Nothing was deleted, and '+escapeHtml(p.name)+' still has everything exactly as it was. Rejoin whenever you\'re ready — same space, right where you left it.</p>'+
        '<button class="btn-primary" id="pairingRejoinBtn" type="button" style="width:100%;margin-top:6px">Rejoin →</button>';
    } else { // joined
      var joinedLabel = new Intl.DateTimeFormat("en-US",{ day:"numeric", month:"long", year:"numeric" }).format(new Date(SPACE.pairing.joinedAt));
      html +=
        '<h3 class="disp-3" style="margin-top:10px">'+escapeHtml(p.name)+' is here. Your space is ready.</h3>'+
        '<p class="body-m">You\'ve shared this space since '+joinedLabel+'. Everything in Shared Day, Our Story and Letters lives only between the two of you.</p>'+
        '<div class="danger-row" style="margin-top:8px">'+
          '<div class="copy"><span class="title">Disconnect relationship</span><span class="sub">Ends the live connection between you — explained before you confirm.</span></div>'+
          '<button class="btn-danger" id="pairingDisconnectBtn" type="button">Disconnect</button>'+
        '</div>'+
        '<div class="danger-row" style="margin-top:8px">'+
          '<div class="copy"><span class="title">Leave this Pairlum</span><span class="sub">Steps away from this space without ending the connection — '+escapeHtml(p.name)+' keeps everything.</span></div>'+
          '<button class="btn-ghost" id="pairingLeaveBtn" type="button">Leave</button>'+
        '</div>';
    }
    html += "</div>";
    body.innerHTML = html;
    wirePairingBodyEvents();
  }

  function wirePairingBodyEvents(){
    var createBtn = document.getElementById("pairingCreateBtn");
    if(createBtn) createBtn.addEventListener("click", function(){
      SPACE.pairing.status = "invite_sent";
      SPACE.pairing.inviteCode = genInviteCode();
      SPACE.pairing.inviteSentAt = Date.now();
      saveSpaceSettings();
      renderPairingOverlay();
      renderSpaceBindings();
      applyPairingGate();
      showToast("Invite created for " + SPACE.partner.name + ".");
    });
    var copyBtn = document.getElementById("pairingCopyBtn");
    if(copyBtn) copyBtn.addEventListener("click", function(){
      var text = "Join me on Pairlum — code " + (SPACE.pairing.inviteCode || "");
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){ showToast("Invite copied."); }, function(){ showToast("Couldn't copy — code is " + SPACE.pairing.inviteCode); });
      } else {
        showToast("Code: " + SPACE.pairing.inviteCode);
      }
    });
    var resendBtn = document.getElementById("pairingResendBtn");
    if(resendBtn) resendBtn.addEventListener("click", function(){
      SPACE.pairing.status = "waiting";
      SPACE.pairing.inviteSentAt = Date.now();
      saveSpaceSettings();
      renderPairingOverlay();
      applyPairingGate();
      showToast("Invite re-sent to " + SPACE.partner.name + ".");
    });
    var cancelBtn = document.getElementById("pairingCancelBtn");
    if(cancelBtn) cancelBtn.addEventListener("click", function(){
      SPACE.pairing.status = "not_started";
      SPACE.pairing.inviteCode = null;
      saveSpaceSettings();
      renderPairingOverlay();
      renderSpaceBindings();
      applyPairingGate();
      showToast("Invite cancelled.");
    });
    var simBtn = document.getElementById("pairingSimulateBtn");
    if(simBtn) simBtn.addEventListener("click", function(){
      SPACE.pairing.status = "joined";
      SPACE.pairing.joinedAt = new Date().toISOString();
      saveSpaceSettings();
      renderPairingOverlay();
      renderSpaceBindings();
      applyPairingGate();
      showToast(SPACE.partner.name + " joined your space — Shared Day is active.");
    });
    var resendExpiredBtn = document.getElementById("pairingResendExpiredBtn");
    if(resendExpiredBtn) resendExpiredBtn.addEventListener("click", function(){
      SPACE.pairing.status = "invite_sent";
      SPACE.pairing.inviteCode = genInviteCode();
      saveSpaceSettings();
      renderPairingOverlay();
      applyPairingGate();
      showToast("New invite sent.");
    });
    var disconnectBtn = document.getElementById("pairingDisconnectBtn");
    if(disconnectBtn) disconnectBtn.addEventListener("click", renderDisconnectConfirm);
    var leaveBtn = document.getElementById("pairingLeaveBtn");
    if(leaveBtn) leaveBtn.addEventListener("click", renderLeaveConfirm);
    var rejoinBtn = document.getElementById("pairingRejoinBtn");
    if(rejoinBtn) rejoinBtn.addEventListener("click", function(){
      SPACE.pairing.status = "joined";
      saveSpaceSettings();
      renderPairingOverlay();
      renderSpaceBindings();
      applyPairingGate();
      showToast("Welcome back — nothing changed while you were away.");
    });
  }

  function renderDisconnectConfirm(){
    var body = document.getElementById("pairingBody");
    var p = SPACE.partner;
    body.innerHTML =
      '<div class="confirm-panel">'+
        '<button class="overlay-back" type="button" id="disconnectBack">← Back</button>'+
        '<h4>Disconnect '+escapeHtml(p.name)+'?</h4>'+
        '<p class="body-m">Here\'s exactly what happens if you do:</p>'+
        '<ul>'+
          '<li>Shared moments stay visible to both of you, but become read-only — no new ones can be added to them.</li>'+
          '<li>Private moments (only ever visible to you) are untouched.</li>'+
          '<li>Letters already written stay exactly as they are, still opening on their dates.</li>'+
          '<li>Imported memories from before Pairlum remain in Our Story.</li>'+
          '<li>Your relationship history is kept — disconnecting pauses the space, it does not erase it.</li>'+
        '</ul>'+
        '<label class="confirm-check"><input type="checkbox" id="disconnectUnderstand"><span>I understand this pauses our shared space.</span></label>'+
        '<div class="confirm-actions">'+
          '<button class="btn-ghost" id="disconnectCancelBtn" type="button">Never mind</button>'+
          '<button class="btn-danger-solid" id="disconnectConfirmBtn" type="button" disabled>Disconnect '+escapeHtml(p.name)+'</button>'+
        '</div>'+
      '</div>';
    document.getElementById("disconnectBack").addEventListener("click", renderPairingOverlay);
    document.getElementById("disconnectCancelBtn").addEventListener("click", renderPairingOverlay);
    var check = document.getElementById("disconnectUnderstand");
    var confirmBtn = document.getElementById("disconnectConfirmBtn");
    check.addEventListener("change", function(){ confirmBtn.disabled = !check.checked; });
    confirmBtn.addEventListener("click", function(){
      liveShutdown("Live sound stopped. Your microphone is off."); cancelRecordings();
      SPACE.pairing.status = "not_started";
      SPACE.pairing.inviteCode = null;
      saveSpaceSettings();
      closeOverlay("pairingOverlay");
      renderSpaceBindings();
      applyPairingGate();
      showToast("Disconnected. Your space is paused — nothing was deleted.");
    });
  }

  // "Leave" is the lighter, reversible step next to "Disconnect" — stepping
  // away from a shared space is not the same decision as ending the
  // connection, and the two need visibly different consequences and wording.
  function renderLeaveConfirm(){
    var body = document.getElementById("pairingBody");
    var p = SPACE.partner;
    body.innerHTML =
      '<div class="confirm-panel">'+
        '<button class="overlay-back" type="button" id="leaveBack">← Back</button>'+
        '<h4>Leave this Pairlum?</h4>'+
        '<p class="body-m">This is lighter than disconnecting. Here\'s exactly what happens:</p>'+
        '<ul>'+
          '<li>'+escapeHtml(p.name)+' keeps this space exactly as it is — nothing changes on their side.</li>'+
          '<li>Nothing is deleted, hidden from '+escapeHtml(p.name)+', or made read-only.</li>'+
          '<li>You can rejoin instantly, any time, with one tap — no new invite needed.</li>'+
          '<li>Your connection with '+escapeHtml(p.name)+' is not ended. If you want to end it instead, use Disconnect.</li>'+
        '</ul>'+
        '<div class="confirm-actions">'+
          '<button class="btn-ghost" id="leaveCancelBtn" type="button">Never mind</button>'+
          '<button class="btn-danger-solid" id="leaveConfirmBtn" type="button">Leave</button>'+
        '</div>'+
      '</div>';
    document.getElementById("leaveBack").addEventListener("click", renderPairingOverlay);
    document.getElementById("leaveCancelBtn").addEventListener("click", renderPairingOverlay);
    document.getElementById("leaveConfirmBtn").addEventListener("click", function(){
      liveShutdown("Live sound stopped. Your microphone is off."); cancelRecordings();
      SPACE.pairing.status = "left";
      saveSpaceSettings();
      closeOverlay("pairingOverlay");
      renderSpaceBindings();
      applyPairingGate();
      showToast("You left — " + p.name + " keeps everything, and you can rejoin anytime.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Notifications & Quiet Hours                                         */
  /* ------------------------------------------------------------------ */
  function toggleRow(id, title, sub, on){
    // title and sub arrive already escaped by the caller (some carry names); the switch is named for screen readers
    return '<div class="toggle-row"><div class="toggle-row-copy"><span class="title" id="'+id+'-t">'+title+'</span><span class="sub" id="'+id+'-s">'+sub+'</span></div><button type="button" class="toggle-switch'+(on?" is-on":"")+'" id="'+id+'" role="switch" aria-checked="'+(on?"true":"false")+'" aria-labelledby="'+id+'-t" aria-describedby="'+id+'-s"></button></div>';
  }

  function wireToggle(id, onChange){
    var btn = document.getElementById(id);
    if(!btn) return;
    btn.addEventListener("click", function(){
      var on = !btn.classList.contains("is-on");
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
      onChange(on);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Privacy & Relationship Controls                                     */
  /* ------------------------------------------------------------------ */
  function deviceIconSvg(){
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 18h4"/></svg>';
  }

  function renderPrivacyMain(){
    var body = document.getElementById("privacyBody");
    var p = SPACE.partner;
    var mp = SPACE.privacy.mediaPermissions, savedPolicy = (DB.prefs[ME] || {}).media;
    if(savedPolicy){ mp.partnerCanSaveOriginals = !!savedPolicy.saveOriginals; mp.partnerCanDownloadVideo = savedPolicy.downloadVideo !== false; }
    var joinedLabel = SPACE.pairing.status === "joined"
      ? "Connected with " + p.name + " since " + new Intl.DateTimeFormat("en-US",{day:"numeric",month:"long",year:"numeric"}).format(new Date(SPACE.pairing.joinedAt))
      : "Not currently connected with " + p.name;

    var html = "";

    // The three questions a couple actually has — answered first, in plain
    // language, before any advanced controls. Everything else lives lower.
    html += '<div class="overlay-section privacy-core-q"><div class="overlay-section-head"><h4>Who can see this?</h4></div>';
    [
      ["Moments you add to Shared Day","shared"],
      ["Voice notes you send","shared"],
      ["Parallel Moments","shared"],
      ["Letters addressed to "+p.name,"shared"],
      ["The sound around you (your recorded clip, until you remove it)","shared"],
      ["Live sound — only after you tap Allow, only until you stop","shared"],
      ["Moments still saved only on this device (not yet sent)","private"],
      ["This device's local settings (quiet hours, sound, reduced motion)","private"]
    ].forEach(function(row){
      html += '<div class="privacy-item"><span class="label">'+escapeHtml(row[0])+'</span><span class="privacy-tag privacy-tag--'+row[1]+'">'+(row[1]==="shared"?"Shared with "+escapeHtml(p.name):"Private to me")+'</span></div>';
    });
    html += '<p class="privacy-note">Distance'+(distanceText() ? ' ('+distanceText()+')' : '')+' is calculated only from the cities you both entered when you set up your space — Pairlum never reads live location. Photos you import are normally saved without the hidden location data cameras add. Two exceptions keep whatever the file holds: imported videos, and a photo this browser cannot convert (some HEIC files).</p></div>';

    var liveLogHtml = DB.liveLog.slice().reverse().slice(0, 8).map(function(en){
      var when = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short", hour:"numeric", minute:"2-digit" }).format(new Date(en.at));
      var who = en.sharer === ME ? p.name + " listened to you" : "You listened to " + p.name;
      var dur = Math.floor(en.secs / 60) + ":" + pad2(en.secs % 60);
      return '<div class="privacy-item"><span class="label">'+escapeHtml(who)+'</span><span class="privacy-tag privacy-tag--private">'+escapeHtml(when + " · " + dur)+'</span></div>';
    }).join("");
    if(DB.liveLog.length > 8) liveLogHtml += '<p class="field-hint">The 8 most recent of ' + DB.liveLog.length + ' are shown. All of them are kept and are in your export.</p>';
    html += '<div class="overlay-section privacy-core-q"><div class="overlay-section-head"><h4>Can '+escapeHtml(p.name)+' hear me?</h4></div>'+
      '<p class="body-m">Only when you say yes. Every live request shows you a prompt, and nothing is ever allowed in advance. You choose each time whether to share your surroundings or just your voice. Pairlum does not record live sound, and your microphone turns off the moment either of you stops, after 15 minutes, or if Pairlum sits in the background for 2 minutes.</p>'+
      toggleRow("liveRequestsToggle","Let "+escapeHtml(p.name)+" ask to listen live","Turn this off and requests never reach you. "+escapeHtml(p.name)+" only sees that you can't share right now.", liveRequestsAllowed(ME))+
      '<p class="eyebrow" style="margin-top:14px">Live listening history</p>'+
      (liveLogHtml || '<p class="privacy-note">No live listening yet. Every session is listed here for both of you.</p>')+
    '</div>';

    html += '<div class="overlay-section privacy-core-q"><div class="overlay-section-head"><h4>Can '+escapeHtml(p.name)+' save it?</h4></div>'+
      toggleRow("mpSaveOriginals","Save your originals","Otherwise "+escapeHtml(p.name)+" can view but not download full-quality photos and videos you share.", mp.partnerCanSaveOriginals)+
      toggleRow("mpDownloadVideo","Download your videos", "Turn this off to keep videos view-only inside Pairlum.", mp.partnerCanDownloadVideo)+
      '<p class="privacy-note">These switches decide what goes into '+escapeHtml(p.name)+'\'s export (the only download Pairlum offers): with them off, your photos and videos are left out of it and stay in yours. No app can stop someone taking a screenshot or filming a screen.</p>'+
    '</div>';

    html += '<div class="overlay-section privacy-core-q"><div class="overlay-section-head"><h4>What happens if we disconnect?</h4></div>'+
      '<p class="body-m">'+escapeHtml(joinedLabel)+'. If you disconnect, everything you\'ve already shared stays exactly as it is for both of you — it just stops growing. Nothing is deleted by disconnecting.</p>'+
      '<div class="danger-row"><div class="copy"><span class="title">Manage the connection</span><span class="sub">Invite, resend, leave, or disconnect '+escapeHtml(p.name)+'.</span></div><button class="btn-ghost" id="privacyOpenPairingBtn" type="button">Open →</button></div>'+
    '</div>';

    html += '<div class="overlay-section privacy-core-q"><div class="overlay-section-head"><h4>Can Pairlum read what I say?</h4></div>'+
      '<p class="body-m">Only if you switch it on, and only for your own recordings. A write-up is the words, a short title, a feeling and the topics, so a voice note can be found again months later.</p>'+
      toggleRow("understandToggle", "Write up my recordings", "Your voice notes and clips are sent to Pairlum's understanding service to be written up. The service keeps the words, not the sound. "+escapeHtml(p.name)+" decides separately for theirs.", understandAllowed(ME))+
      '<p class="field-hint">'+(understandCfg() ? "Recordings you make from now on are written up automatically, and earlier ones a few at a time." : "The understanding service is not connected in this preview, so nothing is sent anywhere. Your choice is remembered for when it is.")+'</p>'+
    '</div>';

    // Advanced controls, deliberately lower — not the first thing a couple
    // needs to make sense of their privacy.
    html += '<p class="eyebrow" style="margin-top:22px">More controls</p>';

    html += '<div class="overlay-section"><div class="overlay-section-head"><h4>Devices &amp; sessions</h4></div><div id="privacyDevicesList"></div></div>';

    html += '<div class="overlay-section"><div class="overlay-section-head"><h4>Your data</h4></div>'+
      '<div class="danger-row"><div class="copy"><span class="title">Export your Pairlum</span><span class="sub">Download everything in your space as one .zip file, photos, videos and voice included.</span></div><button class="btn-ghost" id="privacyExportBtn" type="button">Export</button></div>'+
      '<div class="danger-row"><div class="copy"><span class="title">Restore from a backup</span><span class="sub">Put back an export you downloaded earlier.</span></div><button class="btn-ghost" id="privacyRestoreBtn" type="button">Restore</button></div>'+
      '<div class="danger-row"><div class="copy"><span class="title">Delete my account</span><span class="sub">Permanently removes your access. Always confirmed first.</span></div><button class="btn-danger" id="privacyDeleteBtn" type="button">Delete →</button></div>'+
    '</div>';

    body.innerHTML = html;
    renderDevicesList();
    var saveMediaPolicy = function(){
      var ok = mutate(function(db){
        if(!db.prefs[ME]) db.prefs[ME] = {};
        db.prefs[ME].media = { saveOriginals: !!mp.partnerCanSaveOriginals, downloadVideo: mp.partnerCanDownloadVideo !== false };
      }, { evenIfPaused: true });
      if(ok) saveSpaceSettings(); else { var was = mediaPolicy(DB, ME); mp.partnerCanSaveOriginals = was.saveOriginals; mp.partnerCanDownloadVideo = was.downloadVideo; renderPrivacyMain(); }
    };
    wireToggle("mpSaveOriginals", function(on){ mp.partnerCanSaveOriginals = on; saveMediaPolicy(); });
    wireToggle("mpDownloadVideo", function(on){ mp.partnerCanDownloadVideo = on; saveMediaPolicy(); });
    wireToggle("understandToggle", function(on){
      if(!mutate(function(db){ if(!db.prefs[ME]) db.prefs[ME] = {}; db.prefs[ME].understand = on; }, { evenIfPaused: true })){ renderPrivacyMain(); return; }
      showToast(on ? (understandCfg() ? "On. Your recordings will be written up." : "On. Nothing is sent until the service is connected.") : "Off. Your recordings are not sent to be written up.");
      if(on) resumeUnderstanding();
    });
    wireToggle("liveRequestsToggle", function(on){
      if(!mutate(function(db){ if(!db.prefs[ME]) db.prefs[ME] = {}; db.prefs[ME].liveRequests = on; }, { evenIfPaused: true })){ renderPrivacyMain(); return; }
      if(!on && LS.share.state === "incoming") liveDecline();
      showToast(on ? SPACE.partner.name + " can ask to listen live again." : "Live requests are off. Nothing reaches you until you turn this back on.");
    });
    document.getElementById("privacyOpenPairingBtn").addEventListener("click", function(){
      closeOverlay("privacyOverlay");
      renderPairingOverlay();
      openOverlay("pairingOverlay");
    });
    document.getElementById("privacyExportBtn").addEventListener("click", renderExportPanel);
    document.getElementById("privacyRestoreBtn").addEventListener("click", renderRestorePanel);
    document.getElementById("privacyDeleteBtn").addEventListener("click", renderDeleteConfirm);
  }

  function renderDevicesList(){
    var wrap = document.getElementById("privacyDevicesList");
    if(!wrap) return;
    wrap.innerHTML = "";
    SPACE.devices.forEach(function(d){
      var row = el("div","device-row");
      row.innerHTML =
        '<span class="device-icon">'+deviceIconSvg()+'</span>'+
        '<div class="device-info"><span class="name">'+escapeHtml(d.name)+(d.current?' <span class="device-current-tag">This device</span>':'')+'</span><span class="meta">'+escapeHtml(d.lastActive)+'</span></div>'+
        (d.current ? '' : '<button type="button" class="device-revoke" data-device-id="'+d.id+'">Revoke</button>');
      wrap.appendChild(row);
    });
    wrap.querySelectorAll("[data-device-id]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id = btn.getAttribute("data-device-id");
        SPACE.devices = SPACE.devices.filter(function(d){ return d.id !== id; });
        saveSpaceSettings();
        renderDevicesList();
        showToast("That session was signed out.");
      });
    });
  }

  /* ================================================================== */
  /* VOICE-FIRST MOMENTS                                                  */
  /* A moment is a voice note, a photo or a short clip. A photo or clip   */
  /* can carry a voice. Your partner answers with a voice, a clip or a    */
  /* reaction, in ONE flat thread per moment: no replies to replies.      */
  /* Every recording gets a write-up (transcript, title, feeling, topics, */
  /* people, events) so it can be found again by what was said.           */
  /* ================================================================== */
  var U_FEELINGS = { happy:"Happy", calm:"Calm", loving:"Loving", missing:"Missing you", playful:"Playful", excited:"Excited", tired:"Tired", worried:"Worried", rough:"A rough day" };
  var REACTIONS = [["love","Love"],["miss","Miss you"],["hug","Hug"],["smile","Made me smile"]];
  var REACTION_LABEL = { love:"loved this", miss:"misses you", hug:"sent a hug", smile:"smiled at this" };
  var REACTION_MINE = { love:"You loved this", miss:"You said you miss them", hug:"You sent a hug", smile:"This made you smile" };
  function reactionLine(userId, r){ return userId === ME ? REACTION_MINE[r] : SPACE.partner.name + " " + REACTION_LABEL[r]; }

  function mediaUrl(id, cb){
    if(MEDIA_URLS[id]) return cb(MEDIA_URLS[id]);
    idbGetMedia(id, function(err, blob){
      if(err || !blob) return cb(null);
      MEDIA_URLS[id] = URL.createObjectURL(blob);
      cb(MEDIA_URLS[id]);
    });
  }
  function personLabel(by){ return by === ME ? "You" : SPACE.partner.name; }
  function momentAt(m){ return m.at || spaceDayStart(); } // sample cards carry only a clock label; they belong to today
  function momentWhenLabel(m){
    if(!m.at) return m.time || "Today";
    return new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long", year:"numeric", timeZone: spaceTz() }).format(new Date(m.at)) + " · " + momentTimeLabel(m);
  }
  function hasFile(id){ return !!(MEDIA_URLS[id] || (window.PAIRLUM_DEMO_MEDIA || {})[id]); }

  /* ---- every recording in the space, with the moment around it ---- */
  function allRecordings(){
    var out = [];
    DB.moments.forEach(function(m){
      var around = (m.type === "photo" || m.type === "video") ? { type: m.type, id: m.id, caption: m.caption || "" } : null;
      var base = { momentId: m.id, by: m.by, at: momentAt(m), caption: m.caption || m.text || "" };
      if(m.type === "voice") out.push(copyInto({ recId: m.id, role: "moment", kind: "voice", secs: m.secs || 0, dur: m.dur || "", related: null, sample: !!m.demo && !hasFile(m.id) }, base));
      if(m.type === "video" && (m.hasMedia || hasFile(m.id))) out.push(copyInto({ recId: m.id, role: "moment", kind: "clip", secs: m.secs || 0, related: null }, base));
      if(m.voice && m.voice.id) out.push(copyInto({ recId: m.voice.id, role: "attached", kind: "voice", secs: m.voice.secs || 0, related: around }, base));
    });
    DB.replies.forEach(function(r){
      if(r.kind !== "voice" && r.kind !== "clip") return;
      var m = momentById(r.to);
      var around = m && (m.type === "photo" || m.type === "video") ? { type: m.type, id: m.id, caption: m.caption || "" } : null;
      out.push({ recId: r.id, role: "reply", kind: r.kind, secs: r.secs || 0, related: around, momentId: r.to, by: r.by, at: r.at || 0, caption: m ? (m.caption || "") : "" });
    });
    return out;
  }
  function copyInto(o, base){ Object.keys(base).forEach(function(k){ o[k] = base[k]; }); return o; }

  /* ---- the write-up of a recording ----------------------------------
     Stored in the shared record as understood[recordingId]. It comes from
     one of three places: the understanding service ("service"), the author
     typing it ("you"), or sample data in the demo ("demo").
     THE SERVICE CONTRACT (see docs/voice-first-moments-plan.md):
       POST   {url}/v1/recordings        audio + meta   -> 200 record | 202 pending
       GET    {url}/v1/recordings/{id}                  -> record
       POST   {url}/v1/search            {spaceId, query, limit} -> {results:[{recordingId, score}]}
       DELETE {url}/v1/recordings/{id}
     Nothing is sent unless PAIRLUM_CONFIG.understand.url is set AND the
     person who made the recording switched the write-up on for themselves.
     Whatever comes back is cleaned and treated as plain text. */
  function understandCfg(){ var c = window.PAIRLUM_CONFIG && window.PAIRLUM_CONFIG.understand; return c && typeof c.url === "string" && c.url ? c : null; }
  function understandAllowed(userId){ return !!((DB.prefs[userId] || {}).understand); }
  function understoodOf(recId){ var u = DB.understood[recId]; return u && typeof u === "object" ? u : null; }
  function cleanText(v, max){ return String(v === null || v === undefined ? "" : v).replace(/\s+/g, " ").trim().slice(0, max); }
  function cleanList(v, n, max){ return (Array.isArray(v) ? v : []).map(function(x){ return cleanText(typeof x === "object" && x ? (x.text || x.name || "") : x, max); }).filter(Boolean).slice(0, n); }
  function cleanUnderstood(raw, source){
    raw = raw && typeof raw === "object" ? raw : {};
    var feeling = cleanText(raw.feeling, 20).toLowerCase();
    return {
      status: "ready", source: source, at: Date.now(),
      transcript: cleanText(raw.transcript, 6000), title: cleanText(raw.title, 60),
      feeling: U_FEELINGS[feeling] ? feeling : "", language: cleanText(raw.language, 12),
      topics: cleanList(raw.topics, 8, 40), people: cleanList(raw.people, 8, 40),
      events: cleanList(raw.events, 8, 80), words: cleanList(raw.keywords || raw.words, 16, 30)
    };
  }
  function setUnderstood(recId, record){
    return mutate(function(db){ db.understood[recId] = record; }, { evenIfPaused: true });
  }
  // What the screen says about a recording that has no write-up.
  function understandStatus(rec){
    var u = understoodOf(rec.recId);
    if(u && u.status === "ready") return "ready";
    if(rec.sample) return "sample";
    if(u && u.status === "pending") return "pending";
    if(u && u.status === "failed") return "failed";
    if(!understandAllowed(rec.by)) return "off";
    return understandCfg() ? "pending" : "waiting";
  }
  var UNDERSTAND_BUSY = {};
  function serviceHeaders(cfg){ return cfg.token ? { Authorization: "Bearer " + cfg.token } : {}; }
  function afterUnderstood(){ refreshMomentBars(); if(document.getElementById("momentOverlay").classList.contains("is-open")) renderMomentThread(); }
  function sendToService(rec){
    var cfg = understandCfg();
    if(!cfg || rec.by !== ME || !understandAllowed(ME) || UNDERSTAND_BUSY[rec.recId]) return; // each device sends only its own person's recordings
    var cur = understoodOf(rec.recId);
    if(cur && cur.status === "ready") return;
    UNDERSTAND_BUSY[rec.recId] = true;
    var base = cfg.url.replace(/\/+$/, "");
    var done = function(){ delete UNDERSTAND_BUSY[rec.recId]; afterUnderstood(); };
    idbGetMedia(rec.recId, function(err, blob){
      if(err || !blob){ delete UNDERSTAND_BUSY[rec.recId]; return; }
      var fd = new FormData();
      fd.append("audio", blob, rec.recId);
      fd.append("meta", JSON.stringify({
        recordingId: rec.recId, spaceId: SPACE.spaceId, speaker: ME, kind: rec.kind, recordedAt: new Date(rec.at || Date.now()).toISOString(),
        timezone: SPACE.currentUser.timezone, names: [SPACE.currentUser.name, SPACE.partner.realName || SPACE.partner.name], relatedCaption: rec.caption || ""
      }));
      fetch(base + "/v1/recordings", { method: "POST", body: fd, headers: serviceHeaders(cfg) })
        .then(function(r){ if(r.status === 202) return { status: "pending" }; if(!r.ok) throw new Error("service"); return r.json(); })
        .then(function(data){
          if(data && data.status === "pending"){
            setUnderstood(rec.recId, { status: "pending", source: "service", at: Date.now() });
            pollService(rec, base, cfg, 0);
          } else setUnderstood(rec.recId, cleanUnderstood(data, "service"));
          done();
        })
        .catch(function(){ setUnderstood(rec.recId, { status: "failed", source: "service", at: Date.now() }); done(); });
    });
  }
  function pollService(rec, base, cfg, n){
    var waits = (cfg.pollMs && cfg.pollMs.length) ? cfg.pollMs : [2000, 5000, 12000, 30000];
    if(n >= waits.length) return; // still pending: tried again the next time Pairlum opens
    window.setTimeout(function(){
      fetch(base + "/v1/recordings/" + encodeURIComponent(rec.recId), { headers: serviceHeaders(cfg) })
        .then(function(r){ if(!r.ok) throw new Error("service"); return r.json(); })
        .then(function(data){
          if(data && data.status === "ready"){ setUnderstood(rec.recId, cleanUnderstood(data, "service")); afterUnderstood(); }
          else pollService(rec, base, cfg, n + 1);
        })
        .catch(function(){ pollService(rec, base, cfg, n + 1); });
    }, waits[n]);
  }
  function understandMomentRecordings(momentId){
    allRecordings().filter(function(r){ return r.momentId === momentId && r.by === ME; }).forEach(sendToService);
  }
  // On opening Pairlum: anything of mine that was never written up, a few at a time.
  function resumeUnderstanding(){
    if(!understandCfg() || !understandAllowed(ME)) return;
    allRecordings().filter(function(r){ var u = understoodOf(r.recId); return r.by === ME && !r.sample && (!u || u.status !== "ready"); })
      .sort(function(x, y){ return y.at - x.at; }).slice(0, 6).forEach(sendToService);
  }
  function forgetAtService(recIds){
    var cfg = understandCfg();
    if(!cfg) return;
    var base = cfg.url.replace(/\/+$/, "");
    recIds.forEach(function(id){ try{ fetch(base + "/v1/recordings/" + encodeURIComponent(id), { method: "DELETE", headers: serviceHeaders(cfg), keepalive: true }).catch(function(){}); }catch(e){} });
  }

  /* ---- how one recording is drawn (in a moment, in the thread) ---- */
  function chipsHtml(u){
    var chips = [];
    if(u.feeling) chips.push('<span class="rec-chip rec-chip--feel">' + escapeHtml(U_FEELINGS[u.feeling]) + '</span>');
    (u.topics || []).slice(0, 4).forEach(function(t){ chips.push('<span class="rec-chip">' + escapeHtml(t) + '</span>'); });
    return chips.length ? '<div class="rec-chips">' + chips.join("") + '</div>' : "";
  }
  function understoodHtml(rec){
    var u = understoodOf(rec.recId), st = understandStatus(rec), mine = rec.by === ME, html = "";
    if(st === "ready"){
      var src = u.source === "demo" ? "Sample write-up. In this demo the sound is a hummed stand-in, so these words are an example."
        : u.source === "you" ? (mine ? "Written by you." : "Written by " + SPACE.partner.name + ".") : "Written up by Pairlum.";
      html += (u.title ? '<p class="rec-title">' + escapeHtml(u.title) + '</p>' : "") + chipsHtml(u) +
        (u.transcript ? '<details class="rec-words"><summary>What was said</summary><p>' + escapeHtml(u.transcript) + '</p></details>' : "") +
        '<p class="rec-src">' + escapeHtml(src) + '</p>';
      if(!(u.source === "you" && mine)) return html;
    } else {
      var line = st === "sample" ? "A sample voice note. There is no recording behind it."
        : st === "pending" ? "Pairlum is writing this up."
        : st === "failed" ? "The write-up did not come through. It will be tried again."
        : st === "off" ? (mine ? "Not written up: you have not switched on write-ups for your recordings (Privacy)." : SPACE.partner.name + " has not switched on write-ups for their recordings.")
        : "No write-up yet. Automatic write-ups are not connected in this preview.";
      html += '<p class="rec-src">' + escapeHtml(line) + '</p>';
      if(st === "sample" || st === "pending") return html;
    }
    // The author can always say what a recording is about, in their own words. It is found by those words later.
    if(mine){
      var cur = u && u.source === "you" ? u : null;
      html += '<details class="rec-own"' + (cur ? "" : "") + '><summary>' + (cur ? "Change your words" : "Add a title and a few words, so you can find it later") + '</summary>' +
        '<label class="visually-hidden" for="t_' + escapeHtml(rec.recId) + '">Title</label>' +
        '<input type="text" class="imp-caption" id="t_' + escapeHtml(rec.recId) + '" maxlength="60" placeholder="A short title" value="' + escapeHtml(cur ? cur.title : "") + '" data-own-title>' +
        '<label class="visually-hidden" for="w_' + escapeHtml(rec.recId) + '">What it is about</label>' +
        '<textarea class="capture-textarea rec-own-words" id="w_' + escapeHtml(rec.recId) + '" maxlength="600" placeholder="What you said, or what it is about" data-own-words>' + escapeHtml(cur ? cur.transcript : "") + '</textarea>' +
        '<label class="visually-hidden" for="f_' + escapeHtml(rec.recId) + '">Feeling</label>' +
        '<select class="confirm-input rec-own-feel" id="f_' + escapeHtml(rec.recId) + '" data-own-feel><option value="">Feeling (optional)</option>' +
          Object.keys(U_FEELINGS).map(function(k){ return '<option value="' + k + '"' + (cur && cur.feeling === k ? " selected" : "") + '>' + escapeHtml(U_FEELINGS[k]) + '</option>'; }).join("") + '</select>' +
        '<button type="button" class="btn-ghost" data-own-save="' + escapeHtml(rec.recId) + '">Save these words</button></details>';
    }
    return html;
  }
  function recBlockHtml(rec, opts){
    var o = opts || {}, isClip = rec.kind === "clip";
    var head = (isClip ? "Clip" : "Voice") + (rec.secs ? " · " + comfortClock(rec.secs) : rec.dur ? " · " + rec.dur : "");
    var player = o.noPlayer ? "" : rec.sample ? ""
      : isClip ? '<video class="rec-video" controls playsinline preload="none" data-rec-media="' + escapeHtml(rec.recId) + '"></video>'
      : '<audio class="rec-audio" controls preload="none" data-rec-media="' + escapeHtml(rec.recId) + '"></audio>';
    return '<div class="rec" data-rec="' + escapeHtml(rec.recId) + '">' +
      '<p class="rec-head">' + (isClip ? "" : MIC_SVG) + '<span>' + escapeHtml((o.who ? personLabel(rec.by) + " · " : "") + head) + '</span>' + (o.when ? '<span class="rec-when">' + escapeHtml(o.when) + '</span>' : "") + '</p>' +
      player + understoodHtml(rec) + '</div>';
  }
  // Fills in players once their file has been found; a missing file is said plainly.
  function hydrateRecPlayers(root){
    root.querySelectorAll("[data-rec-media]").forEach(function(node){
      if(node.getAttribute("src")) return;
      var id = node.getAttribute("data-rec-media");
      mediaUrl(id, function(url){
        if(!document.contains(node)) return;
        if(url){ node.src = url; var poster = node.tagName === "VIDEO" ? posterFor(id, "") : ""; if(poster) node.poster = poster; }
        else node.outerHTML = '<p class="rec-src">This recording is not on this device.</p>';
      });
    });
  }

  /* ---- the moment sheet ---- */
  var momentState = { id: null, focus: null, voice: null, clip: null, recorder: null };
  function reactionOf(momentId, userId){
    if((DB.hearts[momentId] || {})[userId]) return "love";
    var r = (DB.reacts[momentId] || {})[userId];
    return REACTION_LABEL[r] ? r : "";
  }
  function openMoment(id, focusRecId){
    var m = momentById(id);
    if(!m){ showToast("That moment is not here any more."); return; }
    momentState = { id: id, focus: focusRecId || null, voice: null, clip: null, recorder: null };
    renderMoment();
    openOverlay("momentOverlay");
    if(focusRecId) window.setTimeout(function(){
      var el = document.querySelector('#momentOverlay [data-rec="' + (window.CSS && CSS.escape ? CSS.escape(focusRecId) : focusRecId) + '"]');
      if(el){ el.classList.add("is-found"); if(el.scrollIntoView) el.scrollIntoView({ block: "center" }); }
    }, 120);
  }
  function renderMoment(){
    var m = momentById(momentState.id), body = document.getElementById("momentBody");
    if(!m || !body) return;
    setText("momentTitle", personLabel(m.by) + " · " + momentWhenLabel(m));
    var recs = allRecordings().filter(function(r){ return r.momentId === m.id && r.role !== "reply"; });
    var main = recs.filter(function(r){ return r.role === "moment"; })[0], attached = recs.filter(function(r){ return r.role === "attached"; })[0];
    var html = "";
    if(m.type === "photo") html += '<div class="mv-media" id="momentMedia" data-moment-photo="' + escapeHtml(m.id) + '">' + (m.photo ? '<div class="photo photo--' + escapeHtml(m.photo) + ' moment-sample-photo"></div>' : '<span class="imp-nopreview">Finding the photo…</span>') + '</div>';
    else if(m.type === "video") html += main ? recBlockHtml(main) : '<div class="mv-media"><span class="imp-nopreview">This clip is not on this device.</span></div>';
    else if(m.type === "voice") html += main ? recBlockHtml(main) : "";
    else html += '<div class="mv-media"><p class="mv-text">“' + escapeHtml(m.text || m.caption || "") + '”</p></div>';
    var cap = m.type === "text" ? "" : (m.caption || "");
    if(cap && !(m.type === "voice" && cap === "Voice note")) html += '<p class="mv-caption">' + escapeHtml(cap) + '</p>';
    if(attached) html += '<div class="moment-attached"><p class="eyebrow">' + escapeHtml(m.by === ME ? "Your voice, with it" : SPACE.partner.name + "'s voice, with it") + '</p>' + recBlockHtml(attached) + '</div>';
    html += '<div class="moment-thread" id="momentThread" aria-live="polite"></div>';
    html += '<div class="moment-reply" id="momentReply"></div>';
    body.innerHTML = html;
    if(m.type === "photo" && !m.photo){
      mediaUrl(m.id, function(url){
        var host = document.getElementById("momentMedia");
        if(!host || host.getAttribute("data-moment-photo") !== m.id) return;
        host.innerHTML = url ? '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(m.caption || "Photo") + '">' : '<span class="imp-nopreview">This photo is not on this device.</span>';
      });
    }
    hydrateRecPlayers(body);
    renderMomentThread();
    renderMomentReply();
  }
  // The flat thread: reactions first, then every reply in the order it was sent.
  function renderMomentThread(){
    var host = document.getElementById("momentThread"), m = momentById(momentState.id);
    if(!host || !m) return;
    var open = {}; host.querySelectorAll("details[open]").forEach(function(d){ var r = d.closest("[data-rec]"); if(r) open[r.getAttribute("data-rec") + "|" + d.className] = 1; });
    var playing = {}; host.querySelectorAll("audio, video").forEach(function(a){ if(!a.paused) playing[a.getAttribute("data-rec-media")] = a.currentTime; });
    var list = repliesTo(m.id), html = "";
    var reacts = [ME, THEM].map(function(u){ var r = reactionOf(m.id, u); return r ? '<span class="thread-react">' + (r === "love" ? HEART_SVG : "") + escapeHtml(reactionLine(u, r)) + '</span>' : ""; }).join("");
    if(reacts) html += '<div class="thread-reacts">' + reacts + '</div>';
    if(list.length){
      var fmt = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short", hour:"numeric", minute:"2-digit", timeZone: spaceTz() });
      html += '<p class="eyebrow thread-title">Back and forth</p><ol class="thread-list">' + list.map(function(r){
        var rec = allRecordings().filter(function(x){ return x.recId === r.id; })[0];
        return '<li class="thread-item thread-item--' + (r.by === ME ? "me" : "them") + '">' + (rec ? recBlockHtml(rec, { who: true, when: fmt.format(new Date(r.at || 0)) }) : "") + '</li>';
      }).join("") + '</ol>';
    } else if(!reacts){
      html += '<p class="body-s thread-empty">' + escapeHtml(m.by === ME ? "No answer yet. When " + SPACE.partner.name + " replies, it is kept here with this moment." : "Answer with your voice, a short clip, or just a feeling. It is kept here with this moment.") + '</p>';
    }
    host.innerHTML = html;
    host.querySelectorAll("details").forEach(function(d){ var r = d.closest("[data-rec]"); if(r && open[r.getAttribute("data-rec") + "|" + d.className]) d.open = true; });
    hydrateRecPlayers(host);
  }
  function renderMomentReply(){
    var host = document.getElementById("momentReply"), m = momentById(momentState.id);
    if(!host || !m) return;
    var mineReact = reactionOf(m.id, ME), p = SPACE.partner.name, html = "";
    if(m.by !== ME){
      html += '<div class="reply-reacts" role="group" aria-label="A simple reaction">' + REACTIONS.map(function(r){
        var on = mineReact === r[0];
        return '<button type="button" class="reply-react' + (on ? " is-on" : "") + '" data-react="' + r[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + (r[0] === "love" ? HEART_SVG : "") + '<span>' + r[1] + '</span></button>';
      }).join("") + '</div>';
    }
    html +=
      '<div class="reply-actions">' +
        '<button type="button" class="capture-attach-btn reply-voice-btn" id="replyVoiceBtn">' + MIC_SVG + '<span id="replyVoiceLabel">' + (m.by === ME ? "Add your voice" : "Reply with your voice") + '</span></button>' +
        '<button type="button" class="capture-attach-btn" id="replyClipBtn"><span class="capture-record-dot" aria-hidden="true"></span><span id="replyClipLabel">' + (m.by === ME ? "Add a clip" : "Reply with a clip") + '</span></button>' +
        '<button type="button" class="ambient-link" id="replyClipPick">or choose a clip</button>' +
        '<input type="file" accept="video/*" id="replyClipInput" hidden>' +
      '</div>' +
      '<p class="body-s reply-note" id="replyNote">Voice up to ' + VOICE_MAX_SECONDS + ' seconds. Clips ' + CLIP_MIN_SECONDS + ' to ' + CLIP_MAX_SECONDS + ' seconds.</p>' +
      '<div class="reply-draft" id="replyDraft" hidden>' +
        '<video class="rec-video" id="replyLive" muted playsinline autoplay hidden></video>' +
        '<audio class="rec-audio" id="replyVoicePreview" controls hidden></audio>' +
        '<video class="rec-video" id="replyClipPreview" controls playsinline hidden></video>' +
        '<div class="capture-footer"><button type="button" class="btn-ghost" id="replyDiscard">Discard</button>' +
          '<button type="button" class="btn-primary" id="replySend" disabled>Send to ' + escapeHtml(p) + '</button></div>' +
      '</div>';
    host.innerHTML = html;
    wireMomentReply();
  }
  function clearReplyDraft(){
    ["voice", "clip"].forEach(function(k){ var d = momentState[k]; if(d && d.url && !d.sent){ try{ URL.revokeObjectURL(d.url); }catch(e){} } momentState[k] = null; });
  }
  function wireMomentReply(){
    var note = document.getElementById("replyNote"), draft = document.getElementById("replyDraft"), send = document.getElementById("replySend");
    var vBtn = document.getElementById("replyVoiceBtn"), vLabel = document.getElementById("replyVoiceLabel"), vPrev = document.getElementById("replyVoicePreview");
    var live = document.getElementById("replyLive"), cPrev = document.getElementById("replyClipPreview");
    var showDraft = function(kind){
      draft.hidden = false; send.disabled = false;
      vPrev.hidden = kind !== "voice"; cPrev.hidden = kind !== "clip";
    };
    var vRec = null, vSecs = 0;
    vBtn.addEventListener("click", function(){
      if(vRec && vRec.isActive()){ vRec.stop(); return; }
      if((vRec && vRec.isBusy()) || recordingIn("momentOverlay")) return;
      clearReplyDraft(); cPrev.hidden = true; send.disabled = true;
      vRec = makeRecorder({
        onStart: function(){ vSecs = 0; vBtn.classList.add("is-recording"); vLabel.textContent = "Recording… tap to stop"; draft.hidden = true; },
        onTick: function(sec){ vSecs = Math.min(sec, VOICE_MAX_SECONDS); note.textContent = comfortClock(vSecs) + " / " + comfortClock(VOICE_MAX_SECONDS); if(sec >= VOICE_MAX_SECONDS && vRec.isActive()) vRec.stop(); },
        onStop: function(blob, url){
          vBtn.classList.remove("is-recording"); vLabel.textContent = "Record it again";
          momentState.voice = { blob: blob, url: url, secs: Math.max(1, vSecs) };
          note.textContent = "Have a listen, then send it.";
          vPrev.src = url; showDraft("voice");
        },
        onError: function(msg){ vBtn.classList.remove("is-recording"); vLabel.textContent = "Reply with your voice"; note.textContent = msg; }
      }, { scope: "momentOverlay" });
      vRec.start();
    });
    var gotClip = function(blob, url, secs){
      clearReplyDraft();
      momentState.clip = { blob: blob, url: url, secs: secs };
      note.textContent = "Have a look, then send it.";
      cPrev.src = url; showDraft("clip");
    };
    makeClipRecorder({
      btn: document.getElementById("replyClipBtn"), label: document.getElementById("replyClipLabel"), timer: note, note: note, idleText: "Reply with a clip",
      live: function(stream){
        if(stream){ clearReplyDraft(); draft.hidden = false; send.disabled = true; vPrev.hidden = true; cPrev.hidden = true; live.hidden = false; live.srcObject = stream; }
        else { live.srcObject = null; live.hidden = true; }
      }
    }, "momentOverlay", gotClip);
    var input = document.getElementById("replyClipInput");
    document.getElementById("replyClipPick").addEventListener("click", function(){ if(!recordingIn("momentOverlay")) input.click(); });
    input.addEventListener("change", function(){
      var f = input.files && input.files[0];
      if(!f) return;
      var url = URL.createObjectURL(f);
      clipSeconds(url, function(secs){
        try{ input.value = ""; }catch(e){}
        if(secs !== null && secs > CLIP_MAX_SECONDS + 0.5){
          URL.revokeObjectURL(url);
          note.textContent = "That clip is " + Math.round(secs) + " seconds. Clips here are up to " + CLIP_MAX_SECONDS + " seconds: trim it in your gallery, or record one here.";
          return;
        }
        gotClip(f, url, secs === null ? 0 : Math.max(1, Math.round(secs)));
      });
    });
    document.getElementById("replyDiscard").addEventListener("click", function(){
      cancelRecordings("momentOverlay"); clearReplyDraft(); renderMomentReply();
    });
    send.addEventListener("click", function(){
      var kind = momentState.clip ? "clip" : momentState.voice ? "voice" : "", d = momentState.clip || momentState.voice;
      if(!kind || !d) return;
      send.disabled = true;
      sendReply(momentState.id, kind, d, function(ok){
        if(!ok){ send.disabled = false; return; } // the draft is still here to send again
        d.sent = true; momentState.voice = null; momentState.clip = null;
        renderMomentThread(); renderMomentReply(); refreshMomentBars(); renderMemoryTimeline();
        showToast("Sent. It is kept with this moment.");
      });
    });
    document.querySelectorAll("#momentReply [data-react]").forEach(function(btn){
      btn.addEventListener("click", function(){ setReaction(momentState.id, btn.getAttribute("data-react")); });
    });
  }
  // The file first; the reply appears only once the file is safely stored.
  function sendReply(momentId, kind, draft, cb){
    var id = uid("rp"), at = Date.now();
    idbPutMedia(id, draft.blob, function(err){
      if(err){ showToast("Couldn't save that on this device. It is still here: free some space and send again.", true); return cb(false); }
      var ok = mutate(function(db){
        if(!db.moments.some(function(m){ return m.id === momentId; })) return;
        db.replies.push({ id: id, to: momentId, by: ME, kind: kind, secs: draft.secs || 0, at: at, hasMedia: true });
      });
      if(!ok || !DB.replies.some(function(r){ return r.id === id; })){ idbDeleteMedia(id); if(ok) showToast("That moment is not here any more, so nothing was sent.", true); return cb(false); }
      MEDIA_URLS[id] = draft.url;
      markFirst("moment");
      sendToService({ recId: id, by: ME, kind: kind, at: at, caption: (momentById(momentId) || {}).caption || "" });
      cb(true);
    });
  }
  // One reaction per person per moment. Choosing the same one again takes it back.
  function setReaction(momentId, key){
    var cur = reactionOf(momentId, ME), next = cur === key ? "" : key;
    var ok = mutate(function(db){
      if(!db.hearts[momentId]) db.hearts[momentId] = {};
      if(!db.reacts[momentId]) db.reacts[momentId] = {};
      delete db.hearts[momentId][ME]; delete db.reacts[momentId][ME];
      if(next === "love") db.hearts[momentId][ME] = true;
      else if(next) db.reacts[momentId][ME] = next;
      if(!Object.keys(db.reacts[momentId]).length) delete db.reacts[momentId];
    });
    refreshHearts(); renderMomentThread(); renderMomentReply();
    if(ok && next) showToast(SPACE.partner.name + " will see it.");
  }
  function wireMoments(){
    // every "open this moment" button on the page, wherever it is drawn
    document.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("[data-open-moment]") : null;
      if(!b) return;
      var id = b.getAttribute("data-open-moment"), focus = b.getAttribute("data-focus-rec");
      if(b.closest("#voiceFindOverlay")) closeOverlay("voiceFindOverlay");
      openMoment(id, focus);
    });
    var body = document.getElementById("momentBody");
    if(body) body.addEventListener("click", function(e){
      var save = e.target.closest("[data-own-save]");
      if(!save) return;
      var recId = save.getAttribute("data-own-save"), box = save.closest(".rec-own");
      var rec = allRecordings().filter(function(r){ return r.recId === recId; })[0];
      if(!rec || rec.by !== ME) return; // only the person who made a recording can describe it
      var title = cleanText(box.querySelector("[data-own-title]").value, 60), words = cleanText(box.querySelector("[data-own-words]").value, 600);
      var feel = box.querySelector("[data-own-feel]").value;
      if(!title && !words){ showToast("Add a title or a few words first."); return; }
      var record = cleanUnderstood({ title: title, transcript: words, feeling: feel }, "you");
      if(!setUnderstood(recId, record)) return; // what was typed stays in the boxes
      var block = save.closest("[data-rec]");
      if(block){ var tmp = document.createElement("div"); tmp.innerHTML = recBlockHtml(rec, block.closest(".thread-item") ? { who: true } : {}); var fresh = tmp.firstChild; var media = block.querySelector("[data-rec-media]"), slot = fresh.querySelector("[data-rec-media]"); if(media && slot) slot.parentNode.replaceChild(media, slot); block.parentNode.replaceChild(fresh, block); }
      showToast("Saved. You can find it by these words.");
    });
  }

  /* ---- finding a voice again ---------------------------------------
     The sentence is read for: who spoke, a feeling, whether it is attached
     to a photo or clip, when, and the words that are left. Those words are
     matched against title, transcript, topics, people, events, and the
     captions around the recording. When the understanding service is
     connected its meaning-based ranking is merged in; without it this is
     word, feeling, person, date and attachment matching, and says so. */
  var FEEL_WORDS = {
    missing: ["miss","missing","missed","longing","lonely"], happy: ["happy","glad","joy","laughing","laugh","cheerful"],
    loving: ["love","loving","loved","tender"], calm: ["calm","peaceful","quiet","relaxed"], playful: ["playful","teasing","silly","joking","funny"],
    excited: ["excited","thrilled"], tired: ["tired","exhausted","sleepy"], worried: ["worried","anxious","nervous","scared"],
    rough: ["sad","rough","upset","crying","cry","low","hard day"]
  };
  var VF_STOP = ("a an and the of to in on at for from with about that this those these it is was were be been being do did does i me my mine we us our ours you your yours " +
    "find show give get play hear listen want need please can could would where when which what who whom how there then one some any all " +
    "voice voices note notes recording recordings recorded message messages talked talk talking said say says saying spoke speak telling told tell " +
    "attached attach photo photos picture pictures pic image clip clips video videos him her his hers he she they them their partner while during " +
    "last month year week today yesterday ago").split(" ");
  var VF_MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  function stemWord(w){
    w = w.toLowerCase();
    if(w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if(w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
    else if(w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  function wordsOf(text){ return (String(text || "").toLowerCase().match(/[a-z0-9À-￿']+/g) || []).map(function(w){ return w.replace(/'s$|'$/g, ""); }).filter(Boolean); }
  function parseVoiceQuery(q){
    var raw = " " + String(q || "").toLowerCase().replace(/[“”"?.,!]/g, " ") + " ", out = { who: "", feeling: "", media: "", from: 0, to: 0, words: [] };
    var me = SPACE.currentUser.name.toLowerCase(), them = [SPACE.partner.name, SPACE.partner.realName].filter(Boolean).map(function(x){ return x.toLowerCase(); });
    var has = function(re){ return re.test(raw); };
    // "she / he / her / his" is the other person; "I / my" is you. Names win over pronouns.
    if(them.some(function(n){ return raw.indexOf(" " + n + " ") > -1 || raw.indexOf(" " + n + "'s ") > -1; })) out.who = THEM;
    else if(raw.indexOf(" " + me + " ") > -1) out.who = ME;
    else if(has(/ (she|he|her|his|hers|him|partner) /)) out.who = THEM;
    else if(has(/ (i|my|mine|myself) /) && !has(/ (missing|miss|missed) me /)) out.who = ME;
    if(!out.who && has(/ (missing|miss|missed) me /)) out.who = THEM;
    Object.keys(FEEL_WORDS).forEach(function(f){ if(!out.feeling && FEEL_WORDS[f].some(function(w){ return raw.indexOf(" " + w + " ") > -1; })) out.feeling = f; });
    if(has(/ (photo|photos|picture|pictures|pic|image) /)) out.media = "photo";
    else if(has(/ (clip|clips|video|videos) /)) out.media = "video";
    // when
    var now = new Date(), y = (raw.match(/ (20\d\d) /) || [])[1], mi = -1;
    VF_MONTHS.forEach(function(mn, i){ if(raw.indexOf(" " + mn + " ") > -1 || raw.indexOf(" " + mn.slice(0, 3) + " ") > -1) mi = i; });
    if(mi === 4 && !/ in may | may 20\d\d | last may /.test(raw)) mi = -1; // "may" is usually not the month
    if(mi > -1){
      var yy = y ? Number(y) : (mi > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear());
      out.from = Date.UTC(yy, mi, 1) - 14 * 3600000; out.to = Date.UTC(yy, mi + 1, 1) + 14 * 3600000;
    } else if(y){ out.from = Date.UTC(Number(y), 0, 1) - 14 * 3600000; out.to = Date.UTC(Number(y) + 1, 0, 1) + 14 * 3600000; }
    else if(has(/ today /)){ out.from = spaceDayStart(); out.to = out.from + 86400000; }
    else if(has(/ yesterday /)){ out.to = spaceDayStart(); out.from = out.to - 86400000; }
    else if(has(/ last week /)){ out.to = Date.now(); out.from = out.to - 8 * 86400000; }
    else if(has(/ last month /)){ out.to = Date.now(); out.from = out.to - 31 * 86400000; }
    var skip = {}; VF_STOP.concat(VF_MONTHS, [me], them).forEach(function(w){ skip[w] = 1; });
    Object.keys(FEEL_WORDS).forEach(function(f){ FEEL_WORDS[f].forEach(function(w){ skip[w] = 1; }); });
    wordsOf(raw).forEach(function(w){ if(!skip[w] && !/^20\d\d$/.test(w) && w.length > 1){ var st = stemWord(w); if(out.words.indexOf(st) < 0) out.words.push(st); } });
    return out;
  }
  // Returns [{ rec, u, score, hits }] best first.
  function searchRecordings(q, pick){
    var f = parseVoiceQuery(q), p = pick || {};
    var who = p.who || f.who, feeling = p.feeling || f.feeling, media = p.media || f.media;
    var out = [];
    allRecordings().forEach(function(rec){
      if(rec.sample) return;
      var u = understoodOf(rec.recId); u = u && u.status === "ready" ? u : null;
      if(who && rec.by !== who) return;
      if(media && !(rec.related && rec.related.type === media) && !(media === "video" && rec.kind === "clip")) return;
      if(f.from && !(rec.at >= f.from && rec.at < f.to)) return;
      var fields = [[u && u.title, 5], [u && (u.topics || []).join(" "), 4], [u && (u.people || []).join(" "), 4], [u && (u.events || []).join(" "), 4], [u && (u.words || []).join(" "), 3],
                    [rec.related && rec.related.caption, 3], [rec.caption, 2], [u && u.transcript, 2]];
      var stems = fields.map(function(fl){ return wordsOf(fl[0]).map(stemWord); });
      var score = 0, hits = 0;
      f.words.forEach(function(w){
        var best = 0;
        stems.forEach(function(list, i){ if(list.indexOf(w) > -1) best = Math.max(best, fields[i][1]); });
        if(best){ score += best; hits++; }
      });
      if(f.words.length && !hits) return;
      if(feeling){
        var feels = !!u && (u.feeling === feeling || FEEL_WORDS[feeling].some(function(w){ return (" " + (u.transcript || "").toLowerCase() + " ").indexOf(" " + w + " ") > -1; }));
        if(!feels) return;
        score += u.feeling === feeling ? 6 : 3;
      }
      if(f.words.length > 1 && hits === f.words.length) score += 4; // every word found
      if(media && rec.role === "attached") score += 5;               // "the voice on that photo" means the one sent with it
      out.push({ rec: rec, u: u, score: score, hits: hits });
    });
    out.sort(function(x, y){ return y.score - x.score || y.rec.at - x.rec.at; });
    return out;
  }
  var voiceFind = { who: "", feeling: "", media: "", audio: null, playing: "", seq: 0, service: {} };
  function snippetFor(u, words){
    var t = (u && u.transcript) || "";
    if(!t) return "";
    var low = t.toLowerCase(), at = -1;
    words.forEach(function(w){ if(at < 0){ var i = low.indexOf(w); if(i > -1) at = i; } });
    var start = Math.max(0, (at < 0 ? 0 : at) - 40), cut = t.slice(start, start + 130);
    return (start > 0 ? "…" : "") + cut + (start + 130 < t.length ? "…" : "");
  }
  function renderVoiceFind(){
    var input = document.getElementById("voiceFindInput"), list = document.getElementById("voiceFindResults"), note = document.getElementById("voiceFindNote");
    if(!input || !list) return;
    var q = input.value, parsed = parseVoiceQuery(q), p = SPACE.partner.name;
    var all = allRecordings().filter(function(r){ return !r.sample; });
    // the filter chips: who, feelings that exist in this space, and what it is attached to
    var feelsHere = {}; all.forEach(function(r){ var u = understoodOf(r.recId); if(u && u.status === "ready" && u.feeling) feelsHere[u.feeling] = 1; });
    var chip = function(group, value, label, on){ return '<button type="button" class="period-chip vf-chip' + (on ? " is-selected" : "") + '" data-vf-' + group + '="' + value + '" aria-pressed="' + (on ? "true" : "false") + '">' + escapeHtml(label) + '</button>'; };
    var who = voiceFind.who || parsed.who, feeling = voiceFind.feeling || parsed.feeling, media = voiceFind.media || parsed.media;
    document.getElementById("voiceFindChips").innerHTML =
      '<div class="vf-row" role="group" aria-label="Who spoke">' + chip("who", "", "Anyone", !who) + chip("who", ME, "You", who === ME) + chip("who", THEM, p, who === THEM) + '</div>' +
      '<div class="vf-row" role="group" aria-label="Attached to">' + chip("media", "", "Any moment", !media) + chip("media", "photo", "On a photo", media === "photo") + chip("media", "video", "On a clip", media === "video") + '</div>' +
      (Object.keys(feelsHere).length ? '<div class="vf-row" role="group" aria-label="Feeling">' + chip("feeling", "", "Any feeling", !feeling) +
        Object.keys(U_FEELINGS).filter(function(k){ return feelsHere[k]; }).map(function(k){ return chip("feeling", k, U_FEELINGS[k], feeling === k); }).join("") + '</div>' : "");
    var res = searchRecordings(q, voiceFind);
    // meaning-based ranking from the service, when it is connected, lifts its matches to the top
    if(Object.keys(voiceFind.service).length){
      var byId = {}; res.forEach(function(r){ byId[r.rec.recId] = r; });
      Object.keys(voiceFind.service).forEach(function(id){
        if(byId[id]) byId[id].score += 20 * voiceFind.service[id];
        else { var rec = all.filter(function(x){ return x.recId === id; })[0]; if(rec && (!who || rec.by === who)){ var u = understoodOf(id); res.push({ rec: rec, u: u && u.status === "ready" ? u : null, score: 20 * voiceFind.service[id], hits: 0 }); } }
      });
      res.sort(function(x, y){ return y.score - x.score || y.rec.at - x.rec.at; });
    }
    var fmt = new Intl.DateTimeFormat("en-US", { day:"numeric", month:"short", year:"numeric", timeZone: spaceTz() });
    var shown = res.slice(0, 40);
    list.innerHTML = shown.map(function(r){
      var rec = r.rec, u = r.u, title = (u && u.title) || (rec.kind === "clip" ? "A clip" : rec.role === "reply" ? "A voice reply" : rec.related ? "A voice on a " + (rec.related.type === "video" ? "clip" : "photo") : "A voice note");
      var meta = [personLabel(rec.by), fmt.format(new Date(rec.at)), rec.secs ? comfortClock(rec.secs) : (rec.dur || "")];
      if(u && u.feeling) meta.push(U_FEELINGS[u.feeling]);
      var around = rec.role === "reply" ? "A reply" + (rec.caption ? " to “" + rec.caption + "”" : "") : rec.related ? "With a " + (rec.related.type === "video" ? "clip" : "photo") + (rec.related.caption ? ": “" + rec.related.caption + "”" : "") : "";
      var snip = snippetFor(u, parsed.words);
      return '<li class="vf-item">' +
        '<button type="button" class="vf-play" data-vf-play="' + escapeHtml(rec.recId) + '" data-vf-kind="' + rec.kind + '" aria-label="Play ' + escapeHtml(title) + '">' + (voiceFind.playing === rec.recId ? '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>' : '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>') + '</button>' +
        (rec.related ? '<span class="vf-thumb" data-vf-thumb="' + escapeHtml(rec.related.id) + '" data-vf-type="' + rec.related.type + '" aria-hidden="true"></span>' : "") +
        '<button type="button" class="vf-open" data-open-moment="' + escapeHtml(rec.momentId) + '" data-focus-rec="' + escapeHtml(rec.recId) + '">' +
          '<span class="vf-title">' + escapeHtml(title) + '</span>' +
          (snip ? '<span class="vf-snip">' + escapeHtml(snip) + '</span>' : "") +
          (around ? '<span class="vf-around">' + escapeHtml(around) + '</span>' : "") +
          '<span class="vf-meta">' + escapeHtml(meta.filter(Boolean).join(" · ")) + '</span>' +
        '</button></li>';
    }).join("");
    list.querySelectorAll("[data-vf-thumb]").forEach(function(slot){
      var id = slot.getAttribute("data-vf-thumb"), type = slot.getAttribute("data-vf-type"), m = momentById(id);
      if(m && m.photo){ slot.innerHTML = '<span class="photo photo--' + escapeHtml(m.photo) + '"></span>'; return; }
      var poster = type === "video" ? posterFor(id, "") : "";
      if(poster){ slot.innerHTML = '<img src="' + escapeHtml(poster) + '" alt="">'; return; }
      if(type === "video") return;
      mediaUrl(id, function(url){ if(url && document.contains(slot)) slot.innerHTML = '<img src="' + escapeHtml(url) + '" alt="">'; });
    });
    var bare = all.filter(function(r){ var u = understoodOf(r.recId); return !(u && u.status === "ready"); }).length;
    var asked = q.trim() || who || feeling || media;
    var lines = [];
    if(!all.length) lines.push("No voice notes or clips yet. Everything you two record will be findable here.");
    else if(!res.length) lines.push("Nothing matches that. Try a word from what was said, a name, a month, or a feeling.");
    else lines.push((asked ? res.length + (res.length === 1 ? " match" : " matches") : res.length + " recordings, newest first") + (res.length > shown.length ? " (showing " + shown.length + ")" : "") + ".");
    if(bare && all.length) lines.push(bare + (bare === 1 ? " recording has" : " recordings have") + " no write-up yet, so " + (bare === 1 ? "it" : "they") + " can only be found by person, date and what " + (bare === 1 ? "it is" : "they are") + " attached to.");
    lines.push(understandCfg() ? "Matching by meaning comes from Pairlum's understanding service." : "This preview matches words, feelings, people, dates and attachments. Matching by meaning needs the understanding service, which is not connected here.");
    note.innerHTML = lines.map(function(l){ return "<p>" + escapeHtml(l) + "</p>"; }).join("");
  }
  function askServiceSearch(){
    var cfg = understandCfg(), q = document.getElementById("voiceFindInput").value.trim(), seq = ++voiceFind.seq;
    voiceFind.service = {};
    if(!cfg || q.length < 3) return;
    fetch(cfg.url.replace(/\/+$/, "") + "/v1/search", { method: "POST", headers: copyInto({ "Content-Type": "application/json" }, serviceHeaders(cfg)), body: JSON.stringify({ spaceId: SPACE.spaceId, query: q, limit: 20 }) })
      .then(function(r){ if(!r.ok) throw new Error("service"); return r.json(); })
      .then(function(data){
        if(seq !== voiceFind.seq) return; // an older question's answer
        (data && Array.isArray(data.results) ? data.results : []).slice(0, 20).forEach(function(x){
          if(x && typeof x.recordingId === "string") voiceFind.service[x.recordingId] = Math.max(0, Math.min(1, Number(x.score) || 0));
        });
        renderVoiceFind();
      }).catch(function(){}); // word matching is already on screen
  }
  function stopVoiceFindAudio(){
    if(voiceFind.audio){ try{ voiceFind.audio.pause(); }catch(e){} }
    voiceFind.audio = null; voiceFind.playing = "";
  }
  function openVoiceFind(query){
    voiceFind.who = ""; voiceFind.feeling = ""; voiceFind.media = ""; voiceFind.service = {};
    var input = document.getElementById("voiceFindInput");
    input.value = query || "";
    renderVoiceFind();
    openOverlay("voiceFindOverlay");
    try{ input.focus({ preventScroll: true }); }catch(e){}
  }
  function wireVoiceFind(){
    var btn = document.getElementById("voiceFindBtn"), input = document.getElementById("voiceFindInput");
    if(!btn || !input) return;
    btn.addEventListener("click", function(){ openVoiceFind(""); });
    var timer = null;
    input.addEventListener("input", function(){
      voiceFind.service = {}; renderVoiceFind();
      window.clearTimeout(timer); timer = window.setTimeout(askServiceSearch, 450);
    });
    document.getElementById("voiceFindExamples").addEventListener("click", function(e){
      var b = e.target.closest("[data-vf-example]");
      if(!b) return;
      input.value = b.textContent; voiceFind.who = ""; voiceFind.feeling = ""; voiceFind.media = ""; voiceFind.service = {};
      renderVoiceFind(); askServiceSearch();
    });
    document.getElementById("voiceFindChips").addEventListener("click", function(e){
      var b = e.target.closest(".vf-chip");
      if(!b) return;
      ["who", "feeling", "media"].forEach(function(g){ if(b.hasAttribute("data-vf-" + g)) voiceFind[g] = b.getAttribute("data-vf-" + g); });
      renderVoiceFind();
    });
    document.getElementById("voiceFindResults").addEventListener("click", function(e){
      var b = e.target.closest("[data-vf-play]");
      if(!b) return;
      var id = b.getAttribute("data-vf-play");
      if(voiceFind.playing === id){ stopVoiceFindAudio(); renderVoiceFind(); return; }
      stopVoiceFindAudio();
      mediaUrl(id, function(url){
        if(!url){ showToast("This recording is not on this device."); return; }
        var a = new Audio(url); // a clip plays its sound here; open the moment to see it
        voiceFind.audio = a; voiceFind.playing = id;
        a.addEventListener("ended", function(){ if(voiceFind.audio === a){ stopVoiceFindAudio(); renderVoiceFind(); } });
        var started = a.play(); if(started && started.catch) started.catch(function(){ if(voiceFind.audio === a){ stopVoiceFindAudio(); renderVoiceFind(); } });
        renderVoiceFind();
      });
    });
  }
  function setExamplePhrases(){
    var host = document.getElementById("voiceFindExamples");
    if(!host) return;
    var p = SPACE.partner.name;
    host.innerHTML = ["when " + p + " talked about our trip", p + " missing me", "the voice on that sunset photo"].map(function(t){
      return '<button type="button" class="ambient-link" data-vf-example>' + escapeHtml(t) + '</button>';
    }).join("");
  }

  /* ---- Export and restore ------------------------------------------- */
  /* WHAT A BACKUP IS                                                      */
  /*  - One .zip: pairlum.json (everything written) plus the media files.  */
  /*  - Media included: photos, videos, voice notes, voice requests, both  */
  /*    hard-day messages, both "sound of my place" recordings, anything   */
  /*    still waiting to send, and kept originals of imported photos.      */
  /*  - Media left out on purpose, and listed in the file:                 */
  /*      * your partner's photos/videos when they have not allowed saving */
  /*        (their "Can X save it?" switches). Their own export has them.  */
  /*      * anything not on this device.                                   */
  /*  - A letter your partner sealed for a later day is exported without   */
  /*    its title or words. So the RECIPIENT's backup cannot bring that    */
  /*    letter back on an empty device; only the writer's backup can.      */
  /*  - Restore checks the whole file first and changes nothing if any     */
  /*    part is damaged. Media is written as a new set beside the current  */
  /*    one; the saved record is switched over last, in one step.          */
  var EXPORT_VERSION = 3;
  var RESTORE_MAX_BYTES = 1500 * 1048576; // larger files are refused rather than risk the phone running out of memory
  var CRC_TABLE = null;
  function crc32(u8){
    if(!CRC_TABLE){
      CRC_TABLE = [];
      for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC_TABLE[n] = c >>> 0; }
    }
    var crc = 0xFFFFFFFF;
    for(var i = 0; i < u8.length; i++) crc = CRC_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  // files: [{name, data:Uint8Array}] -> Blob (a plain, uncompressed zip any computer can open)
  function makeZip(files){
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    files.forEach(function(f){
      var name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + size;
    });
    var cdSize = 0; central.forEach(function(x){ cdSize += x.byteLength; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [e.buffer]), { type:"application/zip" });
  }
  /* Reads a zip made by makeZip. Every entry is bounds-checked and its
     checksum is recomputed. Returns { files } or { error }. A checksum shows
     the file was not damaged on the way; it does not prove who made it. */
  function readZip(buf){
    var bad = function(msg){ return { error: msg }; };
    try{
      var dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), len = buf.byteLength, i = len - 22;
      if(len < 22) return bad("It is too short to be a backup.");
      while(i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
      if(i < 0) return bad("It is not a zip file, or the end of it is missing.");
      var count = dv.getUint16(i + 10, true), cdSize = dv.getUint32(i + 12, true), p = dv.getUint32(i + 16, true), out = {};
      if(p + cdSize > len) return bad("Part of the file is missing.");
      for(var n = 0; n < count; n++){
        if(p + 46 > len || dv.getUint32(p, true) !== 0x02014b50) return bad("Its list of contents is damaged.");
        if(dv.getUint16(p + 10, true) !== 0) return bad("It was re-compressed by another program. Use the .zip exactly as Pairlum downloaded it.");
        var crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
        if(p + 46 + nl > len) return bad("Its list of contents is damaged.");
        var name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
        if(lo + 30 > len || dv.getUint32(lo, true) !== 0x04034b50) return bad("“" + name + "” is damaged.");
        var start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
        if(start + size > len) return bad("“" + name + "” is cut short.");
        if(Object.prototype.hasOwnProperty.call(out, name)) return bad("“" + name + "” appears twice.");
        var bytes = u8.subarray(start, start + size);
        if(crc32(bytes) !== crc) return bad("“" + name + "” is damaged (its checksum does not match).");
        out[name] = bytes;
        p += 46 + nl + xl + cl;
      }
      return { files: out };
    }catch(e){ return bad("It could not be read."); }
  }
  function mediaExt(type){
    type = String(type || "");
    if(/jpeg/.test(type)) return "jpg"; if(/png/.test(type)) return "png"; if(/webp/.test(type)) return "webp"; if(/heic|heif/.test(type)) return "heic";
    if(/mp4/.test(type)) return /audio/.test(type) ? "m4a" : "mp4"; if(/quicktime/.test(type)) return "mov";
    if(/webm/.test(type)) return "webm"; if(/ogg/.test(type)) return "ogg"; if(/mpeg/.test(type)) return "mp3"; if(/wav/.test(type)) return "wav";
    return "bin";
  }
  function isSealedForMe(l){ return l.by !== ME && !!l.openDate && spaceDayStart(l.openDate) > Date.now(); }
  // Who may save whose media. Each person's choice lives with the space, so the other side can honour it.
  function mediaPolicy(db, userId){
    var m = (db.prefs[userId] || {}).media;
    if(!m && userId === ME && typeof SPACE !== "undefined") m = { saveOriginals: SPACE.privacy.mediaPermissions.partnerCanSaveOriginals, downloadVideo: SPACE.privacy.mediaPermissions.partnerCanDownloadVideo };
    return { saveOriginals: !!(m && m.saveOriginals), downloadVideo: !(m && m.downloadVideo === false) };
  }
  /* Every media file the record refers to: [{id, kind, owner}].
     One list for export, restore checking and tests, so they cannot disagree. */
  function referencedMedia(db, queue){
    var out = [], seen = {}, demoMedia = window.PAIRLUM_DEMO_MEDIA || {};
    var add = function(id, kind, owner){ if(id && !seen[id]){ seen[id] = 1; out.push({ id: id, kind: kind, owner: owner }); } };
    db.moments.concat(db.memories).forEach(function(x){
      if(x.type === "text" || x.type === "note") return;
      if(x.demo && !demoMedia[x.id]) return;                 // a sample entry that never had a file
      if(x.hasMedia === false) return;
      add(x.id, x.type, x.by);
      if(x.hasOriginal) add("orig:" + x.id, "original", x.by);
    });
    db.requests.forEach(function(x){ if(x.hasVoice) add(x.id, "voice", x.by); });
    db.moments.forEach(function(x){ if(x.voice && x.voice.id && !(x.demo && !demoMedia[x.voice.id])) add(x.voice.id, "voice", x.by); });
    db.replies.forEach(function(x){ if(x.hasMedia !== false && (x.kind === "voice" || x.kind === "clip")) add(x.id, x.kind === "clip" ? "video" : "voice", x.by); });
    Object.keys(db.comfort).forEach(function(u){ if(db.comfort[u] && db.comfort[u].id) add(db.comfort[u].id, "voice", u); });
    Object.keys(db.ambient).forEach(function(u){ if(db.ambient[u] && db.ambient[u].id) add(db.ambient[u].id, "voice", u); });
    (queue || []).forEach(function(q){ if(q.hasMedia !== false && q.type !== "text") add(q.id, q.type, ME); });
    return out;
  }
  function withheldByOwner(db, m){
    if(m.owner === ME || !m.owner) return false;
    var pol = mediaPolicy(db, m.owner);
    if(m.kind === "photo" || m.kind === "original") return !pol.saveOriginals;
    if(m.kind === "video") return !pol.saveOriginals || !pol.downloadVideo;
    return false;
  }
  function buildExport(onStep, done){
    var db = JSON.parse(JSON.stringify(readShared())), sealed = 0;
    db.letters = db.letters.map(function(l){
      if(!isSealedForMe(l)) return l;
      sealed++;
      return { id:l.id, by:l.by, from:l.from, openDate:l.openDate, createdAt:l.createdAt, locked:true, state:l.state, sealedInExport:true };
    });
    delete db.ops;
    // Answer first, then see theirs: the export follows the same rule as Home, the archive and the Book.
    var todayKey = sharedDay(), hiddenAnswer = false;
    if(db.dq[todayKey] && !db.dq[todayKey][ME] && db.dq[todayKey][THEM]){ delete db.dq[todayKey][THEM]; db.dq[todayKey]._hiddenInExport = true; hiddenAnswer = true; }
    var settings = {};
    [["settings", userSettingsKey()], ["mood", MOOD_KEY], ["queue", QUEUE_META_KEY]].forEach(function(kv){ try{ var v = localStorage.getItem(kv[1]); if(v !== null) settings[kv[0]] = v; }catch(e){} });
    var refs = referencedMedia(db, loadQueueMeta()), files = [], media = [], missing = [], withheld = [], i = 0;
    function next(){
      if(i >= refs.length) return finish();
      var m = refs[i++];
      if(onStep) onStep(i, refs.length);
      if(withheldByOwner(db, m)){ withheld.push(m.id); return next(); }
      idbGetMedia(m.id, function(err, blob){
        if(err || !blob || !blob.arrayBuffer){ missing.push(m.id); return next(); }
        blob.arrayBuffer().then(function(ab){
          var name = "media/" + String(m.id).replace(/[^\w.-]/g, "_") + "." + mediaExt(blob.type);
          files.push({ name:name, data:new Uint8Array(ab) });
          media.push({ id:m.id, file:name, type:blob.type || "", size: ab.byteLength, kind: m.kind, owner: m.owner });
          next();
        }, function(){ missing.push(m.id); next(); });
      });
    }
    function finish(){
      var payload = {
        format: "pairlum-export", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), exportedBy: ME,
        notes: {
          sealedLetters: sealed,
          sealedLettersNote: sealed ? "Letters sealed for you are listed without their title or words. This file cannot bring them back on an empty device; the writer's own export can." : "",
          withheldMedia: withheld,
          withheldNote: withheld.length ? "Left out because the person who shared them has not allowed saving. Their own export includes them." : "",
          missingMedia: missing,
          hiddenAnswer: hiddenAnswer ? "Today's answer from your partner is left out because you have not answered yet." : ""
        },
        coverage: { referenced: refs.length, included: media.length, withheld: withheld.length, missing: missing.length },
        shared: db, deviceSettings: settings, media: media
      };
      var enc = new TextEncoder(), pn = SPACE.partner.name;
      var readme = "Pairlum export, made " + payload.exportedAt + "\r\n\r\n" +
        "pairlum.json   everything written in your space (moments, notes, letters, plans, answers, settings)\r\n" +
        "media/         " + media.length + " photo, video and voice file(s), named by the id used in pairlum.json\r\n\r\n" +
        (sealed ? sealed + " letter(s) sealed for a later day are listed without their words. They stay a surprise. This file cannot restore them on an empty device; " + pn + "'s own export can.\r\n" : "") +
        (withheld.length ? withheld.length + " of " + pn + "'s photo/video file(s) are not included, because " + pn + " has not switched on saving for you. " + pn + "'s own export includes them.\r\n" : "") +
        (missing.length ? missing.length + " file(s) were not on this device and could not be included. They are listed in pairlum.json under notes.missingMedia.\r\n" : "") +
        "\r\nTo put this back: Pairlum > Privacy > Restore from a backup, and choose this .zip file exactly as it was downloaded.\r\n";
      files.unshift({ name:"pairlum.json", data: enc.encode(JSON.stringify(payload, null, 2)) }, { name:"READ-ME.txt", data: enc.encode(readme) });
      done(makeZip(files), { media: media.length, missing: missing.length, sealed: sealed, withheld: withheld.length });
    }
    next();
  }
  function renderExportPanel(){
    var body = document.getElementById("privacyBody"), pn = escapeHtml(SPACE.partner.name);
    body.innerHTML =
      '<div class="confirm-panel">'+
        '<button class="overlay-back" type="button" id="exportBack">← Back</button>'+
        '<h4>Export your Pairlum</h4>'+
        '<p class="body-m">This downloads one .zip file with everything in your space: moments, notes, chapters, letters, plans, daily answers, “I could use…” requests and your settings, together with the photos, videos and voice recordings held on this device.</p>'+
        '<p class="body-s">Two things are left out on purpose. A letter '+pn+' sealed for a later day is exported still sealed, without its words. And '+pn+'’s photos and videos are only included if '+pn+' has switched on saving for you.</p>'+
        '<p class="body-s" id="exportStatusLine" style="margin-top:14px" aria-live="polite"></p>'+
        '<div class="confirm-actions"><button class="btn-primary" id="exportConfirmBtn" type="button">Prepare export</button></div>'+
      '</div>';
    document.getElementById("exportBack").addEventListener("click", renderPrivacyMain);
    document.getElementById("exportConfirmBtn").addEventListener("click", function(){
      var statusLine = document.getElementById("exportStatusLine"), btn = this;
      btn.disabled = true;
      statusLine.textContent = "Preparing your export…";
      buildExport(function(i, n){ statusLine.textContent = "Collecting photos, videos and voice… " + i + " of " + n; }, function(blob, info){
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "pairlum-export-" + spaceDayIso(Date.now()) + ".zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        btn.disabled = false;
        var plural = function(n, one, many){ return n + " " + (n === 1 ? one : many); };
        statusLine.textContent = "Your browser has been handed the file (" + (blob.size / 1048576).toFixed(1) + " MB, " + plural(info.media, "media file", "media files") + "). Look for it in your Downloads." +
          (info.withheld ? " " + plural(info.withheld, "file of " + SPACE.partner.name + "’s was", "files of " + SPACE.partner.name + "’s were") + " left out, because saving is not switched on for you." : "") +
          (info.sealed ? " " + plural(info.sealed, "sealed letter is", "sealed letters are") + " listed without words." : "") +
          (info.missing ? " " + plural(info.missing, "recording was", "recordings were") + " not on this device and could not be included." : "");
      });
    });
  }

  /* Checks a backup completely, without touching anything stored.
     Returns { errors:[], warnings:[], data, files }. Any error means no restore. */
  function inspectBackup(buf){
    var res = { errors: [], warnings: [], data: null, files: null };
    if(buf.byteLength > RESTORE_MAX_BYTES){ res.errors.push("It is larger than " + Math.round(RESTORE_MAX_BYTES / 1048576) + " MB, which is more than this device can safely load at once."); return res; }
    var z = readZip(buf);
    if(z.error){ res.errors.push(z.error); return res; }
    var files = z.files, data = null;
    if(!files["pairlum.json"]){ res.errors.push("It has no pairlum.json inside, so it is not a Pairlum export."); return res; }
    try{ data = JSON.parse(new TextDecoder().decode(files["pairlum.json"])); }catch(e){ res.errors.push("Its data file cannot be read."); return res; }
    if(!data || data.format !== "pairlum-export"){ res.errors.push("It is not a Pairlum export."); return res; }
    if(data.version !== 2 && data.version !== 3){ res.errors.push("It was made by a different version of Pairlum (format " + String(data.version) + "), which this version cannot restore."); return res; }
    if(!data.shared || typeof data.shared !== "object"){ res.errors.push("The space is missing from it."); return res; }
    var shape = inspectStored(JSON.stringify(data.shared));
    if(shape.damage){ res.errors.push(shape.damage === "version" ? "The space inside it is in a format this version does not know." : "The space inside it is malformed" + (shape.fields && shape.fields.length ? " (" + shape.fields.join(", ") + ")." : ".")); return res; }
    var db = fillSharedDefaults(JSON.parse(JSON.stringify(data.shared)));
    var okTime = function(v){ return v === undefined || v === null || (typeof v === "number" && isFinite(v)); };
    SHARED_ARRAYS.forEach(function(k){
      var ids = {};
      db[k].forEach(function(x, n){
        if(res.errors.length > 6) return;
        if(typeof x.id !== "string" || !x.id){ res.errors.push("An entry in “" + k + "” has no id (number " + (n + 1) + ")."); return; }
        // ids, authors and kinds are used inside the page's structure, so only plain values are accepted
        if(!/^[\w.:-]{1,80}$/.test(x.id)){ res.errors.push("An entry in “" + k + "” has an id that is not a plain identifier."); return; }
        if(x.by !== undefined && x.by !== "u_aarav" && x.by !== "u_mira"){ res.errors.push("An entry in “" + k + "” names an author this space does not have (" + x.id + ")."); return; }
        if((k === "moments" || k === "memories") && ["photo","video","voice","text","note"].indexOf(x.type) < 0){ res.errors.push("An entry in “" + k + "” has a kind Pairlum does not know (" + x.id + ")."); return; }
        if(ids[x.id]) res.errors.push("Two entries in “" + k + "” share the id " + x.id + ".");
        ids[x.id] = 1;
        if(!okTime(x.at) || !okTime(x.createdAt) || !okTime(x.sentAt)) res.errors.push("An entry in “" + k + "” has a time that is not a number (" + x.id + ").");
        if(k === "replies" && (typeof x.to !== "string" || ["voice","clip"].indexOf(x.kind) < 0)){ res.errors.push("A reply is not attached to a moment, or is of a kind Pairlum does not know (" + x.id + ")."); return; }
        if(k === "memories" && !validIso(x.date)) res.errors.push("A memory has a date that is not a real day (" + x.id + ").");
      });
    });
    if(!Array.isArray(data.media)){ res.errors.push("Its list of media files is missing."); return res; }
    var have = {};
    data.media.forEach(function(m){
      if(res.errors.length > 6) return;
      if(!m || typeof m.id !== "string" || typeof m.file !== "string"){ res.errors.push("Its list of media files is malformed."); return; }
      if(have[m.id]){ res.errors.push("The media file " + m.id + " is listed twice."); return; }
      have[m.id] = 1;
      if(!files[m.file]){ res.errors.push("The media file " + m.file + " is listed but not inside the zip."); return; }
      if(typeof m.size === "number" && files[m.file].length !== m.size) res.errors.push("The media file " + m.file + " is not the size it should be.");
    });
    if(res.errors.length) return res;
    // every file the record points to must be inside, or be named as left out
    var declared = {}, notes = data.notes || {};
    (notes.withheldMedia || []).concat(notes.missingMedia || []).forEach(function(id){ declared[id] = 1; });
    var queue = []; try{ queue = JSON.parse((data.deviceSettings || {}).queue || "[]") || []; }catch(e){}
    var unaccounted = referencedMedia(db, queue).filter(function(m){ return !have[m.id] && !declared[m.id]; });
    if(unaccounted.length){
      if(data.version >= 3) res.errors.push(unaccounted.length + " media file(s) the space refers to are neither inside the zip nor listed as left out, so the backup is incomplete.");
      else res.warnings.push(unaccounted.length + " recording(s) are not in this older backup (it did not include “sound of my place” recordings). They will show as not on this device unless they are already here.");
    }
    var sealedN = db.letters.filter(function(l){ return l.sealedInExport; }).length;
    if(sealedN) res.warnings.push(sealedN + " sealed letter(s) are in this backup without their words. If this device still holds them they are kept; on an empty device they come back only from the writer's backup.");
    if((notes.withheldMedia || []).length) res.warnings.push(notes.withheldMedia.length + " of your partner's photo/video file(s) are not in this backup. Those already on this device are kept.");
    if((notes.missingMedia || []).length) res.warnings.push(notes.missingMedia.length + " file(s) were already missing when the backup was made.");
    if(data.exportedBy && data.exportedBy !== ME) res.warnings.push("This backup was made on your partner's side. The space and media are restored; device settings and anything waiting to send are left as they are here.");
    res.data = data; res.files = files; res.db = db;
    return res;
  }
  /* Restores a checked backup. Order: (1) media into a new set beside the
     current one, all or nothing; (2) device settings, remembered so they can
     be put back; (3) the saved record, in one write. If any step fails, the
     earlier ones are undone and the space is exactly as it was. */
  function commitRestore(checked, onStep, done){
    var data = checked.data, files = checked.files;
    var gen = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var cur = RECOVERY ? null : readShared();
    var entries = data.media.map(function(m){ return { key: gen + ":" + m.id, blob: new Blob([files[m.file]], { type: m.type || "" }) }; });
    var stagedKeys = entries.map(function(e){ return e.key; });
    var undoMedia = function(then){ idbDeleteKeys(stagedKeys, function(){ then(); }); };
    onStep("Putting photos, videos and voice in place (" + entries.length + " files)…");
    idbPutMany(entries, function(err){
      if(err){
        return undoMedia(function(){ done("The media files could not all be stored on this device, so the restore was stopped. Your space, photos and recordings are exactly as they were. Free some space and try again."); });
      }
      var next = fillSharedDefaults(JSON.parse(JSON.stringify(data.shared)));
      // sealed letters came out without their words; keep the copy this device already holds
      var held = {}; if(cur) cur.letters.forEach(function(l){ held[l.id] = l; });
      next.letters = next.letters.map(function(l){ return l.sealedInExport ? (held[l.id] || l) : l; });
      // the same for today's answer that was held back from the export
      var otherUser = data.exportedBy === "u_mira" ? "u_aarav" : "u_mira";
      Object.keys(next.dq).forEach(function(k){
        var day = next.dq[k];
        if(!day || !day._hiddenInExport) return;
        delete day._hiddenInExport;
        if(cur && cur.dq[k] && cur.dq[k][otherUser]) day[otherUser] = cur.dq[k][otherUser];
      });
      next.mediaGens = [gen].concat(cur ? cur.mediaGens : []).slice(0, 8);
      next.mediaPrune = true;
      next.ops = [];
      next.epoch = Math.max((cur && cur.epoch) || 0, next.epoch || 0) + 1;
      next.rev = Math.max((cur && cur.rev) || 0, next.rev || 0) + 1;
      // device settings and the waiting-to-send list: only from my own backup
      var mine = !data.exportedBy || data.exportedBy === ME, ds = data.deviceSettings || {}, undo = [];
      var put = function(key, value){
        var old = null; try{ old = localStorage.getItem(key); }catch(e){}
        undo.push([key, old]);
        localStorage.setItem(key, value);
      };
      var rollBack = function(){ undo.reverse().forEach(function(kv){ try{ if(kv[1] === null) localStorage.removeItem(kv[0]); else localStorage.setItem(kv[0], kv[1]); }catch(e){} }); };
      try{
        if(window.__pairlumTestFailCommit) throw new Error("test: commit refused");
        if(mine){
          if(typeof ds.settings === "string") put(userSettingsKey(), ds.settings);
          if(typeof ds.mood === "string") put(MOOD_KEY, ds.mood);
          if(typeof ds.queue === "string") put(QUEUE_META_KEY, ds.queue);
        }
        if(RECOVERY && RECOVERY.raw !== null){ try{ localStorage.setItem(SHARED_KEY + ":unreadable-copy", RECOVERY.raw); }catch(e){ if(!RECOVERY.downloaded) throw new Error("keep-copy"); } }
        localStorage.setItem(SHARED_KEY, JSON.stringify(next)); // the one step that makes the restore real
      }catch(e){
        rollBack();
        return undoMedia(function(){
          done(e && e.message === "keep-copy"
            ? "Download the unreadable data first (the button above), so nothing is lost. Nothing was changed."
            : "The restore could not be saved on this device, so it was stopped. Your space, photos and recordings are exactly as they were.");
        });
      }
      done(null);
    });
  }
  function mountRestoreUi(host, idp){
    host.innerHTML =
      '<label class="visually-hidden" for="'+idp+'File">Choose a Pairlum export</label>'+
      '<input type="file" id="'+idp+'File" accept=".zip,application/zip" class="confirm-input" style="padding:10px">'+
      '<div class="body-s" id="'+idp+'Status" style="margin-top:14px" aria-live="polite"></div>'+
      '<div class="confirm-actions"><button class="btn-primary" id="'+idp+'Go" type="button" disabled>Restore this backup</button></div>';
    var status = document.getElementById(idp + "Status"), go = document.getElementById(idp + "Go"), checked = null;
    var say = function(lines){ status.innerHTML = lines.map(function(l){ return "<p>" + escapeHtml(l) + "</p>"; }).join(""); };
    document.getElementById(idp + "File").addEventListener("change", function(){
      var f = this.files && this.files[0];
      checked = null; go.disabled = true;
      if(!f) return;
      if(f.size > RESTORE_MAX_BYTES){ say(["That file cannot be used. It is larger than " + Math.round(RESTORE_MAX_BYTES / 1048576) + " MB, which is more than this device can safely load at once. Nothing was changed."]); return; }
      say(["Checking the whole file before anything is changed…"]);
      f.arrayBuffer().then(function(buf){
        var r = inspectBackup(buf);
        if(r.errors.length){ say(["That file cannot be used. " + r.errors[0] + " Nothing was changed."].concat(r.errors.slice(1, 4))); return; }
        checked = r;
        var d = r.db;
        say(["Backup from " + new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long", year:"numeric", hour:"numeric", minute:"2-digit" }).format(new Date(r.data.exportedAt)) +
          ": " + d.moments.length + " moments, " + d.memories.length + " memories, " + d.letters.length + " letters, " + d.notes.length + " notes, " + r.data.media.length + " media files. The file is intact. Anything added since then will be replaced."].concat(r.warnings));
        go.disabled = false;
      }, function(){ say(["Couldn't read that file. Nothing was changed."]); });
    });
    go.addEventListener("click", function(){
      if(!checked) return;
      go.disabled = true;
      commitRestore(checked, function(msg){ say([msg]); }, function(err){
        if(err){ say([err]); go.disabled = false; return; }
        say(["Restored. Reloading…"]);
        window.setTimeout(function(){ location.reload(); }, 700);
      });
    });
  }
  function renderRestorePanel(){
    var body = document.getElementById("privacyBody");
    body.innerHTML =
      '<div class="confirm-panel">'+
        '<button class="overlay-back" type="button" id="restoreBack">← Back</button>'+
        '<h4>Restore from a backup</h4>'+
        '<p class="body-m">Choose a Pairlum export (.zip) you downloaded earlier. The whole file is checked first. Restoring then replaces what is in this space on this device with what is in that file.</p>'+
        '<p class="body-s">A letter you are still writing is kept. If the restore cannot finish, everything stays exactly as it is now.</p>'+
        '<div id="restoreHost"></div>'+
      '</div>';
    document.getElementById("restoreBack").addEventListener("click", renderPrivacyMain);
    mountRestoreUi(document.getElementById("restoreHost"), "restore");
  }
  // After a restore has loaded successfully: files the new set replaced are cleared away.
  function pruneOldMedia(){
    if(!DB.mediaPrune || DB.mediaGens.length === 0) return;
    var newest = DB.mediaGens[0] + ":";
    idbAllKeys(function(err, keys){
      if(err) return;
      var fresh = {}, drop = [];
      keys.forEach(function(k){ if(k.indexOf(newest) === 0) fresh[k.slice(newest.length)] = 1; });
      keys.forEach(function(k){
        if(k.indexOf(newest) === 0) return;
        var m = /^(g[a-z0-9]+):(.*)$/.exec(k), id = m ? m[2] : k;
        if(fresh[id]) drop.push(k);
      });
      var finish = function(){ mutate(function(db){ delete db.mediaPrune; }, { evenIfPaused: true }); };
      if(!drop.length) return finish();
      idbDeleteKeys(drop, function(e){ if(!e) finish(); });
    });
  }

  /* ---- When the saved space cannot be read ---------------------------- */
  /* Nothing is overwritten. The app behind this screen shows a sample and  */
  /* cannot save. The person chooses: keep a copy, restore a backup, or     */
  /* knowingly start again.                                                 */
  function showRecoveryScreen(){
    if(!RECOVERY || document.getElementById("recoveryScreen")) return;
    MODAL_BACKGROUND.forEach(function(sel){ var n = document.querySelector(sel); if(n) setInert(n, true); });
    document.querySelectorAll(".overlay").forEach(function(o){ o.classList.remove("is-open"); });
    var why = RECOVERY.reason === "version" ? "It was saved by a different version of Pairlum (format " + escapeHtml(String(RECOVERY.v)) + ")."
      : RECOVERY.reason === "shape" ? "Part of it is not in the form Pairlum expects (" + escapeHtml(RECOVERY.fields.join(", ")) + ")."
      : "The saved data is damaged and cannot be opened.";
    var box = document.createElement("div");
    box.id = "recoveryScreen"; box.className = "recovery-screen";
    box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "recoveryTitle");
    box.innerHTML =
      '<div class="recovery-card">'+
        '<h2 class="disp-3" id="recoveryTitle" tabindex="-1">Pairlum could not read your space on this device</h2>'+
        '<p class="body-m">'+why+' <b>Nothing has been deleted or replaced.</b> What is saved is still here, untouched, and Pairlum will not write over it.</p>'+
        '<div class="recovery-step"><h3>1. Keep a copy of what is here</h3>'+
          '<p class="body-s">This saves the unreadable data as a file, so it can be looked at or repaired later.</p>'+
          '<button class="btn-ghost" id="recoveryDownload" type="button">Download the unreadable data</button> <span class="body-s" id="recoveryDownloadNote" aria-live="polite"></span></div>'+
        '<div class="recovery-step"><h3>2. Restore from a backup</h3>'+
          '<p class="body-s">If you have a Pairlum export (.zip), choose it here.</p><div id="recoveryRestoreHost"></div></div>'+
        '<div class="recovery-step"><h3>Or start a new, empty space</h3>'+
          '<p class="body-s">Only after you have downloaded the copy above. Your old data stays in that file.</p>'+
          '<button class="btn-danger" id="recoveryFresh" type="button" disabled>Start a new space</button></div>'+
        '<p class="body-s">Need help? Write to pairlum.co@gmail.com.</p>'+
      '</div>';
    document.body.appendChild(box);
    mountRestoreUi(document.getElementById("recoveryRestoreHost"), "recoveryRestore");
    document.getElementById("recoveryDownload").addEventListener("click", function(){
      var blob = new Blob([RECOVERY.raw === null ? "" : RECOVERY.raw], { type: "text/plain" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "pairlum-unreadable-" + new Date().toISOString().slice(0, 10) + ".txt";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
      RECOVERY.downloaded = true;
      setText("recoveryDownloadNote", "Handed to your browser. Look in your Downloads.");
      document.getElementById("recoveryFresh").disabled = false;
    });
    document.getElementById("recoveryFresh").addEventListener("click", function(){
      if(!RECOVERY.downloaded) return;
      try{ localStorage.setItem(SHARED_KEY + ":unreadable-copy", RECOVERY.raw === null ? "" : RECOVERY.raw); }catch(e){}
      try{ localStorage.removeItem(SHARED_KEY); }catch(e){ return; }
      location.reload();
    });
    try{ document.getElementById("recoveryTitle").focus(); }catch(e){}
    box.addEventListener("keydown", function(e){
      if(e.key !== "Tab") return;
      var f = focusablesIn(box); if(!f.length) return;
      if(e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
    });
  }

  function renderDeleteConfirm(){
    var body = document.getElementById("privacyBody");
    body.innerHTML =
      '<div class="confirm-panel">'+
        '<button class="overlay-back" type="button" id="deleteBack">← Back</button>'+
        '<h4>Delete your account</h4>'+
        '<p class="body-m">This is permanent. In the full product, this removes your access entirely and lets '+escapeHtml(SPACE.partner.name)+' know your account was deleted; your shared history\'s fate follows the same rules as disconnecting.</p>'+
        '<p class="body-s">This prototype has no server. Confirming removes what is yours from this device: your profile, the moments, notes, letters, memories and plans you added, your recordings, and this device\'s settings. Everything '+escapeHtml(SPACE.partner.name)+' added, including their photos and voice notes, stays.</p>'+
        '<label class="body-s" style="display:block;margin-top:14px">Type <b>DELETE</b> to confirm</label>'+
        '<input type="text" class="confirm-input" id="deleteConfirmInput" autocomplete="off">'+
        '<div class="confirm-actions">'+
          '<button class="btn-ghost" id="deleteCancelBtn" type="button">Never mind</button>'+
          '<button class="btn-danger-solid" id="deleteConfirmBtn" type="button" disabled>Delete my account</button>'+
        '</div>'+
      '</div>';
    document.getElementById("deleteBack").addEventListener("click", renderPrivacyMain);
    document.getElementById("deleteCancelBtn").addEventListener("click", renderPrivacyMain);
    var input = document.getElementById("deleteConfirmInput");
    var confirmBtn = document.getElementById("deleteConfirmBtn");
    input.addEventListener("input", function(){ confirmBtn.disabled = input.value.trim() !== "DELETE"; });
    confirmBtn.addEventListener("click", function(){
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Deleting…";
      liveShutdown(); cancelRecordings(); // nothing keeps listening while an account is removed
      // 1. Work out which files are mine, from what is saved right now.
      var mineMedia = [];
      DB.moments.concat(DB.memories).forEach(function(x){ if(x.by === ME && !x.demo) mineMedia.push(x.id); });
      DB.memories.forEach(function(x){ if(x.by === ME && x.hasOriginal) mineMedia.push("orig:" + x.id); });
      DB.requests.forEach(function(x){ if(x.by === ME && x.hasVoice) mineMedia.push(x.id); });
      DB.moments.forEach(function(x){ if(x.by === ME && x.voice && x.voice.id) mineMedia.push(x.voice.id); });
      DB.replies.forEach(function(x){ if(x.by === ME && x.hasMedia !== false) mineMedia.push(x.id); });
      var myRecordings = allRecordings().filter(function(r){ return r.by === ME; }).map(function(r){ return r.recId; });
      if(DB.comfort && DB.comfort[ME]) mineMedia.push(DB.comfort[ME].id);
      if(DB.ambient[ME]) mineMedia.push(DB.ambient[ME].id);
      CAPTURE_QUEUE.forEach(function(q){ mineMedia.push(q.id); });
      // 2. Remove my records. If this does not save, nothing else is touched.
      var removed = mutate(function(db){
        delete db.profiles[ME];
        if(db.comfort) delete db.comfort[ME];
        if(db.dna.people) delete db.dna.people[ME];
        SHARED_ARRAYS.forEach(function(k){
          db[k] = db[k].filter(function(x){ return x.by !== ME || x.demo; });
        });
        delete db.ambient[ME];
        delete db.prefs[ME];
        delete db.sleep[ME];
        delete db.facts[ME];
        myRecordings.forEach(function(id){ delete db.understood[id]; }); // the words go with the recordings
        ["feel","dq","hearts","reacts"].forEach(function(k){
          Object.keys(db[k]).forEach(function(key){ if(db[k][key] && typeof db[k][key] === "object") delete db[k][key][ME]; });
        });
        db.epoch = (db.epoch || 0) + 1;
      }, { evenIfPaused: true });
      if(!removed){
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Delete my account";
        showToast("Your account was not deleted, because the change could not be saved. Nothing was removed.", true);
        return;
      }
      RECENT_OPS = [];
      forgetAtService(myRecordings);
      // 3. Only now the files, and everything private to me on this device.
      var failedFiles = 0, left = mineMedia.length;
      var finish = function(){
        [userSettingsKey(), QUEUE_META_KEY, NEED_REQUESTS_KEY, NOTES_KEY, LETTERS_KEY, DATE_REMINDER_DISMISSED_KEY, MOOD_KEY, HEARTS_KEY,
         FEEL_KEY, SOMEDAY_KEY, INBOX_KEY, REMINDED_KEY, LETTER_DRAFT_KEY, DQ_DRAFT_KEY].forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
        closeOverlay("privacyOverlay");
        showToast(failedFiles
          ? "Your account and everything you added were removed. " + failedFiles + " of your files could not be erased just now; Pairlum will try again when it next opens. " + SPACE.partner.name + "'s things are untouched."
          : "Your account, your moments and your media have been removed from this device. " + SPACE.partner.name + "'s are untouched.", true);
        // Reload so every in-memory structure resets from storage.
        window.setTimeout(function(){ window.location.reload(); }, 1600);
      };
      idbDeleteKeys(["letterdraft:" + ME]);
      if(!left) return finish();
      mineMedia.forEach(function(id){
        var done = function(err){ if(err) failedFiles++; if(--left === 0) finish(); };
        if(id.indexOf("orig:") === 0) idbDeleteKeys([id], done); else idbDeleteMedia(id, done);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Settings — sound / reduced motion / simulate-offline toggles        */
  /* ------------------------------------------------------------------ */
  function syncSoundSettingsRow(){
    var soundBtn = document.getElementById("soundToggle");
    if(!soundBtn) return;
    var chev = soundBtn.querySelector(".chev");
    if(chev) chev.textContent = (SPACE.sound?"On":"Off") + " →";
  }

  function wireSettingsToggles(){
    var soundBtn = document.getElementById("soundToggle");
    if(soundBtn){
      syncSoundSettingsRow();
      soundBtn.addEventListener("click", function(){
        SPACE.sound = !SPACE.sound;
        saveSpaceSettings();
        syncSoundSettingsRow();
        showToast(SPACE.sound ? "Sound turned on." : "Sound turned off.");
      });
    }
    var motionBtn = document.getElementById("reducedMotionToggle");
    if(motionBtn){
      var motionChev = motionBtn.querySelector(".chev");
      function renderMotion(){
        var on = document.body.classList.contains("reduced-motion");
        if(motionChev) motionChev.textContent = (on?"On":"Off") + " →";
      }
      renderMotion();
      motionBtn.addEventListener("click", function(){
        var on = document.body.classList.toggle("reduced-motion");
        SPACE.reducedMotionOverride = on ? "on" : "off";
        saveSpaceSettings();
        renderMotion();
        showToast(on ? "Reduced motion turned on." : "Reduced motion turned off.");
      });
    }
    var simBtn = document.getElementById("simulateOfflineToggle");
    if(simBtn){
      function renderSim(){
        var chev = simBtn.querySelector(".chev");
        if(chev) chev.textContent = (SPACE.simulateOffline?"On":"Off") + " →";
      }
      renderSim();
      simBtn.addEventListener("click", function(){
        SPACE.simulateOffline = !SPACE.simulateOffline;
        saveSpaceSettings();
        renderSim();
        showToast(SPACE.simulateOffline ? "Simulating offline — new moments will queue." : "Back online — queued moments will now share.");
        if(!SPACE.simulateOffline){ flushQueue(); flushPendingNeedRequests(); }
      });
    }
  }

  /* ================================================================== */
  /* SETTINGS · NOTIFICATIONS · CUSTOMIZE · OUR DNA                      */
  /*                                                                    */
  /* Where each thing is kept:                                           */
  /*   · on this device, for you only  → SPACE.notif / .custom / .perf   */
  /*     (how news reaches you, how Pairlum looks) and the bell's list   */
  /*   · in the shared space, for both → DB.profiles, DB.relStart,       */
  /*     DB.membership, DB.dna                                           */
  /* ================================================================== */
  function copyObj(o){ var c = {}; Object.keys(o || {}).forEach(function(k){ c[k] = o[k]; }); return c; }
  function clock12(){ return !(SPACE.custom && SPACE.custom.clock === "24"); }
  function importMaxDim(){
    var q = SPACE.perf && SPACE.perf.photoQuality;
    return q === "high" ? 2400 : q === "saver" ? 1080 : IMPORT_MAX_DIM;
  }
  function overlayOpen(id){ var o = document.getElementById(id); return !!o && o.classList.contains("is-open"); }
  function switchOverlay(from, to, render){
    closeOverlay(from);
    if(render) render();
    openOverlay(to);
  }
  // A row of pick-one chips. `opts` is [[value, label], …].
  function chipRow(name, opts, current){
    return '<div class="opt-row" role="radiogroup" data-opt-group="'+name+'">' + opts.map(function(o){
      var on = o[0] === current;
      return '<button type="button" class="opt-chip'+(on ? " is-selected" : "")+'" role="radio" aria-checked="'+(on ? "true" : "false")+'" data-opt="'+escapeHtml(o[0])+'">'+escapeHtml(o[1])+'</button>';
    }).join("") + '</div>';
  }
  function wireChipRow(root, name, onPick){
    var row = root.querySelector('[data-opt-group="'+name+'"]');
    if(!row) return;
    row.addEventListener("click", function(e){
      var chip = e.target.closest("[data-opt]");
      if(!chip) return;
      row.querySelectorAll("[data-opt]").forEach(function(c){
        var on = c === chip;
        c.classList.toggle("is-selected", on);
        c.setAttribute("aria-checked", on ? "true" : "false");
      });
      onPick(chip.getAttribute("data-opt"));
    });
  }
  function longDate(iso){
    var p = String(iso).split("-");
    return new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long", year:"numeric" }).format(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  }

  /* ------------------------------------------------------------------ */
  /* PROFILE — each of you keeps your own; both of you can see both.     */
  /* ------------------------------------------------------------------ */
  // Cities Pairlum can place on the map: name, time zone, latitude, longitude.
  // Any other city still works — you pick its time zone, and the distance
  // line simply isn't shown, because Pairlum won't guess it.
  var CITIES = [
    ["Ahmedabad","Asia/Kolkata",23.02,72.57],["Mumbai","Asia/Kolkata",19.08,72.88],["Delhi","Asia/Kolkata",28.61,77.21],
    ["Bengaluru","Asia/Kolkata",12.97,77.59],["Hyderabad","Asia/Kolkata",17.39,78.49],["Chennai","Asia/Kolkata",13.08,80.27],
    ["Kolkata","Asia/Kolkata",22.57,88.36],["Pune","Asia/Kolkata",18.52,73.86],["Surat","Asia/Kolkata",21.17,72.83],
    ["Vadodara","Asia/Kolkata",22.31,73.18],["Rajkot","Asia/Kolkata",22.30,70.80],["Jaipur","Asia/Kolkata",26.91,75.79],
    ["Chandigarh","Asia/Kolkata",30.73,76.78],["Kochi","Asia/Kolkata",9.93,76.27],["Lucknow","Asia/Kolkata",26.85,80.95],
    ["Melbourne","Australia/Melbourne",-37.81,144.96],["Sydney","Australia/Sydney",-33.87,151.21],["Brisbane","Australia/Brisbane",-27.47,153.03],
    ["Perth","Australia/Perth",-31.95,115.86],["Adelaide","Australia/Adelaide",-34.93,138.60],["Auckland","Pacific/Auckland",-36.85,174.76],
    ["London","Europe/London",51.51,-0.13],["Manchester","Europe/London",53.48,-2.24],["Dublin","Europe/Dublin",53.35,-6.26],
    ["Berlin","Europe/Berlin",52.52,13.41],["Munich","Europe/Berlin",48.14,11.58],["Hamburg","Europe/Berlin",53.55,9.99],
    ["Paris","Europe/Paris",48.86,2.35],["Amsterdam","Europe/Amsterdam",52.37,4.90],["Brussels","Europe/Brussels",50.85,4.35],
    ["Madrid","Europe/Madrid",40.42,-3.70],["Barcelona","Europe/Madrid",41.39,2.17],["Lisbon","Europe/Lisbon",38.72,-9.14],
    ["Rome","Europe/Rome",41.90,12.50],["Milan","Europe/Rome",45.46,9.19],["Zurich","Europe/Zurich",47.38,8.54],
    ["Vienna","Europe/Vienna",48.21,16.37],["Stockholm","Europe/Stockholm",59.33,18.07],["Copenhagen","Europe/Copenhagen",55.68,12.57],
    ["Warsaw","Europe/Warsaw",52.23,21.01],["Istanbul","Europe/Istanbul",41.01,28.98],
    ["New York","America/New_York",40.71,-74.01],["Boston","America/New_York",42.36,-71.06],["Toronto","America/Toronto",43.65,-79.38],
    ["Chicago","America/Chicago",41.88,-87.63],["Austin","America/Chicago",30.27,-97.74],["Dallas","America/Chicago",32.78,-96.80],
    ["Denver","America/Denver",39.74,-104.99],["Los Angeles","America/Los_Angeles",34.05,-118.24],["San Francisco","America/Los_Angeles",37.77,-122.42],
    ["Seattle","America/Los_Angeles",47.61,-122.33],["Vancouver","America/Vancouver",49.28,-123.12],["Mexico City","America/Mexico_City",19.43,-99.13],
    ["São Paulo","America/Sao_Paulo",-23.55,-46.63],["Buenos Aires","America/Argentina/Buenos_Aires",-34.60,-58.38],
    ["Dubai","Asia/Dubai",25.20,55.27],["Abu Dhabi","Asia/Dubai",24.45,54.38],["Doha","Asia/Qatar",25.29,51.53],
    ["Riyadh","Asia/Riyadh",24.71,46.68],["Singapore","Asia/Singapore",1.35,103.82],["Kuala Lumpur","Asia/Kuala_Lumpur",3.14,101.69],
    ["Bangkok","Asia/Bangkok",13.76,100.50],["Hong Kong","Asia/Hong_Kong",22.32,114.17],["Tokyo","Asia/Tokyo",35.68,139.69],
    ["Seoul","Asia/Seoul",37.57,126.98],["Shanghai","Asia/Shanghai",31.23,121.47],["Manila","Asia/Manila",14.60,120.98],
    ["Jakarta","Asia/Jakarta",-6.21,106.85],["Kathmandu","Asia/Kathmandu",27.72,85.32],["Dhaka","Asia/Dhaka",23.81,90.41],
    ["Colombo","Asia/Colombo",6.93,79.86],["Karachi","Asia/Karachi",24.86,67.01],["Lahore","Asia/Karachi",31.55,74.34],
    ["Nairobi","Africa/Nairobi",-1.29,36.82],["Lagos","Africa/Lagos",6.52,3.38],["Cairo","Africa/Cairo",30.04,31.24],
    ["Johannesburg","Africa/Johannesburg",-26.20,28.05],["Cape Town","Africa/Johannesburg",-33.92,18.42]
  ];
  function findCity(name){
    var want = String(name || "").trim().toLowerCase();
    return CITIES.filter(function(c){ return c[0].toLowerCase() === want; })[0] || null;
  }
  function timeZoneList(){
    try{ if(Intl.supportedValuesOf) return Intl.supportedValuesOf("timeZone"); }catch(e){}
    var seen = {}, out = [];
    CITIES.forEach(function(c){ if(!seen[c[1]]){ seen[c[1]] = true; out.push(c[1]); } });
    return out.sort();
  }
  // Who each of you is: the starting demo couple, with whatever you've each
  // changed laid over the top. Runs every time the shared record is read.
  function applyProfiles(){
    var base = defaultSpace();
    var mine = ME === "u_aarav" ? base.currentUser : base.partner;
    var theirs = ME === "u_aarav" ? base.partner : base.currentUser;
    var fill = function(start, saved){
      var o = copyObj(start);
      Object.keys(saved || {}).forEach(function(k){ o[k] = saved[k]; });
      o.initial = String(o.name || "?").trim().charAt(0).toUpperCase() || "?";
      return o;
    };
    SPACE.currentUser = fill(mine, DB.profiles[ME]);
    SPACE.partner = fill(theirs, DB.profiles[THEM]);
    // What you call them — only on your own device, never changes their name.
    SPACE.partner.realName = SPACE.partner.name;
    var nick = String((SPACE.custom && SPACE.custom.nick) || "").trim();
    if(nick) SPACE.partner.name = nick;
    SPACE.relationshipStart = validIso(DB.relStart) ? DB.relStart : base.relationshipStart;
  }
  // After a change that touches names, cities or dates: repaint everything.
  function refreshEverything(){
    rebuildFromShared();
    renderShared();
    renderNeedRequestOptions();
    tickClocks();
    renderTodayLabel();
    wireViewingAs();
  }
  function renderProfileOverlay(){
    var body = document.getElementById("profileBody");
    if(!body) return;
    var me = SPACE.currentUser, p = SPACE.partner;
    var known = !!findCity(me.city);
    var zones = timeZoneList().map(function(z){ return '<option value="'+escapeHtml(z)+'"'+(z === me.timezone ? " selected" : "")+'>'+escapeHtml(z.replace(/_/g, " "))+'</option>'; }).join("");
    var theirBirthday = validIso(p.birthday) ? new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long" }).format(new Date(p.birthday + "T00:00:00")) : "Not added";
    body.innerHTML =
      '<form id="profileForm" class="field-stack" novalidate>'+
        '<div class="overlay-section">'+
          '<div class="overlay-section-head"><h4>You</h4></div>'+
          '<div class="profile-preview"><span class="profile-avatar" id="profileAvatar">'+escapeHtml(me.initial)+'</span><span class="body-s">This letter is your picture across Pairlum. It follows your name.</span></div>'+
          '<label class="field"><span class="field-label">Your name</span><input type="text" id="profileName" class="confirm-input" maxlength="24" autocomplete="given-name" value="'+escapeHtml(me.name)+'"></label>'+
          '<label class="field"><span class="field-label">Your city</span><input type="text" id="profileCity" class="confirm-input" maxlength="40" list="profileCityList" autocomplete="off" value="'+escapeHtml(me.city)+'"></label>'+
          '<datalist id="profileCityList">'+CITIES.map(function(c){ return '<option value="'+escapeHtml(c[0])+'"></option>'; }).join("")+'</datalist>'+
          '<p class="field-hint" id="profileCityHint"></p>'+
          '<label class="field" id="profileZoneRow"'+(known ? " hidden" : "")+'><span class="field-label">Your time zone</span><select id="profileZone" class="confirm-input">'+zones+'</select></label>'+
          '<label class="field"><span class="field-label">Your birthday</span><input type="date" id="profileBirthday" class="confirm-input" max="'+isoFromDate(new Date())+'" value="'+escapeHtml(validIso(me.birthday) ? me.birthday : "")+'"></label>'+
        '</div>'+
        '<div class="overlay-section">'+
          '<div class="overlay-section-head"><h4>The two of you</h4></div>'+
          '<label class="field"><span class="field-label">Together since</span><input type="date" id="profileStart" class="confirm-input" max="'+isoFromDate(new Date())+'" value="'+escapeHtml(SPACE.relationshipStart)+'"></label>'+
          '<p class="field-hint">This date belongs to both of you — either of you can change it, and it sets your anniversary and your day count.</p>'+
          '<label class="field"><span class="field-label">Your shared day starts at midnight in</span><select id="profileSpaceTz" class="confirm-input">'+
            [[me.timezone, me.city], [p.timezone, p.city]].map(function(z){ return '<option value="'+escapeHtml(z[0])+'"'+(z[0] === spaceTz() ? " selected" : "")+'>'+escapeHtml(z[1])+'</option>'; }).join("")+
            ([me.timezone, p.timezone].indexOf(spaceTz()) < 0 ? '<option value="'+escapeHtml(spaceTz())+'" selected>'+escapeHtml(spaceTz().replace(/_/g, " "))+'</option>' : '')+
          '</select></label>'+
          '<p class="field-hint">One clock decides when “today” turns over for both of you: today\'s question, how today feels, Shared Day, the garden, and the day a sealed letter opens. Each moment still shows its own local time.</p>'+
        '</div>'+
        '<div class="overlay-section">'+
          '<div class="overlay-section-head"><h4>'+escapeHtml(p.realName)+'</h4></div>'+
          '<div class="privacy-item"><span class="label">Name</span><span class="privacy-tag privacy-tag--private">'+escapeHtml(p.realName)+'</span></div>'+
          '<div class="privacy-item"><span class="label">City</span><span class="privacy-tag privacy-tag--private">'+escapeHtml(p.city)+' · '+escapeHtml(formatTimeInZone(new Date(), p.timezone))+' now</span></div>'+
          '<div class="privacy-item"><span class="label">Birthday</span><span class="privacy-tag privacy-tag--private">'+escapeHtml(theirBirthday)+'</span></div>'+
          '<p class="field-hint">Only '+escapeHtml(p.realName)+' can change these. Want your own name for them? Set it in <button type="button" class="ambient-link" id="profileToCustomize">Customize your space</button>.</p>'+
        '</div>'+
        '<p class="field-error" id="profileError" role="alert"></p>'+
        '<div class="confirm-actions"><button class="btn-primary" type="submit">Save profile</button></div>'+
      '</form>';

    var cityInput = document.getElementById("profileCity"), zoneRow = document.getElementById("profileZoneRow");
    var paintCity = function(){
      var c = findCity(cityInput.value);
      zoneRow.hidden = !!c;
      setText("profileCityHint", !cityInput.value.trim() ? ""
        : c ? "Time zone and distance are set from this city. Pairlum never reads your live location."
        : "Pairlum doesn't know this city yet, so choose your time zone below. The distance between you won't be shown.");
    };
    paintCity();
    cityInput.addEventListener("input", paintCity);
    document.getElementById("profileName").addEventListener("input", function(e){
      setText("profileAvatar", e.target.value.trim().charAt(0).toUpperCase() || "?");
    });
    document.getElementById("profileToCustomize").addEventListener("click", function(){ switchOverlay("profileOverlay", "customizeOverlay", renderCustomizeOverlay); });
    document.getElementById("profileForm").addEventListener("submit", function(e){
      e.preventDefault();
      var name = document.getElementById("profileName").value.trim();
      var city = cityInput.value.trim();
      var birthday = document.getElementById("profileBirthday").value;
      var start = document.getElementById("profileStart").value;
      var fail = function(msg){ setText("profileError", msg); };
      if(!name) return fail("Add your name.");
      if(!city) return fail("Add your city.");
      if(birthday && !validIso(birthday)) return fail("That birthday isn't a real date.");
      if(!validIso(start)) return fail("Choose the day you got together.");
      var c = findCity(city);
      var next = { name:name, city: c ? c[0] : city, timezone: c ? c[1] : document.getElementById("profileZone").value,
                   lat: c ? c[2] : null, lon: c ? c[3] : null, birthday: birthday || "" };
      var tzPick = (document.getElementById("profileSpaceTz") || {}).value;
      if(!mutate(function(db){
        db.profiles[ME] = next;
        if(tzPick) db.spaceTz = tzPick;
        if(start !== SPACE.relationshipStart) db.relStart = start;
        db.profileAt = db.profileAt || {};
        db.profileAt[ME] = Date.now();
      })) return fail("Not saved. What you typed is still here, so you can try again.");
      refreshEverything();
      checkSharedDay();
      closeOverlay("profileOverlay");
      showToast("Profile saved. " + SPACE.partner.name + " sees it too.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* REUNION & COUNTDOWN                                                 */
  /* ------------------------------------------------------------------ */
  function renderReunionSettings(){
    var body = document.getElementById("reunionSettingsBody");
    if(!body) return;
    var ru = reunionParse(SPACE.reunionDate), c = reunionCount(ru), p = SPACE.partner;
    var setBy = DB.reunion && DB.reunion.by ? (DB.reunion.by === ME ? "You set this" : p.name + " set this") : "";
    var count = !ru ? "" : (c.statBig || (c.big + (c.unit ? " " + c.unit : ""))) + (ru.precision === "day" ? " to go" : "");
    body.innerHTML =
      '<div class="overlay-section">'+
        '<div class="reunion-summary">'+
          '<p class="eyebrow">'+(ru ? "Your next time together" : "No date yet")+'</p>'+
          '<p class="reunion-summary-when">'+(ru ? escapeHtml(ru.label) : "Whenever you know — even just a month or a year.")+'</p>'+
          (ru ? '<p class="body-m">'+escapeHtml(count)+(SPACE.reunionPlace ? " · " + escapeHtml(SPACE.reunionPlace) : "")+'</p>' : "")+
          (setBy ? '<p class="body-s">'+escapeHtml(setBy)+'. Either of you can change it.</p>' : '<p class="body-s">Either of you can set or change it.</p>')+
        '</div>'+
        '<div class="confirm-actions"><button class="btn-primary" type="button" id="reunionSettingsEdit">'+(ru ? "Change when" : "Set when")+'</button></div>'+
      '</div>'+
      '<div class="overlay-section">'+
        toggleRow("reunionShowHome", "Show the countdown on Home", "The ring and your plans, on your Home screen.", SPACE.custom.homeHidden.indexOf("reunion") === -1)+
        toggleRow("reunionMilestones", "Tell me at the milestones", "A quiet note at 100, 50, 30, 14, 7, 3 and 1 days — and on the day itself. Only when you know the exact date.", SPACE.notif.types.reunion !== false)+
      '</div>'+
      '<p class="privacy-note">A reunion can be a day, a month or just a year. Pairlum counts in whatever you actually know, and never pretends to more.</p>';
    document.getElementById("reunionSettingsEdit").addEventListener("click", function(){
      closeOverlay("reunionSettingsOverlay");
      openReunionEditor();
    });
    wireToggle("reunionShowHome", function(on){ setHomeCardHidden("reunion", !on); });
    wireToggle("reunionMilestones", function(on){ SPACE.notif.types.reunion = on; saveSpaceSettings(); syncSettingsChevs(); });
  }

  /* ------------------------------------------------------------------ */
  /* MEMBERSHIP — exactly two paid plans, prices from PAIRLUM_CONFIG.    */
  /* The printed Book opens after one full year on the Book plan; it is  */
  /* never tied to how many memories you keep.                           */
  /* ------------------------------------------------------------------ */
  function planList(){
    var cfg = window.PAIRLUM_CONFIG || {};
    return Array.isArray(cfg.plans) ? cfg.plans.filter(function(pl){ return pl && (pl.id === "digital" || pl.id === "book"); }).slice(0, 2) : [];
  }
  function planById(id){ return planList().filter(function(pl){ return pl.id === id; })[0] || null; }
  function planPrice(pl){
    if(!pl || pl.amount === null || pl.amount === undefined) return null;
    var cfg = window.PAIRLUM_CONFIG || {};
    try{ return new Intl.NumberFormat(cfg.locale || "en-IN", { style:"currency", currency: cfg.currency || "INR", maximumFractionDigits:0 }).format(pl.amount); }
    catch(e){ return String(pl.amount); }
  }
  function membership(){ return DB.membership && planById(DB.membership.plan) ? DB.membership : null; }
  function addYear(iso){
    var p = String(iso).split("-");
    return isoFromDate(new Date(Number(p[0]) + 1, Number(p[1]) - 1, Number(p[2])));
  }
  // { ready, date, daysLeft, pct } for the Book plan, or null on any other plan.
  function bookStatus(){
    var m = membership();
    if(!m || m.plan !== "book" || !validIso(m.since)) return null;
    var readyIso = addYear(m.since), today = new Date();
    var left = daysBetween(new Date(), new Date(readyIso + "T00:00:00"));
    var total = Math.max(1, daysBetween(new Date(m.since + "T00:00:00"), new Date(readyIso + "T00:00:00")));
    return { ready: left <= 0, date: readyIso, daysLeft: Math.max(0, left), pct: Math.max(0, Math.min(100, Math.round((total - Math.max(0, left)) / total * 100))), today: today };
  }
  function renderMembershipOverlay(){
    var body = document.getElementById("membershipBody");
    if(!body) return;
    var m = membership(), current = m ? planById(m.plan) : null, book = bookStatus(), p = SPACE.partner;
    var html = '<div class="overlay-section">';
    if(current){
      html += '<div class="plan-now"><p class="eyebrow">Your plan</p><p class="plan-now-name">'+escapeHtml(current.name)+'</p>'+
        '<p class="body-m">Since '+escapeHtml(longDate(m.since))+'. One membership covers this whole space — you and '+escapeHtml(p.name)+'.</p></div>';
    } else {
      html += '<div class="plan-now"><p class="eyebrow">Your plan</p><p class="plan-now-name">First Chapter</p>'+
        '<p class="body-m">Free to start. Everything you\'ve made stays yours. Membership is how the two of you keep adding to it.</p></div>';
    }
    if(book){
      html += '<div class="book-progress"><p class="eyebrow">Your Pairlum Book</p>'+
        (book.ready
          ? '<p class="body-l" style="color:var(--ink)">Your year is complete — your Book can be made.</p>'
          : '<p class="body-l" style="color:var(--ink)">Opens on '+escapeHtml(longDate(book.date))+' — '+book.daysLeft+(book.daysLeft === 1 ? " day" : " days")+' to go.</p>')+
        '<div class="book-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+book.pct+'"><i style="width:'+book.pct+'%"></i></div>'+
        '<p class="body-s">The Book opens after one full year on this plan. It has nothing to do with how many memories you keep.</p></div>';
    }
    html += '</div><div class="overlay-section"><div class="overlay-section-head"><h4>The two plans</h4></div><div class="plan-grid">';
    planList().forEach(function(pl){
      var price = planPrice(pl), isCurrent = !!current && current.id === pl.id;
      html += '<article class="plan-card'+(isCurrent ? " is-current" : "")+'">'+
        '<p class="eyebrow">'+(pl.id === "book" ? "Digital + print" : "Digital")+'</p>'+
        '<h4>'+escapeHtml(pl.short)+'</h4>'+
        '<p class="body-s">'+escapeHtml(pl.line || "")+'</p>'+
        '<p class="plan-price">'+(price ? '<b>'+escapeHtml(price)+'</b> / '+escapeHtml(pl.period || "year") : '<span>Price announced before launch</span>')+'</p>'+
        '<ul>'+(pl.features || []).map(function(f){ return '<li>'+escapeHtml(f)+'</li>'; }).join("")+'</ul>'+
        (isCurrent ? '<span class="plan-current-tag">Your plan</span>' : '<button type="button" class="btn-ghost" data-plan-choose="'+escapeHtml(pl.id)+'">Choose '+escapeHtml(pl.short)+'</button>')+
      '</article>';
    });
    html += '</div><p class="privacy-note">Billed yearly. No automatic renewal in this version. 7-day full refund window.</p></div>';
    html += '<div class="overlay-section"><div class="overlay-section-head"><h4>Preview only</h4></div>'+
      '<p class="body-s">This preview has no payments. Choosing a plan here only switches what you see, so you can look at each state — nothing is charged.</p>'+
      (current ? '<div class="confirm-actions"><button type="button" class="btn-ghost" data-plan-choose="">See the free First Chapter state</button></div>' : "")+
    '</div>';
    body.innerHTML = html;
    body.querySelectorAll("[data-plan-choose]").forEach(function(btn){
      btn.addEventListener("click", function(){ renderPlanConfirm(btn.getAttribute("data-plan-choose")); });
    });
  }
  function renderPlanConfirm(planId){
    var body = document.getElementById("membershipBody"), pl = planById(planId), price = planPrice(pl);
    body.innerHTML =
      '<div class="confirm-panel">'+
        '<button class="overlay-back" type="button" id="planBack">← Back</button>'+
        '<h4>'+(pl ? "Switch to " + escapeHtml(pl.short) + "?" : "Go back to the free First Chapter?")+'</h4>'+
        (pl ? '<div class="plan-sum">'+
            '<div><span>Plan</span><b>'+escapeHtml(pl.name)+'</b></div>'+
            '<div><span>Price</span><b>'+(price ? escapeHtml(price)+" / "+escapeHtml(pl.period || "year") : "Announced before launch")+'</b></div>'+
            '<div><span>Term</span><b>1 year · covers your shared space</b></div>'+
            '<div><span>Renewal</span><b>No automatic renewal</b></div>'+
            (pl.id === "book" ? '<div><span>Pairlum Book</span><b>Available after 1 full year on this plan</b></div>' : "")+
          '</div>' : '<p class="body-m">Nothing is deleted. Founder access is part of membership, so it steps back until you choose a plan again.</p>')+
        '<p class="body-s" style="margin-top:12px">Preview only: nothing is charged and no payment page opens. This just switches the plan shown for both of you.</p>'+
        '<div class="confirm-actions">'+
          '<button class="btn-ghost" id="planCancel" type="button">Never mind</button>'+
          '<button class="btn-primary" id="planConfirm" type="button">'+(pl ? "Switch plan" : "Go back to free")+'</button>'+
        '</div>'+
      '</div>';
    document.getElementById("planBack").addEventListener("click", renderMembershipOverlay);
    document.getElementById("planCancel").addEventListener("click", renderMembershipOverlay);
    document.getElementById("planConfirm").addEventListener("click", function(){
      if(!mutate(function(db){ db.membership = pl ? { plan: pl.id, since: isoFromDate(new Date()), by: ME } : null; })) return;
      renderMore();
      renderMembershipOverlay();
      showToast(pl ? "You're on " + pl.short + "." : "Back on the free First Chapter.");
      if(pl) celebrate();
    });
  }
  // Founder access is a membership benefit, so it follows the plan.
  function applyMembership(){
    var section = document.getElementById("founderSection");
    if(section) section.hidden = !membership();
    var teaser = document.getElementById("bookTeaserBtn"), book = bookStatus();
    if(teaser) teaser.textContent = book ? (book.ready ? "Your Book is ready →" : "Opens in " + book.daysLeft + (book.daysLeft === 1 ? " day →" : " days →")) : "How to get yours →";    var st = document.getElementById("bookStatusLine");
    if(st) st.textContent = book
      ? (book.ready ? "Your year is complete — your Book can be made." : "Your printed Book opens on " + longDate(book.date) + ". Until then, this preview keeps growing with you.")
      : "The printed Book comes with the Membership + Book plan, after one full year on it.";
  }

  /* ------------------------------------------------------------------ */
  /* PAIRLUM BOOK PREVIEW — hands book.js a plain snapshot of what this  */
  /* couple has kept, so the 44-page preview is made from their own      */
  /* space. A sealed letter's words are never included.                  */
  /* ------------------------------------------------------------------ */
  function bookTzOffsetMin(tz){
    try{
      var d = new Date();
      return Math.round((new Date(d.toLocaleString("en-US", { timeZone: tz })) - new Date(d.toLocaleString("en-US", { timeZone: "UTC" }))) / 60000);
    }catch(e){ return null; }
  }
  function bookData(){
    var you = SPACE.currentUser, them = SPACE.partner, theirName = them.realName || them.name;
    var start = new Date(SPACE.relationshipStart + "T00:00:00"), now = new Date();
    var days = daysBetween(new Date(start.getTime()), new Date()) + 1;
    var years = Math.max(0, now.getFullYear() - start.getFullYear() - ((now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) ? 1 : 0));
    var oa = bookTzOffsetMin(you.timezone), ob = bookTzOffsetMin(them.timezone), apart = "";
    if(oa !== null && ob !== null){
      var diff = Math.abs(oa - ob), h = Math.floor(diff / 60), mnt = diff % 60;
      apart = diff === 0 ? "Same time zone" : (h ? h + (h === 1 ? " hour" : " hours") : "") + (mnt ? (h ? " " : "") + mnt + " min" : "") + " apart";
    }
    var bday = function(iso){
      if(!validIso(iso)) return "";
      var p = iso.split("-");
      return new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long" }).format(new Date(2000, Number(p[1]) - 1, Number(p[2])));
    };
    var person = function(u, name){ return { name: name, initial: String(name || "?").trim().charAt(0).toUpperCase() || "?", city: u.city || "", birthday: bday(u.birthday) }; };
    var photoMems = DB.memories.filter(function(m){ return m.type === "photo"; });
    DB.moments.forEach(function(m){ // photos shared day to day belong in the Book as much as imported ones
      if(m.type === "photo" && m.hasMedia && m.at && !m.demo) photoMems.push({ id:m.id, type:"photo", date:spaceDayIso(m.at), caption:m.caption || "", preview:"" });
    });
    photoMems.sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    var sortedCh = SPACE.chapters || [];
    var chapters = sortedCh.map(function(c, i){
      var nxt = sortedCh[i + 1];
      var mems = photoMems.filter(function(m){ return m.date >= c.date && (!nxt || m.date < nxt.date); });
      return { title: c.title || "", meta: c.meta || "", note: c.note || "", photo: (c.photo && !c.cover) ? c.photo : "", coverId: c.cover || (!c.photo && mems[0] ? mems[0].id : ""),
        memories: mems.slice(0, 2).map(function(m){ return { id: m.id, preview: m.preview || "", caption: m.caption || "", date: validIso(m.date) ? longDate(m.date) : "" }; }) };
    });
    var qs = [];
    Object.keys(DB.dq).sort(function(a, b){ return Number(b) - Number(a); }).forEach(function(k){
      var day = DB.dq[k] || {}, q = questionForDay(k);
      if(String(k) === String(sharedDay()) && !day[ME]) return; // today: answer first, then see theirs. The Book too.
      if(q && (day[ME] || day[THEM])) qs.push({ q: q.q, you: day[ME] || "", them: day[THEM] || "" });
    });
    DAILY_QUESTIONS.forEach(function(q){
      if(q.a && qs.length < 4 && !qs.some(function(x){ return x.q === q.q; })) qs.push({ q: q.q, you: "", them: q.a, sample: true });
    });
    var facts = function(uid){
      var f = DB.facts[uid] || {};
      return FACT_FIELDS.map(function(x){ return { label: x.label, value: f[x.k] || "" }; });
    };
    var dn = { line: "", rows: [], love: [] };
    try{
      var me = dnaPerson(ME), th = dnaPerson(THEM);
      dn.set = me.set || th.set;
      dn.line = dnaLine();
      dn.rows = DNA_SPECS.map(function(sp){ return { left: sp[1], right: sp[2], you: me.specs[sp[0]], them: th.specs[sp[0]] }; });
      dn.love = [{ name: you.name, items: me.love.slice(0, 3) }, { name: theirName, items: th.love.slice(0, 3) }];
    }catch(e){}
    var ru = SPACE.reunionDate ? reunionParse(SPACE.reunionDate) : null, rc = reunionCount(ru);
    var m = membership(), pl = m ? planById(m.plan) : null, bs = bookStatus();
    return {
      you: person(you, you.name), partner: person(them, theirName),
      since: longDate(SPACE.relationshipStart), sinceYear: start.getFullYear(), year: now.getFullYear(),
      days: days, years: years, distance: distanceText(), apart: apart,
      totalMoments: SPACE.totalSharedMoments || DB.moments.length,
      counts: { letters: DB.letters.length, notes: DB.notes.length, memories: DB.memories.length, chapters: chapters.length, someday: DB.someday.length, somedayDone: DB.someday.filter(function(x){ return x.done; }).length },
      chapters: chapters,
      moments: (SPACE.moments || []).map(function(x){
        return { mine: x.who === "a", type: x.type, photo: x.photo || "", id: x.id, caption: x.caption || x.text || "", time: x.time || "", dur: x.dur || "" };
      }),
      notes: DB.notes.slice(0, 12).map(function(n){ return { mine: n.by === ME, text: n.text }; }),
      letters: SPACE.letters.map(function(l){
        var from = l.by === ME ? you.name : (l.from || theirName);
        return l.locked ? { title: l.title, from: from, locked: true, state: l.state || "Sealed" }
                        : { title: l.title, from: from, locked: false, state: l.state || "", body: l.body || "" };
      }),
      memories: photoMems.slice(-12).map(function(x){ return { id: x.id, preview: x.preview || "", caption: x.caption || "", date: validIso(x.date) ? longDate(x.date) : "" }; }),
      questions: qs.slice(0, 4),
      facts: { you: facts(ME), partner: facts(THEM) },
      dates: getImportantDates().map(function(d){ return { title: d.title, sub: d.sub, when: new Intl.DateTimeFormat("en-US", { day:"numeric", month:"long" }).format(d.date) }; }),
      someday: DB.someday.map(function(x){ return { text: x.text, done: !!x.done }; }),
      needs: NEED_YOU.map(function(n){ return n.title; }), needCount: DB.requests.length,
      dna: dn,
      reunion: ru ? { big: rc.big, unit: rc.unit, label: ru.label || "", place: SPACE.reunionPlace || "" } : null,
      plans: (DB.plans || []).slice(0, 5).map(function(x){ return x.title; }),
      plan: pl ? pl.id : "", status: bs ? { ready: bs.ready, date: longDate(bs.date), daysLeft: bs.daysLeft } : null
    };
  }
  window.PairlumBookBridge = {
    data: bookData,
    loadPhoto: function(id, cb){ try{ loadMemoryUrl(id, cb); }catch(e){} },
    soundOn: function(){ return !!SPACE.sound; },
    motionOk: function(){ return motionAllowed(); }
  };
  // The "asking to share live…" bar floats under the top bar. While it is
  // showing, every view makes room for it so it never sits on top of a page
  // title or the first card.
  function wireLivePillSpace(){
    var pill = document.getElementById("livePill");
    if(!pill) return;
    var sync = function(){
      var h = pill.hidden ? 0 : Math.ceil(pill.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--live-pill-space", h ? (h + 14) + "px" : "0px");
    };
    if(window.MutationObserver) new MutationObserver(sync).observe(pill, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true });
    if(window.ResizeObserver) new ResizeObserver(sync).observe(pill);
    window.addEventListener("resize", sync);
    sync();
  }
  var bookViewer = null;
  function renderBookPreview(){
    var host = document.getElementById("bookViewer");
    if(!host || !window.PairlumBook) return;
    if(bookViewer){ bookViewer.refresh(bookData()); return; }
    bookViewer = window.PairlumBook.mount(host, window.PairlumBookBridge);
  }
  function wireBook(){
    renderBookPreview();
    document.querySelectorAll("[data-book-jump]").forEach(function(a){
      a.addEventListener("click", function(e){
        e.preventDefault();
        setView("us");
        var tab = document.getElementById("usTabTogether"); if(tab && !tab.classList.contains("is-active")) tab.click();
        window.setTimeout(function(){
          var sec = document.getElementById("bookSection");
          if(sec) sec.scrollIntoView({ behavior: motionAllowed() ? "smooth" : "auto", block: "start" });
        }, 80);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* PERFORMANCE & QUALITY                                               */
  /* ------------------------------------------------------------------ */
  function setReducedMotion(on){
    SPACE.reducedMotionOverride = on ? "on" : "off";
    document.body.classList.toggle("reduced-motion", on);
    saveSpaceSettings();
    applyMotionLevel();
    syncSettingsChevs();
  }
  function renderPerfOverlay(){
    var body = document.getElementById("perfBody");
    if(!body) return;
    var level = SPACE.motionLevel === "full" || SPACE.motionLevel === "calm" ? SPACE.motionLevel : "auto";
    body.innerHTML =
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Animations</h4></div>'+
        chipRow("perfMotion", [["auto","Auto"],["calm","Calm"],["full","Full"]], level)+
        '<p class="field-hint" id="perfMotionHint"></p>'+
        toggleRow("perfReduced", "Reduced motion", "Stops movement almost everywhere. Petals and animations rest while this is on.", document.body.classList.contains("reduced-motion"))+
        toggleRow("perfPetals", "Falling petals", "Soft petals drifting behind the page.", SPACE.petals !== false)+
        toggleRow("perfTap", "Tap feedback", "A soft ring and a tiny vibration when you tap.", SPACE.tapFeedback !== false)+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Photos you bring in</h4></div>'+
        chipRow("perfQuality", [["high","Sharpest"],["balanced","Balanced"],["saver","Smallest"]], SPACE.perf.photoQuality)+
        '<p class="field-hint" id="perfQualityHint"></p>'+
        toggleRow("perfOriginals", "Keep the original files too", "Each imported photo is saved as the resized copy above. With this on, the untouched file is kept beside it and goes into your export. It takes more room.", keepOriginalsOn())+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Space on this device</h4></div>'+
        '<p class="body-m" id="perfStorage">Checking…</p>'+
        '<p class="field-hint">Photos, videos and voice notes you add are kept on this device in this preview. To clear them, use Delete my account in Privacy.</p>'+
      '</div>';
    var paintHints = function(){
      var lv = SPACE.motionLevel === "full" || SPACE.motionLevel === "calm" ? SPACE.motionLevel : "auto";
      setText("perfMotionHint", lv === "auto" ? "Pairlum picks for this device — right now that's " + (motionLevel() === "full" ? "Full" : "Calm") + "."
        : lv === "calm" ? "Fewer petals, slower and fainter. Easier on older phones and on battery."
        : "Everything: petals in three depths, drifting hearts, glow and shimmer.");
      setText("perfQualityHint", { high:"Up to 2400 px on the long side. Looks best, takes the most room.", balanced:"Up to 1600 px. Sharp on any phone, light to keep.", saver:"Up to 1080 px. For slow connections or a full phone." }[SPACE.perf.photoQuality] + " Applies to photos you import from now on.");
    };
    paintHints();
    wireChipRow(body, "perfMotion", function(v){
      SPACE.motionLevel = v === "auto" ? null : v;
      saveSpaceSettings(); applyMotionLevel(); syncSettingsChevs(); paintHints();
    });
    wireChipRow(body, "perfQuality", function(v){ SPACE.perf.photoQuality = v; saveSpaceSettings(); syncSettingsChevs(); paintHints(); });
    wireToggle("perfReduced", function(on){ setReducedMotion(on); paintHints(); });
    wireToggle("perfPetals", function(on){ SPACE.petals = on; saveSpaceSettings(); renderPetals(); syncSettingsChevs(); });
    wireToggle("perfOriginals", function(on){ SPACE.perf.keepOriginals = on; saveSpaceSettings(); });
    wireToggle("perfTap", function(on){ SPACE.tapFeedback = on; saveSpaceSettings(); syncSettingsChevs(); });
    var line = document.getElementById("perfStorage");
    if(navigator.storage && navigator.storage.estimate){
      navigator.storage.estimate().then(function(est){
        var mb = (est.usage || 0) / 1048576;
        if(line) line.textContent = "Pairlum is using " + (mb < 0.1 ? "less than 0.1" : "about " + (mb < 10 ? mb.toFixed(1) : String(Math.round(mb)))) + " MB here.";
      }, function(){ if(line) line.textContent = "This browser doesn't share how much space is in use."; });
    } else if(line){ line.textContent = "This browser doesn't share how much space is in use."; }
  }

  /* ------------------------------------------------------------------ */
  /* HELP & CONTACT                                                      */
  /* ------------------------------------------------------------------ */
  function renderAboutOverlay(){
    var body = document.getElementById("aboutBody");
    if(!body) return;
    body.innerHTML =
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Talk to us</h4></div>'+
        '<div class="danger-row"><div class="copy"><span class="title">Email</span><span class="sub">pairlum.co@gmail.com</span></div><a class="btn-ghost" href="mailto:pairlum.co@gmail.com?subject=Pairlum%20help">Write →</a></div>'+
        '<div class="danger-row"><div class="copy"><span class="title">Instagram</span><span class="sub">@pairlum.co.in</span></div><a class="btn-ghost" href="https://www.instagram.com/pairlum.co.in" target="_blank" rel="noopener">Open →</a></div>'+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Find your way</h4></div>'+
        '<div class="danger-row"><div class="copy"><span class="title">Who can see what</span><span class="sub">Plain answers about privacy, saving and disconnecting.</span></div><button class="btn-ghost" type="button" id="aboutPrivacy">Open →</button></div>'+
        '<div class="danger-row"><div class="copy"><span class="title">What reaches you, and when</span><span class="sub">Notifications and quiet hours.</span></div><button class="btn-ghost" type="button" id="aboutNotif">Open →</button></div>'+
        '<div class="danger-row"><div class="copy"><span class="title">Your plan and your Book</span><span class="sub">Membership, and when the printed Book opens.</span></div><button class="btn-ghost" type="button" id="aboutMembership">Open →</button></div>'+
      '</div>'+
      '<p class="privacy-note">Pairlum v1 — a private space for two. This is a preview build: everything you add is kept in this browser, and two tabs stand in for your two phones.</p>';
    document.getElementById("aboutPrivacy").addEventListener("click", function(){ switchOverlay("aboutOverlay", "privacyOverlay", renderPrivacyMain); });
    document.getElementById("aboutNotif").addEventListener("click", function(){ switchOverlay("aboutOverlay", "notifOverlay", renderNotifOverlay); });
    document.getElementById("aboutMembership").addEventListener("click", function(){ switchOverlay("aboutOverlay", "membershipOverlay", renderMembershipOverlay); });
  }

  /* ------------------------------------------------------------------ */
  /* NOTIFICATIONS                                                       */
  /* Every piece of news goes through notify(). It checks your own       */
  /* choices, then does one of three things:                             */
  /*   · shows it now (a banner, a sound, a device notification)         */
  /*   · holds it silently in the bell, during your quiet hours          */
  /*   · drops it, if you switched that kind of news off                 */
  /* "I Need You" always arrives in the bell; it interrupts quiet hours   */
  /* only when the sender marked it urgent. Nothing here is built to nag: no */
  /* streaks, no "you haven't opened this", no repeats.                  */
  /* ------------------------------------------------------------------ */
  var INBOX_KEY = NS + "pairlum-inbox-v1-" + ME;
  var REMINDED_KEY = NS + "pairlum-reminded-v1-" + ME;
  var INBOX_MAX = 60;
  var NOTIF_TYPES = [
    ["notes",    "Thinking of you",            "Little notes and the one-tap “thinking of you”."],
    ["moments",  "Moments",                    "When a new piece of their day is shared."],
    ["hearts",   "Loved your moment",          "When they heart something you shared."],
    ["letters",  "Letters",                    "A new letter, or a sealed one opening today."],
    ["memories", "Our Story",                  "Memories they add to your timeline."],
    ["plans",    "Plans",                      "New plans, and a heads-up 15 minutes before one."],
    ["reunion",  "Reunion",                    "When the reunion is set or changed, and the countdown milestones."],
    ["sleep",    "Good night & good morning",  "When they go to sleep and when they wake."],
    ["ambient",  "Sounds from where they are", "A new recorded sound. Live requests always ask you first."],
    ["games",    "Questions & games",          "Their answer to today's question, and Know each other."],
    ["dates",    "Important dates",            "Anniversaries and birthdays, a week ahead and on the day."],
    ["us",       "Changes to your space",      "Profile, Our DNA and membership changes."]
  ];
  var NOTIF_LABEL = { need:"I Need You", test:"Test" };
  NOTIF_TYPES.forEach(function(t){ NOTIF_LABEL[t[0]] = t[1]; });

  function loadInbox(){
    try{ var list = JSON.parse(localStorage.getItem(INBOX_KEY)); return Array.isArray(list) ? list : []; }catch(e){ return []; }
  }
  var INBOX = loadInbox();
  function saveInbox(){
    INBOX = INBOX.slice(0, INBOX_MAX);
    try{ localStorage.setItem(INBOX_KEY, JSON.stringify(INBOX)); }catch(e){}
  }
  function unreadCount(){ return INBOX.filter(function(n){ return !n.read; }).length; }
  function clockMinutes(str){ var m = /^(\d{1,2}):(\d{2})$/.exec(str || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  function minutesNowIn(tz){
    var parts = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle:"h23", hour:"numeric", minute:"numeric" })
      .formatToParts(new Date()).forEach(function(x){ parts[x.type] = x.value; });
    return (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  }
  // Are you inside your own quiet hours right now, in your own time zone?
  function isQuietNow(){
    var qh = SPACE.quietHours;
    if(!qh || !qh.enabled) return false;
    var s = clockMinutes(qh.start), e = clockMinutes(qh.end);
    if(s === null || e === null || s === e) return false;
    var now;
    try{ now = minutesNowIn(SPACE.currentUser.timezone); }catch(err){ var d = new Date(); now = d.getHours() * 60 + d.getMinutes(); }
    return s < e ? (now >= s && now < e) : (now >= s || now < e);
  }
  function clockLabel(str){
    var m = clockMinutes(str);
    if(m === null) return str;
    var d = new Date(2026, 0, 1, Math.floor(m / 60), m % 60);
    return new Intl.DateTimeFormat("en-US", { hour:"numeric", minute:"2-digit", hour12: clock12() }).format(d);
  }
  function notifWanted(ev){
    return ev.type === "need" || ev.type === "test" || SPACE.notif.types[ev.type] !== false;
  }
  function deviceNotify(ev){
    if(!SPACE.notif.device || !("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    try{
      var n = new Notification("Pairlum", {
        body: SPACE.notif.previews !== false ? ev.text : "Something new from " + SPACE.partner.name + ".",
        tag: "pairlum-" + ev.type
      });
      n.onclick = function(){ window.focus(); openInbox(); n.close(); };
    }catch(e){}
  }
  function notifyAll(list){
    var shown = null, added = 0;
    list.forEach(function(ev){
      if(!ev || !ev.text || !notifWanted(ev)) return;
      var quiet = !ev.urgent && isQuietNow();
      INBOX.unshift({ id: uid("nt"), type: ev.type, text: ev.text, view: ev.view || "", target: ev.target || "", moment: ev.moment || "", at: Date.now(), read: false, held: quiet });
      added++;
      if(!quiet) shown = ev;
    });
    if(!added) return;
    saveInbox();
    renderBell();
    if(overlayOpen("inboxOverlay")) renderInbox();
    if(!shown) return;
    sfx("arrive");
    haptic("confirm");
    if(SPACE.notif.banners !== false) showToast(shown.text);
    deviceNotify(shown);
  }
  function notify(ev){ notifyAll([ev]); }

  // Quiet hours just ended: say so once, in one line, and leave it there.
  function releaseHeld(){
    if(isQuietNow()) return;
    var held = INBOX.filter(function(n){ return n.held; });
    if(!held.length) return;
    var unread = held.filter(function(n){ return !n.read; }).length;
    held.forEach(function(n){ n.held = false; n.wasHeld = true; });
    saveInbox();
    if(overlayOpen("inboxOverlay")) renderInbox();
    if(unread && SPACE.notif.banners !== false){
      showToast("While you were resting: " + unread + (unread === 1 ? " thing" : " things") + " from " + SPACE.partner.name + ". " + (unread === 1 ? "It's" : "They're") + " in the bell.");
    }
  }

  // Things worth a note that come from the calendar, not from your partner:
  // a date coming up, a sealed letter opening, a countdown milestone.
  // Each is said once.
  function localReminders(){
    var done = {};
    try{ done = JSON.parse(localStorage.getItem(REMINDED_KEY)) || {}; }catch(e){}
    var out = [], mark = function(key){ if(done[key]) return false; done[key] = Date.now(); return true; };
    getImportantDates().forEach(function(d){
      var days = daysBetween(new Date(), new Date(d.date)), key = d.id + "-" + d.date.getFullYear();
      if(days === 0){ if(mark(key + "-today")) out.push({ type:"dates", text: d.title + " is today.", view:"us", target:"datesList" }); }
      else if(days > 0 && days <= 7){ if(mark(key + "-soon")) out.push({ type:"dates", text: d.title + " is " + (days === 1 ? "tomorrow" : "in " + days + " days") + ".", view:"us", target:"datesList" }); }
    });
    /* WHICH CALENDAR
       Shared calendar (one for the space): today's question, how today feels,
       Shared Day, Day Story, the day a sealed letter opens, and this reminder
       about it, so the reminder and the unlock always name the same day.
       Your own calendar (this device): anniversaries, birthdays and dates you
       added ("is today" means today where you are), the reunion countdown,
       and On this day. */
    var today = spaceDayIso(Date.now());
    DB.letters.forEach(function(l){
      if(l.by === THEM && l.openDate === today && mark("letter-" + l.id)) out.push({ type:"letters", text: "A sealed letter from " + SPACE.partner.name + " opens today.", view:"letters", target:"lettersList" });
    });
    var ru = reunionParse(SPACE.reunionDate);
    if(ru && ru.precision === "day"){
      var left = daysBetween(new Date(), new Date(ru.start.getTime()));
      if([100, 50, 30, 14, 7, 3, 1, 0].indexOf(left) > -1 && mark("reunion-" + ru.value + "-" + left)){
        out.push({ type:"reunion", text: left === 0 ? "Today. You're together today." : left === 1 ? "One more sleep until you're together." : left + " days until you're together.", view:"home", target:"reunionRing" });
      }
    }
    try{ localStorage.setItem(REMINDED_KEY, JSON.stringify(done)); }catch(e){}
    if(out.length) notifyAll(out);
  }

  // News that only exists because of the new screens: a profile change,
  // a plan change, something added to Our DNA.
  function moreAnnounce(prev, next, add){
    var p = SPACE.partner.name;
    var pAt = (prev.profileAt || {})[THEM], nAt = (next.profileAt || {})[THEM];
    if(nAt && nAt !== pAt) add("us", p + " updated their profile.", "us", "usCoupleNames");
    if((prev.relStart || "") !== (next.relStart || "") && nAt && nAt !== pAt) add("us", p + " changed the day you got together.", "us", "usProfileMeta");
    var pm = prev.membership || null, nm = next.membership || null;
    if(nm && nm.by === THEM && (!pm || pm.plan !== nm.plan)){ var pl = planById(nm.plan); if(pl) add("us", p + " moved you both to " + pl.short + ".", "us", "bookTeaserBtn"); }
    var pd = prev.dna || {}, nd = next.dna || {};
    var fresh = function(key){
      var before = ids(pd[key] || []);
      return (nd[key] || []).filter(function(x){ return x.by === THEM && !before[x.id]; });
    };
    fresh("rituals").forEach(function(r){ add("us", p + " added a ritual: " + r.name + ".", "us", "dnaCard"); });
    fresh("collections").forEach(function(c){ add("us", p + " started a collection: " + c.name + ".", "us", "dnaCard"); });
    if(nd.season && nd.season !== pd.season && nd.seasonBy === THEM) add("us", p + " says this season is “" + nd.season + "”.", "us", "dnaCard");
    var pset = ((pd.people || {})[THEM] || {}).set, nset = ((nd.people || {})[THEM] || {}).set;
    if(nset && !pset) add("us", p + " filled in their side of Our DNA.", "us", "dnaCard");
  }

  function goTo(view, targetId){
    if(view) setView(view);
    if(view === "letters"){ var gate = document.getElementById("lettersGateBtn"), v = document.getElementById("view-letters"); if(gate && v && v.classList.contains("letters-gated")) gate.click(); }
    window.setTimeout(function(){
      var target = targetId ? document.getElementById(targetId) : null;
      revealUsTabFor(target);
      if(target && target.scrollIntoView) target.scrollIntoView({ block:"center" });
      if(target && motionAllowed()){ target.classList.remove("is-pointed"); void target.offsetWidth; target.classList.add("is-pointed"); }
    }, 380);
  }
  function renderBell(){
    var n = unreadCount(), badge = document.getElementById("bellCount"), bell = document.getElementById("notifBell");
    if(badge){ badge.hidden = !n; badge.textContent = n > 9 ? "9+" : String(n); }
    if(bell){
      bell.classList.toggle("has-unread", n > 0);
      bell.setAttribute("aria-label", n ? "Notifications, " + n + " new" : "Notifications");
    }
    setText("inboxChev", (n ? n + " new" : "All caught up") + " →");
  }
  function renderInbox(){
    var body = document.getElementById("inboxBody");
    if(!body) return;
    var p = SPACE.partner, quiet = isQuietNow();
    var html = "";
    if(quiet) html += '<p class="inbox-quiet">Quiet hours are on until '+escapeHtml(clockLabel(SPACE.quietHours.end))+'. Anything new waits here without a sound. “I Need You” still comes through.</p>';
    if(!INBOX.length){
      html += '<div class="inbox-empty">'+emptyArt("timeline")+'<p class="body-l" style="color:var(--ink)">Nothing new just now.</p>'+
        '<p class="body-s">When '+escapeHtml(p.name)+' shares, writes or plans something, it lands here. No streaks, no reminders to come back.</p></div>';
    } else {
      var startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
      var group = function(title, items){
        if(!items.length) return "";
        return '<p class="eyebrow inbox-group">'+title+'</p><ul class="inbox-list">' + items.map(function(n){
          var meta = (NOTIF_LABEL[n.type] || "Pairlum") + " · " + agoLabel(n.at) + (n.held ? " · held for quiet hours" : n.wasHeld ? " · arrived while you rested" : "");
          return '<li><button type="button" class="inbox-item'+(n.read ? "" : " is-unread")+'" data-inbox-id="'+escapeHtml(n.id)+'">'+
            '<span class="inbox-dot" aria-hidden="true"></span>'+
            '<span class="inbox-copy"><span class="inbox-text">'+escapeHtml(n.text)+'</span><span class="inbox-meta">'+escapeHtml(meta)+'</span></span>'+
            '<span class="inbox-go" aria-hidden="true">→</span></button></li>';
        }).join("") + '</ul>';
      };
      html += group("Today", INBOX.filter(function(n){ return n.at >= startOfToday.getTime(); }));
      html += group("Earlier", INBOX.filter(function(n){ return n.at < startOfToday.getTime(); }));
    }
    html += '<div class="confirm-actions inbox-actions">'+
      (INBOX.length ? '<button type="button" class="btn-ghost" id="inboxClear">Clear all</button>' : "")+
      '<button type="button" class="btn-ghost" id="inboxSettings">Notification settings</button></div>';
    body.innerHTML = html;
    var clear = document.getElementById("inboxClear");
    if(clear) clear.addEventListener("click", function(){ INBOX = []; saveInbox(); renderBell(); renderInbox(); });
    document.getElementById("inboxSettings").addEventListener("click", function(){ switchOverlay("inboxOverlay", "notifOverlay", renderNotifOverlay); });
    body.querySelectorAll("[data-inbox-id]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var item = INBOX.filter(function(n){ return n.id === btn.getAttribute("data-inbox-id"); })[0];
        closeOverlay("inboxOverlay");
        if(item && item.moment && momentById(item.moment)){ openMoment(item.moment); return; } // an answer opens the moment it belongs to
        if(item && item.view) goTo(item.view, item.target);
      });
    });
  }
  // Opening the bell is the "I've seen these" moment: the dots stay for this
  // look, and the count clears.
  function openInbox(){
    renderInbox();
    openOverlay("inboxOverlay");
    if(unreadCount()){
      INBOX.forEach(function(n){ n.read = true; });
      saveInbox();
      renderBell();
    }
  }

  function renderNotifOverlay(){
    var body = document.getElementById("notifBody");
    if(!body) return;
    var qh = SPACE.quietHours, nf = SPACE.notif, p = SPACE.partner;
    var canDevice = "Notification" in window;
    var deviceSub = !canDevice ? "This browser can't show device notifications."
      : Notification.permission === "denied" ? "Blocked in this browser. Allow notifications for this page in the browser's site settings, then switch this on."
      : "A notification from this device when Pairlum is open in the background.";
    var html =
      '<p class="inbox-quiet" id="notifQuietLine"'+(isQuietNow() ? "" : " hidden")+'>Quiet hours are on right now, until '+escapeHtml(clockLabel(qh.end))+'. New things wait silently in the bell.</p>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>How it reaches you</h4></div>'+
        toggleRow("notifBanners", "Messages on screen", "The small line at the bottom when something arrives while you're here.", nf.banners !== false)+
        toggleRow("notifSound", "Sound", "A soft two-note chime when something new arrives.", SPACE.sound)+
        toggleRow("notifDevice", "Device notifications", deviceSub, !!nf.device && canDevice && Notification.permission === "granted")+
        toggleRow("notifPreviews", "Show the words", "Off: a device notification only says something is new from "+escapeHtml(p.name)+" — nothing to read on a locked screen.", nf.previews !== false)+
        '<div class="confirm-actions"><button type="button" class="btn-ghost" id="notifTest">Send myself a test</button></div>'+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>What you hear about</h4></div>'+
        '<div class="toggle-row"><div class="toggle-row-copy"><span class="title">I Need You</span><span class="sub">When '+escapeHtml(p.name)+' says they could use you. It always reaches your bell. It only breaks into your quiet hours when '+escapeHtml(p.name)+' marks it as “can\'t wait”.</span></div><span class="privacy-tag privacy-tag--shared">Always on</span></div>'+
        NOTIF_TYPES.map(function(t){ return toggleRow("notifType-" + t[0], t[1], t[2], nf.types[t[0]] !== false); }).join("")+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Quiet hours</h4></div>'+
        toggleRow("qhEnabled", "Quiet hours", "In your own time zone. Everything except “I Need You” waits silently in the bell until they end.", qh.enabled)+
        '<div class="toggle-time-row" id="qhTimeRow" style="'+(qh.enabled ? "" : "opacity:.4;pointer-events:none")+'">'+
          '<input type="time" id="qhStart" aria-label="Quiet hours start" value="'+escapeHtml(qh.start)+'"> <span>to</span> <input type="time" id="qhEnd" aria-label="Quiet hours end" value="'+escapeHtml(qh.end)+'">'+
        '</div>'+
        '<p class="field-hint">'+escapeHtml(p.name)+' sets their own quiet hours on their side. What you send while they rest waits silently in their bell until their quiet hours end.</p>'+
      '</div>'+
      '<p class="privacy-note">Pairlum never sends notifications built to create pressure — no "'+escapeHtml(p.name)+' is waiting", no unread reminders, no streaks. “I Need You” always reaches your bell, and breaks into quiet hours only when it is marked “can\'t wait”.</p>';
    body.innerHTML = html;

    var save = function(){ saveSpaceSettings(); syncSettingsChevs(); };
    wireToggle("notifBanners", function(on){ nf.banners = on; save(); });
    wireToggle("notifSound", function(on){ SPACE.sound = on; save(); });
    wireToggle("notifPreviews", function(on){ nf.previews = on; save(); });
    wireToggle("notifDevice", function(on){
      var btn = document.getElementById("notifDevice");
      var setOff = function(msg){ nf.device = false; save(); if(btn){ btn.classList.remove("is-on"); btn.setAttribute("aria-checked", "false"); } if(msg) showToast(msg); };
      if(!on){ nf.device = false; save(); return; }
      if(!canDevice) return setOff("This browser can't show device notifications.");
      if(Notification.permission === "granted"){ nf.device = true; save(); showToast("Device notifications are on."); return; }
      if(Notification.permission === "denied") return setOff("Notifications are blocked for this page. Allow them in your browser's site settings first.");
      var done = function(result){
        if(result === "granted"){ nf.device = true; save(); showToast("Device notifications are on."); }
        else setOff("No problem — nothing will be sent to this device.");
      };
      try{ var req = Notification.requestPermission(done); if(req && req.then) req.then(done, function(){ setOff(""); }); }catch(e){ setOff(""); }
    });
    NOTIF_TYPES.forEach(function(t){
      wireToggle("notifType-" + t[0], function(on){ nf.types[t[0]] = on; save(); });
    });
    document.getElementById("notifTest").addEventListener("click", function(){
      notify({ type:"test", text: "This is how news from " + p.name + " will reach you.", view:"", target:"" });
      if(isQuietNow()) showToast("Quiet hours are on, so the test went silently to the bell.");
    });
    var paintQuiet = function(){
      var line = document.getElementById("notifQuietLine");
      if(line){ line.hidden = !isQuietNow(); line.textContent = "Quiet hours are on right now, until " + clockLabel(qh.end) + ". New things wait silently in the bell."; }
    };
    wireToggle("qhEnabled", function(on){
      qh.enabled = on;
      document.getElementById("qhTimeRow").style.opacity = on ? "1" : ".4";
      document.getElementById("qhTimeRow").style.pointerEvents = on ? "auto" : "none";
      save(); paintQuiet(); releaseHeld();
    });
    document.getElementById("qhStart").addEventListener("change", function(e){ if(e.target.value){ qh.start = e.target.value; save(); paintQuiet(); releaseHeld(); } });
    document.getElementById("qhEnd").addEventListener("change", function(e){ if(e.target.value){ qh.end = e.target.value; save(); paintQuiet(); releaseHeld(); } });
  }

  /* ------------------------------------------------------------------ */
  /* CUSTOMIZE YOUR SPACE — how Pairlum looks and reads for you, on this */
  /* device. Your partner's side is theirs to arrange.                   */
  /* ------------------------------------------------------------------ */
  // Home cards you can switch off or move. "today" cards are the live,
  // couple-only part of Home; "more" cards sit below it.
  var HOME_CARDS = [
    ["ambient",       "today", "The sound of where they are"],
    ["sharedDay",     "today", "Your Shared Day"],
    ["needYou",       "today", "I Need You"],
    ["thinking",      "today", "Thinking of You"],
    ["dailyQuestion", "today", "Today's question"],
    ["together",      "today", "Together — game, hold, garden, date idea"],
    ["parallel",      "today", "Parallel Moments"],
    ["dayStory",      "today", "Day Story"],
    ["import",        "more",  "Bring your memories"],
    ["resurfaced",    "more",  "A memory, resurfaced"],
    ["reunion",       "more",  "Reunion countdown & plans"],
    ["history",       "more",  "Our Story preview"],
    ["book",          "more",  "Pairlum Book"]
  ];
  function homeCardLabel(id){ var c = HOME_CARDS.filter(function(x){ return x[0] === id; })[0]; return c ? c[2] : id; }
  function homeOrder(group){
    var all = HOME_CARDS.filter(function(c){ return c[1] === group; }).map(function(c){ return c[0]; });
    var saved = ((SPACE.custom.homeOrder || {})[group] || []).filter(function(id){ return all.indexOf(id) > -1; });
    all.forEach(function(id){ if(saved.indexOf(id) === -1) saved.push(id); });
    return saved;
  }
  // Moves the real cards on the page into your order. Anything that isn't
  // one of your cards (the notices in between) stays exactly where it was.
  function applyHomeLayout(){
    var hidden = SPACE.custom.homeHidden || [], changed = false;
    ["today","more"].forEach(function(group){
      var order = homeOrder(group), nodes = {}, inPage = [];
      order.forEach(function(id){ var n = document.querySelector('[data-home-card="'+id+'"]'); if(n) nodes[id] = n; });
      document.querySelectorAll("[data-home-card]").forEach(function(n){ if(nodes[n.getAttribute("data-home-card")] === n) inPage.push(n); });
      var want = order.filter(function(id){ return nodes[id]; });
      var same = inPage.every(function(n, i){ return n.getAttribute("data-home-card") === want[i]; });
      if(!same){
        var slots = inPage.map(function(n){ var ph = document.createComment("card"); n.parentNode.insertBefore(ph, n); return ph; });
        inPage.forEach(function(n){ n.parentNode.removeChild(n); });
        want.forEach(function(id, i){ slots[i].parentNode.replaceChild(nodes[id], slots[i]); });
      }
      var defaults = HOME_CARDS.filter(function(c){ return c[1] === group; }).map(function(c){ return c[0]; });
      if(want.join() !== defaults.filter(function(id){ return nodes[id]; }).join()) changed = true;
      want.forEach(function(id){ nodes[id].classList.toggle("is-off", hidden.indexOf(id) > -1); });
    });
    document.body.classList.toggle("home-custom", changed || hidden.length > 0);
  }
  function setHomeCardHidden(id, off){
    var list = SPACE.custom.homeHidden.filter(function(x){ return x !== id; });
    if(off) list.push(id);
    SPACE.custom.homeHidden = list;
    saveSpaceSettings();
    applyHomeLayout();
    syncSettingsChevs();
  }
  function applyCustom(){
    var c = SPACE.custom;
    document.documentElement.style.fontSize = c.textSize === "sm" ? "93.75%" : c.textSize === "lg" ? "112.5%" : "";
    document.body.classList.toggle("text-sm", c.textSize === "sm");
    document.body.classList.toggle("text-lg", c.textSize === "lg");
    document.body.classList.toggle("density-compact", c.density === "compact");
    applyHomeLayout();
  }
  function renderHomeCardList(){
    var wrap = document.getElementById("customHomeList");
    if(!wrap) return;
    var hidden = SPACE.custom.homeHidden, html = "";
    [["today","Today, together"],["more","More of your world"]].forEach(function(g){
      var order = homeOrder(g[0]);
      html += '<p class="eyebrow home-list-group">'+g[1]+'</p><ul class="home-list">' + order.map(function(id, i){
        var on = hidden.indexOf(id) === -1, label = homeCardLabel(id);
        return '<li class="home-list-item'+(on ? "" : " is-off")+'">'+
          '<span class="home-list-move">'+
            '<button type="button" class="home-move" data-home-move="up" data-home-id="'+id+'" data-home-group="'+g[0]+'" aria-label="Move '+escapeHtml(label)+' up"'+(i === 0 ? " disabled" : "")+'>↑</button>'+
            '<button type="button" class="home-move" data-home-move="down" data-home-id="'+id+'" data-home-group="'+g[0]+'" aria-label="Move '+escapeHtml(label)+' down"'+(i === order.length - 1 ? " disabled" : "")+'>↓</button>'+
          '</span>'+
          '<span class="home-list-name">'+escapeHtml(label)+'</span>'+
          '<button type="button" class="toggle-switch'+(on ? " is-on" : "")+'" role="switch" aria-checked="'+(on ? "true" : "false")+'" aria-label="Show '+escapeHtml(label)+'" data-home-toggle="'+id+'"></button>'+
        '</li>';
      }).join("") + '</ul>';
    });
    wrap.innerHTML = html;
  }
  function renderCustomizeOverlay(){
    var body = document.getElementById("customizeBody");
    if(!body) return;
    var c = SPACE.custom, p = SPACE.partner, mood = loadMood();
    var swatch = { warm:"#F7F0EA 50%,#7C1B33 50%", calm:"#FAF8F6 50%,#9E5F66 50%", deep:"#171014 50%,#C9385A 50%", blush:"#FFEEF2 50%,#C43A6E 50%", midnight:"#0F1220 50%,#6D7FFF 50%" };
    body.innerHTML =
      '<p class="body-s" style="margin:-6px 0 4px">Everything here changes Pairlum on this device only. '+escapeHtml(p.realName)+' arranges their own side.</p>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Mood</h4></div>'+
        '<div class="mood-strip" role="radiogroup" aria-label="Mood" id="customMood">'+MOODS.map(function(m){
          var on = m.id === mood;
          return '<button type="button" class="mood-pill'+(on ? " is-selected" : "")+'" role="radio" aria-checked="'+(on ? "true" : "false")+'" data-mood-pick="'+m.id+'"><i style="background:linear-gradient(135deg,'+swatch[m.id]+')" aria-hidden="true"></i>'+escapeHtml(m.name)+'</button>';
        }).join("")+'</div>'+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Reading</h4></div>'+
        '<p class="field-label">Text size</p>'+chipRow("customText", [["sm","Small"],["md","Medium"],["lg","Large"]], c.textSize)+
        '<p class="field-label" style="margin-top:14px">Spacing</p>'+chipRow("customDensity", [["roomy","Roomy"],["compact","Compact"]], c.density)+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Your name for '+escapeHtml(p.realName)+'</h4></div>'+
        '<form class="note-compose" id="customNickForm" style="margin-top:6px">'+
          '<label class="visually-hidden" for="customNick">What you call '+escapeHtml(p.realName)+'</label>'+
          '<input id="customNick" type="text" maxlength="18" placeholder="'+escapeHtml(p.realName)+'" value="'+escapeHtml(c.nick || "")+'">'+
          '<button type="submit">Save</button>'+
        '</form>'+
        '<p class="field-hint">Pairlum uses it everywhere on your side — “'+escapeHtml(c.nick || "Love")+' shared a moment”. Leave it empty to use '+escapeHtml(p.realName)+'. They never see what you typed here.</p>'+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Time &amp; distance</h4></div>'+
        '<p class="field-label">Clocks</p>'+chipRow("customClock", [["12","12-hour"],["24","24-hour"]], c.clock)+
        '<p class="field-label" style="margin-top:14px">Distance</p>'+chipRow("customDistance", [["km","Kilometres"],["mi","Miles"]], c.distance)+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="overlay-section-head"><h4>Your Home screen</h4></div>'+
        '<p class="field-hint" style="margin-top:0">Switch a card off to hide it, or use the arrows to move it. Nothing is deleted, and '+escapeHtml(p.name)+' still sees everything on their side.</p>'+
        '<div id="customHomeList"></div>'+
      '</div>'+
      '<div class="overlay-section">'+
        '<div class="danger-row"><div class="copy"><span class="title">Start over</span><span class="sub">Puts text, spacing, clocks, distance and your Home screen back the way they came. Your mood and your name for '+escapeHtml(p.realName)+' stay.</span></div><button class="btn-ghost" type="button" id="customReset">Reset</button></div>'+
      '</div>';
    renderHomeCardList();

    var save = function(){ saveSpaceSettings(); syncSettingsChevs(); };
    document.getElementById("customMood").addEventListener("click", function(e){
      var pick = e.target.closest("[data-mood-pick]");
      if(!pick) return;
      applyMood(pick.getAttribute("data-mood-pick"));
      document.querySelectorAll("#customMood [data-mood-pick]").forEach(function(b){
        var on = b === pick;
        b.classList.toggle("is-selected", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
      syncSettingsChevs();
    });
    wireChipRow(body, "customText", function(v){ c.textSize = v; save(); applyCustom(); });
    wireChipRow(body, "customDensity", function(v){ c.density = v; save(); applyCustom(); });
    wireChipRow(body, "customClock", function(v){ c.clock = v; save(); tickClocks(); renderPlans(); });
    wireChipRow(body, "customDistance", function(v){ c.distance = v; save(); renderSpaceBindings(); });
    document.getElementById("customNickForm").addEventListener("submit", function(e){
      e.preventDefault();
      c.nick = document.getElementById("customNick").value.trim();
      save();
      refreshEverything();
      renderCustomizeOverlay();
      showToast(c.nick ? "On your side, " + SPACE.partner.realName + " is “" + c.nick + "” now." : "Back to " + SPACE.partner.realName + ".");
    });
    document.getElementById("customHomeList").addEventListener("click", function(e){
      var move = e.target.closest("[data-home-move]"), toggle = e.target.closest("[data-home-toggle]");
      if(toggle){
        setHomeCardHidden(toggle.getAttribute("data-home-toggle"), toggle.classList.contains("is-on"));
        renderHomeCardList();
        return;
      }
      if(!move || move.disabled) return;
      var group = move.getAttribute("data-home-group"), id = move.getAttribute("data-home-id");
      var order = homeOrder(group), i = order.indexOf(id), j = move.getAttribute("data-home-move") === "up" ? i - 1 : i + 1;
      if(i < 0 || j < 0 || j >= order.length) return;
      order.splice(i, 1); order.splice(j, 0, id);
      c.homeOrder[group] = order;
      save(); applyHomeLayout(); renderHomeCardList();
      var again = document.querySelector('[data-home-move="'+move.getAttribute("data-home-move")+'"][data-home-id="'+id+'"]');
      if(again && !again.disabled) again.focus();
    });
    document.getElementById("customReset").addEventListener("click", function(){
      var fresh = defaultSpace().custom;
      fresh.nick = c.nick;
      SPACE.custom = fresh;
      save(); applyCustom(); tickClocks(); renderPlans(); renderSpaceBindings();
      renderCustomizeOverlay();
      showToast("Back to how it came.");
    });
  }

  /* ------------------------------------------------------------------ */
  /* OUR DNA — how the two of you move, in your own words. Shared: both  */
  /* of you see and shape the same thing. Your sliders, love languages   */
  /* and "more / less like this" are your own; everything else is ours.  */
  /* ------------------------------------------------------------------ */
  var DNA_SPECS = [
    ["social",     "Quiet nights in",  "Out with people"],
    ["tone",       "Calm",             "Playful"],
    ["romance",    "Easygoing",        "Romantic"],
    ["plan",       "Spontaneous",      "Planned"],
    ["expressive", "Private",          "Expressive"],
    ["calls",      "Short check-ins",  "Long calls"],
    ["depth",      "Silly moments",    "Deep talks"],
    ["freq",       "Lots of space",    "Always in touch"]
  ];
  var DNA_LOVE = ["Words", "Touch", "Gifts", "Acts of service", "Quality time"];
  var DNA_MEDIA = ["Photos", "Videos", "Voice", "Words"];
  var DNA_THINGS = [
    ["Songs",          function(x, p){ return "Play “" + x + "” tonight, at the same time, wherever you each are."; }],
    ["Films & shows",  function(x, p){ return "Press play on “" + x + "” together this week."; }],
    ["Foods",          function(x, p){ return x + " this week — same dish, two kitchens."; }],
    ["Places",         function(x, p){ return "Send " + p + " one photo that reminds you of " + x + "."; }],
    ["Games",          function(x, p){ return "A round of " + x + " tonight? Loser writes a letter."; }],
    ["Artists",        function(x, p){ return "Put " + x + " on for your next call."; }],
    ["Hobbies",        function(x, p){ return "Show " + p + " a little of your " + x + " this week."; }],
    ["Date types",     function(x, p){ return "It's been a while: " + x + "."; }],
    ["Things to try",  function(x, p){ return "Pick a day for this one: " + x + "."; }]
  ];
  var DNA_LANG = [
    ["nicknames", "Nicknames"], ["jokes", "Inside jokes"], ["words", "Special words"],
    ["phrases", "Phrases only you use"], ["emojis", "Meaningful emojis"], ["morning", "Usual good morning"]
  ];
  // What matters most → which Home cards carry it.
  var DNA_WORLD = [
    ["Everyday moments",  ["sharedDay", "parallel", "dayStory"]],
    ["Photos",            ["sharedDay"]],
    ["Voice",             ["needYou"]],
    ["Distance",          ["ambient"]],
    ["Thinking of you",   ["thinking"]],
    ["Questions & games", ["dailyQuestion", "together"]],
    ["Rituals",           ["together"]],
    ["Plans & reunion",   ["reunion"]],
    ["Memories",          ["resurfaced", "history", "import"]],
    ["Letters",           []],
    ["The Book",          ["book"]]
  ];
  var DNA_LEARN = [
    ["ritual",  "Small rituals"], ["deep", "Deep conversations"], ["playful", "Playful and silly"],
    ["photo",   "Photos and memories"], ["music", "Music"]
  ];
  var DNA_SEASONS = [
    ["New Us",            "Everything is a first. Keep them — add moments freely."],
    ["Long Distance",     "Two clocks, one day. The countdown and the sounds matter most now."],
    ["Busy Life",         "Small counts. One tap of “thinking of you” is enough on days like these."],
    ["Reconnecting",      "Slow is fine. Today's question is a gentle place to start."],
    ["Living Together",   "Same city for now. Keep the everyday — it's what you'll want back later."],
    ["Planning Reunion",  "The countdown is on. Add plans as they firm up."],
    ["Travelling",        "Different skies again. Share the sound of where you are."],
    ["Just Us",           "Nothing to chase. Just the two of you."],
    ["Big Change",        "Hold on to each other through this one."]
  ];
  var DNA_TABS = [["dna","DNA"],["things","Things"],["language","Language"],["world","World"],["rituals","Rituals"],["collections","Collections"],["learn","Learn"],["season","Season"]];
  var DNA_LIST_MAX = 24;
  var dnaState = { tab: "dna", collection: null, refocus: null };

  function dnaShape(d){
    d = d || {};
    if(!d.people || typeof d.people !== "object") d.people = {};
    if(!d.things || typeof d.things !== "object") d.things = {};
    if(!d.language || typeof d.language !== "object") d.language = {};
    DNA_LANG.forEach(function(f){ if(!Array.isArray(d.language[f[0]])) d.language[f[0]] = []; });
    if(typeof d.language.goodbye !== "string") d.language.goodbye = "";
    ["priorities","rituals","collections"].forEach(function(k){ if(!Array.isArray(d[k])) d[k] = []; });
    if(typeof d.season !== "string") d.season = "";
    return d;
  }
  function dna(){ return dnaShape(DB.dna); }
  function dnaPerson(userId, d){
    var saved = ((d || dna()).people[userId]) || {}, specs = {};
    DNA_SPECS.forEach(function(s){ specs[s[0]] = typeof (saved.specs || {})[s[0]] === "number" ? saved.specs[s[0]] : 50; });
    return { specs: specs, set: !!saved.set, love: Array.isArray(saved.love) ? saved.love : [], media: Array.isArray(saved.media) ? saved.media : [], fb: saved.fb && typeof saved.fb === "object" ? saved.fb : {} };
  }
  function mutateDna(fn){
    var ok = mutate(function(db){ db.dna = dnaShape(db.dna); fn(db.dna); });
    if(ok) markFirst("dna");
    renderMore();
    return ok;
  }
  function mutateMyDna(fn){
    return mutateDna(function(d){
      var mine = dnaPerson(ME, d);
      fn(mine);
      d.people[ME] = mine;
    });
  }
  function dnaLine(){
    var p = SPACE.partner.name, me = dnaPerson(ME), th = dnaPerson(THEM);
    if(!me.set && !th.set) return "Tell Pairlum how the two of you move. It takes a minute, and it's only ever yours.";
    if(!th.set) return "Your side is in. When " + p + " adds theirs, you'll see the two of you side by side.";
    if(!me.set) return p + " has filled in their side. Add yours to see the two of you together.";
    var avg = function(k){ return (me.specs[k] + th.specs[k]) / 2; }, bits = [];
    bits.push(avg("social") > 55 ? "happiest out in the world" : "quiet and close");
    bits.push(avg("plan") > 55 ? "planning ahead" : "saying yes on a whim");
    bits.push(avg("depth") > 55 ? "talking deep, often" : "keeping it light and easy");
    bits.push(Math.abs(me.specs.calls - th.specs.calls) > 25 ? "one of you loves long calls, one keeps it short" : "matched on how you check in");
    return "This is how you two move: " + bits.join(", ") + ".";
  }
  function dnaAllThings(){
    var d = dna(), out = [];
    DNA_THINGS.forEach(function(cat){ (d.things[cat[0]] || []).forEach(function(x){ out.push({ cat: cat[0], text: x, line: cat[1](x, SPACE.partner.name) }); }); });
    return out;
  }
  // One idea a day, the same for both of you, drawn from what you both love.
  function dnaSuggestion(){
    var all = dnaAllThings();
    return all.length ? all[Number(sharedDay()) % all.length] : null;
  }
  // Both of your "more / less like this" taps, added up.
  function dnaLean(kind){
    return (dnaPerson(ME).fb[kind] || 0) + (dnaPerson(THEM).fb[kind] || 0);
  }
  // Date ideas you've both leaned away from are left out; the ones you
  // leaned toward come first.
  function dateIdeaPool(){
    var keep = DATE_IDEAS.filter(function(i){ return dnaLean(i.k) >= 0; });
    if(!keep.length) keep = DATE_IDEAS.slice();
    return keep.filter(function(i){ return dnaLean(i.k) > 0; }).concat(keep.filter(function(i){ return dnaLean(i.k) <= 0; }));
  }
  function addToList(list, text){
    text = String(text || "").trim().slice(0, 60);
    if(!text) return "empty";
    if(list.some(function(x){ return String(x).toLowerCase() === text.toLowerCase(); })) return "dup";
    if(list.length >= DNA_LIST_MAX) return "full";
    list.push(text);
    return "ok";
  }
  function listResult(res){
    if(res === "dup") showToast("That one's already there.");
    if(res === "full") showToast("That list is full — take one out to add another.");
    return res === "ok";
  }

  function chipList(items, removeAttr, extra){
    if(!items.length) return '<p class="dna-empty">Nothing here yet.</p>';
    return '<div class="dna-chips">' + items.map(function(x, i){
      return '<button type="button" class="dna-chip dna-chip--x" '+removeAttr+' data-i="'+i+'"'+(extra || "")+' aria-label="Remove '+escapeHtml(x)+'">'+escapeHtml(x)+'<span aria-hidden="true">✕</span></button>';
    }).join("") + '</div>';
  }
  function addForm(kind, attrs, placeholder, label){
    return '<form class="note-compose dna-add" data-dna-add="'+kind+'" '+(attrs || "")+'>'+
      '<input type="text" maxlength="60" placeholder="'+escapeHtml(placeholder)+'" aria-label="'+escapeHtml(label || placeholder)+'">'+
      '<button type="submit">Add</button></form>';
  }
  function dnaPanelHtml(){
    var d = dna(), me = dnaPerson(ME), th = dnaPerson(THEM), p = SPACE.partner.name, t = dnaState.tab, html = "";
    if(t === "dna"){
      html += '<div class="dna-block"><h3>Side by side</h3>'+
        '<p class="dna-legend"><span><b class="dna-dot dna-dot--me"></b>You</span><span><b class="dna-dot dna-dot--them"></b>'+escapeHtml(p)+'</span></p>'+
        (th.set ? "" : '<p class="field-hint" style="margin-top:0">'+escapeHtml(p)+' hasn\'t added theirs yet. Their dots appear here when they do.</p>');
      DNA_SPECS.forEach(function(s){
        html += '<div class="dna-spec">'+
          '<div class="dna-spec-labels"><span>'+s[1]+'</span><span>'+s[2]+'</span></div>'+
          '<div class="dna-track">'+(th.set ? '<i class="dna-dot dna-dot--them" style="left:'+th.specs[s[0]]+'%"></i>' : "")+'<i class="dna-dot dna-dot--me" data-dna-me="'+s[0]+'" style="left:'+me.specs[s[0]]+'%"></i></div>'+
          '<input type="range" min="0" max="100" step="5" value="'+me.specs[s[0]]+'" data-dna-spec="'+s[0]+'" aria-label="'+s[1]+' to '+s[2]+'">'+
        '</div>';
      });
      html += '</div>';
      var personal = function(title, key, opts, note){
        var theirs = th[key].length ? p + ": " + th[key].join(", ") : p + " hasn't picked yet.";
        return '<div class="dna-block"><h3>'+title+'</h3><p class="field-hint" style="margin-top:0">'+note+'</p><div class="dna-chips">'+opts.map(function(o){
          var on = me[key].indexOf(o) > -1;
          return '<button type="button" class="dna-chip'+(on ? " is-on" : "")+'" aria-pressed="'+(on ? "true" : "false")+'" data-dna-chip="'+key+'" data-value="'+escapeHtml(o)+'">'+escapeHtml(o)+'</button>';
        }).join("")+'</div><p class="dna-theirs">'+escapeHtml(theirs)+'</p></div>';
      };
      html += personal("How you feel loved", "love", DNA_LOVE, "Pick the ones that are you. " + escapeHtml(p) + " sees them.");
      html += personal("How you like to share", "media", DNA_MEDIA, "The way you'd rather send a piece of your day.");
    }
    if(t === "things"){
      var sug = dnaSuggestion();
      html += '<div class="dna-suggest"><p class="eyebrow">An idea for today</p>'+
        (sug ? '<p>'+escapeHtml(sug.line)+'</p><button type="button" class="ambient-link" id="dnaPlanSuggestion">Make it a plan</button>'
             : '<p>Add a few things you both love. Pairlum turns them into one small idea a day, the same for both of you.</p>')+'</div>';
      html += '<div class="dna-block"><h3>Our things</h3><p class="field-hint" style="margin-top:0">Either of you can add or take away. Tap one to remove it.</p>';
      DNA_THINGS.forEach(function(cat){
        html += '<div class="dna-cat"><h4>'+cat[0]+'</h4>'+chipList(d.things[cat[0]] || [], 'data-dna-remove-thing="'+escapeHtml(cat[0])+'"')+
          addForm("thing", 'data-cat="'+escapeHtml(cat[0])+'"', "Add to " + cat[0].toLowerCase(), "Add to " + cat[0])+'</div>';
      });
      html += '</div>';
    }
    if(t === "language"){
      html += '<div class="dna-block"><h3>Our language</h3><p class="field-hint" style="margin-top:0">The words that only belong to you two.</p>';
      DNA_LANG.forEach(function(f){
        html += '<div class="dna-cat"><h4>'+f[1]+'</h4>'+chipList(d.language[f[0]], 'data-dna-remove-lang="'+f[0]+'"')+
          addForm("lang", 'data-key="'+f[0]+'"', "Add to " + f[1].toLowerCase(), "Add to " + f[1])+'</div>';
      });
      html += '<div class="dna-cat"><h4>Usual goodbye</h4><form class="note-compose dna-add" data-dna-add="goodbye">'+
        '<input type="text" maxlength="60" placeholder="How you always sign off" aria-label="Usual goodbye" value="'+escapeHtml(d.language.goodbye)+'"><button type="submit">Save</button></form></div></div>';
    }
    if(t === "world"){
      html += '<div class="dna-block"><h3>What matters most right now</h3><p class="field-hint" style="margin-top:0">Pick up to five, in the order they matter. This is shared — it\'s what your world is built around.</p><div class="dna-chips">'+
        DNA_WORLD.map(function(w){
          var i = d.priorities.indexOf(w[0]), on = i > -1;
          return '<button type="button" class="dna-chip'+(on ? " is-on" : "")+'" aria-pressed="'+(on ? "true" : "false")+'" data-dna-world="'+escapeHtml(w[0])+'">'+(on ? '<b>'+(i + 1)+'</b>' : "")+escapeHtml(w[0])+'</button>';
        }).join("")+'</div></div>';
      html += '<div class="dna-block"><h3>Your world, reordered</h3>';
      if(!d.priorities.length){
        html += '<p class="dna-empty">Pick a few above to see what moves to the top of Home.</p>';
      } else {
        html += '<ol class="dna-prio">'+d.priorities.map(function(name){
          var w = DNA_WORLD.filter(function(x){ return x[0] === name; })[0], cards = w ? w[1] : [];
          return '<li><span>'+escapeHtml(name)+'</span><small>'+(cards.length ? escapeHtml(cards.map(homeCardLabel).join(" · ")) : "Lives in its own Letters tab")+'</small></li>';
        }).join("")+'</ol><div class="confirm-actions"><button type="button" class="btn-primary" id="dnaApplyWorld">Arrange my Home this way</button></div>'+
        '<p class="field-hint">Moves those cards to the top of your own Home screen. '+escapeHtml(p)+' chooses for theirs. You can fine-tune it in Customize.</p>';
      }
      html += '</div>';
    }
    if(t === "rituals"){
      html += '<div class="dna-block"><h3>Our rituals</h3><p class="field-hint" style="margin-top:0">Name them yourselves. No streaks, nothing to keep up — just a record of the times you did.</p>';
      html += d.rituals.length ? '<ul class="dna-rows">'+d.rituals.map(function(r){
        var meta = r.freq + (r.count ? " · " + r.count + (r.count === 1 ? " time" : " times") + " · last " + agoLabel(r.last) : " · not yet");
        return '<li><div class="dna-row-copy"><span class="title">'+escapeHtml(r.name)+'</span><span class="sub">'+escapeHtml(meta)+'</span></div>'+
          '<button type="button" class="btn-ghost dna-small" data-ritual-done="'+escapeHtml(r.id)+'">We did it</button>'+
          (r.by === ME ? '<button type="button" class="date-card-remove" data-ritual-remove="'+escapeHtml(r.id)+'" aria-label="Remove '+escapeHtml(r.name)+'">✕</button>' : "")+'</li>';
      }).join("")+'</ul>' : '<p class="dna-empty">No rituals yet. A Friday midnight call? Coffee on video every Sunday?</p>';
      html += '<form class="dna-form" data-dna-add="ritual"><input type="text" maxlength="50" placeholder="e.g. Friday midnight call" aria-label="Ritual name">'+
        '<select aria-label="How often"><option>Daily</option><option selected>Weekly</option><option>Monthly</option><option>Whenever</option></select><button type="submit" class="btn-primary">Add</button></form></div>';
    }
    if(t === "collections"){
      var open = d.collections.filter(function(c){ return c.id === dnaState.collection; })[0];
      if(open){
        html += '<div class="dna-block"><button class="overlay-back" type="button" data-coll-back>← All collections</button>'+
          '<h3>'+escapeHtml(open.emoji + " " + open.name)+'</h3>';
        html += (open.items || []).length ? '<ul class="dna-rows">'+open.items.map(function(it){
          return '<li><div class="dna-row-copy"><span class="title">'+escapeHtml(it.text)+'</span><span class="sub">'+escapeHtml(it.by === ME ? "You" : p)+' · '+escapeHtml(agoLabel(it.at))+'</span></div>'+
            (it.by === ME ? '<button type="button" class="date-card-remove" data-coll-item-remove="'+escapeHtml(it.id)+'" aria-label="Remove">✕</button>' : "")+'</li>';
        }).join("")+'</ul>' : '<p class="dna-empty">Empty for now. Add the first one.</p>';
        html += addForm("collitem", "", "Add to " + open.name, "Add to " + open.name);
        if(open.by === ME) html += '<div class="confirm-actions"><button type="button" class="btn-danger" data-coll-remove="'+escapeHtml(open.id)+'">Delete this collection</button></div>';
        html += '</div>';
      } else {
        html += '<div class="dna-block"><h3>Our collections</h3><p class="field-hint" style="margin-top:0">Little lists that belong just to you two — things they say half asleep, places you\'ve kissed, bad puns.</p>';
        html += d.collections.length ? '<div class="dna-colls">'+d.collections.map(function(c){
          var n = (c.items || []).length;
          return '<button type="button" class="dna-coll" data-coll-open="'+escapeHtml(c.id)+'"><span class="dna-coll-emoji" aria-hidden="true">'+escapeHtml(c.emoji)+'</span><span class="dna-coll-name">'+escapeHtml(c.name)+'</span><span class="dna-coll-count">'+n+(n === 1 ? " thing" : " things")+'</span></button>';
        }).join("")+'</div>' : '<p class="dna-empty">No collections yet.</p>';
        html += '<form class="dna-form" data-dna-add="collection"><input type="text" class="dna-emoji-input" maxlength="4" placeholder="💗" aria-label="Emoji">'+
          '<input type="text" maxlength="40" placeholder="Name it" aria-label="Collection name"><button type="submit" class="btn-primary">Create</button></form></div>';
      }
    }
    if(t === "learn"){
      html += '<div class="dna-block"><h3>More of this, less of that</h3><p class="field-hint" style="margin-top:0">Your taps and '+escapeHtml(p)+'\'s are added together. They shape the date ideas on Home for both of you: what you lean away from stops coming up, what you lean toward comes first.</p>';
      DNA_LEARN.forEach(function(it){
        var mine = me.fb[it[0]] || 0, theirs = th.fb[it[0]] || 0, pct = Math.max(6, Math.min(100, 50 + (mine + theirs) * 9));
        var word = function(v){ return v > 0 ? "more" : v < 0 ? "less" : "no lean"; };
        html += '<div class="dna-learn"><div class="dna-learn-head"><span class="title">'+it[1]+'</span><span class="sub">You: '+word(mine)+' · '+escapeHtml(p)+': '+word(theirs)+'</span></div>'+
          '<div class="dna-bar"><i style="width:'+pct+'%"></i></div>'+
          '<div class="dna-learn-actions"><button type="button" class="btn-ghost dna-small" data-learn="'+it[0]+'" data-dir="-1"'+(mine <= -3 ? " disabled" : "")+'>Less like this</button>'+
          '<button type="button" class="btn-ghost dna-small" data-learn="'+it[0]+'" data-dir="1"'+(mine >= 3 ? " disabled" : "")+'>More like this</button></div></div>';
      });
      html += '</div>';
    }
    if(t === "season"){
      var note = (DNA_SEASONS.filter(function(s){ return s[0] === d.season; })[0] || [])[1];
      html += '<div class="dna-block"><h3>What life feels like right now</h3><p class="field-hint" style="margin-top:0">One for the two of you. Either of you can change it, as often as life does.</p><div class="dna-seasons">'+
        DNA_SEASONS.map(function(s){
          var on = s[0] === d.season;
          return '<button type="button" class="dna-season'+(on ? " is-on" : "")+'" aria-pressed="'+(on ? "true" : "false")+'" data-season="'+escapeHtml(s[0])+'">'+escapeHtml(s[0])+'</button>';
        }).join("")+'</div>'+
        (note ? '<div class="dna-suggest" style="margin-top:14px"><p>'+escapeHtml(note)+'</p></div>' : "")+'</div>';
    }
    return html;
  }
  function renderDna(force){
    var body = document.getElementById("dnaBody"), tabs = document.getElementById("dnaTabs");
    if(!body || !tabs) return;
    // Never repaint under someone who is in the middle of typing or dragging.
    var a = document.activeElement;
    if(!force && a && body.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    setText("dnaHero", dnaLine());
    tabs.innerHTML = DNA_TABS.map(function(t){
      var on = t[0] === dnaState.tab;
      return '<button type="button" role="tab" class="dna-tab'+(on ? " is-on" : "")+'" aria-selected="'+(on ? "true" : "false")+'" data-dna-tab="'+t[0]+'">'+t[1]+'</button>';
    }).join("");
    body.innerHTML = dnaPanelHtml();
    if(dnaState.refocus){
      var again = body.querySelector(dnaState.refocus);
      dnaState.refocus = null;
      if(again && again.focus) again.focus();
    }
  }
  function openDna(tab){
    if(tab) dnaState.tab = tab;
    dnaState.collection = null;
    renderDna(true);
    openOverlay("dnaOverlay");
  }
  function renderDnaCard(){
    var card = document.getElementById("dnaCard");
    if(!card) return;
    var d = dna(), me = dnaPerson(ME), th = dnaPerson(THEM), sug = dnaSuggestion(), things = dnaAllThings().length;
    setText("dnaCardLine", dnaLine());
    var chips = [];
    if(d.season) chips.push(d.season);
    me.love.slice(0, 2).forEach(function(l){ chips.push("You: " + l); });
    th.love.slice(0, 2).forEach(function(l){ chips.push(SPACE.partner.name + ": " + l); });
    if(things) chips.push(things + (things === 1 ? " thing you love" : " things you love"));
    if(d.rituals.length) chips.push(d.rituals.length + (d.rituals.length === 1 ? " ritual" : " rituals"));
    if(d.collections.length) chips.push(d.collections.length + (d.collections.length === 1 ? " collection" : " collections"));
    var box = document.getElementById("dnaCardChips");
    if(box) box.innerHTML = chips.map(function(c){ return '<span>'+escapeHtml(c)+'</span>'; }).join("");
    setText("dnaCardHint", sug ? "Today: " + sug.line : me.set ? "Add the things you both love for one small idea a day." : "Tap to start — sliders, your words, your rituals.");
  }

  function wireDna(){
    var body = document.getElementById("dnaBody"), tabs = document.getElementById("dnaTabs");
    if(!body || !tabs) return;
    tabs.addEventListener("click", function(e){
      var tab = e.target.closest("[data-dna-tab]");
      if(!tab) return;
      dnaState.tab = tab.getAttribute("data-dna-tab");
      dnaState.collection = null;
      renderDna(true);
      var sheet = body.closest(".sheet");
      if(sheet) sheet.scrollTop = 0;
      var now = tabs.querySelector(".dna-tab.is-on");
      if(now){ now.focus(); if(now.scrollIntoView) now.scrollIntoView({ inline:"center", block:"nearest" }); }
    });
    // sliders: the dot follows your finger; the save happens when you let go
    body.addEventListener("input", function(e){
      var key = e.target.getAttribute && e.target.getAttribute("data-dna-spec");
      if(!key) return;
      var dot = body.querySelector('[data-dna-me="'+key+'"]');
      if(dot) dot.style.left = e.target.value + "%";
    });
    body.addEventListener("change", function(e){
      var key = e.target.getAttribute && e.target.getAttribute("data-dna-spec");
      if(!key) return;
      var value = Number(e.target.value);
      mutateMyDna(function(mine){ mine.specs[key] = value; mine.set = true; });
      setText("dnaHero", dnaLine());
    });
    body.addEventListener("submit", function(e){
      var form = e.target.closest("[data-dna-add]");
      if(!form) return;
      e.preventDefault();
      var kind = form.getAttribute("data-dna-add"), inputs = form.querySelectorAll("input[type=text]"), ok = false, saved = true;
      var text = inputs[inputs.length - 1].value.trim();
      if(kind === "thing"){
        var cat = form.getAttribute("data-cat"), res = "empty";
        saved = mutateDna(function(d){ if(!Array.isArray(d.things[cat])) d.things[cat] = []; res = addToList(d.things[cat], text); });
        ok = listResult(res);
        dnaState.refocus = '[data-dna-add="thing"][data-cat="'+cat+'"] input';
      } else if(kind === "lang"){
        var key = form.getAttribute("data-key"), res2 = "empty";
        saved = mutateDna(function(d){ res2 = addToList(d.language[key], text); });
        ok = listResult(res2);
        dnaState.refocus = '[data-dna-add="lang"][data-key="'+key+'"] input';
      } else if(kind === "goodbye"){
        saved = mutateDna(function(d){ d.language.goodbye = text.slice(0, 60); });
        if(saved) showToast(text ? "Saved." : "Cleared.");
        ok = true;
      } else if(kind === "ritual"){
        if(!text) return;
        var freq = form.querySelector("select").value;
        saved = mutateDna(function(d){ d.rituals.push({ id: uid("rit"), name: text.slice(0, 50), freq: freq, by: ME, at: Date.now(), count: 0, last: 0 }); });
        ok = true;
        dnaState.refocus = '[data-dna-add="ritual"] input';
      } else if(kind === "collection"){
        if(!text) return;
        var emoji = inputs[0].value.trim() || "💗", id = uid("col");
        saved = mutateDna(function(d){ d.collections.push({ id: id, emoji: emoji.slice(0, 4), name: text.slice(0, 40), by: ME, at: Date.now(), items: [] }); });
        dnaState.collection = id;
        ok = true;
        dnaState.refocus = '[data-dna-add="collitem"] input';
      } else if(kind === "collitem"){
        if(!text) return;
        saved = mutateDna(function(d){
          var c = d.collections.filter(function(x){ return x.id === dnaState.collection; })[0];
          if(c){ if(!Array.isArray(c.items)) c.items = []; c.items.unshift({ id: uid("ci"), text: text.slice(0, 60), by: ME, at: Date.now() }); } // nothing is trimmed away
        });
        ok = true;
        dnaState.refocus = '[data-dna-add="collitem"] input';
      }
      if(!saved) return; // what you typed stays in the box
      if(ok || kind === "thing" || kind === "lang") renderDna(true);
    });
    body.addEventListener("click", function(e){
      var t = e.target, hit;
      if((hit = t.closest("[data-dna-chip]"))){
        var key = hit.getAttribute("data-dna-chip"), value = hit.getAttribute("data-value");
        mutateMyDna(function(mine){
          var i = mine[key].indexOf(value);
          if(i > -1) mine[key].splice(i, 1); else mine[key].push(value);
        });
        dnaState.refocus = '[data-dna-chip="'+key+'"][data-value="'+value+'"]';
      } else if((hit = t.closest("[data-dna-remove-thing]"))){
        var cat = hit.getAttribute("data-dna-remove-thing"), i1 = Number(hit.getAttribute("data-i"));
        mutateDna(function(d){ if(Array.isArray(d.things[cat])) d.things[cat].splice(i1, 1); });
      } else if((hit = t.closest("[data-dna-remove-lang]"))){
        var lk = hit.getAttribute("data-dna-remove-lang"), i2 = Number(hit.getAttribute("data-i"));
        mutateDna(function(d){ d.language[lk].splice(i2, 1); });
      } else if((hit = t.closest("[data-dna-world]"))){
        var name = hit.getAttribute("data-dna-world"), full = false;
        mutateDna(function(d){
          var i = d.priorities.indexOf(name);
          if(i > -1) d.priorities.splice(i, 1);
          else if(d.priorities.length < 5) d.priorities.push(name);
          else full = true;
        });
        if(full) showToast("Five is the most. Take one out to add another.");
        dnaState.refocus = '[data-dna-world="'+name+'"]';
      } else if(t.closest("#dnaApplyWorld")){
        var wanted = [];
        dna().priorities.forEach(function(nm){
          var w = DNA_WORLD.filter(function(x){ return x[0] === nm; })[0];
          (w ? w[1] : []).forEach(function(id){ if(wanted.indexOf(id) === -1) wanted.push(id); });
        });
        ["today","more"].forEach(function(group){
          var current = homeOrder(group);
          var top = wanted.filter(function(id){ return current.indexOf(id) > -1; });
          SPACE.custom.homeOrder[group] = top.concat(current.filter(function(id){ return top.indexOf(id) === -1; }));
        });
        SPACE.custom.homeHidden = SPACE.custom.homeHidden.filter(function(id){ return wanted.indexOf(id) === -1; });
        saveSpaceSettings(); applyHomeLayout(); syncSettingsChevs();
        showToast("Your Home is arranged around what matters most.");
        return;
      } else if((hit = t.closest("[data-ritual-done]"))){
        var rid = hit.getAttribute("data-ritual-done"), rname = "";
        mutateDna(function(d){
          var r = d.rituals.filter(function(x){ return x.id === rid; })[0];
          if(r){ r.count = (r.count || 0) + 1; r.last = Date.now(); rname = r.name; }
        });
        petalBurst(hit, 6);
        if(rname) showToast("Kept: " + rname + ".");
      } else if((hit = t.closest("[data-ritual-remove]"))){
        var rr = hit.getAttribute("data-ritual-remove");
        mutateDna(function(d){ d.rituals = d.rituals.filter(function(x){ return !(x.id === rr && x.by === ME); }); });
      } else if((hit = t.closest("[data-coll-open]"))){
        dnaState.collection = hit.getAttribute("data-coll-open");
      } else if(t.closest("[data-coll-back]")){
        dnaState.collection = null;
      } else if((hit = t.closest("[data-coll-item-remove]"))){
        var ci = hit.getAttribute("data-coll-item-remove");
        mutateDna(function(d){
          var c = d.collections.filter(function(x){ return x.id === dnaState.collection; })[0];
          if(c) c.items = (c.items || []).filter(function(x){ return !(x.id === ci && x.by === ME); });
        });
      } else if((hit = t.closest("[data-coll-remove]"))){
        var cr = hit.getAttribute("data-coll-remove");
        mutateDna(function(d){ d.collections = d.collections.filter(function(x){ return !(x.id === cr && x.by === ME); }); });
        dnaState.collection = null;
        showToast("Collection deleted.");
      } else if((hit = t.closest("[data-learn]"))){
        var lkind = hit.getAttribute("data-learn"), dir = Number(hit.getAttribute("data-dir"));
        mutateMyDna(function(mine){ mine.fb[lkind] = Math.max(-3, Math.min(3, (mine.fb[lkind] || 0) + dir)); });
        renderDateIdea();
        dnaState.refocus = '[data-learn="'+lkind+'"][data-dir="'+dir+'"]';
      } else if((hit = t.closest("[data-season]"))){
        var season = hit.getAttribute("data-season");
        mutateDna(function(d){
          if(d.season === season){ d.season = ""; d.seasonBy = ""; }
          else { d.season = season; d.seasonBy = ME; }
        });
        dnaState.refocus = '[data-season="'+season+'"]';
      } else if(t.closest("#dnaPlanSuggestion")){
        var sug = dnaSuggestion();
        closeOverlay("dnaOverlay");
        setView("home");
        var addPlan = document.getElementById("addPlanBtn");
        if(addPlan) addPlan.click();
        var title = document.getElementById("planTitleInput");
        if(title && sug) title.value = sug.text.slice(0, Number(title.getAttribute("maxlength")) || 60);
        return;
      } else {
        return;
      }
      renderDna(true);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Keeping it all in step                                              */
  /* ------------------------------------------------------------------ */
  // The small words on the right of each Settings row.
  function syncSettingsChevs(){
    var me = SPACE.currentUser, qh = SPACE.quietHours, c = SPACE.custom;
    var row = function(id, text){ var b = document.getElementById(id), chev = b && b.querySelector(".chev"); if(chev) chev.textContent = text + " →"; };
    setText("profileChev", me.name + " · " + me.city + " →");
    var ru = reunionParse(SPACE.reunionDate);
    setText("reunionChev", (ru ? ru.label : "Not set") + " →");
    var d = dna(), mine = dnaPerson(ME);
    setText("dnaChev", (d.season || (mine.set ? "Yours is in" : "Start")) + " →");
    var mood = MOODS.filter(function(m){ return m.id === loadMood(); })[0];
    setText("appearanceChev", (mood ? mood.name : "") + " →");
    var bits = [];
    if(c.textSize !== "md") bits.push(c.textSize === "lg" ? "Large text" : "Small text");
    if(c.nick) bits.push("“" + c.nick + "”");
    if(c.homeHidden.length) bits.push(c.homeHidden.length + " hidden");
    setText("customizeChev", (bits.length ? bits.slice(0, 2).join(" · ") : "As it came") + " →");
    setText("perfChev", ({ high:"Sharpest photos", balanced:"Balanced", saver:"Smallest photos" }[SPACE.perf.photoQuality] || "Balanced") + " →");
    setText("notifChev", (qh.enabled ? "Quiet " + clockLabel(qh.start) + " – " + clockLabel(qh.end) : "No quiet hours") + " →");
    var m = membership(), pl = m ? planById(m.plan) : null;
    setText("membershipChev", (pl ? pl.short : "First Chapter") + " →");
    row("soundToggle", SPACE.sound ? "On" : "Off");
    row("petalsToggle", SPACE.petals !== false ? "On" : "Off");
    row("motionLevelToggle", SPACE.motionLevel === "full" ? "Full" : SPACE.motionLevel === "calm" ? "Calm" : "Auto · " + (motionLevel() === "full" ? "Full" : "Calm"));
    row("reducedMotionToggle", document.body.classList.contains("reduced-motion") ? "On" : "Off");
    row("tapFeedbackToggle", SPACE.tapFeedback !== false ? "On" : "Off");
  }
  // Runs after every change to the shared space, yours or your partner's.
  function renderMore(){
    syncSettingsChevs();
    renderBell();
    renderDnaCard();
    applyMembership();
    renderDateIdea();
    if(overlayOpen("dnaOverlay")) renderDna(false);
    if(overlayOpen("membershipOverlay") && !document.getElementById("planConfirm")) renderMembershipOverlay();
    if(overlayOpen("reunionSettingsOverlay")) renderReunionSettings();
  }
  function wireMore(){
    applyCustom();
    var open = {
      "open-inbox":            openInbox,
      "open-profile":          function(){ renderProfileOverlay(); openOverlay("profileOverlay"); },
      "open-reunion-settings": function(){ renderReunionSettings(); openOverlay("reunionSettingsOverlay"); },
      "open-membership":       function(){ renderMembershipOverlay(); openOverlay("membershipOverlay"); },
      "open-performance":      function(){ renderPerfOverlay(); openOverlay("perfOverlay"); },
      "open-about":            function(){ renderAboutOverlay(); openOverlay("aboutOverlay"); },
      "open-customize":        function(){ renderCustomizeOverlay(); openOverlay("customizeOverlay"); },
      "open-dna":              function(){ openDna(); }
    };
    Object.keys(open).forEach(function(action){
      document.querySelectorAll("[data-action='" + action + "']").forEach(function(btn){ btn.addEventListener("click", open[action]); });
    });
    wireDna();
    // The older one-tap rows in Settings repaint their own label; this keeps
    // every other label (and the Performance sheet) in step with them.
    ["soundToggle","petalsToggle","motionLevelToggle","reducedMotionToggle","tapFeedbackToggle"].forEach(function(id){
      var b = document.getElementById(id);
      if(b) b.addEventListener("click", function(){ window.setTimeout(syncSettingsChevs, 0); });
    });
    renderMore();
    localReminders();
    releaseHeld();
    window.setInterval(function(){ releaseHeld(); localReminders(); }, 60000);
  }


  /* ------------------------------------------------------------------ */
  /* PHOTO VIEWER — a photo, whole and uncropped, on the full screen.    */
  /* Tap any photo, anywhere in Pairlum (Shared Day, Parallel Moments,   */
  /* Our Story, a memory, a letter, an import), and it opens like this.  */
  /* Tap again, anywhere, and it goes back to normal.                    */
  /*                                                                    */
  /* A photo that is also a button keeps doing its own job: a timeline   */
  /* tile still opens its memory, a chapter still unfolds its note — and */
  /* the photo inside that memory is the one that goes full screen.      */
  /* Hearts, voice notes, links and videos are never taken over.         */
  /* ------------------------------------------------------------------ */
  var photoViewerFrom = null;
  var PHOTO_CARDS = ".moment-card, .parallel-half, .resurfaced, .history-tile";
  var PHOTO_SKIP = "button, a, input, select, textarea, label, summary, audio, video, [data-heart-id], [data-voice-cta], [data-retry-moment], [data-open-moment]";
  function photoUrlOf(card){
    var layer = card.querySelector(".photo");
    if(!layer || card.querySelector(".moment-video-wrap")) return "";
    var m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(getComputedStyle(layer).backgroundImage || "");
    return m ? m[1] : "";
  }
  // The card shows a small, compressed copy; the viewer asks for a bigger one.
  function sharperPhoto(url){
    return /images\.unsplash\.com/.test(url) ? url.replace(/([?&])w=\d+/, "$1w=1600").replace(/([?&])q=\d+/, "$1q=80") : url;
  }
  function textOf(root, selector){
    var n = root && root.querySelector(selector);
    return n ? n.textContent.replace(/\s+/g, " ").trim() : "";
  }
  // What was tapped → { url, tag, caption, time, from }, or null if it isn't a photo.
  function resolvePhoto(t){
    if(!t || !t.closest || t.closest("#photoViewer") || t.closest(PHOTO_SKIP)) return null;
    var box = t.closest("#memoryViewMedia");
    if(box){
      var mi = box.querySelector("img");
      return mi ? { url: mi.src, tag: textOf(document, "#memoryViewBy"), caption: textOf(document, "#memoryViewCaption"), time: textOf(document, "#memoryViewDate"), from: box } : null;
    }
    var img = t.closest(".letter-photo-polaroid, .letter-photo-thumb img, .imp-thumb img, .capture-preview-img");
    if(img && img.src){
      var inLetter = !!img.closest("#letterPreviewPhotos, #letterPhotoRow");
      return { url: img.src, tag: inLetter ? "Letter" : "", caption: inLetter ? textOf(document, "#letterPreviewTitle") : "", time: "", from: img };
    }
    var card = t.closest(PHOTO_CARDS);
    if(card){
      var url = photoUrlOf(card);
      if(!url) return null;
      return {
        url: url, from: card,
        tag: textOf(card, ".moment-tag, .place, .mono, .eyebrow"),
        caption: textOf(card, ".moment-caption, h3"),
        time: textOf(card, ".moment-time, .time")
      };
    }
    return null;
  }
  function openPhotoViewer(photo){
    var v = document.getElementById("photoViewer"), img = document.getElementById("photoViewerImg");
    if(!v || !img) return;
    var url = photo.url, from = photo.from;
    photoViewerFrom = from;
    setText("photoViewerTag", photo.tag);
    setText("photoViewerCaption", photo.caption);
    setText("photoViewerTime", photo.time);
    img.alt = photo.caption || "Photo";
    var big = sharperPhoto(url);
    img.onerror = function(){
      if(img.getAttribute("src") !== url){ img.src = url; return; }
      closePhotoViewer(true);
      showToast("Couldn't load that photo.");
    };
    img.src = url;                                  // show what is already on screen at once
    if(big !== url){
      var hi = new Image();
      hi.onload = function(){ if(photoViewerFrom === from) img.src = big; };
      hi.src = big;
    }
    var hintEl = v.querySelector(".photo-viewer-hint"); if(hintEl) hintEl.hidden = firstDone("photoView");
    v.classList.add("is-open");
    syncModals();
    document.getElementById("photoViewerClose").focus({ preventScroll:true });
  }
  function closePhotoViewer(quiet){
    var v = document.getElementById("photoViewer");
    if(!v || !v.classList.contains("is-open")) return;
    v.classList.remove("is-open");
    syncModals();
    if(!quiet) markFirst("photoView");
    var back = photoViewerFrom;
    photoViewerFrom = null;
    window.setTimeout(function(){ var img = document.getElementById("photoViewerImg"); if(img && !v.classList.contains("is-open")){ img.onerror = null; img.removeAttribute("src"); } }, 300);
    if(back && back.focus && !quiet && document.contains(back)){
      // Cards are focusable; a bare image or frame isn't, so hand focus to the sheet it lives in.
      if(back.hasAttribute("tabindex")) back.focus({ preventScroll:true });
      else { var sheet = back.closest(".overlay.is-open .sheet"); if(sheet){ sheet.setAttribute("tabindex", "-1"); sheet.focus({ preventScroll:true }); } }
    }
  }
  function wirePhotoViewer(){
    var v = document.getElementById("photoViewer");
    if(!v) return;
    document.addEventListener("click", function(e){
      if(v.classList.contains("is-open")) return;
      var photo = resolvePhoto(e.target);
      if(photo) openPhotoViewer(photo);
    });
    document.addEventListener("keydown", function(e){
      if((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(PHOTO_CARDS) && !v.classList.contains("is-open")){
        var photo = resolvePhoto(e.target.querySelector(".photo") || e.target);
        if(photo){ e.preventDefault(); openPhotoViewer(photo); }
      }
    });
    // Second tap, anywhere: back to normal.
    v.addEventListener("click", function(){ closePhotoViewer(); });
    document.addEventListener("keydown", function(e){
      if(!v.classList.contains("is-open")) return;
      if(e.key === "Escape"){ e.stopPropagation(); closePhotoViewer(); }
      else if(e.key === "Tab"){ e.preventDefault(); document.getElementById("photoViewerClose").focus({ preventScroll:true }); }
    }, true);
    // Cards that really hold a photo can be reached with the keyboard too.
    var mark = function(){
      document.querySelectorAll(PHOTO_CARDS).forEach(function(card){
        var has = !!photoUrlOf(card);
        if(has && !card.hasAttribute("tabindex")){
          card.setAttribute("tabindex", "0");
          card.setAttribute("aria-label", (textOf(card, ".moment-caption, h3, .place") || "Photo") + " — open full screen");
          card.classList.add("has-photo");
        } else if(!has && card.classList.contains("has-photo")){
          card.removeAttribute("tabindex"); card.removeAttribute("aria-label"); card.classList.remove("has-photo");
        }
      });
    };
    var queued = false, schedule = function(){ if(!queued){ queued = true; window.requestAnimationFrame(function(){ queued = false; mark(); }); } };
    ["sharedDayGrid", "parallelFrame"].forEach(function(id){
      var grid = document.getElementById(id);
      if(grid && "MutationObserver" in window) new MutationObserver(schedule).observe(grid, { childList:true, subtree:true, attributes:true, attributeFilter:["style","class"] });
    });
    mark();
  }

  /* ------------------------------------------------------------------ */
  /* US PAGE TABS — "Together" (your shared things) and "Settings".      */
  /* ------------------------------------------------------------------ */
  function showUsTab(name){
    document.querySelectorAll("[data-us-tab]").forEach(function(b){
      var on = b.getAttribute("data-us-tab") === name;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    var t = document.getElementById("usPanelTogether"), st = document.getElementById("usPanelSettings");
    if(t) t.hidden = name !== "together";
    if(st) st.hidden = name !== "settings";
    try{ sessionStorage.setItem("pairlum-us-tab", name); }catch(e){}
  }
  function wireUsTabs(){
    var tabs = document.querySelectorAll("[data-us-tab]");
    if(!tabs.length) return;
    tabs.forEach(function(b){
      b.addEventListener("click", function(){ showUsTab(b.getAttribute("data-us-tab")); });
      b.addEventListener("keydown", function(e){
        if(e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        var next = b.getAttribute("data-us-tab") === "together" ? "settings" : "together";
        showUsTab(next); document.getElementById(next === "together" ? "usTabTogether" : "usTabSettings").focus();
      });
    });
    var saved = null; try{ saved = sessionStorage.getItem("pairlum-us-tab"); }catch(e){}
    showUsTab(saved === "settings" ? "settings" : "together");
  }
  // Anything that points at a thing inside a hidden tab brings that tab forward first.
  function revealUsTabFor(el){
    var panel = el && el.closest && el.closest("#usPanelTogether, #usPanelSettings");
    if(panel && panel.hidden) showUsTab(panel.id === "usPanelSettings" ? "settings" : "together");
  }

  /* ------------------------------------------------------------------ */
  /* FIRST-TIME TIPS — a gentle suggestion beside a feature, shown until */
  /* the person has used it once (or waved it away). After that it is    */
  /* gone for good and the app is just the app. Stored per person.       */
  /* ------------------------------------------------------------------ */
  var FIRSTS_KEY = NS + "pairlum-firsts-v1-" + ME;
  var FIRSTS = (function(){ try{ var v = JSON.parse(localStorage.getItem(FIRSTS_KEY)); return v && typeof v === "object" ? v : {}; }catch(e){ return {}; } })();
  function saveFirsts(){ try{ localStorage.setItem(FIRSTS_KEY, JSON.stringify(FIRSTS)); }catch(e){} }
  function firstDone(k){ return !!FIRSTS[k]; }
  function markFirst(k){
    if(FIRSTS[k]) return;
    FIRSTS[k] = 1; saveFirsts();
    document.querySelectorAll('[data-first-tip="'+k+'"]').forEach(function(t){
      t.classList.add("is-leaving");
      window.setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 320);
    });
    applyFirstGone();
  }
  // Something the person has already done before tips existed counts as done.
  function inferFirsts(){
    var mineOf = function(list){ return list.some(function(x){ return x.by === ME && !x.demo; }); };
    if(mineOf(DB.moments)) FIRSTS.moment = 1;
    if(DB.moments.some(function(m){ return m.by === ME && m.parallel; })) FIRSTS.parallel = 1;
    if(mineOf(DB.letters)) FIRSTS.letter = 1;
    if(mineOf(DB.memories)) FIRSTS["import"] = 1;
    if(DB.chapters.some(function(c){ return !c.demo; })) FIRSTS.chapter = 1;
    if(DB.dna && DB.dna.people && DB.dna.people[ME] && DB.dna.people[ME].set) FIRSTS.dna = 1;
    saveFirsts();
  }
  // Features that were only ever a suggestion disappear once done.
  function applyFirstGone(){
    document.querySelectorAll('[data-home-card="import"]').forEach(function(c){ c.classList.toggle("first-gone", firstDone("import")); });
    var hint = document.querySelector(".photo-viewer-hint");
    if(hint) hint.hidden = firstDone("photoView");
  }
  function firstTips(){
    var p = SPACE.partner.name;
    return [
      { k:"moment",   at:"#fabAdd", mode:"fab", title:"Share your first moment", text:"Tap + to send a photo, a line or a voice note. " + p + " sees it right away." },
      { k:"thinking", at:".thinking-quick-row", mode:"before", title:"The smallest hello", text:"One tap tells " + p + " you're thinking of them. No words, no reply needed." },
      { k:"dq",       at:"#dqFlip", mode:"before", title:"Try today's question", text:"Answer first, then you both see each other's answer at the same time." },
      { k:"parallel", at:"#parallelShare", mode:"before", title:"Show where you are, right now", text:"Share a photo of this moment and it sits beside " + p + "'s, side by side." },
      { k:"letter",   at:"#view-letters [data-action='open-letter']", mode:"before", title:"Write the first letter", text:"Seal one to open tonight, or on a day that matters. " + p + " can't peek early." },
      { k:"chapter",  at:"#storyScrubber", mode:"before", title:"Name your chapters", text:"Chapters are the seasons of your story. Add one and your memories file themselves under it." },
      { k:"dna",      at:"#dnaCard", mode:"before", title:"Say how you two move", text:"A minute of sliders and words, and Pairlum starts to sound like you." }
    ];
  }
  function renderFirstTips(){
    document.querySelectorAll("[data-first-tip]").forEach(function(t){ if(t.parentNode) t.parentNode.removeChild(t); });
    firstTips().forEach(function(tip){
      if(firstDone(tip.k)) return;
      var anchor = document.querySelector(tip.at);
      if(!anchor) return;
      var n = document.createElement("div");
      n.className = "first-tip" + (tip.mode === "fab" ? " first-tip--fab" : "");
      n.setAttribute("data-first-tip", tip.k);
      n.setAttribute("role", "note");
      n.innerHTML = '<span class="first-tip-ic" aria-hidden="true">✦</span>'+
        '<span class="first-tip-copy"><b>'+escapeHtml(tip.title)+'</b><span>'+escapeHtml(tip.text)+'</span></span>'+
        '<button type="button" class="first-tip-x" data-first-dismiss="'+tip.k+'" aria-label="Hide this tip">✕</button>';
      if(tip.mode === "fab") anchor.parentNode.insertBefore(n, anchor);
      else anchor.parentNode.insertBefore(n, anchor);
    });
    applyFirstGone();
  }
  function wireFirstTips(){
    document.addEventListener("click", function(e){
      var x = e.target.closest("[data-first-dismiss]");
      if(x) markFirst(x.getAttribute("data-first-dismiss"));
    });
    var replay = document.getElementById("replayTipsBtn");
    if(replay) replay.addEventListener("click", function(){
      FIRSTS = {}; saveFirsts();
      renderFirstTips();
      showToast("First-time tips are back.");
    });
    inferFirsts();
    renderFirstTips();
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function(){
    if(RECOVERY) window.setTimeout(showRecoveryScreen, 0);
    else window.setTimeout(function(){ retryMediaCleanup(); pruneOldMedia(); resumeUnderstanding(); }, 2500);
    wireMoments(); wireVoiceFind(); setExamplePhrases();
    renderSpaceBindings();
    renderSharedDay();
    renderNeedYou();
    renderNeedRequestOptions();
    renderNotes();
    renderChapters();
    renderLetters();
    renderMemoryTimeline();
    renderAmbient();
    renderDayStory();
    renderDailyQuestion();
    renderImportantDates();
    renderFeeling();
    renderSomeday();
    renderIncomingRequest();
    renderPresenceLine();
    applyPairingGate();
    renderTodayLabel();

    wireNav();
    wireOverlays();
    wireCapture();
    wireNeedRequest();
    wireNeedResponses();
    wireImportFlow();
    wireLetterComposer();
    wireLetterPreview();
    wireLettersGate();
    wireAppearancePicker();
    wireParallax();
    wireParallel();
    renderParallel();
    wireNoteForm();
    wireReducedMotion();
    wireSettingsToggles();
    wireReunionRing();
    wireStoryTimeline();
    wireMomentReactions();
    wireChapterExpand();
    wireDailyQuestion();
    wireImportantDates();
    wireUpcomingReminder();
    wireFeeling();
    wireSomeday();
    wireIncomingRequest();
    wireViewingAs();
    wireMemoryTimeline();
    wireAmbient();
    wireLive();
    wireReunionEditor();
    wirePlans();
    wireSleep();
    wireWaiting();
    wireHold();
    renderWaiting();
    renderOnThisDay();
    renderGarden();
    wireTapFeedback();
    wireQuiz();
    wireDateIdea();
    wireFacts();
    renderQuizCard();
    renderDateIdea();
    renderFacts();
    wireSmallTouches();
    wireFullMotion();
    wireMotion();
    renderPlans();
    renderSleep();
    wireMore();
    wirePhotoViewer();
  wireUsTabs();
  wireFirstTips();
  wireBook();
  wireLivePillSpace();

    tickClocks();
    window.setInterval(tickClocks, 30000);

    buildWaveform(document.getElementById("needWaveform"), 40);
  });

})();
