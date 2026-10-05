/* Pairlum 2 — shared core.
   Loaded synchronously in <head> on every page so the mood and motion settings apply before first paint.

   BACKEND RULE: nothing here talks to a server. Every operation that needs one goes through
   PL.backend.*, which in this build rejects with {code:'backend_pending'}. Pages show an honest
   "not connected yet" state for that code. To connect a backend, replace the bodies of the
   adapter functions marked  >>> INTEGRATION POINT  — callers already await Promises. */
(function(){
'use strict';
var PL=window.PL={};
var d=document,root=d.documentElement;

/* ---------- storage keys ---------- */
var K=PL.KEYS={world:'pl-world',mood:'pl-mood',session:'pl-session',account:'pl-account',space:'pl-space',
  onb:'pl-onb2',settings:'pl-settings',dna:'pl-dna',flags:'pl-flags',upgrade:'pl-upgrade',profile:'pl-profile'};
function rd(k,f){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch(e){return f}}
function wr(k,v){localStorage.setItem(k,JSON.stringify(v))}          /* throws on quota — callers decide */
function wrSafe(k,v){try{wr(k,v);return true}catch(e){return false}}
PL.read=rd;PL.write=wr;PL.writeSafe=wrSafe;

/* ---------- QA state previews ----------
   ?state=<name> renders a specific state (invalid invite, payment failed …) for design QA and
   controlled testing. Analytics are never sent from a QA preview. */
var params=new URLSearchParams(location.search);
PL.qa={state:params.get('state')||'',on:!!params.get('state')||params.get('qa')==='1'};
PL.param=function(n){return params.get(n)};

/* ---------- mood (theme) + motion, applied before paint ---------- */
var MOODS=PL.MOODS=[
  {id:'warm',name:'Soft & Warm',line:'For slow mornings and long calls.'},
  {id:'calm',name:'Calm & Minimal',line:'For quiet certainty, just the two of you.'},
  {id:'deep',name:'Deep & Cinematic',line:'For late nights and big feelings.'},
  {id:'blush',name:'Blush',line:'For new love and butterflies.'},
  {id:'midnight',name:'Midnight',line:'For the miles between you tonight.'}];
var MOOD_IDS=MOODS.map(function(m){return m.id});
PL.mood={
  get:function(){var w=rd(K.world,{})||{},m=w.mood||rd(K.mood,'warm');return MOOD_IDS.indexOf(m)>-1?m:'warm'},
  set:function(m){if(MOOD_IDS.indexOf(m)<0)return;root.setAttribute('data-mood',m);wrSafe(K.mood,m);
    var w=rd(K.world,null);if(w){w.mood=m;wrSafe(K.world,w)}},
  apply:function(){root.setAttribute('data-mood',PL.mood.get())}
};
PL.motion={
  osReduced:function(){return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)},
  appReduced:function(){var w=rd(K.world,{})||{};return !!(w.settings&&w.settings.motion===false)},
  ok:function(){return !PL.motion.osReduced()&&!PL.motion.appReduced()},
  apply:function(){if(PL.motion.appReduced())root.setAttribute('data-motion','reduced');else root.removeAttribute('data-motion')},
  setApp:function(on){var w=rd(K.world,{})||{};w.settings=Object.assign({sound:true,haptics:true,motion:true},w.settings||{});w.settings.motion=!!on;wrSafe(K.world,w);PL.motion.apply()}
};
PL.mood.apply();PL.motion.apply();
PL.haptics={supported:function(){return 'vibrate' in navigator}};

/* ---------- tiny DOM helpers ---------- */
PL.$=function(s,r){return (r||d).querySelector(s)};
PL.h=function(t,a){var e=d.createElement(t),k=[].slice.call(arguments,2);
  for(var n in (a||{})){var v=a[n];if(v===false||v==null)continue;
    if(n==='class')e.className=v;else if(n==='text')e.textContent=v;else if(n==='html')e.innerHTML=v;
    else if(n==='value')e.value=v;else if(n.slice(0,2)==='on'&&typeof v==='function')e.addEventListener(n.slice(2),v);else e.setAttribute(n,v===true?'':v)}
  k.forEach(function(c){if(c==null||c===false)return;if(Array.isArray(c))c.forEach(function(x){if(x!=null&&x!==false)e.append(x.nodeType?x:d.createTextNode(x))});else e.append(c.nodeType?c:d.createTextNode(c))});return e};
PL.toast=function(t){var el=d.getElementById('plToast');if(!el){el=PL.h('div',{id:'plToast',class:'pl-toast',role:'status','aria-live':'polite'});d.body.append(el)}
  el.textContent=t;el.classList.add('on');clearTimeout(PL.toast.t);PL.toast.t=setTimeout(function(){el.classList.remove('on')},2800)};
PL.wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
PL.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};

/* ---------- accessible dialog with focus trap, Escape, focus restore ---------- */
var FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
PL.dialog=function(o){
  var prev=d.activeElement,back=PL.h('div',{class:'pl-dlg'}),box=PL.h('div',{class:'box',role:o.alert?'alertdialog':'dialog','aria-modal':'true',tabindex:'-1'});
  var tid='dlg'+Date.now();if(o.title){box.setAttribute('aria-labelledby',tid)}
  var closed=false;
  function key(e){if(e.key==='Escape'){if(o.onEscape&&o.onEscape()===false)return;e.preventDefault();close()}
    if(e.key!=='Tab')return;var f=[].filter.call(box.querySelectorAll(FOCUSABLE),function(x){return x.offsetParent!==null||x===d.activeElement});
    if(!f.length){e.preventDefault();return}var a=d.activeElement;
    if(e.shiftKey&&(a===f[0]||a===box)){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&a===f[f.length-1]){e.preventDefault();f[0].focus()}}
  function close(){if(closed)return;closed=true;d.removeEventListener('keydown',key,true);back.remove();if(o.onClose)o.onClose();if(prev&&prev.focus&&prev.isConnected)prev.focus({preventScroll:true})}
  back.addEventListener('click',function(e){if(e.target===back&&!o.alert)close()});
  if(o.title)box.append(PL.h('h2',{id:tid},o.title));
  var api={box:box,close:close};
  o.build(box,api);
  back.append(box);d.body.append(back);d.addEventListener('keydown',key,true);
  var first=(o.initialFocus&&o.initialFocus(box))||box.querySelector(FOCUSABLE)||box;first.focus({preventScroll:true});
  return api;
};

/* ---------- backend adapter ---------- */
/* Real backend, when app/pairlum-config.js carries a Supabase URL + anon key.
   Until then PL.backend.connected is false and every path below falls back to
   the exact device-preview behavior this build always had — nothing breaks
   for anyone who hasn't set up Supabase yet. */
