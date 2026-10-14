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

  var B = window.PairlumBackend;
  var configured = B && B.isConfigured();
  var rawSetItem = localStorage.setItem.bind(localStorage);
  var rawGetItem = localStorage.getItem.bind(localStorage);

  var state = { spaceId: null, role: null, myId: null, serverRev: 0, applyingRemote: false, sub: null, requestsSub: null, pendingRequestId: null };

  // Cached list of pending requests addressed to ME — kept fresh by boot()'s
  // initial fetch and by subscribeMyRequests' realtime callback below.
  // app.js reads this via window.PairlumSpace.incomingRequests() and is told
  // when it changes via a "pairlum:incoming-requests" window event, the same
  // "app.js doesn't need to know how this data arrives" principle the
  // storage-event bridge above already uses.
  var incomingRequests = [];
  function setIncomingRequests(list){
    incomingRequests = list || [];
    try{ window.dispatchEvent(new CustomEvent("pairlum:incoming-requests", { detail: incomingRequests.slice() })); }catch(e){}
  }
  function refreshIncomingRequests(){
    if(!state.myId) return Promise.resolve();
    return B.myIncomingRequests(state.myId).then(setIncomingRequests);
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
  function installOutboundHook(){
    localStorage.setItem = function(key, value){
      rawSetItem(key, value);
      if(state.applyingRemote) return;
      if(key === SHARED_KEY) schedulePush();
      else if(SIGNAL_KEYS.indexOf(key) > -1 && state.sub) state.sub.broadcast({ key: key, value: value });
    };
  }

  // ---- pairing requests: realtime + cache, independent of having a space ----
  function installRequestsRealtime(){
    state.requestsSub = B.subscribeMyRequests(state.myId, function(){
      // A request addressed to me appeared or changed — just refetch; the
      // list is short and this keeps the cache simple and always correct.
      refreshIncomingRequests();
    }, function(payload){
      // A request I SENT changed status. Acceptance is already covered by
      // the space_members INSERT listener in installRealtime() below (once
      // I have a space to subscribe on); here we only need to handle the
      // other party declining, so the sender isn't stuck on a dead "waiting"
      // screen.
      if(payload && payload.new && payload.new.status === "declined" && payload.new.id === state.pendingRequestId){
        setPairing({ status: "not_started", pendingRequestEmail: null, pendingRequestId: null, inviteCode: null });
        state.pendingRequestId = null;
      }
    });
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

  // Internal: makes sure the caller has a space to attach a pairing request
  // to, creating one (and stamping a real display name in) if needed. Sets
  // state.spaceId/state.role in memory immediately — not only after a reload
  // — so a FAILED send (e.g. a mistyped email) can be retried without trying
  // to create a second space.
  function ensureSpace(session){
    if(state.spaceId) return Promise.resolve(state.spaceId);
    return B.createSpace().then(function(space){
      state.spaceId = space.id;
      state.role = "a";
      var data = space.data || {};
      data.profiles = data.profiles || {};
      data.profiles.u_aarav = { name: deriveDisplayName(session) };
      // Neutral placeholder until the real partner accepts and stamps their
      // own name in — otherwise the pairing screen would show the leftover
      // demo name "Mira".
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
    // Sends a pairing request to `email`, creating this account's space
    // first if it doesn't have one yet (see ensureSpace above). Reloads on
    // success so boot() picks up both the (possibly new) membership and the
    // fresh pending request in one go.
    sendRequest: function(email){
      return B.getSession().then(function(session){
        return ensureSpace(session).then(function(spaceId){
          return B.sendPairingRequest(spaceId, email);
        });
      }).then(function(req){ location.reload(); return req; });
    },
    cancelRequest: function(){
      return B.cancelPairingRequest(state.pendingRequestId).then(function(){
        state.pendingRequestId = null;
        setPairing({ status: "not_started", pendingRequestEmail: null, pendingRequestId: null, inviteCode: null });
      });
    },
    // Accepting/declining an INCOMING request never needs a space of my
    // own (that's the sender's space) — these stand alone, unlike the rest
    // of this object which act on state.spaceId.
    acceptIncomingRequest: function(requestId){
      return B.acceptPairingRequest(requestId).then(function(){ location.reload(); });
    },
    declineIncomingRequest: function(requestId){
      return B.declinePairingRequest(requestId).then(function(){ return refreshIncomingRequests(); });
    },
    incomingRequests: function(){ return incomingRequests.slice(); },
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
      // Incoming pairing requests work before this account has ever created
      // or joined a space, so fetch + subscribe as soon as we know who's
      // signed in, regardless of what myMembership() turns out to say.
      state.myId = session.user.id;
      refreshIncomingRequests();
      installRequestsRealtime();
      return B.myMembership(state.myId);
    }).then(function(membership){
      if(!membership){
        // Signed in, but this account hasn't started or joined a space yet.
        // Seed a blank, local-only record and the "not_started" pairing
        // state so app.js renders a real empty shell — the pairing overlay
        // offers an email field to send a request.
        writeLocal(SHARED_KEY, JSON.stringify(B.emptySpaceSeed()));
        setPairing({ status: "not_started", pendingRequestEmail: null, pendingRequestId: null, inviteCode: null, inviteSentAt: null, joinedAt: null });
        try{ sessionStorage.setItem(ME_KEY, "u_aarav"); }catch(e){}
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
          setPairing({ status: "joined", joinedAt: partner.joined_at, pendingRequestEmail: null, pendingRequestId: null, inviteCode: null });
        } else {
          // No partner yet: restore an in-flight pairing request if one
          // exists, so a reload doesn't lose the "waiting" screen.
          return B.myOutgoingRequest(state.myId).then(function(req){
            state.pendingRequestId = req ? req.id : null;
            setPairing(req
              ? { status: "request_sent", pendingRequestEmail: req.to_email, pendingRequestId: req.id, inviteSentAt: req.created_at }
              : { status: "not_started", pendingRequestEmail: null, pendingRequestId: null, inviteCode: null, inviteSentAt: null });
          });
        }
      }).then(function(){
        // Restore "left" across a reload — myMembership() only falls back to
        // a 'left' row when there's no active one, so this only overrides
        // the "joined"/"request_sent" status just computed above, nothing else.
        if(membership.status === "left") setPairing({ status: "left" });
        installRealtime();
        return { configured: true, hasSpace: true };
      });
    });
  }

  return { boot: boot };
})();
