"""Overlap audit for the Pairlum prototype.
Usage: python3 audit.py <site_dir> <out_dir> [--shots]
Opens every view / tab / overlay at several widths and reports
text/icon boxes that intersect, text clipped by its box, and
anything wider than the screen."""
import sys, os, json, threading, http.server, functools, base64
from playwright.sync_api import sync_playwright

SITE, OUT = sys.argv[1], sys.argv[2]
SHOTS = "--shots" in sys.argv
os.makedirs(OUT, exist_ok=True)
FD = os.environ.get("PAIRLUM_FONTS", "/home/claude/tools/node_modules/@fontsource")  # folder holding @fontsource/bodoni-moda and ibm-plex-mono

def face(fam, path, w, st):
    if not os.path.exists(path): return ""   # without the font files the page falls back to system fonts; measurements then differ slightly
    b = base64.b64encode(open(path, "rb").read()).decode()
    return "@font-face{font-family:'%s';font-weight:%s;font-style:%s;src:url(data:font/woff2;base64,%s) format('woff2')}" % (fam, w, st, b)

FONT_CSS = "".join([
    face("Bodoni Moda", FD + "/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2", "400 500", "normal"),
    face("Bodoni Moda", FD + "/bodoni-moda/files/bodoni-moda-latin-400-italic.woff2", "400 500", "italic"),
    face("IBM Plex Mono", FD + "/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", "500", "normal"),
])

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/index.html%s" % (srv.server_address[1], os.environ.get("QS", ""))

