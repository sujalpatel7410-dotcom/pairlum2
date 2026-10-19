// Pairlum sync bridge — connects app.js's existing local-storage data model
// to a real Supabase backend WITHOUT changing app.js's readShared/writeShared
// or its "storage" listener (see app.js:330-338's own comment — those three
// seams are exactly what this file replaces, just from the outside).
//
// How: before app.js ever runs, this seeds localStorage with the real,
// authoritative record fetched from Supabase. From then on:
//   - outbound: a wrapped localStorage.setItem notices app.js's own writes
//     to the shared-record key and pushes them to Supabase in the background.
//   - inbound: a Supabase Realtime subscription writes incoming changes into
//     localStorage and fires a *synthetic* "storage" event — the exact event
//     app.js already listens for (as if another tab/device had written it).
// app.js never needs to know any of this is happening.
//
// In demo mode (no supabaseUrl/supabaseAnonKey set) PairlumSync.boot()
// resolves immediately and nothing here touches storage at all — the app
// behaves exactly as the original local-only prototype.
window.PairlumSync = (function(){
  "use strict";
  var NS = typeof window.PAIRLUM_STORAGE_NS === "string" ? window.PAIRLUM_STORAGE_NS : "";
  var SHARED_KEY = NS + "pairlum-shared-space-v1";
  var PAIRING_KEY = NS + "pairlum-pairing-v1";
  var ME_KEY = NS + "pairlum-me-v1";
  // "I Need You" live listening and the Hold-the-Heart minigame each use
  // their own localStorage key purely as an ephemeral cross-tab signaling
  // channel (WebRTC offer/answer/ICE, a "holding" presence ping) — never
  // durable data, so these are relayed over a realtime broadcast instead of
  // being written to the spaces table. See SIGNAL_KEYS below.
  var LIVE_SIGNAL_KEY = NS + "pairlum-live-signal-v1";
  var HOLD_SIGNAL_KEY = NS + "pairlum-hold-signal-v1";
  var SIGNAL_KEYS = [LIVE_SIGNAL_KEY, HOLD_SIGNAL_KEY];
  // A partner's invite token this browser received: set by auth.html when it
  // sees ?invite=TOKEN, read (and cleared once settled) here — see boot().
  var PENDING_INVITE_KEY = NS + "pairlum-pending-invite";
  // MY OWN invite's raw token, kept on the device that created it. The
  // database stores only a hash, so this is the only place the link can be
  // shown again after a reload; on any other device, "make a new link".
  var MY_INVITE_KEY = NS + "pairlum-my-invite-v1";
  // Set when a link couldn't be used because this account is already
  // connected — app.js shows it once as a toast, then removes it.
  var INVITE_NOTICE_KEY = NS + "pairlum-invite-notice";

  var B = window.PairlumBackend;
  var configured = B && B.isConfigured();
  var rawSetItem = localStorage.setItem.bind(localStorage);
  var rawGetItem = localStorage.getItem.bind(localStorage);
  var cfgHours = Number((window.PAIRLUM_CONFIG || {}).inviteValidHours);
  var INVITE_VALID_HOURS = cfgHours >= 1 && cfgHours <= 168 ? cfgHours : 48;

  var state = { spaceId: null, role: null, myId: null, serverRev: 0, applyingRemote: false, sub: null, inviteId: null, offerToken: null };

  function readJson(key){ try{ return JSON.parse(rawGetItem(key) || "null"); }catch(e){ return null; } }
  function forget(key){ try{ localStorage.removeItem(key); }catch(e){} }
  // Accepts a bare token or a whole pasted invite link.
  function inviteTokenFrom(text){
    var s = String(text || "").trim();
    var m = /[?&]invite=([^&#\s]+)/.exec(s);
    if(m){ try{ s = decodeURIComponent(m[1]); }catch(e){ s = m[1]; } }
    return /^[A-Za-z0-9_-]{8,}$/.test(s) ? s : "";
  }

  function dispatchStorage(key, newValue){
    try{
      window.dispatchEvent(new StorageEvent("storage", { key: key, newValue: newValue, storageArea: localStorage, url: location.href }));
    }catch(e){
      // older engines: StorageEvent isn't constructible with an init dict.
      try{
        var ev = document.createEvent("StorageEvent");
        ev.initStorageEvent("storage", false, false, key, null, newValue, location.href, localStorage);
        window.dispatchEvent(ev);
      }catch(e2){}
    }
  }
  function writeLocal(key, value){
    state.applyingRemote = true;
    try{ rawSetItem(key, value); }finally{ state.applyingRemote = false; }
  }
  function applyRemoteSpace(row){
    if(!row) return;
    state.serverRev = row.rev;
    writeLocal(SHARED_KEY, JSON.stringify(row.data));
    dispatchStorage(SHARED_KEY, JSON.stringify(row.data));
  }
  function setPairing(patch){
    var cur = {}; try{ cur = JSON.parse(rawGetItem(PAIRING_KEY) || "{}") || {}; }catch(e){}
    var next = Object.assign({}, cur, patch);
    var json = JSON.stringify(next);
    writeLocal(PAIRING_KEY, json);
    dispatchStorage(PAIRING_KEY, json);
  }

  // ---- outbound: app.js's own writeShared() calls localStorage.setItem ----
  var pendingTimer = null, DEBOUNCE_MS = 350;
  function schedulePush(){
    if(pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(flushPush, DEBOUNCE_MS);
  }
  function flushPush(){
    pendingTimer = null;
    if(!state.spaceId) return;
    var raw = rawGetItem(SHARED_KEY);
    if(!raw) return;
    var data; try{ data = JSON.parse(raw); }catch(e){ return; }
    B.writeSpaceData(state.spaceId, data, state.serverRev).then(function(row){
      if(row){ state.serverRev = row.rev; return; }
      // Conflict: someone else's write landed first. Pull the authoritative
      // row in through the normal "storage" event path — app.js's own
      // replayLostOps() (see app.js:566-574) will reapply this tab's recent
      // changes on top of it and writeShared() will run again naturally,
      // which this same patched setItem will then push on the next tick.
      return B.fetchSpace(state.spaceId).then(applyRemoteSpace);
    }).catch(function(err){
      console.warn("Pairlum sync: couldn't reach the server, will retry on the next change.", err);
    });
  }
  // Push the shared record right now instead of after the usual short pause,
  // and say whether it landed. On a clash with the partner's change, pull
  // their version in (so a retry works on fresh data) and report false.
  function pushNow(){
    if(pendingTimer){ clearTimeout(pendingTimer); pendingTimer = null; }
    if(!state.spaceId) return Promise.resolve(true);
    var raw = rawGetItem(SHARED_KEY);
    if(!raw) return Promise.resolve(true);
    var data; try{ data = JSON.parse(raw); }catch(e){ return Promise.resolve(false); }
    return B.writeSpaceData(state.spaceId, data, state.serverRev).then(function(row){
      if(row){ state.serverRev = row.rev; return true; }
      return B.fetchSpace(state.spaceId).then(applyRemoteSpace).then(function(){ return false; });
    });
  }
  function installOutboundHook(){
    localStorage.setItem = function(key, value){
      rawSetItem(key, value);
      if(state.applyingRemote) return;
      if(key === SHARED_KEY) schedulePush();
      else if(SIGNAL_KEYS.indexOf(key) > -1 && state.sub) state.sub.broadcast({ key: key, value: value });
    };
  }

  // ---- inbound: realtime ----
  function installRealtime(){
    state.sub = B.subscribeSpace(state.spaceId, function(row){
      applyRemoteSpace(row);
    }, function(memberRow){
      // The partner just accepted the invite: tell app.js's pairing listener.
      B.partnerRow(state.spaceId, state.role).then(function(partner){
        if(!partner) return;
        forget(MY_INVITE_KEY);
        state.inviteId = null;
        setPairing({ status: "joined", joinedAt: partner.joined_at, inviteId: null, inviteToken: null, inviteExpiresAt: null });
      });
    }, function(memberRow){
      // A member row's status changed — see leaveSpace/rejoinSpace/
      // disconnectSpace in pairlum-backend.js.
      if(memberRow.status === "disconnected"){
        // Terminal, and shared: whichever side changed, both accounts are
        // now free of this space. Reload so boot() re-reads membership
        // (myMembership() only returns active rows) and renders the real
        // "not started" state, same as a fresh account. Covers both the
        // partner's device and this same account's other open tabs/devices.
        location.reload();
        return;
      }
      // Leave/rejoin only ever affects the leaver's own writes (app.js's
      // own "Leave" copy: the partner "keeps this space exactly as it is —
      // nothing changes on their side") — there's no UI for "your partner
      // left", so only reflect this when it's MY OWN row, to keep this
      // same account's other open tabs/devices in step.
      if(memberRow.role !== state.role) return;
      setPairing({ status: memberRow.status === "left" ? "left" : "joined" });
    }, function(msg){
      // A live-audio or hold-the-heart signal from the partner's device —
      // write it where app.js's own listener already expects it (app.js
      // :5474, :6992), as if it had come from another tab.
      if(!msg || SIGNAL_KEYS.indexOf(msg.key) === -1) return;
      writeLocal(msg.key, msg.value);
      dispatchStorage(msg.key, msg.value);
    }, function(){
      // The plan changed on the server (e.g. a payment went through).
      refreshPlan();
    });
  }

  // ---- the space's plan (server-owned — see schema.sql's memberships) ----
  // Kept as { known, plan, at } under PLAN_KEY so app.js can read it
  // synchronously as it loads. plan is null for the free First Chapter;
  // known is false only when the server couldn't be asked, so app.js can say
  // so instead of pretending. Book eligibility is the server's answer, never
  // worked out here or in app.js.
  var PLAN_KEY = NS + "pairlum-plan-v1";
  function setPlan(value){
    var json = JSON.stringify(value);
    writeLocal(PLAN_KEY, json);
    try{ window.dispatchEvent(new CustomEvent("pairlum:plan", { detail: value })); }catch(e){}
  }
  function refreshPlan(){
    if(!state.spaceId){ setPlan({ known: true, plan: null, at: Date.now() }); return Promise.resolve(); }
    return B.planMembership(state.spaceId).then(function(p){
      setPlan({ known: true, at: Date.now(), plan: p ? {
        plan: p.plan, startedAt: p.started_at, endsAt: p.ends_at, active: !!p.active,
        bookEligibleAt: p.book_eligible_at, bookEligible: !!p.book_eligible
      } : null });
    }, function(){
      // Keep whatever was last known; if nothing was, say it's unknown.
      var prev = readJson(PLAN_KEY);
      if(!prev || prev.known === undefined) setPlan({ known: false, plan: null, at: Date.now() });
    });
  }

  // ---- media bridge, used by small hooks added to idbPutMedia/idbGetMedia/
  // idbDeleteMedia in app.js, so a partner's device can actually fetch
  // photos/voice the other partner captured (today those bytes only ever
  // lived in that one browser's IndexedDB). ----
  // Uploads that haven't happened yet. A photo, clip or voice note always
  // lands in this device's IndexedDB first; its upload to the shared space
  // used to be fire-and-forget, so one failed request (or a profile photo
  // set before any space existed) meant the partner never got the file. Now
  // its id is remembered until an upload actually succeeds, and retried at
  // start-up, when the connection comes back, and every minute meanwhile.
  var PENDING_MEDIA_KEY = NS + "pairlum-media-pending-v1";
  function pendingMedia(){ var l = readJson(PENDING_MEDIA_KEY); return Array.isArray(l) ? l : []; }
  function setPendingMedia(l){ try{ rawSetItem(PENDING_MEDIA_KEY, JSON.stringify(l)); }catch(e){} }
  function rememberUpload(id){ var l = pendingMedia(); if(l.indexOf(id) === -1){ l.push(id); setPendingMedia(l); } }
  function forgetUpload(id){ var l = pendingMedia(); if(l.indexOf(id) > -1) setPendingMedia(l.filter(function(x){ return x !== id; })); }
  var flushing = false;
  function flushPendingMedia(){
    var reader = window.PairlumMediaBridge && window.PairlumMediaBridge.readLocal;
    if(flushing || !configured || !state.spaceId || typeof reader !== "function") return;
    var list = pendingMedia();
    if(!list.length) return;
    flushing = true;
    var i = 0;
    (function next(){
      if(i >= list.length){ flushing = false; return; }
      var id = list[i++];
      reader(id, function(blob){
        // null: no longer on this device (deleted meanwhile) — nothing to send.
        // undefined: couldn't read it right now — keep it for the next try.
        if(blob === null){ forgetUpload(id); next(); return; }
        if(!blob){ next(); return; }
        B.uploadMedia(state.spaceId, id, blob).then(function(){ forgetUpload(id); next(); }, function(){ next(); });
      });
    })();
  }
  var retriesInstalled = false;
  function installMediaRetries(){
    if(retriesInstalled) return;
    retriesInstalled = true;
    try{ window.addEventListener("online", flushPendingMedia); }catch(e){}
    setInterval(function(){ if(pendingMedia().length) flushPendingMedia(); }, 60000);
    // app.js registers PairlumMediaBridge.readLocal as it loads, after boot.
    setTimeout(flushPendingMedia, 3000);
  }

  window.PairlumMediaBridge = {
    upload: function(id, blob){
      if(!configured) return;
      if(!state.spaceId){ rememberUpload(id); return; }
      B.uploadMedia(state.spaceId, id, blob).then(function(){ forgetUpload(id); }, function(err){
        rememberUpload(id);
        console.warn("Pairlum: couldn't upload yet, will retry", id, err);
      });
    },
    download: function(id, cb){
      if(!configured || !state.spaceId) return cb(null, null);
      B.downloadMedia(state.spaceId, id).then(function(blob){ cb(null, blob); }, function(){ cb(null, null); });
    },
    remove: function(id){
      forgetUpload(id);
      if(!configured || !state.spaceId) return;
      B.deleteMedia(state.spaceId, id).catch(function(){});
    }
    // readLocal(id, cb) is added by app.js — a local-only IndexedDB read.
  };

  // ---- role → app.js's internal ids. Arbitrary but fixed mapping: role 'a'
  // is app.js's "u_aarav" id, role 'b' is "u_mira" — these are just internal
  // object keys (see app.js's profiles{} override), never shown as-is. ----
  function roleToId(role){ return role === "b" ? "u_mira" : "u_aarav"; }

  function deriveDisplayName(session){
    var email = (session && session.user && session.user.email) || "";
    var local = email.split("@")[0] || "You";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  // My own local, pre-space profile edits (Settings → Profile, made before
  // any real space existed to sync them to — they only ever landed in
  // localStorage until now). Falls back to a name derived from the email
  // for whatever was never touched, so setting your name first and THEN
  // creating or accepting an invite doesn't lose it the moment a real space
  // exists.
  // Before joining anyone, this device kept my profile photo as app.js's
  // "avatar:u_aarav" — but in the space I'm joining, u_aarav is my partner.
  // Move it to my new slot (u_mira) so it neither shows up as their picture
  // nor gets uploaded over it. Resolves true if a photo was moved.
  function moveMyAvatarToJoinerSlot(){
    return new Promise(function(resolve){
      try{
        var r = indexedDB.open(NS + "pairlum-media-v1", 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore("media"); };
        r.onerror = function(){ resolve(false); };
        r.onsuccess = function(){
          try{
            var tx = r.result.transaction("media", "readwrite"), store = tx.objectStore("media"), moved = false;
            var get = store.get("avatar:u_aarav");
            get.onsuccess = function(){
              if(!get.result) return;
              store.put(get.result, "avatar:u_mira");
              store.delete("avatar:u_aarav");
              moved = true;
            };
            tx.oncomplete = function(){ resolve(moved); };
            tx.onerror = tx.onabort = function(){ resolve(false); };
          }catch(e){ resolve(false); }
        };
      }catch(e){ resolve(false); }
    });
  }

  // Read from whichever profile slot this device has been using for me so
  // far — before joining anyone's space that is always app.js's "u_aarav"
  // (boot() sets it for a space-less account, and anyone who started their
  // own space is its role 'a').
  function localProfileFallback(session){
    var saved = {}, me = "u_aarav";
    try{ saved = JSON.parse(rawGetItem(SHARED_KEY) || "{}").profiles || {}; }catch(e){}
    try{ me = sessionStorage.getItem(ME_KEY) || "u_aarav"; }catch(e){}
    return Object.assign({ name: deriveDisplayName(session) }, saved[me] || {});
  }

  // Internal: makes sure the caller has a space to attach an invite to,
  // creating one (and stamping a real display name in) if needed. Sets
  // state.spaceId/state.role in memory immediately — not only after a reload
  // — so a failed invite creation can be retried without trying to create a
  // second space.
  function ensureSpace(session){
    if(state.spaceId) return Promise.resolve(state.spaceId);
    var mine = localProfileFallback(session);
    return B.createSpace().then(function(space){
      state.spaceId = space.id;
      state.role = "a";
      var data = space.data || {};
      data.profiles = data.profiles || {};
      data.profiles.u_aarav = mine;
      // Neutral placeholder until the real partner accepts and stamps their
      // own name in (see PairlumSpace.acceptInviteOffer below) — otherwise
      // the pairing screen would show the leftover demo name "Mira".
      data.profiles.u_mira = { name: "Your partner" };
      return B.writeSpaceData(space.id, data, space.rev).then(function(){ return space.id; });
    });
  }

  // Wipes every bit of this account's data cached on this device: all of
  // localStorage (the shared-space cache, pairing state, settings, drafts,
  // the inbox, everything app.js's own account-deletion path already lists
  // individually) and the IndexedDB database holding photo/video/voice
  // bytes. Blunt on purpose — "a different person may use this browser
  // next" calls for nothing left over, not a key-by-key allowlist that can
  // drift out of date as app.js grows new localStorage keys.
  function clearLocalCache(){
    try{ localStorage.clear(); }catch(e){}
    try{ indexedDB.deleteDatabase(NS + "pairlum-media-v1"); }catch(e){}
  }

  window.PairlumSpace = {
    isConfigured: function(){ return configured; },
    hasSpace: function(){ return !!state.spaceId; },
    role: function(){ return state.role; },
    inviteTokenFrom: inviteTokenFrom,
    // The space's plan as last fetched from the server: { known, plan, at }.
    plan: function(){ return readJson(PLAN_KEY); },
    // A link (or token) pasted into the pairing screen goes through exactly
    // the same path as one opened from a message: keep it, reload, and let
    // boot() show the "Join our Pairlum?" confirmation with the inviter's
    // name. Returns false if it doesn't look like an invite at all.
    openInvite: function(text){
      var t = inviteTokenFrom(text);
      if(!t) return false;
      try{ rawSetItem(PENDING_INVITE_KEY, t); }catch(e){ return false; }
      location.reload();
      return true;
    },
    // Creates this account's space first if it doesn't have one yet (see
    // ensureSpace above), then a new invite link for it. A new link always
    // replaces any older one (the server cancels it). The raw token is kept
    // on this device only, so the link can be shown again after a reload.
    createInvite: function(){
      return B.getSession().then(function(session){
        return ensureSpace(session).then(function(spaceId){ return B.createInvite(spaceId, INVITE_VALID_HOURS); });
      }).then(function(inv){
        if(!inv || !inv.token) throw new Error("Couldn't create an invite. Try again.");
        try{ rawSetItem(MY_INVITE_KEY, JSON.stringify({ id: inv.invite_id, token: inv.token, expiresAt: inv.expires_at })); }catch(e){}
        state.inviteId = inv.invite_id;
        setPairing({ status: "invite_ready", inviteId: inv.invite_id, inviteToken: inv.token, inviteExpiresAt: inv.expires_at });
        // There's a space now: anything saved before it existed (e.g. a
        // profile photo) can finally go up.
        installMediaRetries();
        flushPendingMedia();
        return inv;
      });
    },
    cancelInvite: function(){
      return B.cancelInvite(state.inviteId).then(function(){
        forget(MY_INVITE_KEY);
        state.inviteId = null;
        setPairing({ status: "not_started", inviteId: null, inviteToken: null, inviteExpiresAt: null });
      });
    },
    // The OTHER side of pairing: this browser holds a partner's invite token
    // (from opening their link — see boot() below), not yet accepted.
    // `token` is optional — omit it to accept the link this browser opened;
    // pass one to accept a link or token pasted into the fallback field.
    acceptInviteOffer: function(token){
      var t = token || state.offerToken;
      if(!t) return Promise.reject(new Error("That doesn't look like a Pairlum invite link."));
      return B.getSession().then(function(session){
        return B.redeemInvite(t).then(function(space){
          // accept_pairing_invite only adds the space_members row — it leaves
          // profiles.u_mira as the inviter's neutral "Your partner" seed, so
          // stamp my real profile in now, the same way ensureSpace does for
          // the inviter's side. The join itself has already succeeded at this
          // point, so nothing after it may surface as "couldn't join".
          var mine = localProfileFallback(session);
          return moveMyAvatarToJoinerSlot().then(function(moved){
            if(!moved) delete mine.photoAt; // no photo here to show
            // Anything queued for upload belonged to my space-less self; the
            // only thing worth carrying over is the photo, under its new id.
            setPendingMedia(moved ? ["avatar:u_mira"] : []);
            var data = space.data || {};
            data.profiles = data.profiles || {};
            data.profiles.u_mira = mine;
            return B.writeSpaceData(space.id, data, space.rev);
          }).catch(function(err){
            console.warn("Pairlum: joined, but couldn't save your profile yet — set it in Profile.", err);
          });
        });
      }).then(function(){
        forget(PENDING_INVITE_KEY);
        forget(MY_INVITE_KEY);
        location.reload();
      });
    },
    // "Not now" on the Join screen, or "OK" on a link that can't be used:
    // forget the link and reload, so boot() shows this account's own state
    // (blank, or its own space and invite) instead of the offer.
    declineInviteOffer: function(){
      forget(PENDING_INVITE_KEY);
      location.reload();
    },
    // "Try again" after the link couldn't be checked (e.g. offline) — the
    // link is still kept, so a reload simply checks it again.
    retryInviteCheck: function(){ location.reload(); },
    // Steps away without ending the connection: pauses writes for THIS
    // account only (write_space_data requires the caller to be 'active') —
    // the partner keeps reading and writing normally. setPairing updates
    // this tab immediately; the realtime UPDATE handler above carries it to
    // this same account's other open tabs/devices.
    leave: function(){
      return B.leaveSpace(state.spaceId).then(function(){
        setPairing({ status: "left" });
      });
    },
    rejoin: function(){
      return B.rejoinSpace(state.spaceId).then(function(){
        setPairing({ status: "joined" });
      });
    },
    // Permanently ends the pairing for both accounts. Reload so boot() sees
    // "no active membership" and renders fresh, same as a brand-new account.
    disconnect: function(){
      return B.disconnectSpace(state.spaceId).then(function(){ location.reload(); });
    },
    // "Delete my account", server half. app.js has already removed my own
    // content from the shared record (locally) and from this device; here:
    // delete my files from storage, make sure that removal actually reached
    // the server, then delete the account itself, sign out and wipe this
    // device. Rejects — with nothing deleted on the server — if any step
    // before the final one fails, so the person can simply try again.
    deleteAccount: function(mediaIds){
      var ids = (mediaIds || []).filter(function(id){ return id && String(id).indexOf("orig:") !== 0; });
      var removeFiles = state.spaceId && ids.length ? B.deleteMedia(state.spaceId, ids).catch(function(){}) : Promise.resolve();
      return removeFiles.then(pushNow).then(function(ok){
        if(!ok) throw new Error("Your partner changed something at the same moment, so your account wasn't deleted yet. Tap Delete again.");
        return B.deleteMyAccount();
      }).then(function(){
        return B.signOut().catch(function(){});
      }).then(function(){
        clearLocalCache();
        location.href = "index.html";
      });
    },
    // A real sign-out is also "a different person may use this device next":
    // clear every bit of this account's cached data first, not just the
    // Supabase session, so nothing of theirs lingers for whoever signs in
    // after them on the same browser.
    signOut: function(){ return B.signOut().then(function(){ clearLocalCache(); location.href = "index.html"; }); }
  };

  // ---- invite links during boot --------------------------------------------
  // If this browser holds a partner's invite link, check it (read-only) and
  // turn the result into a pairing-state patch: the Join screen when it's
  // usable, a plain explanation when it isn't. Never accepts anything.
  // Resolves to a patch, or null when there's nothing to show.
  function checkPendingInvite(){
    var token = inviteTokenFrom(rawGetItem(PENDING_INVITE_KEY));
    if(!token){ forget(PENDING_INVITE_KEY); return Promise.resolve(null); }
    state.offerToken = token;
    return B.invitePreview(token).then(function(p){
      var s = (p && p.state) || "invalid";
      if(s === "valid") return { status: "invite_offer", inviteFromName: p.inviter_name || "Your partner", inviteOfferExpiresAt: p.expires_at };
      // Everything else is final for this link — stop holding on to it.
      forget(PENDING_INVITE_KEY);
      state.offerToken = null;
      if(s === "already_paired"){
        try{ sessionStorage.setItem(INVITE_NOTICE_KEY, "already_paired"); }catch(e){}
        return null;
      }
      return { status: "invite_problem", inviteProblem: s };
    }, function(){
      // The check itself failed (offline, server unreachable): the link may
      // be perfectly fine, so keep it and offer a retry.
      return { status: "invite_problem", inviteProblem: "network" };
    });
  }
  // My own pending invite for this space, if any. Shows the link again when
  // this device created it; otherwise says one is waiting and offers a new
  // link (the old token can't be read back from the database).
  function restoreMyInvite(){
    return B.myPendingInvite(state.spaceId).then(function(inv){
      var mine = readJson(MY_INVITE_KEY);
      if(!inv){
        forget(MY_INVITE_KEY);
        state.inviteId = null;
        setPairing({ status: "not_started", inviteId: null, inviteToken: null, inviteExpiresAt: null });
        return;
      }
      state.inviteId = inv.id;
      var expired = Date.parse(inv.expires_at) <= Date.now();
      setPairing({
        status: expired ? "invite_expired" : "invite_ready",
        inviteId: inv.id,
        inviteToken: !expired && mine && mine.id === inv.id ? mine.token : null,
        inviteExpiresAt: inv.expires_at
      });
    });
  }

  // ---- boot ----------------------------------------------------------------
  function boot(){
    if(!configured) return Promise.resolve({ configured: false });
    installOutboundHook();
    return B.getSession().then(function(session){
      if(!session){ location.replace("auth.html#login"); return Promise.reject(new Error("no session")); }
      state.myId = session.user.id;
      return B.myMembership(state.myId);
    }).then(function(membership){
      // A partner's link opened in this browser (before or while signing in —
      // see auth.html) is checked first, whatever this account's own state.
      // Accepting only ever happens when they tap Join, never here.
      return checkPendingInvite().then(function(offer){ return bootWith(membership, offer); });
    });
  }
  function bootWith(membership, offer){
    if(!membership){
      // Signed in, but this account hasn't started or joined a space yet.
      // Seed a blank, local-only record so app.js renders a real empty shell.
      writeLocal(SHARED_KEY, JSON.stringify(B.emptySpaceSeed()));
      try{ sessionStorage.setItem(ME_KEY, "u_aarav"); }catch(e){}
      setPairing(offer || { status: "not_started", inviteId: null, inviteToken: null, inviteExpiresAt: null, joinedAt: null });
      setPlan({ known: true, plan: null, at: Date.now() }); // no space yet = no plan
      return { configured: true, hasSpace: false };
    }
    state.spaceId = membership.spaceId;
    state.role = membership.role;
    try{ sessionStorage.setItem(ME_KEY, roleToId(state.role)); }catch(e){}
    var paired = false;
    return B.fetchSpace(state.spaceId).then(function(row){
      state.serverRev = row.rev;
      writeLocal(SHARED_KEY, JSON.stringify(row.data));
      // The plan is fetched before app.js loads (it reads it synchronously).
      // refreshPlan never rejects, so a slow or failed check can't block boot.
      return refreshPlan();
    }).then(function(){
      return B.partnerRow(state.spaceId, state.role);
    }).then(function(partner){
      if(partner){
        paired = true;
        forget(MY_INVITE_KEY);
        setPairing({ status: "joined", joinedAt: partner.joined_at, inviteId: null, inviteToken: null, inviteExpiresAt: null });
      } else {
        // No partner yet: restore my own in-flight invite, if I made one, so a
        // reload doesn't lose the "here's your link" screen.
        return restoreMyInvite();
      }
    }).then(function(){
      // Restore "left" across a reload — myMembership() only falls back to a
      // 'left' row when there's no active one.
      if(membership.status === "left") setPairing({ status: "left" });
      if(offer && paired){
        // Already connected: a leftover link must never replace "joined"
        // (that would pause Shared Day). Drop it and say why, once.
        forget(PENDING_INVITE_KEY);
        if(offer.status === "invite_offer"){ try{ sessionStorage.setItem(INVITE_NOTICE_KEY, "already_paired"); }catch(e){} }
      } else if(offer){
        // A space nobody else has joined yet: their partner's link takes over
        // the screen, since that's the space they actually mean to be in.
        setPairing(offer);
      }
      installRealtime();
      installMediaRetries();
      return { configured: true, hasSpace: true };
    });
  }

  return { boot: boot };
})();