PL.backend={};
Object.defineProperty(PL.backend,'connected',{get:function(){
  return !!(window.PAIRLUM_SUPABASE_URL&&window.PAIRLUM_SUPABASE_ANON_KEY&&window.supabase&&window.supabase.createClient);
}});
var _sbClient=null;
function sb(){
  if(!PL.backend.connected)return null;
  if(!_sbClient)_sbClient=window.supabase.createClient(window.PAIRLUM_SUPABASE_URL,window.PAIRLUM_SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return _sbClient;
}
PL.sb=sb; /* exposed for the world.html sync layer */
function pending(feature){var e=new Error('backend_pending');e.code='backend_pending';e.feature=feature;return Promise.reject(e)}
PL.isPending=function(e){return !!e&&e.code==='backend_pending'};
function latency(){return PL.wait(PL.qa.on?60:450)}
function hash(s){
  if(!(window.crypto&&crypto.subtle&&window.TextEncoder))return Promise.reject(err('secure_context_required')); /* file:// on old browsers */
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){return [].map.call(new Uint8Array(b),function(x){return x.toString(16).padStart(2,'0')}).join('')});
}
function err(code,cause){var e=new Error(code);e.code=code;if(cause)e.cause=cause;return e}
function clearPersonCache(){[K.session,K.account,K.space,K.profile,K.world,K.onb,K.dna,K.flags,K.upgrade].forEach(function(k){localStorage.removeItem(k)});PL._uid=null;}
function offline(){return navigator.onLine===false}
function sbErr(e){ /* map a supabase-js error to our {code} shape */
  var msg=(e&&e.message||'').toLowerCase();
  if(/already registered|already exists/.test(msg))return err('email_in_use',e);
  if(/invalid login credentials/.test(msg))return err('invalid_credentials',e);
  return err('server_error',e);
}

/* Auth. Device mode (no Supabase configured) keeps one preview account on this
   device, a salted hash, never the password itself — labelled device-only
   everywhere it appears. Server mode delegates to Supabase Auth, which owns
   real password storage, so K.session/K.account become a synchronous local
   *cache* of the last known real session (kept fresh by onAuthStateChange). */
PL.auth={
  mode:function(){return PL.backend.connected?'server':'device'},
  session:function(){return rd(K.session,null)},
  account:function(){var a=rd(K.account,null);return a&&{email:a.email,name:a.name,createdAt:a.createdAt}},
  signUp:function(o){ /* >>> INTEGRATION POINT: create account on the server */
    if(offline())return Promise.reject(err('offline'));
    if(sb()){
      return sb().auth.signUp({email:o.email.toLowerCase(),password:o.password,options:{data:{name:o.name}}}).then(function(res){
        if(res.error)throw sbErr(res.error);
        clearPersonCache();wr(K.account,{email:o.email.toLowerCase(),name:o.name,mode:'server',createdAt:new Date().toISOString()});
        if(!res.data.session){ /* email confirmation is required before a session exists */
          var e=err('confirm_email');e.email=o.email.toLowerCase();throw e;
        }
        var s={email:o.email.toLowerCase(),name:o.name,mode:'server',at:new Date().toISOString()};wr(K.session,s);
        /* a brand-new account has no space/profile-progress yet, but refresh anyway so the
           cache shape is consistent (profile row exists immediately via the on-signup trigger) */
        return Promise.all([PL.space.refresh(),PL.profile.refresh()]).then(function(){return s},function(){return s});
      });
    }
    return latency().then(function(){
      var a=rd(K.account,null);
      if(a&&a.email!==o.email.toLowerCase())throw err('device_account_exists');
      if(a&&a.email===o.email.toLowerCase())throw err('email_in_use');
      var salt=Math.random().toString(36).slice(2);
      return hash(salt+':'+o.password).then(function(hx){
        wr(K.account,{email:o.email.toLowerCase(),name:o.name,salt:salt,hash:hx,adult:true,termsAcceptedAt:new Date().toISOString(),createdAt:new Date().toISOString(),mode:'device'});
        var s={email:o.email.toLowerCase(),name:o.name,mode:'device',at:new Date().toISOString()};wr(K.session,s);return s;
      });
    });
  },
  signIn:function(o){ /* >>> INTEGRATION POINT: server sign-in */
    if(offline())return Promise.reject(err('offline'));
    if(sb()){
      return sb().auth.signInWithPassword({email:o.email.toLowerCase(),password:o.password}).then(function(res){
        if(res.error)throw sbErr(res.error);
        if((PL.auth.session()||{}).email!==o.email.toLowerCase())clearPersonCache();
        return sb().from('profiles').select('name').eq('id',res.data.user.id).single().then(function(pr){
          var name=(pr.data&&pr.data.name)||(res.data.user.user_metadata&&res.data.user.user_metadata.name)||'';
          wr(K.account,{email:o.email.toLowerCase(),name:name,mode:'server',createdAt:res.data.user.created_at});
          var s={email:o.email.toLowerCase(),name:name,mode:'server',at:new Date().toISOString()};wr(K.session,s);
          /* refresh space + profile caches now, synchronously ahead of any redirect the
             caller makes right after this resolves (e.g. PL.home()) — this is what makes
             "log in from another device" land correctly on the first try. */
          return Promise.all([PL.space.refresh(),PL.profile.refresh()]).then(function(){return s},function(){return s});
        });
      });
    }
    return latency().then(function(){
      var a=rd(K.account,null);
      if(!a||a.email!==o.email.toLowerCase())throw err('invalid_credentials');
      return hash(a.salt+':'+o.password).then(function(hx){if(hx!==a.hash)throw err('invalid_credentials');
        var s={email:a.email,name:a.name,mode:'device',at:new Date().toISOString()};wr(K.session,s);return s});
    });
  },
  signOut:function(){if(sb())return sb().auth.signOut().then(function(res){if(res.error)throw sbErr(res.error);clearPersonCache();});localStorage.removeItem(K.session);return Promise.resolve()},
  requestReset:function(email){ /* >>> INTEGRATION POINT: password reset email */
    if(offline())return Promise.reject(err('offline'));
    if(sb())return sb().auth.resetPasswordForEmail(email,{redirectTo:new URL('auth.html#reset',location.href).href}).then(function(res){if(res.error)throw sbErr(res.error);return true});
    return latency().then(function(){return pending('password_reset_email')});
  },
  resetPassword:function(token,pw){ /* >>> INTEGRATION POINT: password reset */
    if(offline())return Promise.reject(err('offline'));
    if(sb())return sb().auth.updateUser({password:pw}).then(function(res){
      if(res.error){if(/session|token/i.test(res.error.message||''))throw err('invalid_token',res.error);throw sbErr(res.error)}
      return true;
    });
    return latency().then(function(){return pending('password_reset')});
  }
};

/* Couple Space. get() stays synchronous (a local cache under K.space) so every
   existing `var space=PL.space.get()` call site keeps working unchanged;
   refresh() re-fills that cache from the server when connected. */
var INVITE_ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/* "First Chapter" is each PERSON's own onboarding, not a shared space flag (see
   profiles.first_chapter_done) — a space carries no completion state of its own,
   only isCreator, which decides whether the create/invite steps ever apply to
   the signed-in user viewing it. */