CHECK = r"""
() => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const out = { overlaps: [], clipped: [], offscreen: [], spill: [], cut: [], hscroll: document.documentElement.scrollWidth > vw + 1 };
  const openOv = document.querySelector('[data-audit-root], .bookv.is-open, .overlay.is-open');
  const root = openOv || document.body;
  function visible(el){
    if(!el.checkVisibility || !el.checkVisibility({checkOpacity:true, checkVisibilityCSS:true})) return false;
    for(let n = el; n && n !== document.documentElement; n = n.parentElement){
      const cs = getComputedStyle(n);
      if(parseFloat(cs.opacity) < 0.05) return false;
      if(n.getAttribute('aria-hidden') === 'true' && n.classList.contains('petals')) return false;
    }
    return true;
  }
  function clipRect(el, r, self){
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for(let n = (self ? el : el.parentElement); n && n !== document.documentElement; n = n.parentElement){
      const cs = getComputedStyle(n);
      if(/(hidden|auto|scroll|clip)/.test(cs.overflowX + cs.overflowY)){
        const b = n.getBoundingClientRect();
        if(/(hidden|auto|scroll|clip)/.test(cs.overflowX)){ x1 = Math.max(x1, b.left); x2 = Math.min(x2, b.right); }
        if(/(hidden|auto|scroll|clip)/.test(cs.overflowY)){ y1 = Math.max(y1, b.top); y2 = Math.min(y2, b.bottom); }
      }
    }
    return { left:x1, top:y1, right:x2, bottom:y2, w:x2-x1, h:y2-y1, cutX: (x2 < r.right - 2.5 || x1 > r.left + 2.5) && x2 > x1, raw: r };
  }
  function fixedAnc(el){
    for(let n = el; n && n !== document.body; n = n.parentElement){
      const p = getComputedStyle(n).position;
      if(p === 'fixed' || p === 'sticky') return n;
    }
    return null;
  }
  function label(el){
    let s = el.tagName.toLowerCase();
    if(el.id) s += '#' + el.id;
    const c = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0,3).join('.');
    if(c) s += '.' + c;
    return s;
  }
  function path(el){
    const p = []; let n = el;
    for(let i = 0; i < 3 && n && n !== document.body; i++, n = n.parentElement) p.unshift(label(n));
    return p.join(' > ');
  }
  const items = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for(let el = walker.currentNode; el; el = walker.nextNode()){
    if(el.closest('[data-audit-skip]')) continue;
    if(!openOv && document.body.classList.contains('swipe-mode') && el.closest('.view:not(.is-active)')) continue;
    const tag = el.tagName;
    if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION') continue;
    let rects = [], kind = null, text = '';
    if(tag === 'svg' || tag === 'IMG' || tag === 'CANVAS' && false){
      if(el.closest('svg') !== el && tag === 'svg') continue;
      const r = el.getBoundingClientRect();
      if(r.width > 90 || r.height > 90) continue;           // big art, not an icon
      rects = [r]; kind = 'icon';
    } else if(el.closest('svg')){
      continue;
    } else {
      for(const node of el.childNodes){
        if(node.nodeType === 3 && node.textContent.trim()){
          const rg = document.createRange(); rg.selectNodeContents(node);
          for(const r of rg.getClientRects()) if(r.width > 1 && r.height > 1){ const k = r.height * 0.16; rects.push({left:r.left, right:r.right, top:r.top + k, bottom:r.bottom - k, width:r.width, height:r.height - 2*k}); }
          text += node.textContent.trim() + ' ';
        }
      }
      if(rects.length) kind = 'text';
      else if(!el.children.length && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'){
        const r = el.getBoundingClientRect(), c0 = getComputedStyle(el);
        const painted = (c0.backgroundColor !== 'rgba(0, 0, 0, 0)' || c0.backgroundImage !== 'none' || parseFloat(c0.borderTopWidth) > 0);
        if(painted && r.width >= 5 && r.height >= 5 && r.width <= 44 && r.height <= 44 && c0.position !== 'fixed' && !el.matches('[class*=petal],[class*=star],[class*=spark],[class*=glow]')){ rects = [r]; kind = 'dot'; }
      }
      else if((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && el.type !== 'hidden'){ rects = [el.getBoundingClientRect()]; kind = 'field'; text = el.placeholder || ''; }
    }
    if(!kind || !visible(el)) continue;
    { const face = el.closest('.dq-face-back, .dq-face-front'); if(face){ const fl = face.closest('.dq-flip'); const flipped = fl && fl.classList.contains('is-flipped'); if(face.classList.contains('dq-face-back') !== !!flipped) continue; } }
    const cs = getComputedStyle(el);
    if(kind === 'text' && (cs.color === 'rgba(0, 0, 0, 0)' || cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)')) continue;
    const clipped = rects.map(r => clipRect(el, r, kind === 'text')).filter(r => r.w > 1 && r.h > 1);
    if(!clipped.length) continue;
    const it = { el, kind, text: text.trim().slice(0, 50), rects: clipped, fixed: fixedAnc(el) };
    items.push(it);
    // text sliced off sideways by a box that cannot scroll and shows no "…"
    if(kind === 'text' && clipped.some(r => r.cutX)){
      let ok = false, n = el;
      for(; n && n !== document.documentElement; n = n.parentElement){
        const c2 = getComputedStyle(n), b = n.getBoundingClientRect();
        if(!/(hidden|auto|scroll|clip)/.test(c2.overflowX)) continue;
        const cutsHere = clipped.some(r => r.raw.right > b.right + 2.5 || r.raw.left < b.left - 2.5);
        if(!cutsHere) continue;
        if(c2.overflowX === 'auto' || c2.overflowX === 'scroll' || c2.textOverflow === 'ellipsis' || n.matches('.view-track, #main, .bkv-face, .bkv-flip, [class*=marquee], [class*=ticker]')) ok = true;
        break;
      }
      if(!ok && n && n !== document.documentElement) out.cut.push(path(el) + ' :: "' + it.text + '" cut by ' + label(n));
    }
    // text spilling out of the card / box that holds it
    if(kind === 'text'){
      let n = el.parentElement;
      for(let d = 0; d < 5 && n && n !== document.body; d++, n = n.parentElement){
        const c1 = getComputedStyle(n);
        const boxy = parseFloat(c1.borderTopWidth) > 0 || c1.backgroundColor !== 'rgba(0, 0, 0, 0)' || c1.backgroundImage !== 'none';
        if(!boxy || c1.display === 'inline') continue;
        const b = n.getBoundingClientRect();
        if(b.width < 20) break;
        const sp = clipped.find(r => r.right > b.right + 3 || r.left < b.left - 3 || r.bottom > b.bottom + 6 || r.top < b.top - 6);
        if(sp && c1.position !== 'absolute'){ out.spill.push(path(el) + ' :: "' + it.text + '" leaves ' + label(n) + ' (' + Math.round(sp.left) + '..' + Math.round(sp.right) + ' vs ' + Math.round(b.left) + '..' + Math.round(b.right) + ')'); }
        break;
      }
      // squeezed into a sliver: 4+ lines of 1-2 words
      const lines = new Set(clipped.map(r => Math.round(r.top))).size;
      const maxw = Math.max.apply(null, clipped.map(r => r.w));
      if(lines >= 5 && maxw < 96 && it.text.length > 20) out.spill.push(path(el) + ' :: "' + it.text + '" squeezed to ' + Math.round(maxw) + 'px over ' + lines + ' lines');
    }
    // text cut off by its own box (no ellipsis)
    if(kind === 'text'){
      const ell = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if(!ell && /(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) out.clipped.push(path(el) + ' :: "' + it.text + '" (needs ' + el.scrollWidth + 'px, has ' + el.clientWidth + ')');
      if(!ell && /(hidden|clip)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0) out.clipped.push(path(el) + ' :: "' + it.text + '" (tall ' + el.scrollHeight + ' in ' + el.clientHeight + ')');
    }
    for(const r of clipped){
      if(r.right > vw + 2 || r.left < -2){
        // allowed inside a horizontal scroller
        let scroller = false;
        for(let n = el.parentElement; n && n !== document.body; n = n.parentElement){ const o = getComputedStyle(n).overflowX; if(o === 'auto' || o === 'scroll'){ scroller = true; break; } }
        if(!scroller){ out.offscreen.push(path(el) + ' :: "' + it.text + '" x ' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + vw); break; }
      }
    }
  }
  const seen = new Set();
  for(let i = 0; i < items.length; i++){
    const a = items[i];
    for(let j = i + 1; j < items.length; j++){
      const b = items[j];
      if(a.el.contains(b.el) && a.kind !== 'text') continue;
      if(b.el.contains(a.el) && b.kind !== 'text') continue;
      if(a.kind === 'field' && a.el.contains(b.el)) continue;
      if(a.fixed !== b.fixed) continue;                 // floating bars over scrolling content are expected
      let hit = null;
      for(const ra of a.rects){ for(const rb of b.rects){
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if(w > 2.5 && h > 2.5){ hit = [Math.round(w), Math.round(h), Math.round(Math.max(ra.left, rb.left)), Math.round(Math.max(ra.top, rb.top) + window.scrollY)]; break; }
      } if(hit) break; }
      if(!hit) continue;
      // same inline run (e.g. <b> inside a sentence) is not an overlap
      if(a.el.contains(b.el) || b.el.contains(a.el)){
        const inner = a.el.contains(b.el) ? b.el : a.el;
        const d = getComputedStyle(inner).display, p = getComputedStyle(inner).position;
        if(p !== 'absolute' && p !== 'fixed') continue;
      }
      const key = path(a.el) + '|' + path(b.el);
      if(seen.has(key)) continue; seen.add(key);
      out.overlaps.push('[' + hit[0] + 'x' + hit[1] + ' at ' + hit[2] + ',' + hit[3] + '] ' + path(a.el) + ' "' + a.text + '"  ×  ' + path(b.el) + ' "' + b.text + '"');
    }
  }
  return out;
}
"""

