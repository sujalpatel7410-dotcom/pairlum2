/* ==========================================================================
   PAIRLUM — Dashboard Design Studio (dev-only tool, ?design=1)

   This file is only ever fetched when design mode is on (see the loader at
   the bottom of app.html). It never touches app.js and app.js never
   touches it — the dashboard keeps working exactly as shipped, this just
   sits on top of it.

   Two subsystems live here:
   - BUTTONS tab (original): drives the --btn-<kind>-<prop> CSS variables
     defined in styles.css.
   - ELEMENTS tab (new): a generic visual editor for any element on any
     screen/modal of the live dashboard, rendered in the iframe below.
     Edits are written as real CSS rules (keyed by the element's own id,
     or a stable, deterministic data-ds-id path when it has none) into a
     <style> tag injected into the iframe document — never as one-off
     inline hacks — so they survive the app's own re-renders.
   ========================================================================== */
(function(){
  "use strict";
  if(!document.documentElement.hasAttribute("data-design-studio")) return;

  /* ====================================================================
     Shared helpers (color math, status line)
     ==================================================================== */
  function cssColorToHex(css){
    try{
      var c=document.createElement("canvas"); c.width=c.height=1;
      var ctx=c.getContext("2d");
      ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,1,1);
      ctx.fillStyle=css; ctx.fillRect(0,0,1,1);
      var d=ctx.getImageData(0,0,1,1).data;
      return "#"+[d[0],d[1],d[2]].map(function(v){ return ("0"+v.toString(16)).slice(-2); }).join("");
    }catch(e){ return "#000000"; }
  }
  function computedVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function hexToRgb(h){
    h=(h||"#000000").replace("#","");
    if(h.length===3) h=h.split("").map(function(c){ return c+c; }).join("");
    var n=parseInt(h,16)||0;
    return [ (n>>16)&255, (n>>8)&255, n&255 ];
  }
  function rgbToHex(r,g,b){
    return "#"+[r,g,b].map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return ("0"+v.toString(16)).slice(-2); }).join("");
  }
  function mixHex(a,b,t){
    var A=hexToRgb(a), B=hexToRgb(b);
    return rgbToHex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t);
  }
  function escapeHtml(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function setStatus(msg){
    var el = document.getElementById("dsStatus");
    if(el) el.textContent = msg;
  }
  function timeNow(){ return new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }

  /* ====================================================================
     BUTTONS subsystem (unchanged from the first pass)
     ==================================================================== */
  var STORAGE_KEY = "pairlum-design-overrides-v1";

  var KINDS = [
    { id:"primary",   name:"Primary",   selector:".btn-primary",
      make:function(label){ var b=document.createElement("button"); b.type="button"; b.className="btn-primary"; b.textContent=label||"Seal it"; return b; } },
    { id:"secondary", name:"Secondary", selector:".btn-ghost",
      make:function(label){ var b=document.createElement("button"); b.type="button"; b.className="btn-ghost"; b.textContent=label||"Write a letter"; return b; } },
    { id:"text",      name:"Text",      selector:".link-more",
      make:function(label){ var b=document.createElement("button"); b.type="button"; b.className="link-more"; b.textContent=label||"Preview →"; return b; } },
    { id:"icon",      name:"Icon",      selector:".sheet-close",
      make:function(){ var b=document.createElement("button"); b.type="button"; b.className="sheet-close"; b.setAttribute("aria-label","Close");
        b.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'; return b; } }
  ];

  var FIELDS = [
    { key:"color",       label:"Color",         type:"color" },
    { key:"textColor",   label:"Text color",    type:"color" },
    { key:"height",      label:"Height",        type:"number", unit:"px", min:0,  max:120, varSuffix:"height" },
    { key:"padY",        label:"Padding (V)",   type:"number", unit:"px", min:0,  max:60,  varSuffix:"pad-y" },
    { key:"padX",        label:"Padding (H)",   type:"number", unit:"px", min:0,  max:80,  varSuffix:"pad-x" },
    { key:"font",        label:"Font size",     type:"number", unit:"px", min:8,  max:28,  varSuffix:"font" },
    { key:"radius",      label:"Corner radius", type:"number", unit:"px", min:0,  max:999, varSuffix:"radius" },
    { key:"borderW",     label:"Border width",  type:"number", unit:"px", min:0,  max:10,  varSuffix:"border-w" },
    { key:"borderColor", label:"Border color",  type:"color",  varSuffix:"border-color" },
    { key:"shadow",      label:"Shadow",        type:"select", varSuffix:"shadow",
      options:[["none","None"],["soft","Soft"],["medium","Medium"],["strong","Strong"]] },
    { key:"gap",         label:"Icon spacing",  type:"number", unit:"px", min:0, max:40,  varSuffix:"gap" },
    { key:"pressY",      label:"Press distance",type:"number", unit:"px", min:0, max:10,  varSuffix:"press-y" },
    { key:"pressMs",     label:"Press speed",   type:"number", unit:"ms", min:0, max:400, varSuffix:"press-ms" }
  ];
  var VAR_SUFFIX = { color:"color", textColor:"text" };
  FIELDS.forEach(function(f){ if(f.varSuffix) VAR_SUFFIX[f.key] = f.varSuffix; });

  var SHADOW_VALUE = { none:"none", soft:"var(--shadow-1)", medium:"var(--shadow-2)", strong:"var(--shadow-3)" };
  var STATES = ["normal","hover","pressed","focused","disabled","loading"];

  function seedDefaults(){
    var line = cssColorToHex(computedVar("--line"));
    var inkSoft = cssColorToHex(computedVar("--ink-soft"));
    var wine = cssColorToHex(computedVar("--wine"));
    var wineText = cssColorToHex(computedVar("--wine-text") || computedVar("--wine"));
    return {
      primary:   { color:wine, textColor:"#ffffff", height:44, padY:13, padX:26, font:15, radius:999, borderW:0, borderColor:line, shadow:"none", gap:8, pressY:1, pressMs:120 },
      secondary: { color:"#ffffff", textColor:inkSoft, height:44, padY:12, padX:22, font:14, radius:999, borderW:1, borderColor:line, shadow:"none", gap:8, pressY:1, pressMs:120 },
      text:      { color:"#ffffff", textColor:wineText, height:28, padY:2,  padX:0,  font:13, radius:0,   borderW:1, borderColor:line, shadow:"none", gap:6, pressY:1, pressMs:120 },
      icon:      { color:"#ffffff", textColor:inkSoft, height:32, padY:0,  padX:0,  font:14, radius:16,  borderW:1, borderColor:line, shadow:"none", gap:0, pressY:1, pressMs:120 }
    };
  }
  var FILL_IS_NONE_BY_DEFAULT = { secondary:true, text:true, icon:true };

  var defaults = seedDefaults();
  var values = JSON.parse(JSON.stringify(defaults));
  var touched = { primary:{}, secondary:{}, text:{}, icon:{} };
  var undoStack = [];
  var dashboardFrame = null;
  var saveTimer = null;

  function loadSaved(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      var saved = JSON.parse(raw);
      if(!saved || !saved.touched) return;
      Object.keys(saved.touched).forEach(function(kind){
        Object.keys(saved.touched[kind]).forEach(function(field){
          values[kind][field] = saved.values[kind][field];
          touched[kind][field] = true;
        });
      });
    }catch(e){}
  }
  function scheduleSave(){
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function(){
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ values:values, touched:touched, savedAt:Date.now() }));
        setStatus("Saved locally · " + timeNow());
      }catch(e){}
    }, 400);
  }

  function varName(kind, field){ return "--btn-" + kind + "-" + VAR_SUFFIX[field]; }
  function formatValue(field, raw){
    if(field === "shadow") return SHADOW_VALUE[raw] || "none";
    var f = FIELDS.filter(function(x){ return x.key === field; })[0];
    if(f && f.unit) return raw + f.unit;
    return raw;
  }
  function setVarEverywhere(name, value){
    document.documentElement.style.setProperty(name, value);
    if(dashboardFrame){
      try{ dashboardFrame.contentDocument.documentElement.style.setProperty(name, value); }catch(e){}
    }
  }
  function removeVarEverywhere(name){
    document.documentElement.style.removeProperty(name);
    if(dashboardFrame){
      try{ dashboardFrame.contentDocument.documentElement.style.removeProperty(name); }catch(e){}
    }
  }
  function deriveHoverVars(kind, field, hex){
    if(field === "color"){
      if(kind === "primary"){
        setVarEverywhere("--btn-primary-color-hover", mixHex(hex, "#000000", .18));
        setVarEverywhere("--btn-primary-color-active", mixHex(hex, "#000000", .30));
      } else {
        setVarEverywhere("--btn-" + kind + "-bg-hover", mixHex(hex, "#ffffff", .94));
        setVarEverywhere("--btn-" + kind + "-bg-active", mixHex(hex, "#ffffff", .88));
      }
    }
    if(field === "borderColor"){
      setVarEverywhere("--btn-" + kind + "-border-color-hover", mixHex(hex, "#000000", .22));
    }
  }
  function removeDerived(kind, field){
    if(field === "color"){
      if(kind === "primary"){
        removeVarEverywhere("--btn-primary-color-hover");
        removeVarEverywhere("--btn-primary-color-active");
      } else {
        removeVarEverywhere("--btn-" + kind + "-bg-hover");
        removeVarEverywhere("--btn-" + kind + "-bg-active");
      }
    }
    if(field === "borderColor") removeVarEverywhere("--btn-" + kind + "-border-color-hover");
  }
  function applyField(kind, field, raw){
    var isFillNone = field === "color" && FILL_IS_NONE_BY_DEFAULT[kind] && !touched[kind][field];
    if(isFillNone){ removeVarEverywhere(varName(kind, field)); removeDerived(kind, field); return; }
    setVarEverywhere(varName(kind, field), formatValue(field, raw));
    if(field === "color" || field === "borderColor") deriveHoverVars(kind, field, raw);
  }
  function unapplyField(kind, field){
    removeVarEverywhere(varName(kind, field));
    removeDerived(kind, field);
  }
  function applyAllTouched(){
    KINDS.forEach(function(k){
      Object.keys(touched[k.id]).forEach(function(field){
        applyField(k.id, field, values[k.id][field]);
      });
    });
  }

  function setField(kind, field, raw, opts){
    opts = opts || {};
    if(!opts.fromUndo){
      undoStack.push({ kind:kind, field:field, prevValue:values[kind][field], wasTouched: !!touched[kind][field] });
    }
    values[kind][field] = raw;
    touched[kind][field] = true;
    applyField(kind, field, raw);
    refreshInput(kind, field);
    renderStates(kind);
    scheduleSave();
  }
  function undoButtons(){
    var entry = undoStack.pop();
    if(!entry) { setStatus("Nothing to undo on the Buttons tab."); return; }
    values[entry.kind][entry.field] = entry.prevValue;
    if(entry.wasTouched){
      touched[entry.kind][entry.field] = true;
      applyField(entry.kind, entry.field, entry.prevValue);
    } else {
      delete touched[entry.kind][entry.field];
      unapplyField(entry.kind, entry.field);
    }
    refreshInput(entry.kind, entry.field);
    renderStates(entry.kind);
    scheduleSave();
    setStatus("Undid " + entry.kind + " · " + entry.field + ".");
  }
  function resetButtons(){
    if(!window.confirm("Reset every button to its shipped default? This clears the local preview save too.")) return;
    KINDS.forEach(function(k){
      Object.keys(touched[k.id]).forEach(function(field){ unapplyField(k.id, field); });
    });
    defaults = seedDefaults();
    values = JSON.parse(JSON.stringify(defaults));
    touched = { primary:{}, secondary:{}, text:{}, icon:{} };
    undoStack = [];
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    KINDS.forEach(function(k){ renderFields(k.id); renderStates(k.id); });
    setStatus("Reset button styles to shipped defaults.");
  }
  function buildButtonCss(){
    var lines = [];
    var any = false;
    KINDS.forEach(function(k){
      var kindLines = [];
      Object.keys(touched[k.id]).forEach(function(field){
        kindLines.push("  " + varName(k.id, field) + ": " + formatValue(field, values[k.id][field]) + ";");
      });
      if(kindLines.length){ any = true; lines.push("  /* " + k.name + " */"); lines = lines.concat(kindLines); }
    });
    return any ? lines.join("\n") : "";
  }
  function exportButtonCss(){
    var body = buildButtonCss();
    if(!body){ setStatus("No button changes to export yet."); return; }
    var css = "/* Pairlum Design Studio — button overrides\n   Generated " + new Date().toISOString() + "\n   Paste this into styles.css (merge into the :root block) to apply\n   these changes to the real source file. This does not happen automatically. */\n:root{\n" + body + "\n}\n";
    var box = document.getElementById("dsExportBox");
    if(box){ box.hidden = false; box.value = css; }
    downloadText("pairlum-button-overrides.css", css);
    setStatus("Exported pairlum-button-overrides.css · not applied to source files automatically.");
  }
  function downloadText(filename, text){
    var blob = new Blob([text], { type:"text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }

  function fieldInputId(kind, field){ return "ds-" + kind + "-" + field; }
  function renderFields(kind){
    var wrap = document.getElementById("dsFields-" + kind);
    if(!wrap) return;
    wrap.innerHTML = "";
    FIELDS.forEach(function(f){
      var box = document.createElement("div");
      box.className = "ds-field";
      box.id = "dsFieldBox-" + fieldInputId(kind, f.key);
      var labelHtml = '<label for="' + fieldInputId(kind, f.key) + '">' + f.label + '</label>';
      var controlHtml = "";
      var v = values[kind][f.key];
      if(f.type === "color"){
        controlHtml = '<input type="color" id="' + fieldInputId(kind, f.key) + '" value="' + v + '">';
      } else if(f.type === "select"){
        controlHtml = '<select id="' + fieldInputId(kind, f.key) + '">' +
          f.options.map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") +
          '</select>';
      } else {
        controlHtml = '<div class="ds-row"><input type="number" id="' + fieldInputId(kind, f.key) + '" value="' + v + '" min="' + f.min + '" max="' + f.max + '"><span class="unit">' + f.unit + '</span></div>';
      }
      box.innerHTML = labelHtml + controlHtml;
      wrap.appendChild(box);
      var input = box.querySelector("input,select");
      input.addEventListener("input", function(){
        var raw = f.type === "number" ? Number(input.value) : input.value;
        setField(kind, f.key, raw);
      });
    });
    syncTouchedStyles(kind);
  }
  function refreshInput(kind, field){
    var el = document.getElementById(fieldInputId(kind, field));
    if(el) el.value = values[kind][field];
    syncTouchedStyles(kind);
  }
  function syncTouchedStyles(kind){
    FIELDS.forEach(function(f){
      var box = document.getElementById("dsFieldBox-" + fieldInputId(kind, f.key));
      if(box) box.classList.toggle("ds-field-touched", !!touched[kind][f.key]);
    });
  }
  function renderStates(kind){
    var wrap = document.getElementById("dsStates-" + kind);
    if(!wrap) return;
    wrap.innerHTML = "";
    var kindDef = KINDS.filter(function(k){ return k.id === kind; })[0];
    STATES.forEach(function(state){
      var cell = document.createElement("div");
      cell.className = "ds-state";
      var label = document.createElement("span");
      label.className = "ds-state-label";
      label.textContent = state.charAt(0).toUpperCase() + state.slice(1);
      var btn = kindDef.make();
      if(state === "hover") btn.classList.add("is-hover");
      if(state === "pressed") btn.classList.add("is-pressed");
      if(state === "focused") btn.classList.add("is-focused");
      if(state === "disabled") btn.disabled = true;
      if(state === "loading") btn.classList.add("is-loading");
      cell.appendChild(btn);
      cell.appendChild(label);
      wrap.appendChild(cell);
    });
  }

  /* ====================================================================
     ELEMENTS subsystem (new) — the full-project visual editor
     ==================================================================== */
  var ELS_STORAGE_KEY = "pairlum-design-elements-v1";

  var SCREENS = [
    { id:"home",         label:"Home",                  group:"Screens", rootSel:"#view-home" },
    { id:"story",        label:"Our Story",              group:"Screens", rootSel:"#view-story",        trigger:'[data-view="story"]' },
    { id:"letters",      label:"Letters",                 group:"Screens", rootSel:"#view-letters",      trigger:'[data-view="letters"]' },
    { id:"us",           label:"Us",                       group:"Screens", rootSel:"#view-us",           trigger:'[data-view="us"]' },
    { id:"capture",      label:"Add a Moment",             group:"Modals",  rootSel:"#captureOverlay .sheet",     overlay:"captureOverlay",     trigger:'[data-action="open-capture"]' },
    { id:"needReveal",   label:"I Need You — reveal",      group:"Modals",  rootSel:"#needOverlay .sheet",        overlay:"needOverlay",        trigger:"#needPrimaryBtn" },
    { id:"needRequest",  label:"I Need You — request",     group:"Modals",  rootSel:"#needRequestOverlay .sheet", overlay:"needRequestOverlay", trigger:".need-chip" },
    { id:"import",       label:"Import Memories",          group:"Modals",  rootSel:"#importOverlay .sheet",      overlay:"importOverlay",      trigger:'[data-action="open-import"]' },
    { id:"letter",       label:"Write a Letter",           group:"Modals",  rootSel:"#letterOverlay .sheet",      overlay:"letterOverlay",       trigger:'[data-action="open-letter"]' },
    { id:"appearance",   label:"Appearance",               group:"Modals",  rootSel:"#appearanceOverlay .sheet",  overlay:"appearanceOverlay",    trigger:'[data-action="open-appearance"]' },
    { id:"pairing",      label:"Partner & Pairing",        group:"Modals",  rootSel:"#pairingOverlay .sheet",     overlay:"pairingOverlay",       trigger:'[data-action="open-pairing"]' },
    { id:"notifications",label:"Notifications",            group:"Modals",  rootSel:"#notifOverlay .sheet",       overlay:"notifOverlay",         trigger:'[data-action="open-notifications"]' },
    { id:"privacy",      label:"Privacy & Controls",       group:"Modals",  rootSel:"#privacyOverlay .sheet",     overlay:"privacyOverlay",        trigger:'[data-action="open-privacy"]' },
    { id:"nav",          label:"Navigation & FAB",          group:"Chrome",  rootSels:[".topbar",".bottom-nav",".fab"] }
  ];

  var ELFIELD_SECTIONS = [
    { title:"Appearance", fields:[
      { key:"backgroundColor", label:"Background",    type:"color" },
      { key:"color",           label:"Text color",    type:"color" },
      { key:"opacity",         label:"Opacity (0–1)", type:"number", step:"0.05", min:0, max:1 },
      { key:"borderWidth",     label:"Border width",  type:"number", unit:"px" },
      { key:"borderColor",     label:"Border color",  type:"color" },
      { key:"borderStyle",     label:"Border style",  type:"select", options:[["solid","Solid"],["dashed","Dashed"],["none","None"]] },
      { key:"borderRadius",    label:"Corner radius", type:"number", unit:"px" },
      { key:"boxShadow",       label:"Shadow",         type:"select", options:[["none","None"],["0 1px 2px rgba(33,21,18,.06)","Soft"],["0 10px 30px rgba(33,21,18,.10)","Medium"],["0 24px 60px rgba(33,21,18,.16)","Strong"]] }
    ]},
    { title:"Typography", fields:[
      { key:"fontSize",      label:"Font size",      type:"number", unit:"px" },
      { key:"fontWeight",    label:"Weight",          type:"select", options:[["400","Regular"],["500","Medium"],["600","Semibold"],["700","Bold"]] },
      { key:"lineHeight",    label:"Line height",     type:"number", step:"0.1" },
      { key:"textAlign",     label:"Align",           type:"select", options:[["left","Left"],["center","Center"],["right","Right"]] },
      { key:"letterSpacing", label:"Letter spacing",  type:"number", unit:"px", step:"0.1" }
    ]},
    { title:"Spacing", fields:[
      { key:"marginTop",    label:"Margin top",    type:"number", unit:"px" },
      { key:"marginRight",  label:"Margin right",  type:"number", unit:"px" },
      { key:"marginBottom", label:"Margin bottom", type:"number", unit:"px" },
      { key:"marginLeft",   label:"Margin left",   type:"number", unit:"px" },
      { key:"paddingTop",    label:"Padding top",    type:"number", unit:"px" },
      { key:"paddingRight",  label:"Padding right",  type:"number", unit:"px" },
      { key:"paddingBottom", label:"Padding bottom", type:"number", unit:"px" },
      { key:"paddingLeft",   label:"Padding left",   type:"number", unit:"px" },
      { key:"gap",          label:"Gap",            type:"number", unit:"px" }
    ]},
    { title:"Size & layout", fields:[
      { key:"width",          label:"Width",     type:"text" },
      { key:"height",         label:"Height",    type:"text" },
      { key:"display",        label:"Display",   type:"select", options:[["","Default"],["block","Block"],["flex","Flex"],["grid","Grid"],["inline-block","Inline block"],["none","Hidden"]] },
      { key:"flexDirection",   label:"Direction", type:"select", options:[["row","Row"],["column","Column"]] },
      { key:"justifyContent", label:"Justify",   type:"select", options:[["flex-start","Start"],["center","Center"],["flex-end","End"],["space-between","Space between"]] },
      { key:"alignItems",     label:"Align",     type:"select", options:[["stretch","Stretch"],["flex-start","Start"],["center","Center"],["flex-end","End"]] }
    ]}
  ];
  var EL_FIELD_INDEX = {};
  ELFIELD_SECTIONS.forEach(function(s){ s.fields.forEach(function(f){ EL_FIELD_INDEX[f.key] = f; }); });

  var elState = { currentScreenId:"home", selectedRef:null, breakpoint:"both", mode:"edit", zoom:1 };
  var elOverrides = {};
  var elUndoStack = [], elRedoStack = [];
  var elSaveTimer = null;
  var dsFrame = null;
  var hoveredEl = null, selectedEl = null;
  var mo = null;

  function loadElSaved(){
    try{
      var raw = localStorage.getItem(ELS_STORAGE_KEY);
      if(!raw) return;
      var parsed = JSON.parse(raw);
      if(parsed && parsed.overrides) elOverrides = parsed.overrides;
    }catch(e){}
  }
  function scheduleElSave(){
    window.clearTimeout(elSaveTimer);
    elSaveTimer = window.setTimeout(function(){
      try{
        localStorage.setItem(ELS_STORAGE_KEY, JSON.stringify({ overrides:elOverrides, savedAt:Date.now() }));
        setStatus("Saved locally · " + timeNow());
      }catch(e){}
    }, 500);
  }
  function snapshotEl(){ return JSON.stringify(elOverrides); }
  function pushUndoSnapshot(){
    elUndoStack.push(snapshotEl());
    if(elUndoStack.length > 60) elUndoStack.shift();
    elRedoStack.length = 0;
  }
  function elUndo(){
    if(!elUndoStack.length){ setStatus("Nothing to undo on the Elements tab."); return; }
    elRedoStack.push(snapshotEl());
    elOverrides = JSON.parse(elUndoStack.pop());
    afterElOverridesReplaced();
    setStatus("Undid last element edit.");
  }
  function elRedo(){
    if(!elRedoStack.length){ setStatus("Nothing to redo on the Elements tab."); return; }
    elUndoStack.push(snapshotEl());
    elOverrides = JSON.parse(elRedoStack.pop());
    afterElOverridesReplaced();
    setStatus("Redid.");
  }
  function afterElOverridesReplaced(){
    var doc = dsFrame && dsFrame.contentDocument;
    if(doc){ regenerateOverrideStyle(doc); reapplyTextAndHidden(doc); }
    scheduleElSave();
    renderPropertyPanel();
    refreshLayersTree();
  }
  function resetElements(){
    if(!window.confirm("Reset the whole Elements editor — every color, text, spacing, visibility, order and duplicate change? This clears the local save too.")) return;
    elOverrides = {}; elUndoStack = []; elRedoStack = [];
    try{ localStorage.removeItem(ELS_STORAGE_KEY); }catch(e){}
    elState.selectedRef = null;
    setStatus("Reset. Reloading the live dashboard…");
    if(dsFrame){ dsFrame.src = dsFrame.src; } // full reload clears any DOM-level dup/reorder/text edits too
  }

  /* ---------------------------------------------------- stable ref tags */
  function cssEscapeAttr(v){ return String(v).replace(/"/g, '\\"'); }
  function ensureRef(el){
    if(!el || el.nodeType !== 1) return null;
    if(el.id) return "#" + el.id;
    var existing = el.getAttribute("data-ds-id");
    if(existing) return '[data-ds-id="' + cssEscapeAttr(existing) + '"]';
    var parent = el.parentElement;
    if(!parent) return null;
    ensureRef(parent);
    var parentKey = parent.id || parent.getAttribute("data-ds-id") || "root";
    var tag = el.tagName.toLowerCase();
    var idx = 0, sib = el;
    while((sib = sib.previousElementSibling)){ if(sib.tagName === el.tagName) idx++; }
    var dsid = parentKey + "-" + tag + idx;
    el.setAttribute("data-ds-id", dsid);
    return '[data-ds-id="' + cssEscapeAttr(dsid) + '"]';
  }
  function tagTreeFull(doc){
    var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null, false);
    var node = walker.currentNode;
    while(node){
      if(node.nodeType === 1) ensureRef(node);
      node = walker.nextNode();
    }
  }

  /* ------------------------------------------------------- override CSS */
  function cssPropName(camel){ return camel.replace(/[A-Z]/g, function(m){ return "-" + m.toLowerCase(); }); }
  function styleObjToCss(obj){
    if(!obj) return "";
    return Object.keys(obj).map(function(k){ return cssPropName(k) + ":" + obj[k] + ";"; }).join("");
  }
  function regenerateOverrideStyle(doc){
    var styleEl = doc.getElementById("ds-overrides-style");
    if(!styleEl){ styleEl = doc.createElement("style"); styleEl.id = "ds-overrides-style"; doc.head.appendChild(styleEl); }
    var globalRules = [], mobileRules = [], desktopRules = [];
    Object.keys(elOverrides).forEach(function(ref){
      var o = elOverrides[ref];
      var decls = styleObjToCss(o.style);
      if(decls) globalRules.push(ref + "{" + decls + "}");
      if(o.hidden) globalRules.push(ref + "{display:none !important}");
      var m = styleObjToCss(o.mobileStyle);
      if(m) mobileRules.push(ref + "{" + m + "}");
      var d = styleObjToCss(o.desktopStyle);
      if(d) desktopRules.push(ref + "{" + d + "}");
    });
    var css = globalRules.join("\n");
    if(mobileRules.length) css += "\n@media (max-width:859px){\n" + mobileRules.join("\n") + "\n}";
    if(desktopRules.length) css += "\n@media (min-width:860px){\n" + desktopRules.join("\n") + "\n}";
    styleEl.textContent = css;
  }
  function reapplyTextAndHidden(doc){
    Object.keys(elOverrides).forEach(function(ref){
      var o = elOverrides[ref];
      if(o.text != null){
        try{
          var el = doc.querySelector(ref);
          if(el && doc.activeElement !== el && el.textContent !== o.text) el.textContent = o.text;
        }catch(e){}
      }
    });
  }
  function newOverrideEntry(){
    return { style:{}, mobileStyle:{}, desktopStyle:{}, text:null, hidden:false, screenId:elState.currentScreenId };
  }
  function bucketForBreakpoint(){
    return elState.breakpoint === "mobile" ? "mobileStyle" : elState.breakpoint === "desktop" ? "desktopStyle" : "style";
  }
  function setElOverrideValue(ref, key, value){
    var bucket = bucketForBreakpoint();
    if(!elOverrides[ref]) elOverrides[ref] = newOverrideEntry();
    if(value === null || value === "") delete elOverrides[ref][bucket][key];
    else elOverrides[ref][bucket][key] = value;
    var doc = dsFrame.contentDocument;
    regenerateOverrideStyle(doc);
    scheduleElSave();
  }

  /* --------------------------------------------------- canvas selection */
  function ensureHighlightBox(doc){
    if(doc.getElementById("dsSelectBox")) return;
    var css = doc.createElement("style");
    css.id = "ds-highlight-style";
    css.textContent =
      "#dsSelectBox,#dsHoverBox{position:fixed;pointer-events:none;z-index:999999;border-radius:3px;margin:0}" +
      "#dsSelectBox{border:2px solid #7C1B33;box-shadow:0 0 0 2px rgba(124,27,51,.22)}" +
      "#dsHoverBox{border:1.5px dashed rgba(124,27,51,.6)}" +
      "[contenteditable='true']{outline:2px dashed #7C1B33 !important;outline-offset:2px}";
    doc.head.appendChild(css);
    var sel = doc.createElement("div"); sel.id = "dsSelectBox"; sel.style.display = "none"; doc.body.appendChild(sel);
    var hov = doc.createElement("div"); hov.id = "dsHoverBox"; hov.style.display = "none"; doc.body.appendChild(hov);
  }
  function positionBox(doc, id, target){
    var b = doc.getElementById(id);
    if(!b) return;
    if(!target){ b.style.display = "none"; return; }
    var r = target.getBoundingClientRect();
    if(r.width === 0 && r.height === 0){ b.style.display = "none"; return; }
    b.style.display = "block";
    b.style.left = r.left + "px"; b.style.top = r.top + "px";
    b.style.width = r.width + "px"; b.style.height = r.height + "px";
  }
  function isStudioInternal(el){
    return el && (el.id === "dsSelectBox" || el.id === "dsHoverBox" || el.id === "ds-overrides-style" || el.id === "ds-highlight-style");
  }
  function selectElement(el){
    if(!el || isStudioInternal(el)) return;
    var ref = ensureRef(el);
    if(!ref) return;
    elState.selectedRef = ref;
    selectedEl = el;
    var doc = dsFrame.contentDocument;
    positionBox(doc, "dsSelectBox", el);
    renderPropertyPanel();
    refreshLayersSelection();
  }
  function setupCanvasInteractions(doc){
    doc.addEventListener("click", function(e){
      if(!e.isTrusted || elState.mode === "preview") return;
      if(isStudioInternal(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      selectElement(e.target);
    }, true);
    doc.addEventListener("dblclick", function(e){
      if(!e.isTrusted || elState.mode === "preview") return;
      if(isStudioInternal(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      startTextEdit(e.target);
    }, true);
    doc.addEventListener("mouseover", function(e){
      if(elState.mode === "preview" || isStudioInternal(e.target)) return;
      hoveredEl = e.target;
      positionBox(doc, "dsHoverBox", e.target);
    }, true);
    doc.addEventListener("mouseout", function(){
      doc.getElementById("dsHoverBox").style.display = "none";
    }, true);
    doc.addEventListener("scroll", function(){
      positionBox(doc, "dsSelectBox", selectedEl);
      positionBox(doc, "dsHoverBox", hoveredEl);
    }, true);
  }
  function startTextEdit(target){
    if(target.children.length){ selectElement(target); setStatus("That element has nested parts — double-click a smaller piece of text inside it."); return; }
    var ref = ensureRef(target);
    if(target.getAttribute("data-ds-orig-text") === null) target.setAttribute("data-ds-orig-text", target.textContent);
    target.setAttribute("contenteditable", "true");
    target.focus();
    try{
      var doc = target.ownerDocument, range = doc.createRange();
      range.selectNodeContents(target);
      var sel = target.ownerDocument.defaultView.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    }catch(e){}
    function commit(){
      target.removeAttribute("contenteditable");
      target.removeEventListener("blur", commit);
      var origText = target.getAttribute("data-ds-orig-text");
      var newText = target.textContent;
      pushUndoSnapshot();
      if(!elOverrides[ref]) elOverrides[ref] = newOverrideEntry();
      elOverrides[ref].text = (newText === origText) ? null : newText;
      scheduleElSave();
      renderPropertyPanel();
      refreshLayersTree();
    }
    target.addEventListener("blur", commit, { once:true });
    selectElement(target);
  }

  /* ----------------------------------------------- order / duplicate   */
  function duplicateSelected(){
    var doc = dsFrame.contentDocument;
    var el = doc.querySelector(elState.selectedRef);
    if(!el || !el.parentElement) return;
    var clone = el.cloneNode(true);
    clone.removeAttribute("data-ds-id");
    clone.querySelectorAll("[data-ds-id]").forEach(function(d){ d.removeAttribute("data-ds-id"); });
    el.parentElement.insertBefore(clone, el.nextSibling);
    tagTreeFull(doc);
    refreshLayersTree();
    setStatus("Duplicated. Note: duplicates don't survive that section's data re-rendering (e.g. navigating away and back to a dynamic list).");
  }
  function moveSelected(dir){
    var doc = dsFrame.contentDocument;
    var el = doc.querySelector(elState.selectedRef);
    if(!el) return;
    var sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    if(!sib){ setStatus("Already at the " + (dir<0?"top":"bottom") + " of its group."); return; }
    if(dir < 0) el.parentElement.insertBefore(el, sib); else el.parentElement.insertBefore(sib, el);
    positionBox(doc, "dsSelectBox", el);
    refreshLayersTree();
    setStatus("Reordered. Note: order resets if this section re-renders from data.");
  }
  function toggleHidden(){
    var ref = elState.selectedRef;
    if(!ref) return;
    pushUndoSnapshot();
    if(!elOverrides[ref]) elOverrides[ref] = newOverrideEntry();
    elOverrides[ref].hidden = !elOverrides[ref].hidden;
    regenerateOverrideStyle(dsFrame.contentDocument);
    scheduleElSave();
    renderPropertyPanel();
    refreshLayersTree();
  }
  function resetElement(){
    var ref = elState.selectedRef;
    if(!ref || !elOverrides[ref]) return;
    pushUndoSnapshot();
    delete elOverrides[ref];
    regenerateOverrideStyle(dsFrame.contentDocument);
    scheduleElSave();
    renderPropertyPanel();
    refreshLayersTree();
  }

  /* ------------------------------------------------------- screen nav   */
  function goToScreen(screen){
    var doc = dsFrame.contentDocument;
    if(!doc) return;
    var openClose = doc.querySelector(".overlay.is-open [data-close-overlay]");
    if(openClose && !screen.overlay) openClose.click();
    if(screen.trigger){
      var trigger = doc.querySelector(screen.trigger);
      if(trigger) trigger.click();
      else setStatus("Couldn't find the real trigger for " + screen.label + " on this screen — try reaching it by hand, then it'll still be fully editable.");
    } else if(screen.id !== "nav"){
      var homeNav = doc.querySelector('.topbar [data-view="' + screen.id + '"]') || doc.querySelector('[data-view="' + screen.id + '"]');
      if(homeNav) homeNav.click();
    }
    elState.currentScreenId = screen.id;
    highlightActiveScreenButton();
    window.setTimeout(refreshLayersTree, 260);
  }
  function highlightActiveScreenButton(){
    document.querySelectorAll(".ds-screen-btn").forEach(function(b){
      b.classList.toggle("is-active", b.getAttribute("data-screen") === elState.currentScreenId);
    });
  }

  /* --------------------------------------------------------- layers    */
  function currentScreenRootEls(doc){
    var screen = SCREENS.filter(function(s){ return s.id === elState.currentScreenId; })[0];
    if(!screen) return [];
    if(screen.rootSels) return screen.rootSels.map(function(s){ return doc.querySelector(s); }).filter(Boolean);
    var r = doc.querySelector(screen.rootSel);
    return r ? [r] : [];
  }
  function layerLabel(el){
    if(el.id) return "#" + el.id;
    var cls = (el.className || "").toString().split(/\s+/).filter(Boolean)[0];
    if(cls) return "." + cls;
    var txt = (el.textContent || "").trim();
    if(txt) return txt.slice(0, 26);
    return "";
  }
  function buildLayerNode(doc, el){
    var ref = ensureRef(el);
    var childEls = Array.prototype.filter.call(el.children, function(c){ return !isStudioInternal(c) && c.tagName !== "STYLE"; });
    var container = document.createElement("div");
    var row = document.createElement("div");
    row.className = "ds-layer-row" + (ref === elState.selectedRef ? " is-selected" : "") + ((elOverrides[ref] && elOverrides[ref].hidden) ? " is-hidden-el" : "");
    row.setAttribute("data-ref", ref);
    row.innerHTML = '<span class="twirl">' + (childEls.length ? "▾" : "") + '</span><span class="tagname">' + el.tagName.toLowerCase() + '</span><span class="lbl">' + escapeHtml(layerLabel(el)) + '</span>';
    row.addEventListener("click", function(ev){ ev.stopPropagation(); selectElement(el); });
    container.appendChild(row);
    if(childEls.length){
      var kids = document.createElement("div");
      kids.className = "ds-layer-children";
      childEls.forEach(function(c){ kids.appendChild(buildLayerNode(doc, c)); });
      container.appendChild(kids);
    }
    return container;
  }
  function refreshLayersTree(){
    var doc = dsFrame && dsFrame.contentDocument;
    var wrap = document.getElementById("dsLayersTree");
    if(!doc || !wrap) return;
    wrap.innerHTML = "";
    currentScreenRootEls(doc).forEach(function(root){ wrap.appendChild(buildLayerNode(doc, root)); });
    applyLayersFilter();
  }
  function refreshLayersSelection(){
    document.querySelectorAll("#dsLayersTree .ds-layer-row").forEach(function(row){
      row.classList.toggle("is-selected", row.getAttribute("data-ref") === elState.selectedRef);
    });
  }
  function applyLayersFilter(){
    var input = document.getElementById("dsLayersSearch");
    var q = input ? input.value.toLowerCase() : "";
    document.querySelectorAll("#dsLayersTree .ds-layer-row").forEach(function(row){
      row.style.display = (!q || row.textContent.toLowerCase().indexOf(q) > -1) ? "" : "none";
    });
  }

  /* ----------------------------------------------- property panel      */
  function toColorInputValue(v){
    if(!v) return "#000000";
    if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v.length === 4 ? ("#" + v[1]+v[1]+v[2]+v[2]+v[3]+v[3]) : v;
    return cssColorToHex(v);
  }
  function liveValueFor(cs, key){
    return cs.getPropertyValue(cssPropName(key)) || cs[key] || "";
  }
  function renderFieldHtml(f, currentValue, isTouched){
    var id = "dsf-" + f.key;
    var cls = "ds-field" + (isTouched ? " ds-field-touched" : "");
    var label = '<label for="' + id + '">' + f.label + '</label>';
    var control;
    if(f.type === "color"){
      control = '<input type="color" id="' + id + '" value="' + toColorInputValue(currentValue) + '">';
    } else if(f.type === "select"){
      control = '<select id="' + id + '">' + f.options.map(function(o){
        return '<option value="' + o[0] + '"' + (String(currentValue).trim() === o[0] ? " selected" : "") + '>' + o[1] + '</option>';
      }).join("") + '</select>';
    } else if(f.type === "text"){
      control = '<input type="text" id="' + id + '" value="' + escapeHtml(currentValue == null ? "" : currentValue) + '">';
    } else {
      var num = parseFloat(currentValue);
      if(isNaN(num)) num = "";
      control = '<div class="ds-row"><input type="number" id="' + id + '" value="' + num + '"' + (f.step ? (' step="' + f.step + '"') : "") + '><span class="unit">' + (f.unit || "") + '</span></div>';
    }
    return '<div class="' + cls + '" data-field="' + f.key + '">' + label + control + '</div>';
  }
  function renderPropertyPanel(){
    var panel = document.getElementById("dsElProps");
    if(!panel) return;
    var ref = elState.selectedRef;
    if(!ref){
      panel.innerHTML = '<p class="ds-empty-note">Click anything on the canvas to select it — or pick a layer on the left. Double-click text to edit it in place.</p>';
      return;
    }
    var doc = dsFrame.contentDocument;
    var el = doc.querySelector(ref);
    if(!el){
      panel.innerHTML = '<p class="ds-empty-note">That element isn’t on screen right now (it may be inside a different modal). Pick a new one, or reopen its screen on the left.</p>';
      return;
    }
    var cs = doc.defaultView.getComputedStyle(el);
    var bucket = bucketForBreakpoint();
    var ov = (elOverrides[ref] && elOverrides[ref][bucket]) || {};
    var hidden = !!(elOverrides[ref] && elOverrides[ref].hidden);

    var html = '<div class="ds-sel-breadcrumb">&lt;' + escapeHtml(el.tagName.toLowerCase()) + (el.id ? ' id="' + escapeHtml(el.id) + '"' : '') + '&gt;</div>';
    html += '<div class="ds-bp-row" id="dsBpRow">' +
      ['both','mobile','desktop'].map(function(bp){
        var lbl = bp === "both" ? "Both" : bp === "mobile" ? "Mobile only" : "Desktop only";
        return '<button type="button" data-bp="' + bp + '" class="' + (elState.breakpoint === bp ? "is-active" : "") + '">' + lbl + '</button>';
      }).join("") + '</div>';

    html += '<div class="ds-prop-section"><h4>Content</h4>';
    var hasSimpleText = el.children.length === 0 && el.textContent.trim().length > 0;
    if(hasSimpleText){
      var textVal = (elOverrides[ref] && elOverrides[ref].text != null) ? elOverrides[ref].text : el.textContent;
      html += '<textarea class="ds-text-edit" id="dsPropText">' + escapeHtml(textVal) + '</textarea>';
    } else {
      html += '<p class="ds-empty-note" style="padding:0">Double-click this element on the canvas to edit its text in place.</p>';
    }
    html += '</div>';

    ELFIELD_SECTIONS.forEach(function(section){
      html += '<div class="ds-prop-section"><h4>' + section.title + '</h4><div class="ds-fields">';
      section.fields.forEach(function(f){
        var isTouched = Object.prototype.hasOwnProperty.call(ov, f.key);
        var current = isTouched ? ov[f.key] : liveValueFor(cs, f.key);
        html += renderFieldHtml(f, current, isTouched);
      });
      html += '</div></div>';
    });

    html += '<div class="ds-prop-section"><h4>Order, duplication &amp; visibility</h4><div class="ds-row-actions">' +
      '<button type="button" class="ds-btn" id="dsMoveUp">↑ Move up</button>' +
      '<button type="button" class="ds-btn" id="dsMoveDown">↓ Move down</button>' +
      '<button type="button" class="ds-btn" id="dsDuplicateBtn">⧉ Duplicate</button>' +
      '<button type="button" class="ds-btn' + (hidden ? " is-on" : "") + '" id="dsToggleHiddenBtn">' + (hidden ? "Hidden — show" : "Hide") + '</button>' +
      '<button type="button" class="ds-btn" id="dsResetElBtn">Reset this element</button>' +
      '</div></div>';

    panel.innerHTML = html;
    wirePropertyPanelEvents(ref, el);
  }
  function wirePropertyPanelEvents(ref, el){
    var panel = document.getElementById("dsElProps");
    panel.querySelectorAll("#dsBpRow button").forEach(function(b){
      b.addEventListener("click", function(){ elState.breakpoint = b.getAttribute("data-bp"); renderPropertyPanel(); });
    });
    var textArea = document.getElementById("dsPropText");
    if(textArea){
      textArea.addEventListener("blur", function(){
        var newVal = textArea.value;
        var origText = el.getAttribute("data-ds-orig-text");
        if(origText === null){ el.setAttribute("data-ds-orig-text", el.textContent); origText = el.textContent; }
        pushUndoSnapshot();
        if(!elOverrides[ref]) elOverrides[ref] = newOverrideEntry();
        elOverrides[ref].text = (newVal === origText) ? null : newVal;
        el.textContent = newVal;
        scheduleElSave();
        refreshLayersTree();
      });
    }
    ELFIELD_SECTIONS.forEach(function(section){
      section.fields.forEach(function(f){
        var input = document.getElementById("dsf-" + f.key);
        if(!input) return;
        input.addEventListener("input", function(){
          var raw = input.value;
          var value = (f.type === "number") ? (raw === "" ? null : raw + (f.unit || "")) : raw;
          pushUndoSnapshot();
          setElOverrideValue(ref, f.key, value);
          var box = input.closest(".ds-field");
          if(box) box.classList.toggle("ds-field-touched", value !== null);
        });
      });
    });
    var up = document.getElementById("dsMoveUp"); if(up) up.addEventListener("click", function(){ moveSelected(-1); });
    var down = document.getElementById("dsMoveDown"); if(down) down.addEventListener("click", function(){ moveSelected(1); });
    var dup = document.getElementById("dsDuplicateBtn"); if(dup) dup.addEventListener("click", duplicateSelected);
    var hide = document.getElementById("dsToggleHiddenBtn"); if(hide) hide.addEventListener("click", toggleHidden);
    var resetBtn = document.getElementById("dsResetElBtn"); if(resetBtn) resetBtn.addEventListener("click", resetElement);
  }

  /* ------------------------------------------------------- mutation obs */
  function setupMutationObserver(doc){
    if(mo) mo.disconnect();
    var pending = false;
    mo = new MutationObserver(function(){
      if(pending) return;
      pending = true;
      window.setTimeout(function(){
        pending = false;
        mo.disconnect();
        tagTreeFull(doc);
        regenerateOverrideStyle(doc);
        reapplyTextAndHidden(doc);
        refreshLayersTree();
        mo.observe(doc.body, { childList:true, subtree:true });
      }, 150);
    });
    mo.observe(doc.body, { childList:true, subtree:true });
  }

  /* ---------------------------------------------------------- export   */
  function friendlyPropLabel(key){
    var f = EL_FIELD_INDEX[key];
    return f ? f.label : key;
  }
  function describeStyleBucket(obj){
    return Object.keys(obj || {}).map(function(k){ return friendlyPropLabel(k) + ": " + obj[k]; }).join(", ");
  }
  function buildElementsCss(){
    var lines = [];
    Object.keys(elOverrides).forEach(function(ref){
      var o = elOverrides[ref];
      var g = styleObjToCss(o.style);
      if(g) lines.push(ref + " {\n  " + g.replace(/;/g, ";\n  ").trim() + "\n}");
      if(o.hidden) lines.push(ref + " {\n  display: none;\n}");
    });
    var mobile = [], desktop = [];
    Object.keys(elOverrides).forEach(function(ref){
      var o = elOverrides[ref];
      var m = styleObjToCss(o.mobileStyle);
      if(m) mobile.push(ref + " {\n  " + m.replace(/;/g, ";\n  ").trim() + "\n}");
      var d = styleObjToCss(o.desktopStyle);
      if(d) desktop.push(ref + " {\n  " + d.replace(/;/g, ";\n  ").trim() + "\n}");
    });
    if(mobile.length) lines.push("@media (max-width: 859px) {\n" + mobile.join("\n") + "\n}");
    if(desktop.length) lines.push("@media (min-width: 860px) {\n" + desktop.join("\n") + "\n}");
    return lines.join("\n\n");
  }
  function buildFullCssExport(){
    var parts = [];
    parts.push("/* Pairlum Design Studio — full export\n   Generated " + new Date().toISOString() + "\n   This file is a reference for applying these changes to the real source\n   files (styles.css / app.html) — it is not wired into the live site\n   automatically. Selectors matching a real id (#foo) are stable; ones\n   using [data-ds-id=\"...\"] are synthetic references this tool assigned\n   to elements that had no id — see pairlum-design-manifest.json for a\n   structural locator (nearest real id + child path) you can use to find\n   the same element in source. */");
    var btnCss = buildButtonCss();
    if(btnCss){ parts.push(":root{\n" + btnCss + "\n}"); }
    var elCss = buildElementsCss();
    if(elCss) parts.push(elCss);
    return parts.join("\n\n") + "\n";
  }
  function locatorFor(ref){
    // Best-effort structural description: real id direct, or
    // "<ancestor-id> > tag:nth-of-type(n) > tag:nth-of-type(n)..."
    if(ref.charAt(0) === "#") return { ancestorId: ref.slice(1), path: [] };
    var m = ref.match(/data-ds-id="([^"]+)"/);
    if(!m) return { ancestorId:null, path:[] };
    var dsid = m[1];
    var segs = dsid.split("-");
    // dsid format: "<parentKey>-<tag><idx>" chained; parentKey may itself
    // be a previous dsid segment or a real id. Walk the chain by
    // re-splitting is lossy for ids containing "-", so we also keep the
    // raw dsid string as a fallback locator.
    return { ancestorId:null, path:[], rawDsId:dsid };
  }
  function buildManifest(){
    var elements = Object.keys(elOverrides).map(function(ref){
      var o = elOverrides[ref];
      return {
        ref: ref,
        locator: locatorFor(ref),
        screen: o.screenId || null,
        style: o.style, mobileStyle: o.mobileStyle, desktopStyle: o.desktopStyle,
        text: o.text, hidden: o.hidden
      };
    });
    var buttons = {};
    KINDS.forEach(function(k){
      var f = {};
      Object.keys(touched[k.id]).forEach(function(field){ f[field] = formatValue(field, values[k.id][field]); });
      if(Object.keys(f).length) buttons[k.id] = f;
    });
    return {
      generatedAt: new Date().toISOString(),
      project: "Pairlum — Your day together (standalone prototype)",
      screens: SCREENS.map(function(s){ return { id:s.id, label:s.label, group:s.group }; }),
      buttonOverrides: buttons,
      elements: elements
    };
  }
  function buildSummaryMd(manifest){
    var lines = ["# Pairlum design changes", "", "Generated " + manifest.generatedAt + " from the Dashboard Design Studio.", ""];
    if(Object.keys(manifest.buttonOverrides).length){
      lines.push("## Buttons");
      Object.keys(manifest.buttonOverrides).forEach(function(kind){
        var f = manifest.buttonOverrides[kind];
        lines.push("- **" + kind + "**: " + Object.keys(f).map(function(k){ return friendlyPropLabel(k) + " → " + f[k]; }).join(", "));
      });
      lines.push("");
    }
    var byScreen = {};
    manifest.elements.forEach(function(e){
      var s = e.screen || "unknown";
      (byScreen[s] = byScreen[s] || []).push(e);
    });
    Object.keys(byScreen).forEach(function(screenId){
      var screen = SCREENS.filter(function(s){ return s.id === screenId; })[0];
      lines.push("## " + (screen ? screen.label : screenId));
      byScreen[screenId].forEach(function(e){
        var bits = [];
        if(e.text != null) bits.push('text changed to "' + e.text + '"');
        if(e.hidden) bits.push("hidden");
        var g = describeStyleBucket(e.style); if(g) bits.push(g);
        var m = describeStyleBucket(e.mobileStyle); if(m) bits.push("mobile only — " + m);
        var d = describeStyleBucket(e.desktopStyle); if(d) bits.push("desktop only — " + d);
        lines.push("- `" + e.ref + "` — " + (bits.join("; ") || "no visible change recorded"));
      });
      lines.push("");
    });
    lines.push("## Not included in this export");
    lines.push("- Drag-and-drop reordering (use the Move up/down buttons instead — those ARE captured above only as a live DOM change, not as a manifest entry; re-apply reordering by hand in source).");
    lines.push("- Image/media replacement (not built in this pass).");
    lines.push("- Animation timing/easing and reduced-motion overrides (not built in this pass).");
    lines.push("");
    return lines.join("\n");
  }

  /* --------------------------------------------------- zip (store-only) */
  var CRC_TABLE = (function(){
    var t = new Uint32Array(256);
    for(var n=0;n<256;n++){
      var c=n;
      for(var k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      t[n]=c;
    }
    return t;
  })();
  function crc32(bytes){
    var crc = 0xFFFFFFFF;
    for(var i=0;i<bytes.length;i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function strToBytes(str){ return new TextEncoder().encode(str); }
  function dosDateTime(d){
    d = d || new Date();
    var time = ((d.getHours()&31)<<11) | ((d.getMinutes()&63)<<5) | ((Math.floor(d.getSeconds()/2))&31);
    var date = (((d.getFullYear()-1980)&127)<<9) | (((d.getMonth()+1)&15)<<5) | (d.getDate()&31);
    return { time:time, date:date };
  }
  function buildZip(files){
    var dt = dosDateTime();
    var localParts = [], centralParts = [], offset = 0;
    files.forEach(function(f){
      var nameBytes = strToBytes(f.name);
      var data = typeof f.data === "string" ? strToBytes(f.data) : f.data;
      var crc = crc32(data), size = data.length;
      var lh = new Uint8Array(30 + nameBytes.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true); dv.setUint16(10, dt.time, true); dv.setUint16(12, dt.date, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, size, true); dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true); dv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);
      localParts.push(lh, data);
      var ch = new Uint8Array(46 + nameBytes.length);
      var cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true); cdv.setUint16(10, 0, true); cdv.setUint16(12, dt.time, true); cdv.setUint16(14, dt.date, true);
      cdv.setUint32(16, crc, true); cdv.setUint32(20, size, true); cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true); cdv.setUint16(30,0,true); cdv.setUint16(32,0,true);
      cdv.setUint16(34,0,true); cdv.setUint16(36,0,true); cdv.setUint32(38,0,true);
      cdv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);
      centralParts.push(ch);
      offset += lh.length + data.length;
    });
    var centralStart = offset;
    var centralSize = centralParts.reduce(function(s,p){ return s+p.length; }, 0);
    var end = new Uint8Array(22);
    var edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, files.length, true); edv.setUint16(10, files.length, true);
    edv.setUint32(12, centralSize, true); edv.setUint32(16, centralStart, true);
    var allParts = localParts.concat(centralParts, [end]);
    return new Blob(allParts, { type:"application/zip" });
  }
  function exportForClaude(){
    var manifest = buildManifest();
    var hasAny = manifest.elements.length || Object.keys(manifest.buttonOverrides).length;
    if(!hasAny){ setStatus("No changes yet to export."); return; }
    var files = [
      { name:"pairlum-design-export.css", data: buildFullCssExport() },
      { name:"pairlum-design-manifest.json", data: JSON.stringify(manifest, null, 2) },
      { name:"SUMMARY.md", data: buildSummaryMd(manifest) }
    ];
    var blob = buildZip(files);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "pairlum-design-export.zip";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    setStatus("Exported pairlum-design-export.zip — hand this to Claude to apply the changes to source.");
  }

  /* --------------------------------------------------------- frame load */
  function onFrameLoad(){
    dashboardFrame = dsFrame;
    applyAllTouched();
    var doc = dsFrame.contentDocument;
    ensureHighlightBox(doc);
    tagTreeFull(doc);
    regenerateOverrideStyle(doc);
    reapplyTextAndHidden(doc);
    setupCanvasInteractions(doc);
    setupMutationObserver(doc);
    elState.currentScreenId = "home";
    refreshLayersTree();
    highlightActiveScreenButton();
    var hasElChanges = Object.keys(elOverrides).length > 0;
    var hasBtnChanges = Object.keys(touched.primary).length || Object.keys(touched.secondary).length || Object.keys(touched.text).length || Object.keys(touched.icon).length;
    setStatus((hasElChanges || hasBtnChanges) ? "Restored your locally saved edits." : "Editing live — changes preview only until exported.");
  }

  /* ---------------------------------------------------------------- UI  */
  var root, activeTab = "elements";

  function build(){
    root = document.createElement("div");
    root.id = "dsRoot";
    root.innerHTML =
      '<div class="ds-toolbar">' +
        '<span class="ds-toolbar-title">Pairlum <b>Design Studio</b></span>' +
        '<span class="ds-tag">dev only · ?design=1</span>' +
        '<div class="ds-tabs" id="dsTabs">' +
          '<button type="button" data-tab="elements" class="is-active">Elements</button>' +
          '<button type="button" data-tab="buttons">Buttons</button>' +
        '</div>' +
        '<span class="ds-spacer"></span>' +
        '<div class="ds-seg" id="dsPreviewSeg">' +
          '<button type="button" data-preview="mobile" class="is-active">Mobile</button>' +
          '<button type="button" data-preview="desktop">Desktop</button>' +
        '</div>' +
        '<div class="ds-zoom-row"><span class="unit">Zoom</span><input type="range" id="dsZoom" min="0.5" max="1.5" step="0.05" value="1"><span class="ds-zoom-val" id="dsZoomVal">100%</span></div>' +
        '<button type="button" class="ds-btn" id="dsUndoBtn">Undo</button>' +
        '<button type="button" class="ds-btn" id="dsRedoBtn">Redo</button>' +
        '<button type="button" class="ds-btn" id="dsResetBtn">Reset</button>' +
        '<button type="button" class="ds-btn ds-btn-primary" id="dsExportClaudeBtn">Export for Claude</button>' +
        '<span class="ds-status" id="dsStatus">Editing live — changes preview only until exported.</span>' +
      '</div>' +
      '<div class="ds-body">' +
        '<div class="ds-left" id="dsLeft">' +
          '<div>' +
            '<h3>Screens</h3><div class="ds-screen-group" id="dsScreenGroupScreens"></div>' +
          '</div>' +
          '<div>' +
            '<h3>Modals &amp; states</h3><div class="ds-screen-group" id="dsScreenGroupModals"></div>' +
          '</div>' +
          '<div>' +
            '<h3>Chrome</h3><div class="ds-screen-group" id="dsScreenGroupChrome"></div>' +
          '</div>' +
          '<div>' +
            '<h3>Layers</h3>' +
            '<input type="text" class="ds-layers-search" id="dsLayersSearch" placeholder="Search this screen’s layers…">' +
            '<div class="ds-layers-tree" id="dsLayersTree"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ds-frame-col">' +
          '<div class="ds-frame-shell" id="dsFrameShell"><iframe id="dsFrame" title="Live dashboard preview"></iframe></div>' +
          '<p class="ds-frame-caption">This is the real dashboard (app.html), loaded live — not a mockup. Click to select, double-click text to edit, drag not yet supported (use Move up/down).</p>' +
        '</div>' +
        '<div class="ds-panel">' +
          '<div id="dsElementsPanel">' +
            '<h2>Elements</h2>' +
            '<p class="ds-lede">Select anything on the canvas or in the Layers list to edit its colors, typography, spacing, borders, size, order, and visibility — live, on the real dashboard.</p>' +
            '<div id="dsElProps"><p class="ds-empty-note">Click anything on the canvas to select it.</p></div>' +
          '</div>' +
          '<div id="dsButtonsPanel" hidden>' +
            '<h2>Button Preview</h2>' +
            '<p class="ds-lede">Primary, secondary, text and icon buttons, reusing the dashboard’s own classes. Adjust a property and watch the states below and the live dashboard update together.</p>' +
            '<div id="dsKinds"></div>' +
            '<div class="ds-footer-note" id="dsFooterNote"></div>' +
            '<textarea class="ds-export-box" id="dsExportBox" readonly placeholder="Export CSS to see the overrides here." hidden></textarea>' +
            '<button type="button" class="ds-btn" id="dsExportButtonCssBtn" style="margin-top:10px">Export Buttons CSS</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    dsFrame = root.querySelector("#dsFrame");

    buildScreenNav();

    KINDS.forEach(function(k, i){
      var card = document.createElement("div");
      card.className = "ds-kind" + (i === 0 ? " is-open" : "");
      card.id = "dsKind-" + k.id;
      card.innerHTML =
        '<button type="button" class="ds-kind-head" data-kind="' + k.id + '">' +
          '<span class="name">' + k.name + '</span><span class="chev">›</span>' +
        '</button>' +
        '<div class="ds-kind-body">' +
          '<div class="ds-states" id="dsStates-' + k.id + '"></div>' +
          '<div class="ds-fields" id="dsFields-' + k.id + '"></div>' +
        '</div>';
      document.getElementById("dsKinds").appendChild(card);
      card.querySelector(".ds-kind-head").addEventListener("click", function(){ card.classList.toggle("is-open"); });
      renderFields(k.id);
      renderStates(k.id);
    });

    document.getElementById("dsFooterNote").textContent =
      "Local saving keeps your in-progress edits in this browser only — reopening Design Studio restores them, but the live site (outside design mode) is unaffected. Export CSS/Export for Claude are the steps that produce something applied to the real source files.";

    wireToolbar();
    frameEl_onLoadAndSrc();
  }

  function buildScreenNav(){
    var groups = { Screens:"dsScreenGroupScreens", Modals:"dsScreenGroupModals", Chrome:"dsScreenGroupChrome" };
    SCREENS.forEach(function(s){
      var host = document.getElementById(groups[s.group]);
      if(!host) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "ds-screen-btn"; b.setAttribute("data-screen", s.id);
      b.innerHTML = escapeHtml(s.label) + (s.overlay ? '<span class="tag">modal</span>' : "");
      b.addEventListener("click", function(){ goToScreen(s); });
      host.appendChild(b);
    });
    highlightActiveScreenButton();
    document.getElementById("dsLayersSearch").addEventListener("input", applyLayersFilter);
  }

  function wireToolbar(){
    document.querySelectorAll("#dsTabs button").forEach(function(b){
      b.addEventListener("click", function(){
        activeTab = b.getAttribute("data-tab");
        document.querySelectorAll("#dsTabs button").forEach(function(x){ x.classList.toggle("is-active", x === b); });
        document.getElementById("dsLeft").style.display = activeTab === "elements" ? "" : "none";
        document.getElementById("dsElementsPanel").hidden = activeTab !== "elements";
        document.getElementById("dsButtonsPanel").hidden = activeTab !== "buttons";
      });
    });
    root.querySelectorAll("#dsPreviewSeg button").forEach(function(btn){
      btn.addEventListener("click", function(){
        root.querySelectorAll("#dsPreviewSeg button").forEach(function(b){ b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        document.getElementById("dsFrameShell").classList.toggle("is-desktop", btn.getAttribute("data-preview") === "desktop");
      });
    });
    var zoom = document.getElementById("dsZoom");
    zoom.addEventListener("input", function(){
      var v = Number(zoom.value);
      document.getElementById("dsFrameShell").style.transform = "scale(" + v + ")";
      document.getElementById("dsFrameShell").style.transformOrigin = "top center";
      document.getElementById("dsZoomVal").textContent = Math.round(v * 100) + "%";
    });
    document.getElementById("dsUndoBtn").addEventListener("click", function(){ activeTab === "elements" ? elUndo() : undoButtons(); });
    document.getElementById("dsRedoBtn").addEventListener("click", function(){
      if(activeTab === "elements") elRedo();
      else setStatus("Redo isn't available for button edits yet — Undo is.");
    });
    document.getElementById("dsResetBtn").addEventListener("click", function(){ activeTab === "elements" ? resetElements() : resetButtons(); });
    document.getElementById("dsExportClaudeBtn").addEventListener("click", exportForClaude);
    document.getElementById("dsExportButtonCssBtn").addEventListener("click", exportButtonCss);
  }

  function frameEl_onLoadAndSrc(){
    dsFrame.addEventListener("load", onFrameLoad);
    dsFrame.src = "app.html";
  }

  /* ---------------------------------------------------------------- init */
  function init(){
    loadSaved();
    loadElSaved();
    build();
  }

  if(document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
