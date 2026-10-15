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
  // Set by auth.html when it sees ?invite=CODE in the URL, read (and
  // cleared) here once a session exists — see boot() and auth.html.
  var PENDING_INVITE_KEY = NS + "pairlum-pending-invite";

  var B = window.PairlumBackend;
  var configured = B && B.isConfigured();
  var rawSetItem = localStorage.setItem.bind(localStorage);
  var rawGetItem = localStorage.getItem.bind(localStorage);

  var state = { spaceId: null, role: null, myId: null, serverRev: 0, applyingRemote: false, sub: null, inviteCode: null };

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
      // The partner just redeemed the invite: tell app.js's pairing listener.
      B.partnerRow(state.spaceId, state.role).then(function(partner){
        if(partner) setPairing({ status: "joined", joinedAt: partner.joined_at, inviteCode: null });
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
    });
  }

  // ---- media bridge, used by small hooks added to idbPutMedia/idbGetMedia/
  // idbDeleteMedia in app.js, so a partner's device can actually fetch
  // photos/voice the other partner captured (today those bytes only ever
  // lived in that one browser's IndexedDB). ----
  window.PairlumMediaBridge = {
    upload: function(id, blob){
      if(!configured || !state.spaceId) return;
      B.uploadMedia(state.spaceId, id, blob).catch(function(err){ console.warn("Pairlum media upload failed", id, err); });
    },
    download: function(id, cb){
      if(!configured || !state.spaceId) return cb(null, null);
      B.downloadMedia(state.spaceId, id).then(function(blob){ cb(null, blob); }, function(){ cb(null, null); });
    },
    remove: function(id){
      if(!configured || !state.spaceId) return;
      B.deleteMedia(state.spaceId, id).catch(function(){});
    }
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
  function localProfileFallback(session){
    var saved = {};
    try{ saved = JSON.parse(rawGetItem(SHARED_KEY) || "{}").profiles || {}; }catch(e){}
    return { aarav: Object.assign({ name: deriveDisplayName(session) }, saved.u_aarav || {}),
             mira: Object.assign({ name: deriveDisplayName(session) }, saved.u_mira || {}) };
  }

  // Internal: makes sure the caller has a space to attach an invite to,
  // creating one (and stamping a real display name in) if needed. Sets
  // state.spaceId/state.role in memory immediately — not only after a reload
  // — so a failed invite creation can be retried without trying to create a
  // second space.
  function ensureSpace(session){
    if(state.spaceId) return Promise.resolve(state.spaceId);
    var mine = localProfileFallback(session).aarav;
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
    // Creates this account's space first if it doesn't have one yet (see
    // ensureSpace above), then a shareable invite for it — or re-fetches
    // the existing pending one, so opening the pairing screen twice doesn't
    // invalidate a link already sent. No reload needed: the pairing panel
    // re-renders straight from the returned code.
    createInvite: function(){
      return B.getSession().then(function(session){
        return ensureSpace(session).then(function(spaceId){ return B.createInvite(spaceId); });
      }).then(function(inv){
        state.inviteCode = inv.code;
        setPairing({ status: "invite_ready", inviteCode: inv.code, inviteSentAt: inv.created_at });
        return inv;
      });
    },
    revokeInvite: function(){
      return B.revokeInvite(state.inviteCode).then(function(){
        state.inviteCode = null;
        setPairing({ status: "not_started", inviteCode: null, inviteSentAt: null });
      });
    },
    // The OTHER side of pairing: this browser is holding a pending invite
    // code (from opening a link — see boot() below), not yet redeemed.
    // These act on that stashed code, not on state.spaceId (this account
    // doesn't have a space yet — that's the point).
    // `code` is optional — omit it to redeem the stashed offer from a link
    // (state.inviteCode); pass one to redeem a code typed directly into the
    // "Already have an invite code?" fallback field instead.
    acceptInviteOffer: function(code){
      return B.getSession().then(function(session){
        return B.redeemInvite(code || state.inviteCode).then(function(space){
          // redeem_space_invite only adds the space_members row — it leaves
          // profiles.u_mira as the inviter's neutral "Your partner" seed, so
          // stamp a real name in now, the same way ensureSpace does for the
          // inviter's own side.
          var mine = localProfileFallback(session).mira;
          var data = space.data || {};
          data.profiles = data.profiles || {};
          data.profiles.u_mira = mine;
          return B.writeSpaceData(space.id, data, space.rev);
        });
      }).then(function(){
        try{ localStorage.removeItem(PENDING_INVITE_KEY); }catch(e){}
        location.reload();
      });
    },
    declineInviteOffer: function(){
      try{ localStorage.removeItem(PENDING_INVITE_KEY); }catch(e){}
      state.inviteCode = null;
      setPairing({ status: "not_started", inviteCode: null, inviteFromName: null });
    },
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
    // A real sign-out is also "a different person may use this device next":
    // clear every bit of this account's cached data first, not just the
    // Supabase session, so nothing of theirs lingers for whoever signs in
    // after them on the same browser.
    signOut: function(){ return B.signOut().then(function(){ clearLocalCache(); location.href = "index.html"; }); }
  };

  // ---- boot ----------------------------------------------------------------
  function boot(){
    if(!configured) return Promise.resolve({ configured: false });
    installOutboundHook();
    return B.getSession().then(function(session){
      if(!session){ location.replace("auth.html#login"); return Promise.reject(new Error("no session")); }
      state.myId = session.user.id;
      return B.myMembership(state.myId);
    }).then(function(membership){
      if(!membership){
        // Signed in, but this account hasn't started or joined a space yet.
        // Seed a blank, local-only record so app.js renders a real empty
        // shell either way.
        writeLocal(SHARED_KEY, JSON.stringify(B.emptySpaceSeed()));
        try{ sessionStorage.setItem(ME_KEY, "u_aarav"); }catch(e){}
        // This browser may be holding a pending invite code (opened a link
        // before or while signing in — see auth.html). If so, show the
        // "Join this Pairlum?" confirmation instead of the plain "create
        // your own invite" screen; redeeming only happens if they tap Join
        // (PairlumSpace.acceptInviteOffer), never automatically here.
        var pendingCode = null;
        try{ pendingCode = localStorage.getItem(PENDING_INVITE_KEY); }catch(e){}
        if(pendingCode){
          state.inviteCode = pendingCode;
          return B.invitePreview(pendingCode).then(function(preview){
            setPairing({ status: "invite_offer", inviteCode: pendingCode, inviteFromName: (preview && preview.inviter_name) || "Your partner", joinedAt: null });
            return { configured: true, hasSpace: false };
          }, function(){
            // Expired/used/garbage code: drop it quietly, fall back to normal.
            try{ localStorage.removeItem(PENDING_INVITE_KEY); }catch(e){}
            state.inviteCode = null;
            setPairing({ status: "not_started", inviteCode: null, joinedAt: null });
            return { configured: true, hasSpace: false };
          });
        }
        setPairing({ status: "not_started", inviteCode: null, inviteSentAt: null, joinedAt: null });
        return { configured: true, hasSpace: false };
      }
      state.spaceId = membership.spaceId;
      state.role = membership.role;
      try{ sessionStorage.setItem(ME_KEY, roleToId(state.role)); }catch(e){}
      return B.fetchSpace(state.spaceId).then(function(row){
        state.serverRev = row.rev;
        writeLocal(SHARED_KEY, JSON.stringify(row.data));
        return B.partnerRow(state.spaceId, state.role);
      }).then(function(partner){
        if(partner){
          setPairing({ status: "joined", joinedAt: partner.joined_at, inviteCode: null });
        } else {
          // No partner yet: restore my own in-flight invite, if I made one,
          // so a reload doesn't lose the "here's your link" screen.
          return B.myPendingInvite(state.spaceId).then(function(inv){
            state.inviteCode = inv ? inv.code : null;
            setPairing(inv
              ? { status: "invite_ready", inviteCode: inv.code, inviteSentAt: inv.created_at }
              : { status: "not_started", inviteCode: null, inviteSentAt: null });
          });
        }
      }).then(function(){
        // Restore "left" across a reload — myMembership() only falls back to
        // a 'left' row when there's no active one, so this only overrides
        // the "joined"/"invite_ready" status just computed above, nothing else.
        if(membership.status === "left") setPairing({ status: "left" });
        installRealtime();
        return { configured: true, hasSpace: true };
      });
    });
  }

  return { boot: boot };
})();