STRESS_JS = r"""
() => {
  const K = 'pairlum-shared-space-v1', db = JSON.parse(localStorage.getItem(K));
  const fill = (n, seed) => { const w = seed || 'Unforgettable midsummer evenings together'; let o = ''; while(o.length < n) o += w + ' '; return o.slice(0, n).trim(); };
  db.profiles = { u_aarav: { name: 'Maximilian-Alexander Jr.', city: 'Thiruvananthapuram, Kerala, India' }, u_mira: { name: 'Wilhelmina-Christabella', city: 'Llanfairpwllgwyngyll, Anglesey, Wales' } };
  db.chapters.forEach((c, i) => { c.title = fill(48, 'Extraordinarily long chapter name number ' + i); c.note = fill(200); });
  for(let i = 0; i < 9; i++) db.chapters.push({ id: 'chx' + i, title: fill(48, 'Another season of us'), note: fill(200), photo: 'sky', date: '2024-0' + (1 + (i % 3)) + '-1' + i });
  db.someday.forEach(x => x.text = fill(90));
  for(let i = 0; i < 4; i++) db.someday.push({ id: 'sx' + i, by: i % 2 ? 'u_mira' : 'u_aarav', text: fill(90, 'Supercalifragilisticexpialidocious'), done: i === 1 });
  db.notes.forEach(n => n.text = fill(120));
  db.dates = [0,1,2,3].map(i => ({ id: 'dx' + i, title: fill(60, 'The anniversary of the unforgettable day'), month: 10, day: 7 + i }));
  db.reunion = { date: '2026-11-10', place: fill(40, 'Schiphol international arrivals hall') };
  db.plans = [0,1,2].map(i => ({ id: 'px' + i, by: i % 2 ? 'u_mira' : 'u_aarav', title: fill(48, 'A very long video call plan title'), at: Date.now() + 86400000 * (i + 1) }));
  db.letters.forEach(l => { l.title = fill(60, 'For the extraordinarily long and difficult season'); l.state = l.state; });
  const f = { drink: fill(60), comfort: fill(60), flower: fill(60), sizes: fill(60), sad: fill(60), gift: fill(60) };
  db.facts = { u_aarav: f, u_mira: f };
  db.membership = { plan: 'book', since: '2026-03-12' };
  db.moments.forEach(m => { if(m.type === 'text') m.text = fill(220); else m.caption = fill(140); m.time = '10:12 AM · Thiruvananthapuram, Kerala, India'; });
  localStorage.setItem(K, JSON.stringify(db));
  const S = 'pairlum-space-settings-v1', st = JSON.parse(localStorage.getItem(S) || '{}');
  st.custom = Object.assign({ textSize:'md', density:'roomy', clock:'12', distance:'km', homeHidden:[], homeOrder:{today:[],more:[]} }, st.custom || {}, { nick: 'Wwwwwwwwwwwwwwwwww' });
  localStorage.setItem(S, JSON.stringify(st));
}
"""
VIEWPORTS = [(320, 640), (360, 780), (412, 915), (768, 1024), (1280, 800)]
if "--quick" in sys.argv: VIEWPORTS = [(360, 780), (1280, 800)]
MOODS = ["warm"]
report, total = {}, 0