function mapSpaceRow(row,isCreator){
  return {id:row.id,createdAt:row.created_at,mode:'server',inviteCode:row.invite_code,isCreator:!!isCreator,
    since:row.since||'',ldr:!!row.ldr,cities:{me:row.city_a||'',them:row.city_b||''},
    ldrLabel:row.ldr_label||'',reunion:row.reunion_date||''};
}
PL.space={
  get:function(){return rd(K.space,null)},
  refresh:function(){ /* pull the signed-in member's space from the server into the local cache */
    if(!sb())return Promise.resolve(PL.space.get());
    return sb().auth.getUser().then(function(u){
      if(!u.data.user)return null;
      var uid=u.data.user.id;PL._uid=uid;
      return sb().from('space_members').select('spaces(*)').eq('user_id',uid).limit(1).maybeSingle().then(function(res){
        if(res.error)throw sbErr(res.error);if(!res.data||!res.data.spaces){localStorage.removeItem(K.space);return null;}
        var row=res.data.spaces,s=mapSpaceRow(row,row.created_by===uid);wr(K.space,s);return s;
      });
    });
  },
  create:function(o){ /* >>> INTEGRATION POINT: create Couple Space on the server */
    o=o||{};
    if(sb()){
      return sb().rpc('pl2_create_space',{p_since:o.since||null,p_ldr:!!o.ldr,p_city_a:o.myCity||null,p_city_b:o.theirCity||null}).then(function(res){
        if(res.error)throw sbErr(res.error);
        var s=mapSpaceRow(res.data,true); /* create_space() always returns the caller's own space, made or pre-existing */
        wr(K.space,s);return s;
      });
    }
    return latency().then(function(){var s=PL.space.get();if(s)return s;
      s={id:'dev-'+Date.now().toString(36),createdAt:new Date().toISOString(),mode:'device',inviteCode:PL.invites.newCode(),isCreator:true,firstChapterDone:false};
      wr(K.space,s);return s});
  },
  update:function(p){var s=PL.space.get()||{};Object.assign(s,p);wr(K.space,s);
    if(sb()&&s.id){ /* best-effort push; the local cache above is already the source of truth for this tab */
      var patch={};
      if('since' in p)patch.since=p.since||null;
      if('ldr' in p)patch.ldr=p.ldr;
      if('ldrLabel' in p)patch.ldr_label=p.ldrLabel;
      if('reunion' in p)patch.reunion_date=p.reunion||null;
      if(p.cities){patch.city_a=p.cities.me||null;patch.city_b=p.cities.them||null}
      if(Object.keys(patch).length)sb().from('spaces').update(patch).eq('id',s.id).then(function(res){if(res&&res.error)PL.toast('Your change could not be synced. Please try again.');},function(){PL.toast('Your change could not be synced. Please try again.');});
    }
    return s;}
};

/* Profile. Carries settings + THIS PERSON's own First Chapter completion —
   one row per person (profiles), never shared with the partner's state. get()
   stays synchronous (local cache under K.profile); refresh() re-fills it. */
function mapProfileRow(row){
  return {name:row.name||'',avatarUrl:row.avatar_url||'',mood:row.mood||'warm',
    sound:row.sound!==false,haptics:row.haptics!==false,motion:row.motion!==false,
    quietHoursOn:!!row.quiet_hours_on,quietStart:row.quiet_start||'',quietEnd:row.quiet_end||'',
    timezone:row.timezone||'',deliverForMorning:!!row.deliver_for_morning,
    firstChapterDone:!!row.first_chapter_done,firstChapterAt:row.first_chapter_at||''};
}
PL.profile={
  get:function(){return rd(K.profile,null)},
  refresh:function(){
    if(!sb())return Promise.resolve(PL.profile.get());
    return sb().auth.getUser().then(function(u){
      if(!u.data.user)return null;
      return sb().from('profiles').select('*').eq('id',u.data.user.id).single().then(function(res){
        if(res.error||!res.data)return null;
        var p=mapProfileRow(res.data);wr(K.profile,p);PL.mood.set(p.mood);var w=rd(K.world,{})||{};w.me=Object.assign({},w.me||{},{name:p.name});w.settings=Object.assign({},w.settings||{},{sound:p.sound,haptics:p.haptics,motion:p.motion});wrSafe(K.world,w);PL.motion.apply();return p;
      });
    });
  },
  update:function(patch){var p=PL.profile.get()||{};Object.assign(p,patch);wr(K.profile,p);
    if(sb()){
      var row={};
      if('firstChapterDone' in patch)row.first_chapter_done=patch.firstChapterDone;
      if('firstChapterAt' in patch)row.first_chapter_at=patch.firstChapterAt||null;
      if('quietHoursOn' in patch)row.quiet_hours_on=patch.quietHoursOn;
      if('quietStart' in patch)row.quiet_start=patch.quietStart||null;
      if('quietEnd' in patch)row.quiet_end=patch.quietEnd||null;
      if('timezone' in patch)row.timezone=patch.timezone||null;
      if('deliverForMorning' in patch)row.deliver_for_morning=patch.deliverForMorning;
      if('name' in patch)row.name=patch.name;
      if('mood' in patch)row.mood=patch.mood;
      if('sound' in patch)row.sound=patch.sound;
      if('haptics' in patch)row.haptics=patch.haptics;
      if('motion' in patch)row.motion=patch.motion;
      if(Object.keys(row).length)sb().auth.getUser().then(function(u){if(u.data.user)sb().from('profiles').update(row).eq('id',u.data.user.id).then(function(){},function(){})});
    }
    return p;}
};

/* Onboarding completion, abstracted over device vs. server mode: device mode has
   only one local person so the old space-level flag still works; server mode
   asks this person's own profile, never the space (see profiles.first_chapter_done). */
PL.progress={
  done:function(){
    if(sb()){var p=PL.profile.get();return !!(p&&p.firstChapterDone)}
    var s=PL.space.get();return !!(s&&s.firstChapterDone);
  },
  markDone:function(){
    if(sb())return PL.profile.update({firstChapterDone:true,firstChapterAt:new Date().toISOString()});
    return PL.space.update({firstChapterDone:true,firstChapterAt:new Date().toISOString()});
  }
};

/* Invites. In device mode, codes are made on this device for the share UI but
   aren't valid anywhere until a server verifies them (lookup/accept reject with
   backend_pending). In server mode they're real, checked by Postgres RPCs that
   also enforce the two-person cap (see docs/supabase-schema.sql). */
PL.invites={
  newCode:function(){var c='';for(var i=0;i<6;i++)c+=INVITE_ALPHA[Math.floor(Math.random()*INVITE_ALPHA.length)];return 'PAIR-'+c},
  validFormat:function(c){return /^PAIR-[A-HJ-KM-NP-Z2-9]{4,8}$/.test(String(c||'').trim().toUpperCase())},
  link:function(code){try{return new URL('join.html?code='+encodeURIComponent(code),location.href).href}catch(e){return 'join.html?code='+code}},
  lookup:function(code){ /* >>> INTEGRATION POINT → {status:'valid'|'invalid'|'expired'|'already_connected'|'space_full', inviterName} */
    if(offline())return Promise.reject(err('offline'));
    if(!PL.invites.validFormat(code))return Promise.resolve({status:'invalid'});
    if(sb())return sb().rpc('pl2_lookup_invite',{p_code:code}).then(function(res){
      if(res.error)throw sbErr(res.error);
      var row=(res.data&&res.data[0])||{status:'invalid'};
      return {status:row.status,inviterName:row.inviter_name};
    });
    return latency().then(function(){return pending('invite_lookup')});
  },
  accept:function(code){
    if(offline())return Promise.reject(err('offline'));
    if(sb())return sb().rpc('pl2_accept_invite',{p_code:code}).then(function(res){
      if(res.error)throw sbErr(res.error);
      var row=(res.data&&res.data[0])||{status:'error'};
      if(row.status!=='connected'&&row.status!=='already_connected'){var e=err(row.status);e.inviterName=row.inviter_name;throw e}
      return PL.space.refresh().then(function(){return {inviterName:row.inviter_name}});
    });
    return latency().then(function(){return pending('invite_accept')});
  },
  partnerStatus:function(){ /* >>> INTEGRATION POINT → {joined:boolean, name} */
    if(sb()){
      var s=PL.space.get();if(!s||!s.id)return Promise.resolve({joined:false});
      return sb().auth.getUser().then(function(u){
        var uid=u.data.user&&u.data.user.id;
        return sb().from('space_members').select('user_id, profiles(name)').eq('space_id',s.id).neq('user_id',uid||'').maybeSingle().then(function(res){
          if(res.error||!res.data)return {joined:false};
          return {joined:true,name:res.data.profiles&&res.data.profiles.name};
        });
      });
    }
    return pending('partner_status');
  }
};

