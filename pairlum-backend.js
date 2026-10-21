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
      // When "today" turns over for both of you — the creator's own time
      // zone to start with (changeable in Profile), not a fixed demo one.
      spaceTz: deviceTimeZone()
    };
  }
  function deviceTimeZone(){
    try{ var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; }catch(e){ return "UTC"; }
  }
  function createSpace(){
    if(!configured) return need();
    return client.rpc("create_space", { seed: emptySpaceSeed() }).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  // Turns a Supabase/network error into something a person can act on. The
  // invite functions raise their own plain-language messages (Postgres code
  // P0001); a failed request has no code and a fetch-style message.
  function friendlyError(err){
    var msg = (err && err.message) || "";
    if(err && err.code === "P0001" && msg) return new Error(msg);
    if(!msg || /fetch|network|load failed|timeout/i.test(msg)) return new Error("Couldn't reach Pairlum. Check your connection and try again.");
    return new Error(msg);
  }
  function rpc(name, args){
    return client.rpc(name, args).then(function(r){ if(r.error) throw friendlyError(r.error); return r.data; }, function(e){ throw friendlyError(e); });
  }

  // ---- invite links (see schema.sql's pairing_invites) -----------------------
  // Creates a new invite for spaceId and returns { invite_id, token,
  // expires_at }. `token` exists only in this response — the database keeps
  // just its hash — so the caller must keep it if the link is to be shown
  // again later on this device.
  function createInvite(spaceId, validHours){
    if(!configured) return need();
    return rpc("create_pairing_invite", { target_space: spaceId, valid_hours: validHours || 48 }).then(function(rows){ return (rows && rows[0]) || null; });
  }
  function cancelInvite(inviteId){
    if(!configured) return need();
    return rpc("cancel_pairing_invite", { target_invite: inviteId });
  }
  // My own most recent pending invite for spaceId, if any — { id,
  // expires_at } only; the token itself can't be read back. A direct table
  // read: the select policy lets the creator see their own invites.
  function myPendingInvite(spaceId){
    if(!configured) return Promise.resolve(null);
    return client.from("pairing_invites").select("id, expires_at")
      .eq("space_id", spaceId).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).then(function(r){
        if(r.error) throw friendlyError(r.error);
        return (r.data && r.data[0]) || null;
      });
  }
  // Read-only check before joining: { state, inviter_name, expires_at }.
  // state is one of valid | invalid | used | cancelled | expired | own |
  // full | already_paired | signed_out. Rejects only when the request itself
  // failed (e.g. offline) — the invite may still be fine.
  function invitePreview(token){
    if(!configured) return need();
    return rpc("preview_pairing_invite", { raw_token: token }).then(function(rows){ return (rows && rows[0]) || { state: "invalid" }; });
  }
  // The actual join — only after the person taps "Join our Pairlum".
  // Returns the joined space row.
  function redeemInvite(token){
    if(!configured) return need();
    return rpc("accept_pairing_invite", { raw_token: token });
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
  // The space's plan, with Book eligibility decided by the server (schema.sql's
  // my_membership): { plan, started_at, ends_at, active, book_eligible_at,
  // book_eligible }, or null for the free First Chapter.
  function planMembership(spaceId){
    if(!configured) return Promise.resolve(null);
    return rpc("my_membership", { target_space: spaceId }).then(function(rows){ return (rows && rows[0]) || null; });
  }
  // Ends this account's pairing(s) like disconnectSpace, then deletes the
  // login itself (schema.sql's delete_my_account). Irreversible.
  function deleteMyAccount(){
    if(!configured) return need();
    return rpc("delete_my_account", {});
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
  // cb5(payload), when given, fires whenever this space's plan changes (e.g.
  // after a payment), so both devices update without a reload.
  function subscribeSpace(spaceId, onSpaceChange, onMemberJoin, onMemberUpdate, onBroadcast, onPlanChange){
    if(!configured) return { unsubscribe: function(){}, broadcast: function(){} };
    // Private channel: Supabase checks the realtime.messages policies in
    // schema.sql, so only this space's members can receive (and only active
    // ones can send) its live signals. Database changes on the same channel
    // are still filtered by each table's own row-level security.
    var channel = client.channel("space-" + spaceId, { config: { private: true } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: "id=eq." + spaceId }, function(payload){
        onSpaceChange(payload.new);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_members", filter: "space_id=eq." + spaceId }, function(payload){
        if(onMemberJoin) onMemberJoin(payload.new);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "space_members", filter: "space_id=eq." + spaceId }, function(payload){
        if(onMemberUpdate) onMemberUpdate(payload.new);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "memberships", filter: "space_id=eq." + spaceId }, function(payload){
        if(onPlanChange) onPlanChange(payload);
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

  // Content-free analytics (supabase/migrations/20261019150000_analytics.sql):
  // only an event's name is sent — never anything anyone wrote or made — and
  // who/which space is worked out on the server. Resolves true/false, never
  // rejects: counting must never get in anyone's way.
  function trackEvent(name){
    if(!configured) return Promise.resolve(false);
    try{
      return client.rpc("track_event", { event_name: name }).then(function(r){ return !r.error; }, function(){ return false; });
    }catch(e){ return Promise.resolve(false); }
  }

  return {
    isConfigured: isConfigured, trackEvent: trackEvent,
    getSession: getSession, onAuthChange: onAuthChange, signUp: signUp, signIn: signIn, signOut: signOut,
    myMembership: myMembership, emptySpaceSeed: emptySpaceSeed, createSpace: createSpace,
    createInvite: createInvite, cancelInvite: cancelInvite, myPendingInvite: myPendingInvite,
    invitePreview: invitePreview, redeemInvite: redeemInvite,
    partnerRow: partnerRow,
    leaveSpace: leaveSpace, rejoinSpace: rejoinSpace, disconnectSpace: disconnectSpace, deleteMyAccount: deleteMyAccount,
    planMembership: planMembership,
    fetchSpace: fetchSpace, writeSpaceData: writeSpaceData, subscribeSpace: subscribeSpace,
    uploadMedia: uploadMedia, downloadMedia: downloadMedia, deleteMedia: deleteMedia
  };
})();
