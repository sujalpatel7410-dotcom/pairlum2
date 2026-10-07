// Pairlum core — small shared helpers used by the public pages (landing,
// auth, pricing, legal) and, as it grows, the dashboard. Nothing here talks
// to a server: it reads/writes localStorage and builds DOM nodes.
window.PL = (function(){
  "use strict";

  function read(key, fallback){
    try{
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }catch(e){ return fallback; }
  }
  function writeSafe(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  }

  // Minimal element builder: PL.h('div', {class:'x'}, 'text', childEl, [a, b])
  function h(tag, attrs){
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function(k){
      var v = attrs[k];
      if(v === null || v === undefined) return;
      if(k === "class") el.className = v;
      else if(k === "style") el.setAttribute("style", v);
      else if(/^on[a-z]/.test(k) && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    function append(child){
      if(child === null || child === undefined) return;
      if(Array.isArray(child)){ child.forEach(append); return; }
      if(typeof child === "string" || typeof child === "number") el.appendChild(document.createTextNode(String(child)));
      else el.appendChild(child);
    }
    for(var i = 2; i < arguments.length; i++) append(arguments[i]);
    return el;
  }

  // Demo sign-in: a local stand-in for a real account system. auth.html sets
  // this on submit; nothing else writes it. See pairlum-config.js for where
  // a real Supabase project would plug in instead.
  var AUTH_KEY = "pairlum-auth-session-v1";
  var auth = {
    session: function(){ return read(AUTH_KEY, null); },
    setSession: function(data){ writeSafe(AUTH_KEY, data || { at: Date.now() }); },
    clearSession: function(){ try{ localStorage.removeItem(AUTH_KEY); }catch(e){} }
  };

  // Where "Open Pairlum" / a finished sign-in sends someone.
  function home(){ return "app.html"; }

  var motion = {
    ok: function(){
      try{ return !matchMedia("(prefers-reduced-motion: reduce)").matches; }
      catch(e){ return true; }
    }
  };

  return { read: read, writeSafe: writeSafe, h: h, auth: auth, home: home, motion: motion };
})();