/* ---------- content sync: Moments, Signals, Need You, Letters, Plans ----------
   world.html keeps its own in-memory `S` object as the synchronous source the
   UI renders from (unchanged — this is not a rewrite of that rendering code).
   PL.sync is the bridge: pullSpace() fetches everything for a space in the
   shape world.html already expects (so it can be merged straight into S),
   the push/update functions fire the matching write to the server (best-effort, additive
   — the local commit()/save() world.html already does remains the source of
   truth for this tab's own UI), and subscribe() opens one realtime channel so
   a partner's own additions/edits arrive live instead of needing a reload.
   Every function no-ops safely when Supabase isn't configured, since the
   caller only invokes them behind `if(PL.backend.connected)`.               */
function mapMomentRow(r){return {id:r.id,by:r.by===PL._uid?'me':'partner',_by:r.by,type:r.type,text:r.text,
  photo:r.photo_path?('sb:'+r.photo_path):'',date:r.date,mood:r.mood||'',chapter:r.chapter||undefined,
  fav:!!r.fav,hidden:!!r.hidden,editedAt:r.edited_at||undefined,_deletedAt:r.deleted_at||null}}
function mapLetterRow(r){return {id:r.id,by:r.by===PL._uid?'me':'partner',title:r.title,body:r.body,
  sealedUntil:r.sealed_until||'',opened:!!r.opened,type:'letter'}}