def settle(page, ms=450):
    page.wait_for_timeout(ms)

def run_check(page, name, vp):
    global total
    page.evaluate("document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in'))")
    res = page.evaluate(CHECK)
    n = len(res["overlaps"]) + len(res["clipped"]) + len(res["offscreen"]) + len(res["spill"]) + len(res["cut"]) + (1 if res["hscroll"] else 0)
    total += n
    if n:
        report["%dx%d %s" % (vp[0], vp[1], name)] = res
        if SHOTS:
            page.screenshot(path=os.path.join(OUT, "%d_%s.png" % (vp[0], name.replace(" ", "_").replace("/", "-"))), full_page=False)
    return res

with sync_playwright() as p:
    br = p.chromium.launch()
    for vp in VIEWPORTS:
        ctx = br.new_context(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=1, has_touch=vp[0] < 800, is_mobile=vp[0] < 800, reduced_motion="reduce")
        ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=FONT_CSS))
        ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
        VAR = os.environ.get("VARIANT", "")
        if "lg" in VAR: ctx.add_init_script("try{var k='pairlum-space-settings-v1';var o=JSON.parse(localStorage.getItem(k)||'{}');o.custom=Object.assign({textSize:'lg',density:'roomy',clock:'12',distance:'km',nick:'',homeHidden:[],homeOrder:{today:[],more:[]}},o.custom||{},{textSize:'lg'});localStorage.setItem(k,JSON.stringify(o));}catch(e){}")
        if os.environ.get("MOOD"): ctx.add_init_script("try{localStorage.setItem('pairlum-mood-v1','%s')}catch(e){}" % os.environ["MOOD"])
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL); page.wait_for_load_state("load"); settle(page, 1200)
        # dismiss any first-run layers
        page.evaluate("document.fonts.ready")
        if os.environ.get("STRESS"):
            page.evaluate(STRESS_JS); page.reload(); page.wait_for_load_state("load"); settle(page, 1400)
        if "notips" in VAR:
            for _ in range(6):
                page.evaluate("document.querySelectorAll('[class*=tip] button, [class*=coach] button').forEach(b=>{ if(/close|dismiss|×|✕/i.test((b.getAttribute('aria-label')||'')+b.textContent)) b.click(); })"); settle(page, 250)
        views = page.evaluate("[...document.querySelectorAll('[data-view-panel]')].map(e=>e.dataset.viewPanel)")
        for v in views:
            page.evaluate("(v)=>{var b=document.querySelector('[data-view=\"'+v+'\"]'); if(b) b.click();}", v); settle(page, 700)
            page.evaluate("window.scrollTo(0,0)")
            run_check(page, "view-" + v, vp)
            if SHOTS: page.screenshot(path=os.path.join(OUT, "full_%d_%s.png" % (vp[0], v)), full_page=True)
            if v == "us":
                page.evaluate("document.getElementById('usTabSettings').click()"); settle(page)
                run_check(page, "view-us-settings", vp)
                if SHOTS: page.screenshot(path=os.path.join(OUT, "full_%d_us-settings.png" % vp[0]), full_page=True)
                page.evaluate("document.getElementById('usTabTogether').click()"); settle(page, 200)
        # every overlay, opened through the app's own action handlers where possible
        acts = page.evaluate("[...new Set([...document.querySelectorAll('[data-action]')].map(e=>e.dataset.action))]")
        for a in acts:
            page.evaluate("(a)=>{var b=document.querySelector('[data-action=\"'+a+'\"]'); if(b) b.click();}", a); settle(page, 600)
            op = page.evaluate("(document.querySelector('.overlay.is-open, .bookv.is-open')||{}).id||''")
            if op:
                run_check(page, "action-" + a, vp)
                if SHOTS: page.screenshot(path=os.path.join(OUT, "ov_%d_%s.png" % (vp[0], a)))
                page.keyboard.press("Escape"); settle(page, 350)
                page.evaluate("document.querySelectorAll('.overlay.is-open').forEach(o=>o.classList.remove('is-open')); document.body.style.overflow=''")
        ids = page.evaluate("[...document.querySelectorAll('.overlay')].map(e=>e.id)")
        for oid in ids:
            page.evaluate("(id)=>{document.getElementById(id).classList.add('is-open')}", oid); settle(page, 450)
            run_check(page, "overlay-" + oid, vp)
            if SHOTS: page.screenshot(path=os.path.join(OUT, "raw_%d_%s.png" % (vp[0], oid)))
            page.evaluate("(id)=>{document.getElementById(id).classList.remove('is-open')}", oid); settle(page, 150)
        if errs: report["%d js-errors" % vp[0]] = errs[:8]
        ctx.close()
    br.close()

json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
print("TOTAL findings:", total)
for k, v in report.items():
    if isinstance(v, list): print("\n##", k, v); continue
    print("\n##", k, "| hscroll" if v["hscroll"] else "")
    for kind in ("overlaps", "clipped", "offscreen", "spill", "cut"):
        for line in v[kind][:14]: print("  ", kind[:4], line[:330])
        if len(v[kind]) > 14: print("   ... +%d more %s" % (len(v[kind]) - 14, kind))
