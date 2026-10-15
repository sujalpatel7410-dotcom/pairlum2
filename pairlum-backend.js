// Pairlum backend — a thin wrapper around the Supabase client, used by
// auth.html (accounts) and pairlum-sync.js (keeping app.js's local record in
// sync with the real one). See supabase/schema.sql for the tables/RPCs this
// calls, and supabase/SETUP.md for how to connect a project.
//
// Everything here is a no-op / rejects cleanly when pairlum-config.js has no
// supabaseUrl/supabaseAnonKey — that's how the app keeps working as a local
// demo (see isConfigured()).
window.PairlumBackend = (function(){
  "use strict";
  var cfg = window.PAIRLUM_CONFIG || {};
  var configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var client = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  function isConfigured(){ return configured; }
  function need(){ if(!configured) return Promise.reject(new Error("Supabase isn't configured (see pairlum-config.js).")); }

  // ---- auth --------------------------------------------------------------
  function getSession(){
    if(!configured) return Promise.resolve(null);
    return client.auth.getSession().then(function(r){ return (r.data && r.data.session) || null; });
  }
  function onAuthChange(cb){
    if(!configured) return function(){};
    var sub = client.auth.onAuthStateChange(function(_event, session){ cb(session); });
    return function(){ try{ sub.data.subscription.unsubscribe(); }catch(e){} };
  }
  function signUp(email, password){
    if(!configured) return need();
    return client.auth.signUp({ email: email, password: password }).then(unwrap);
  }
  function signIn(email, password){
    if(!configured) return need();
    return client.auth.signInWithPassword({ email: email, password: password }).then(unwrap);
  }
  function signOut(){ return configured ? client.auth.signOut() : Promise.resolve(); }
  function unwrap(r){ if(r.error) throw r.error; return r.data; }

  // ---- space / membership -------------------------------------------------
  // Every real account belongs to at most one ACTIVE space, but can hold
  // several historical rows over time (a past 'left'/'disconnected' space
  // doesn't get deleted — see schema.sql's partial unique index). Returns
  // the active row if there is one; otherwise the most recent 'left' row,
  // so a page reload while "left" still shows the Rejoin screen instead of
  // silently losing that state. A purely 'disconnected' history is treated
  // as no membership at all — that account is free, and this phase has no
  // "browse your old disconnected space" UI (see FOLLOWUP notes).
  function myMembership(myId){
    if(!configured) return Promise.resolve(null);
    // Must filter to MY OWN rows: the select policy on space_members also
    // lets a member read their PARTNER's row (is_space_member(space_id)),
    // so an unfiltered query can return the partner's row instead of mine
    // once both of us have joined_at timestamps in the mix.
    return client.from("space_members").select("space_id, role, status").eq("user_id", myId).order("joined_at", { ascending: false }).then(function(r){
      if(r.error) throw r.error;
      var rows = r.data || [];
      var row = rows.filter(function(x){ return x.status === "active"; })[0] || rows.filter(function(x){ return x.status === "left"; })[0];
      return row ? { spaceId: row.space_id, role: row.role, status: row.status } : null;
    });
  }
  // A complete, empty record matching app.js's shape (SHARED_ARRAYS /
  // SHARED_OBJECTS in app.js) — a fresh couple starts blank, never seeded
  // with the Aarav/Mira demo story. Keep in sync with app.js's
  // fillSharedDefaults() if its field list ever changes.
  function emptySpaceSeed(){
    return {
      v: 1,
      moments: [], notes: [], letters: [], someday: [], requests: [], dates: [], memories: [], plans: [], replies: [],
      chapters: [],
      feel: {}, hearts: {}, dq: {}, ambient: {}, prefs: {}, sleep: {}, facts: {}, days: {}, hold: {}, profiles: {}, dna: {}, comfort: {}, dqPick: {}, reacts: {}, understood: {},
      quiz: { round: 0, answers: {} },
      reunion: { date: null, place: "" },
      liveLog: [], ops: [], mediaGens: [],
      membership: { plan: null, since: null },
      rev: 0, epoch: 0,
      spaceTz: "Asia/Kolkata"
    };
  }
  function createSpace(){
    if(!configured) return need();
    return client.rpc("create_space", { seed: emptySpaceSeed() }).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  // Creates (or re-fetches) a shareable invite for spaceId — see
  // schema.sql's create_space_invite. Returns the invite row (its `code` is
  // what the link/fallback-entry field uses).
  function createInvite(spaceId){
    if(!configured) return need();
    return client.rpc("create_space_invite", { target_space: spaceId }).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  function revokeInvite(code){
    if(!configured) return need();
    return client.rpc("revoke_space_invite", { invite_code: code }).then(function(r){ if(r.error) throw r.error; });
  }
  // My own still-pending invite for spaceId, if I made one — restores the
  // "here's your link" screen across a reload. A direct table read (not an
  // RPC): schema.sql's select policy on space_invites already lets the
  // creator read their own row, same as space_members/spaces elsewhere here.
  function myPendingInvite(spaceId){
    if(!configured) return Promise.resolve(null);
    return client.from("space_invites").select("code, created_at")
      .eq("space_id", spaceId).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).then(function(r){
        if(r.error) throw r.error;
        return (r.data && r.data[0]) || null;
      });
  }
  // Read-only: who's this code from, before committing to join (see
  // schema.sql's invite_preview — the "Join this Pairlum?" screen uses this,
  // not redeemInvite, until the person actually taps Join).
  function invitePreview(code){
    if(!configured) return need();
    return client.rpc("invite_preview", { invite_code: code }).then(function(r){
      if(r.error) throw r.error;
      return (r.data && r.data[0]) || null;
    });
  }
  // The actual join — only call this after the person has confirmed on the
  // "Join this Pairlum?" screen.
  function redeemInvite(code){
    if(!configured) return need();
    return client.rpc("redeem_space_invite", { invite_code: code }).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  // Pauses the space for BOTH partners (server-enforced: write_space_data
  // refuses while either member isn't 'active') until the same account
  // calls rejoinSpace. Never touches the other member's row.
  function leaveSpace(spaceId){
    if(!configured) return need();
    return client.rpc("leave_space", { target_space: spaceId }).then(function(r){ if(r.error) throw r.error; });
  }
  function rejoinSpace(spaceId){
    if(!configured) return need();
    return client.rpc("rejoin_space", { target_space: spaceId }).then(function(r){ if(r.error) throw r.error; });
  }
  // Permanently ends the pairing: both members move to 'disconnected'. The
  // space and its data are kept, but writes are refused forever after this,
  // and both accounts become free to create or join a different space.
  function disconnectSpace(spaceId){
    if(!configured) return need();
    return client.rpc("disconnect_space", { target_space: spaceId }).then(function(r){ if(r.error) throw r.error; });
  }
  function partnerRow(spaceId, myRole){
    if(!configured) return Promise.resolve(null);
    var theirRole = myRole === "a" ? "b" : "a";
    return client.from("space_members").select("user_id, role, joined_at").eq("space_id", spaceId).eq("role", theirRole).maybeSingle().then(function(r){
      if(r.error) throw r.error;
      return r.data || null;
    });
  }

  // ---- the shared record ---------------------------------------------------
  function fetchSpace(spaceId){
    if(!configured) return need();
    return client.from("spaces").select("id, data, rev, updated_at").eq("id", spaceId).single().then(function(r){
      if(r.error) throw r.error;
      return r.data;
    });
  }
  // Optimistic-concurrency write. Resolves to the new row on success, or
  // `null` on a conflict (caller should re-fetch + retry — pairlum-sync.js
  // does this once automatically).
  function writeSpaceData(spaceId, newData, expectedRev){
    if(!configured) return need();
    return client.rpc("write_space_data", { target_space: spaceId, new_data: newData, expected_rev: expectedRev }).then(function(r){
      if(r.error) throw r.error;
      return r.data; // a row, or null on rev mismatch
    });
  }
  // Fires cb(row) on every update to this space, cb2(memberRow) whenever a
  // new space_members row appears (the partner joining), cb3(memberRow)
  // whenever an existing row's status changes (leave/rejoin/disconnect —
  // see leaveSpace/rejoinSpace/disconnectSpace), and cb4(payload) on every
  // low-latency broadcast sent via the returned `broadcast()` — used for
  // "I Need You" live-audio WebRTC signaling (offer/answer/ICE), which must
  // never wait on a database round-trip.
  function subscribeSpace(spaceId, onSpaceChange, onMemberJoin, onMemberUpdate, onBroadcast){
    if(!configured) return { unsubscribe: function(){}, broadcast: function(){} };
    var channel = client.channel("space-" + spaceId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: "id=eq." + spaceId }, function(payload){
        onSpaceChange(payload.new);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_members", filter: "space_id=eq." + spaceId }, function(payload){
        if(onMemberJoin) onMemberJoin(payload.new);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "space_members", filter: "space_id=eq." + spaceId }, function(payload){
        if(onMemberUpdate) onMemberUpdate(payload.new);
      })
      .on("broadcast", { event: "signal" }, function(msg){
        if(onBroadcast) onBroadcast(msg.payload);
      })
      .subscribe();
    return {
      unsubscribe: function(){ try{ client.removeChannel(channel); }catch(e){} },
      broadcast: function(payload){ channel.send({ type: "broadcast", event: "signal", payload: payload }); }
    };
  }

  // ---- media (Supabase Storage) -------------------------------------------
  function mediaPath(spaceId, mediaId){ return spaceId + "/" + mediaId; }
  function uploadMedia(spaceId, mediaId, blob){
    if(!configured) return need();
    return client.storage.from("media").upload(mediaPath(spaceId, mediaId), blob, {
      upsert: true, contentType: (blob && blob.type) || "application/octet-stream"
    }).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  function downloadMedia(spaceId, mediaId){
    if(!configured) return need();
    return client.storage.from("media").download(mediaPath(spaceId, mediaId)).then(function(r){
      if(r.error) throw r.error;
      return r.data; // Blob
    });
  }
  function deleteMedia(spaceId, mediaIds){
    if(!configured) return need();
    var paths = (Array.isArray(mediaIds) ? mediaIds : [mediaIds]).map(function(id){ return mediaPath(spaceId, id); });
    return client.storage.from("media").remove(paths).then(function(r){ if(r.error) throw r.error; return r.data; });
  }

  return {
    isConfigured: isConfigured,
    getSession: getSession, onAuthChange: onAuthChange, signUp: signUp, signIn: signIn, signOut: signOut,
    myMembership: myMembership, emptySpaceSeed: emptySpaceSeed, createSpace: createSpace,
    createInvite: createInvite, revokeInvite: revokeInvite, myPendingInvite: myPendingInvite,
    invitePreview: invitePreview, redeemInvite: redeemInvite,
    partnerRow: partnerRow,
    leaveSpace: leaveSpace, rejoinSpace: rejoinSpace, disconnectSpace: disconnectSpace,
    fetchSpace: fetchSpace, writeSpaceData: writeSpaceData, subscribeSpace: subscribeSpace,
    uploadMedia: uploadMedia, downloadMedia: downloadMedia, deleteMedia: deleteMedia
  };
})();