function mapPlanRow(r){return {id:r.id,cat:r.cat,text:r.text,done:!!r.done}}
PL.sync={
  pullSpace:function(spaceId){
    if(!sb())return Promise.resolve(null);
    return sb().auth.getUser().then(function(u){
      PL._uid=u.data.user&&u.data.user.id;
      return Promise.all([
        sb().from('moments').select('*').eq('space_id',spaceId).is('deleted_at',null).order('date',{ascending:false}),
        sb().from('moments').select('*').eq('space_id',spaceId).not('deleted_at','is',null).order('deleted_at',{ascending:false}),
        sb().from('letters').select('*').eq('space_id',spaceId).order('created_at',{ascending:false}),
        sb().from('plans').select('*').eq('space_id',spaceId).order('created_at',{ascending:true}),
        sb().from('rituals').select('*').eq('space_id',spaceId).order('created_at',{ascending:true}),
        sb().from('need_requests').select('*').eq('space_id',spaceId).is('responded_at',null).order('created_at',{ascending:false})
      ]).then(function(res){
        res.forEach(function(x){if(x.error)throw sbErr(x.error)});
        return {
          needInbox:(res[5].data||[]).filter(function(x){return x.by!==PL._uid}).map(function(x){return {id:x.id,category:x.category,note:x.note,noReplyNeeded:x.no_reply_needed}}),
          moments:(res[0].data||[]).map(mapMomentRow),
          recentlyDeleted:(res[1].data||[]).map(function(r){return {m:mapMomentRow(r),deletedAt:r.deleted_at}}),
          letters:(res[2].data||[]).map(mapLetterRow),
          plans:(res[3].data||[]).map(mapPlanRow),
          rituals:(res[4].data||[]).map(function(r){return {id:r.id,label:r.label,cadence:r.cadence,last:r.last_done_at||''}})
        };
      });
    });
  },
  pushMoment:function(spaceId,m){ /* m: local moment shape from PL.captureForm */
    if(!sb())return Promise.resolve(null);
    var photoPath=null;
    var body={space_id:spaceId,type:m.type,text:m.text||'',date:m.date,mood:m.mood||''};
    var up=m.photo?PL.media.upload(spaceId,m.photo):Promise.resolve(null);
    return up.then(function(path){if(path)body.photo_path=path;
      return sb().from('moments').insert(body).select().single();
    }).then(function(res){if(res.error)throw sbErr(res.error);var mapped=mapMomentRow(res.data);mapped.by='me';Object.assign(m,mapped);return PL.media.preload(mapped.photo?[mapped.photo]:[]).then(function(){return mapped});});
  },
  updateMoment:function(id,patch){
    if(!sb())return Promise.resolve(null);
    var row={};
    if('text' in patch)row.text=patch.text;if('date' in patch)row.date=patch.date;if('mood' in patch)row.mood=patch.mood;
    if('editedAt' in patch)row.edited_at=patch.editedAt;if('fav' in patch)row.fav=patch.fav;if('hidden' in patch)row.hidden=patch.hidden;
    if('chapter' in patch)row.chapter=patch.chapter||null;
    return sb().from('moments').update(row).eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)});
  },
  softDeleteMoment:function(id){if(!sb())return Promise.resolve();return sb().from('moments').update({deleted_at:new Date().toISOString()}).eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  restoreMoment:function(id){if(!sb())return Promise.resolve();return sb().from('moments').update({deleted_at:null}).eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  purgeMoment:function(id){if(!sb())return Promise.resolve();return sb().from('moments').delete().eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  sendSignal:function(spaceId,kind){if(!sb())return Promise.resolve();return sb().from('signals').insert({space_id:spaceId,kind:kind}).then(function(res){if(res.error)throw sbErr(res.error)})},
  sendNeed:function(spaceId,category,note,noReply){
    if(!sb())return Promise.resolve(null);
    return sb().from('need_requests').insert({space_id:spaceId,category:category,note:note||null,no_reply_needed:!!noReply}).select().single()
      .then(function(res){if(res.error)throw sbErr(res.error);return res.data});
  },
  respondNeed:function(id,text,kind){if(!sb())return Promise.resolve();return sb().from('need_requests').update({response_text:text,response_kind:kind||'text'}).eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  pushLetter:function(spaceId,l){
    if(!sb())return Promise.resolve(null);
    return sb().from('letters').insert({space_id:spaceId,title:l.title,body:l.body||'',sealed_until:l.sealedUntil||null}).select().single()
      .then(function(res){if(res.error)throw sbErr(res.error);var mapped=mapLetterRow(res.data);mapped.by='me';Object.assign(l,mapped);return mapped;});
  },
  openLetter:function(id){if(!sb())return Promise.resolve();return sb().from('letters').update({opened:true,opened_at:new Date().toISOString()}).eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  pushPlan:function(spaceId,p){
    if(!sb())return Promise.resolve(null);
    return sb().from('plans').insert({space_id:spaceId,cat:p.cat||'Dates',text:p.text}).select().single()
      .then(function(res){if(res.error)throw sbErr(res.error);var mapped=mapPlanRow(res.data);Object.assign(p,mapped);return mapped;});
  },
  updatePlan:function(id,patch){if(!sb())return Promise.resolve();return sb().from('plans').update(patch).eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  removePlan:function(id){if(!sb())return Promise.resolve();return sb().from('plans').delete().eq('id',id).then(function(res){if(res.error)throw sbErr(res.error)})},
  /* One realtime channel per space. handlers: {onMoment,onLetter,onPlan,onSignal,onNeed,onMember} each
     receive (eventType, newRow, oldRow); world.html decides how to merge into S and re-render. */
  subscribe:function(spaceId,handlers){
    if(!sb())return {unsubscribe:function(){}};
    var ch=sb().channel('space:'+spaceId)
      .on('postgres_changes',{event:'*',schema:'public',table:'moments',filter:'space_id=eq.'+spaceId},function(p){handlers.onMoment&&handlers.onMoment(p.eventType,p.new,p.old)})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'signals',filter:'space_id=eq.'+spaceId},function(p){handlers.onSignal&&handlers.onSignal(p.new)})
      .on('postgres_changes',{event:'*',schema:'public',table:'need_requests',filter:'space_id=eq.'+spaceId},function(p){handlers.onNeed&&handlers.onNeed(p.eventType,p.new,p.old)})
      .on('postgres_changes',{event:'*',schema:'public',table:'letters',filter:'space_id=eq.'+spaceId},function(p){handlers.onLetter&&handlers.onLetter(p.eventType,p.new,p.old)})
      .on('postgres_changes',{event:'*',schema:'public',table:'plans',filter:'space_id=eq.'+spaceId},function(p){handlers.onPlan&&handlers.onPlan(p.eventType,p.new,p.old)})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'space_members',filter:'space_id=eq.'+spaceId},function(p){handlers.onMember&&handlers.onMember(p.new)})
      .subscribe();
    return ch;
  }
};

/* Billing (exactly two paid plans, prices kept here only) */
PL.PRICING={
  currency:'INR',locale:'en-IN',
  /* Test values. Change freely; nothing else in the app hard-codes a price.
     amount:null renders as "Price announced before launch". */
  plans:[
    {id:'digital',name:'Pairlum Digital Membership',short:'Digital Membership',amount:null,period:'year',
     line:'Your whole shared world, kept and growing.',
     features:['Our World: Window, Signals, Pulse and For You','Unlimited Moments: photos and thoughts','Timeline, Chapters and your private Archive','Letters, plans and your reunion countdown','Export your data whenever you like']},
    {id:'book',name:'Pairlum Membership + Physical Pairlum Book',short:'Membership + Book',amount:null,period:'year',
     line:'Everything in Digital, plus your story in print.',
     features:['Everything in Digital Membership','A printed Pairlum Book of your year together','Book becomes available after 1 full year on this plan','One Book per Couple Space']}
  ]
};
PL.plan=function(id){return PL.PRICING.plans.filter(function(p){return p.id===id})[0]||null};
PL.price=function(p){if(!p||p.amount==null)return null;
  try{return new Intl.NumberFormat(PL.PRICING.locale,{style:'currency',currency:PL.PRICING.currency,maximumFractionDigits:0}).format(p.amount)}catch(e){return '₹'+p.amount}};
PL.billing={
  membership:function(){return pending('membership_status')},          /* >>> INTEGRATION POINT → {plan, since, bookEligible} */
  startCheckout:function(planId){if(offline())return Promise.reject(err('offline'));return latency().then(function(){return pending('checkout')})}, /* >>> INTEGRATION POINT */
  confirm:function(ref){return pending('payment_confirmation')}        /* >>> INTEGRATION POINT */
};

/* Account data */
PL.account={
  deleteAccount:function(){ /* >>> INTEGRATION POINT: delete the account on the server */
    if(offline())return Promise.reject(err('offline'));
    if(sb())return sb().auth.getUser().then(function(u){return sb().from('moments').select('photo_path').eq('by',u.data.user.id)}).then(function(res){if(res.error)throw sbErr(res.error);var paths=res.data.map(function(m){return m.photo_path}).filter(Boolean);return paths.length?sb().storage.from('moment-photos').remove(paths):{error:null}}).then(function(res){if(res.error)throw sbErr(res.error);return sb().rpc('pl2_delete_own_account')}).then(function(res){if(res.error)throw sbErr(res.error);return true});
    return latency().then(function(){return pending('account_deletion')});
  },
  serverExport:function(){
    if(!sb())return PL.account.exportDevice();
    var sp=PL.space.get();return PL.sync.pullSpace(sp.id).then(function(content){
      return Promise.all(content.moments.filter(function(m){return m.photo}).map(function(m){return sb().storage.from('moment-photos').createSignedUrl(m.photo.slice(3),3600).then(function(res){if(res.error)throw sbErr(res.error);return fetch(res.data.signedUrl).then(function(x){if(!x.ok)throw err('export_failed');return x.blob()}).then(blobToData).then(function(data){return [m.id,data]})})})).then(function(media){
        var out={exportedAt:new Date().toISOString(),source:'connected account',account:PL.auth.account(),space:sp,profile:PL.profile.get(),content:content,media:Object.fromEntries(media)};
        var url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));var a=PL.h('a',{href:url,download:'pairlum-export-'+new Date().toISOString().slice(0,10)+'.json'});d.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000);return true;
      });
    });
  },             /* >>> INTEGRATION POINT */
  /* Real, device-level export: everything this browser holds for Pairlum, photos included. */
  exportDevice:function(){
    var out={exportedAt:new Date().toISOString(),source:'this device',note:'Device export. A full export of your connected account arrives with accounts.',
      account:PL.auth.account(),space:PL.space.get(),world:rd(K.world,null),settings:rd(K.settings,null),dna:rd(K.dna,null)};
    var refs=[];((out.world&&out.world.moments)||[]).forEach(function(m){if(m.photo&&/^idb:/.test(m.photo))refs.push(m.photo)});
    return Promise.all(refs.map(function(r){return PL.media.get(r).then(function(b){return b?blobToData(b).then(function(u){return [r,u]}):[r,null]})}))
      .then(function(pairs){out.photos={};pairs.forEach(function(p){if(p[1])out.photos[p[0]]=p[1]});
        var blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
        var a=PL.h('a',{href:URL.createObjectURL(blob),download:'pairlum-export-'+new Date().toISOString().slice(0,10)+'.json'});d.body.append(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(a.href)},4000);return true});
  },
  eraseDevice:function(){
    Object.keys(localStorage).forEach(function(k){if(/^pl-/.test(k)||k==='theme')localStorage.removeItem(k)});
    try{sessionStorage.clear()}catch(e){}
    return PL.media.clear();
  }
};
function blobToData(b){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(b)})}

/* ---------- media: photos live in IndexedDB on this device (localStorage is far too small) ----------
   Moment.photo holds a reference 'idb:<id>'. When media storage is connected, upload() moves the blob
   to the server and the reference becomes a URL; render code already treats photo as a reference.   */
var dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise(function(res,rej){
  if(!window.indexedDB){rej(err('no_idb'));return}
  var r=indexedDB.open('pairlum-media',1);r.onupgradeneeded=function(){r.result.createObjectStore('photos')};
  r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error||err('idb_open'))}});return dbp}
function tx(mode,fn){return db().then(function(x){return new Promise(function(res,rej){var t=x.transaction('photos',mode),s=t.objectStore('photos'),out=fn(s);
  t.oncomplete=function(){res(out&&out.result!==undefined?out.result:out)};t.onerror=function(){rej(t.error||err('idb_tx'))};t.onabort=function(){rej(t.error||err('quota'))}})})}
var urlCache={};
PL.media={
  LIMITS:{maxBytes:20*1024*1024,maxEdge:1600,types:['image/jpeg','image/png','image/webp','image/gif']},
  check:function(f){ /* → null | 'unsupported' | 'too_large' */
    if(!f)return 'missing';
    var t=(f.type||'').toLowerCase();
    if(PL.media.LIMITS.types.indexOf(t)<0)return 'unsupported';
    if(f.size>PL.media.LIMITS.maxBytes)return 'too_large';
    return null;
  },
  /* decode + downscale; onProgress(0..1) */
  prepare:function(f,edge,onProgress){
    edge=edge||PL.media.LIMITS.maxEdge;onProgress=onProgress||function(){};
    return new Promise(function(res,rej){
      onProgress(.1);
      var u=URL.createObjectURL(f),img=new Image();
      img.onload=function(){onProgress(.45);
        var sc=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight)),c=d.createElement('canvas');
        c.width=Math.max(1,Math.round(img.naturalWidth*sc));c.height=Math.max(1,Math.round(img.naturalHeight*sc));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);onProgress(.7);
        if(c.toBlob)c.toBlob(function(b){b?res(b):rej(err('unreadable'))},'image/jpeg',.84);else rej(err('unreadable'));
      };
      img.onerror=function(){URL.revokeObjectURL(u);rej(err('unreadable'))};
      img.src=u;
    });
  },
  put:function(blob){var id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    return tx('readwrite',function(s){return s.put(blob,id)}).then(function(){var ref='idb:'+id;urlCache[ref]=URL.createObjectURL(blob);return ref})},
  get:function(ref){if(!/^idb:/.test(ref||''))return Promise.resolve(null);return tx('readonly',function(s){return s.get(ref.slice(4))}).then(function(r){return r||null}).catch(function(){return null})},
  url:function(ref){ /* sync, from cache: string | null (missing) | undefined (not loaded yet) */
    if(!ref)return null;if(/^data:|^https?:/.test(ref))return ref;if(/^blob:/.test(ref))return null; /* blob URLs from older builds die on reload */
    if(/^idb:/.test(ref))return ref in urlCache?urlCache[ref]:undefined;
    if(/^sb:/.test(ref))return ref in urlCache?urlCache[ref]:undefined; /* cloud photo — signed URL, filled by preload() */
    return null},
  preload:function(refs){return Promise.all((refs||[]).filter(function(r){return /^idb:/.test(r||'')&&!(r in urlCache)}).map(function(r){
      return PL.media.get(r).then(function(b){urlCache[r]=b?URL.createObjectURL(b):null})})
    .concat((refs||[]).filter(function(r){return /^sb:/.test(r||'')&&!(r in urlCache)}).map(function(r){
      if(!sb()){urlCache[r]=null;return null}
      return sb().storage.from('moment-photos').createSignedUrl(r.slice(3),3600).then(function(res){urlCache[r]=(res.data&&res.data.signedUrl)||null});
    })))},
  remove:function(ref){if(!/^idb:/.test(ref||''))return Promise.resolve();if(urlCache[ref])URL.revokeObjectURL(urlCache[ref]);delete urlCache[ref];
    return tx('readwrite',function(s){return s.delete(ref.slice(4))}).catch(function(){})},
  clear:function(){return tx('readwrite',function(s){return s.clear()}).catch(function(){})},
  /* Move a locally-captured photo (idb: ref) to cloud storage under this space.
     Keeps the IndexedDB copy too — it doubles as an offline-capture cache — and
     returns the new 'sb:<path>' reference moments/pushMoment() stores instead. */
  upload:function(spaceId,ref){ /* >>> INTEGRATION POINT: move blob to cloud storage, return a reference */
    if(!sb()||!/^idb:/.test(ref||''))return Promise.resolve(null);
    return PL.media.get(ref).then(function(blob){
      if(!blob)return null;
      var path=spaceId+'/'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)+(blob.type.includes('webm')?'.webm':blob.type.includes('ogg')?'.ogg':blob.type.startsWith('audio/')?'.m4a':blob.type.startsWith('video/')?'.mp4':'.jpg');
      return sb().storage.from('moment-photos').upload(path,blob,{contentType:blob.type||'image/jpeg'}).then(function(res){
        if(res.error)throw sbErr(res.error);return path;
      });
    });
  }
};

/* ---------- capture: one form for text + photo Moments, used by First Chapter and Drop ----------
   opts: {save(moment)→Promise, onDone(moment), onCancel(), submitLabel, partnerName, kind, cancelLabel}
   Photos are prepared (decoded + resized) and kept on this device in IndexedDB. Nothing is uploaded:
   the note says so, and PL.media.upload() is the integration point for cloud storage. */
PL.MEM_MOODS=[['','None'],['loved','Loved'],['peaceful','Peaceful'],['missing','Missing you']];
PL.captureForm=function(o){
  var h=PL.h,kind=o.kind||'text',file=null,previewURL=null,busy=false,uid='cap'+Date.now().toString(36);
  var wrap=h('div',{class:'cap'}),recorder=null,stream=null,chunks=[],recording=false;
  function stopTracks(){if(stream)stream.getTracks().forEach(function(t){t.stop()});stream=null;}
  function cleanRecord(){if(recorder&&recorder.state!=='inactive')recorder.stop();stopTracks();}
  var observer=new MutationObserver(function(){if(!wrap.isConnected){cleanRecord();observer.disconnect();}});
  setTimeout(function(){if(wrap.isConnected)observer.observe(document.body,{childList:true,subtree:true})},100);
  var recordBtn=h('button',{class:'btn ghost',type:'button',onclick:function(){
    if(recording){recorder.stop();recordBtn.disabled=true;return;}
    if(!navigator.mediaDevices||!window.MediaRecorder){setError('Recording isn’t supported here. Choose a saved audio or video file.');return;}
    recordBtn.disabled=true;navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'}).then(function(s){
      stream=s;chunks=[];recorder=new MediaRecorder(s);recording=true;recordBtn.disabled=false;recordBtn.textContent='Stop recording';saveBtn.disabled=true;
      recorder.ondataavailable=function(e){if(e.data.size)chunks.push(e.data);if(chunks.reduce(function(n,b){return n+b.size},0)>50*1024*1024)recorder.stop()};
      recorder.onstop=function(){recording=false;stopTracks();file=new File(chunks,['moment',kind==='voice'?'webm':'mp4'].join('.'),{type:recorder.mimeType});recordBtn.disabled=false;recordBtn.textContent='Record again';showThumb();saveBtn.disabled=false;};recorder.start(1000);
    }).catch(function(){recordBtn.disabled=false;setError('Camera or microphone access wasn’t allowed. You can choose a saved file instead.');});
  }},'Start recording');

  var KINDS=[['text','Text'],['photo','Photo'],['voice','Voice'],['video','Video']];
  var tabs=h('div',{class:'cap-tabs',role:'tablist','aria-label':'What kind of moment'});
  var panel=h('div',{class:'cap-panel',role:'tabpanel',id:uid+'p'});
  var err=h('div',{class:'cap-err','aria-live':'polite'});
  var prog=h('div',{class:'cap-prog',hidden:true},h('div',{class:'pbar'},h('i')),h('p',{class:'cap-stage pl-mono','aria-live':'polite'}));
  var saveBtn=h('button',{type:'submit',class:'btn'},o.submitLabel||'Save');
  var cancelBtn=o.onCancel?h('button',{type:'button',class:'btn ghost',onclick:function(){if(!busy){cleanRecord();o.onCancel()}}},o.cancelLabel||'Cancel'):null;
  var today=new Date(),iso=function(x){return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  var ta=h('textarea',{class:'in',id:uid+'t',rows:'4',maxlength:'1000'});
  var dateIn=h('input',{class:'in',type:'date',id:uid+'d',max:iso(today),value:iso(today)});
  var mood='';
  var moods=h('div',{class:'chips',role:'group','aria-labelledby':uid+'m'});
  PL.MEM_MOODS.forEach(function(m){var b=h('button',{type:'button',class:'chip','aria-pressed':String(mood===m[0]),onclick:function(){mood=m[0];[].forEach.call(moods.children,function(x){x.setAttribute('aria-pressed',String(x===b))})}},m[1]);moods.append(b)});
  var fileIn=h('input',{type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,image/*',id:uid+'f',class:'vh'});
  var pick=h('label',{for:uid+'f',class:'cap-pick',tabindex:'0',role:'button'},h('span',{class:'cap-pick-ic','aria-hidden':'true',html:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none"/><path d="M21 16l-5.5-5.5L9 17"/></svg>'}),
    h('span',null,h('b',null,'Choose a photo'),h('small',null,'JPEG, PNG, WebP or GIF, up to 20 MB')));
  pick.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fileIn.click()}});
  var thumb=h('div',{class:'cap-thumb',hidden:true});
  function setError(msg,retry){err.replaceChildren();if(!msg)return;
    err.append(h('div',{class:'notice error',role:'alert'},h('div',null,h('p',null,msg),retry?h('p',null,h('button',{type:'button',class:'link',onclick:retry},'Try again')):null)))}
  function showThumb(){thumb.replaceChildren();if(!file){thumb.hidden=true;pick.hidden=false;return}
    if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);
    thumb.append(kind==='voice'?h('audio',{src:previewURL,controls:true}):kind==='video'?h('video',{src:previewURL,controls:true,playsinline:true}):h('img',{src:previewURL,alt:'Selected photo preview'}),h('div',{class:'cap-thumb-x'},
      h('span',{class:'pl-mono'},(file.size/1048576).toFixed(1)+' MB'),
      h('button',{type:'button',class:'link',onclick:function(){fileIn.click()}},'Change'),
      h('button',{type:'button',class:'link',onclick:function(){file=null;fileIn.value='';showThumb()}},'Remove')));
    thumb.hidden=false;pick.hidden=true}
  fileIn.addEventListener('change',function(){var f=fileIn.files&&fileIn.files[0];if(!f)return;setError();
    var c=kind==='photo'?PL.media.check(f):(!f.type.startsWith(kind==='voice'?'audio/':'video/')?'unsupported':f.size>50*1024*1024?'too_large':null);
    if(c==='unsupported'){file=null;showThumb();setError(/heic|heif/i.test(f.type+f.name)?'iPhone HEIC photos can’t be opened here yet. Share the photo as a JPEG, or choose another one.':'That file isn’t a photo we can use. Choose a JPEG, PNG, WebP or GIF.');return}
    if(c==='too_large'){file=null;showThumb();setError('This photo is over 20 MB. Choose a smaller one.');return}
    file=f;showThumb()});
  function field(label,ctl,id,hint){return h('div',{class:'field'},h('label',{for:id},label),ctl,hint?h('span',{class:'hint'},hint):null)}
  function draw(){
    [].forEach.call(tabs.children,function(b){var on=b.dataset.k===kind;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
    panel.replaceChildren();setError();
    saveBtn.disabled=false;
    fileIn.accept=kind==='voice'?'audio/*':kind==='video'?'video/*':'image/jpeg,image/png,image/webp,image/gif';pick.querySelector('b').textContent=kind==='voice'?'Choose audio':kind==='video'?'Choose video':'Choose a photo';pick.querySelector('small').textContent=kind==='photo'?'JPEG, PNG, WebP or GIF, up to 20 MB':'Audio or video, up to 50 MB';
    if(kind==='voice'||kind==='video')panel.append(h('div',{class:'cap-record'},recordBtn));
    if(kind!=='text'){panel.append(fileIn,pick,thumb,field('Caption (optional)',ta,uid+'t'));ta.placeholder='What was happening?'}
    else panel.append(field(o.textLabel||'In your own words',ta,uid+'t'));
    if(kind==='text')ta.placeholder=o.textPlaceholder||'One small thing from today…';
    panel.append(field('When it happened',dateIn,uid+'d'),h('div',{class:'field'},h('span',{class:'lab',id:uid+'m'},'How it felt (optional)'),moods));
  }
  KINDS.forEach(function(k){var b=h('button',{type:'button',role:'tab',class:'cap-tab','data-k':k[0],'aria-controls':uid+'p',onclick:function(){if(busy||recording)return;kind=k[0];file=null;fileIn.value='';showThumb();draw();b.focus()}},k[1]);tabs.append(b)});
  tabs.addEventListener('keydown',function(e){var bs=[].slice.call(tabs.children),i=bs.indexOf(document.activeElement);if(i<0)return;
    var n={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:bs.length-1}[e.key];if(n==null)return;e.preventDefault();n=(n+bs.length)%bs.length;bs[n].click()});
  function setProg(p,label){prog.hidden=false;prog.querySelector('i').style.width=Math.round(p*100)+'%';if(label)prog.querySelector('.cap-stage').textContent=label}
  function lock(on){busy=on;saveBtn.disabled=on;if(cancelBtn)cancelBtn.disabled=on;ta.disabled=on;dateIn.disabled=on;fileIn.disabled=on;
    [].forEach.call(moods.children,function(b){b.disabled=on});[].forEach.call(tabs.children,function(b){b.disabled=on});
    saveBtn.replaceChildren();if(on)saveBtn.append(h('span',{class:'spin','aria-hidden':'true'}),'Saving…');else saveBtn.append(o.submitLabel||'Save')}
  var form=h('form',{novalidate:true,class:'cap-form'},tabs,panel,err,prog,h('p',{class:'cap-note pl-pending'},PL.backend.connected?'Private to your space · saved securely':'Device preview · saved only in this browser'),h('div',{class:'cap-act'},cancelBtn,saveBtn));
  form.addEventListener('submit',function(e){e.preventDefault();if(busy)return;setError();
    var text=ta.value.trim();
    if(kind==='text'&&!text){setError('Write a few words first.');ta.setAttribute('aria-invalid','true');ta.focus();return}
    if(kind!=='text'&&!file){setError('Choose a photo first.');pick.focus();return}
    ta.removeAttribute('aria-invalid');
    var dv=dateIn.value,isToday=dv===iso(new Date()),when=isToday||!dv?new Date():new Date(dv+'T12:00');
    if(when.getTime()>Date.now()+6e4){setError('Choose a day that has already happened.');dateIn.focus();return}
    lock(true);var ref=null;
    var step=kind!=='text'?
      (kind==='photo'?PL.media.prepare(file,null,function(p){setProg(p*.8,'Preparing your photo…')}):Promise.resolve(file)).then(function(b){setProg(.85,'Saving on this device…');return PL.media.put(b)}).then(function(r){ref=r;setProg(.95)}):
      Promise.resolve();
    step.then(function(){
      var m={id:Date.now(),by:'me',type:kind,text:text||(kind==='photo'?'':''),photo:ref||'',date:when.toISOString(),mood:mood};
      return Promise.resolve(o.save(m)).then(function(){return m});
    }).then(function(m){setProg(1,'Saved');lock(false);if(previewURL)URL.revokeObjectURL(previewURL);o.onDone&&o.onDone(m)},function(ex){
      lock(false);prog.hidden=true;
      if(ref)PL.media.remove(ref);
      var code=ex&&ex.code;
      if(code==='unreadable')setError('We couldn’t open this photo. It may be damaged. Try another one.');
      else if(code==='no_idb')setError('This browser can’t keep photos (private browsing can block it). Try a text moment, or open Pairlum in a normal window.');
      else setError(PL.backend.connected?'Your moment wasn’t saved. Check your connection and try again.':'Your moment wasn’t saved. Check available storage and try again.',function(){form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true}))});
    });
  });
  draw();
  wrap.append(form);
  wrap.focusFirst=function(){var t=tabs.querySelector('[aria-selected=true]');(kind==='text'?ta:t).focus()};
  return wrap;
};
/* shared styles for the capture form live in pairlum-core.css (.cap-*) */

/* ---------- analytics hooks: funnel events only, never private content ---------- */
var EVENTS={
  signup_started:['method'],signup_completed:['method'],space_created:['ldr'],invite_sent:['channel'],
  partner_joined:[],first_memory_created:['kind','source'],first_chapter_completed:[],
  pricing_viewed:['source'],upgrade_clicked:['source','plan'],checkout_started:['plan'],purchase_completed:['plan']};
var ONCE=['signup_completed','space_created','partner_joined','first_memory_created','first_chapter_completed','purchase_completed'];
var SAFE_VALUE=/^[a-z0-9_\-]{1,40}$/i;
var transport=null;
PL.analytics={queue:[],
  setTransport:function(fn){transport=fn;PL.analytics.queue.splice(0).forEach(function(e){try{fn(e)}catch(x){}})} /* >>> INTEGRATION POINT: vendor */
};
PL.track=function(name,props){
  if(!EVENTS[name]||PL.qa.on)return false;
  var flags=rd(K.flags,{})||{};
  if(ONCE.indexOf(name)>-1){if(flags['ev_'+name])return false;flags['ev_'+name]=new Date().toISOString();wrSafe(K.flags,flags)}
  var clean={};(EVENTS[name]||[]).forEach(function(k){var v=props&&props[k];
    if(typeof v==='boolean'||typeof v==='number')clean[k]=v;else if(typeof v==='string'&&SAFE_VALUE.test(v))clean[k]=v});
  var ev={event:name,props:clean,at:new Date().toISOString(),page:location.pathname.split('/').pop()||'index.html'};
  if(transport){try{transport(ev)}catch(x){}}else{PL.analytics.queue.push(ev);if(PL.analytics.queue.length>100)PL.analytics.queue.shift()}
  try{window.dispatchEvent(new CustomEvent('pairlum:analytics',{detail:ev}))}catch(x){}
  return true;
};

/* ---------- routing + guards ---------- */
PL.routes={landing:'index.html',signup:'auth.html#signup',login:'auth.html#login',forgot:'auth.html#forgot',onboarding:'onboarding.html',
  world:'world.html',settings:'settings.html',pricing:'pricing.html',legal:'legal.html',join:'join.html',dna:'dna.html'};
PL.links={privacy:'legal.html#privacy',terms:'legal.html#terms',refund:'legal.html#refund',book:'legal.html#book-terms',
  aup:'legal.html#acceptable-use',cookies:'legal.html#cookies',data:'legal.html#data',founding:'legal.html#founding-50',plain:'legal.html#plain'};
PL.home=function(){var s=PL.space.get();if(!PL.auth.session())return PL.routes.landing;if(!s||!PL.progress.done())return PL.routes.onboarding;return PL.routes.world};
PL.safeNext=function(n){return n&&/^[a-z0-9\-]+\.html([?#][\w\-=&.%#]*)?$/i.test(n)?n:null};
PL.requireSession=function(){if(PL.auth.session())return true;
  var here=location.pathname.split('/').pop()+location.search+location.hash;location.replace('auth.html?next='+encodeURIComponent(here)+'#login');return false};

/* ---------- offline + unexpected error banners ---------- */
var offBanner=null;
function showOffline(on){
  if(!d.body)return;
  if(on){if(offBanner)return;offBanner=PL.h('div',{class:'pl-banner',role:'status','aria-live':'polite'},
      PL.h('span',{class:'bx'},PL.backend.connected?'You’re offline. Connect again to save to your shared space.':'You’re offline. This preview keeps moments only in this browser.'));d.body.append(offBanner)}
  else if(offBanner){offBanner.remove();offBanner=null;PL.toast('Back online')}
}
window.addEventListener('offline',function(){showOffline(true)});
window.addEventListener('online',function(){showOffline(false)});
var errShown=false;
PL.showError=function(msg){
  if(errShown||!d.body)return;errShown=true;
  var b=PL.h('div',{class:'pl-banner',role:'alert'},PL.h('span',{class:'bx'},msg||'Something went wrong on this page. Your moments are safe on this device.'),
    PL.h('button',{type:'button',onclick:function(){location.reload()}},'Reload'),
    PL.h('button',{type:'button','aria-label':'Dismiss',onclick:function(){b.remove();errShown=false}},'Dismiss'));
  d.body.append(b);
};
window.addEventListener('error',function(e){if(e&&e.error&&!(e.target&&e.target!==window&&e.target.tagName))PL.showError()});
window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;if(r&&(r.code==='backend_pending'||r.code==='offline'))return;PL.showError()});

/* ---------- boot ---------- */
d.addEventListener('DOMContentLoaded',function(){
  if(navigator.onLine===false)showOffline(true);
  if(!PL.backend.connected&&/^(world|settings|onboarding|join)\.html$/.test(location.pathname.split('/').pop())){var b=PL.h('div',{class:'pl-banner',role:'status',style:'position:relative;z-index:5'},PL.h('span',{class:'bx'},'Device preview · moments stay in this browser. Partner sync is awaiting activation.'));d.body.prepend(b);}
  if(PL.qa.on&&PL.qa.state){var t=PL.h('div',{class:'pl-pending',style:'position:fixed;right:10px;bottom:10px;z-index:160;padding:6px 10px;border-radius:99px;background:var(--card);border:1px solid var(--line)'},'QA preview · '+PL.qa.state);d.body.append(t)}
});
/* Keep the synchronous session/space caches honest across reloads and other
   tabs. requireSession()/PL.auth.session() still read a plain local cache —
   this just keeps that cache aligned with what Supabase actually thinks, so
   a page that was open before a sign-out (or a session picked up from
   another tab) doesn't act on stale local state. It never blocks first
   render: pages already work from the cache immediately, same as before. */
if(sb()){
  sb().auth.onAuthStateChange(function(event,session){
    if(event==='SIGNED_OUT'){clearPersonCache();return}
    if(session&&session.user){
      var cached=rd(K.session,null);
      if(!cached||cached.email!==session.user.email){
        setTimeout(function(){sb().from('profiles').select('name').eq('id',session.user.id).single().then(function(pr){
          wr(K.session,{email:session.user.email,name:(pr.data&&pr.data.name)||'',mode:'server',at:new Date().toISOString()});
        });},0);
      }
    }
  });
}
})();
