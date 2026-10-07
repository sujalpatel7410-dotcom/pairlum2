import sys, os, re, json, threading, http.server, functools
from playwright.sync_api import sync_playwright
SITE, OUT = sys.argv[1], sys.argv[2]
STRESS = "--stress" in sys.argv
os.makedirs(OUT, exist_ok=True)
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit.py")).read()
CHECK = re.search(r'CHECK = r"""(.*?)"""', src, re.S).group(1)
import base64
ns = {"base64": base64, "os": os}
exec(src[src.index("FD ="):src.index("handler =")], ns)
FONT_CSS = ns["FONT_CSS"]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/index.html" % srv.server_address[1]

SHEET = """(args) => {
  const [pw, stress] = args;
  let d = window.PairlumBookBridge.data();
  if(stress){
    const L = 'Maximiliana-Alexandrina Featherstonehaugh';
    d.you.name = L; d.partner.name = 'Bartholomew Wolfeschlegelstein'; d.you.initial='M'; d.partner.initial='B';
    d.you.city = 'Thiruvananthapuram International'; d.partner.city = 'Llanfairpwllgwyngyll, Wales';
    d.distance = '12,345,678 km'; d.apart = '11 hours 30 min apart'; d.days = 1234567; d.totalMoments = 9876543;
    const long = 'Supercalifragilisticexpialidocious and a very long sentence that keeps going and going well past any reasonable length for a caption or a title, with no sign of stopping at all, ever, really. '.repeat(4);
    d.chapters = d.chapters.map(c => Object.assign({}, c, { title: long.slice(0, 80), note: long, meta: 'September 2022 – September 2024 and beyond' }));
    d.moments = d.moments.map(m => Object.assign({}, m, { caption: long, time: '10:12:45 AM · Thiruvananthapuram' }));
    d.notes = d.notes.map(n => ({ mine: n.mine, text: long }));
    d.letters = d.letters.map(l => l.locked ? Object.assign({}, l, { title: long.slice(0, 90), state: long.slice(0, 70) }) : Object.assign({}, l, { title: long.slice(0, 90), body: long + long, from: L }));
    d.questions = d.questions.map(q => ({ q: long, you: long, them: long }));
    d.facts.you = d.facts.you.map(f => ({ label: f.label, value: long })); d.facts.partner = d.facts.partner.map(f => ({ label: f.label, value: long }));
    d.dates = d.dates.concat(d.dates).map(x => ({ title: long.slice(0, 60), sub: long.slice(0, 50), when: 'September 30' }));
    d.someday = d.someday.concat(d.someday, d.someday).map(x => ({ text: long, done: x.done }));
    d.needs = d.needs.map(n => long.slice(0, 60));
    d.dna.line = long; d.dna.set = true;
    d.reunion = { big: '1,234', unit: 'months', label: 'September 30, 2099', place: long.slice(0, 60) };
  }
  if(args[2] === 'empty'){
    d.chapters = []; d.moments = []; d.notes = []; d.letters = []; d.memories = []; d.questions = []; d.someday = []; d.dates = []; d.reunion = null;
    d.facts = { you: d.facts.you.map(f=>({label:f.label,value:''})), partner: d.facts.partner.map(f=>({label:f.label,value:''})) };
  }
  if(args[2] === 'many'){
    const base = d.chapters[0] || { title:'Ch', meta:'2022', note:'n', photo:'sky', memories:[] };
    d.chapters = Array.from({length: 15}, (_, i) => Object.assign({}, base, { title: 'Chapter number ' + (i + 1) }));
  }
  const pages = window.PairlumBook.build(d);
  document.querySelectorAll('#bkSheet').forEach(n => n.remove());
  const s = document.createElement('div');
  s.id = 'bkSheet'; s.setAttribute('data-audit-root', '');
  s.style.cssText = 'position:absolute;left:0;top:0;z-index:9999;background:#777;display:grid;grid-template-columns:repeat(4,' + pw + 'px);gap:14px;padding:14px;width:max-content';
  s.innerHTML = pages.map(p => '<div style="position:relative;width:' + pw + 'px;height:' + Math.round(pw * 4 / 3) + 'px" data-n="' + p.n + '">' + p.html + '</div>').join('');
  document.body.appendChild(s);
  document.body.style.overflow = 'visible';
  // every piece of a page must sit inside the page, and clamped text must fit its box
  const probs = [];
  s.querySelectorAll('.bk-page').forEach(pg => {
    const pr = pg.getBoundingClientRect(), n = pg.getAttribute('data-bk-n');
    const inner = pg.querySelector('.bk-in');
    const padB = pr.bottom - parseFloat(getComputedStyle(inner).fontSize) * 1.0;
    pg.querySelectorAll('.bk-in *').forEach(el => {
      if(el.closest('svg') && el.tagName !== 'svg') return;
      const r = el.getBoundingClientRect();
      if(!r.width || !r.height) return;
      const bleed = el.matches('.bk-full,.bk-shade,.bk-top-ph,.bk-end-pattern,.bk-cover-frame') || el.closest('.bk-ph');
      if(!bleed && (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5)) probs.push('p' + n + ' OUTSIDE ' + el.className + ' ' + Math.round(r.right - pr.right) + ',' + Math.round(r.bottom - pr.bottom));
      const hasText = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
      if(hasText){
        const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
        if(r.height < fs * 1.02) probs.push('p' + n + ' SQUASHED ' + el.className + ' h=' + r.height.toFixed(1) + ' fs=' + fs.toFixed(1));
        const fo = pg.querySelector('.bk-folio');
        if(fo && !el.closest('.bk-folio')){ const fr = fo.getBoundingClientRect(); if(r.bottom > fr.top + 1 && r.top < fr.bottom) probs.push('p' + n + ' HITS FOLIO ' + el.className + ' by ' + Math.round(r.bottom - fr.top)); }
      }
    });
    // flow content must not run past the content box
    [...inner.children].forEach(ch => { const cs = getComputedStyle(ch); if(cs.position === 'absolute') return; const r = ch.getBoundingClientRect(); const fo = pg.querySelector('.bk-folio'); const lim = fo ? fo.getBoundingClientRect().top : pr.bottom; if(r.bottom > lim + 1) probs.push('p' + n + ' OVERRUN ' + ch.className + ' by ' + Math.round(r.bottom - lim)); });
  });
  return { count: pages.length, labels: pages.map(p => p.n + ':' + p.label + ' [' + p.section + ']' + (p.sample ? ' sample' : '')), probs };
}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1500, "height": 1000}, device_scale_factor=1, reduced_motion="reduce")
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=FONT_CSS))
    ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)
    page.goto(URL); page.wait_for_timeout(1500)
    variants = [("normal", False, ""), ("empty", False, "empty"), ("many", False, "many")]
    if STRESS: variants = [("stress", True, "")]
    for name, stress, mode in variants:
        for pw in ([330] if name != "normal" else [330, 150]):
            res = page.evaluate(SHEET, [pw, stress, mode]); page.wait_for_timeout(300)
            chk = page.evaluate(CHECK)
            print("\n== %s @%dpx: %d pages | geometry problems %d | overlaps %d clipped %d spill %d" % (name, pw, res["count"], len(res["probs"]), len(chk["overlaps"]), len(chk["clipped"]), len(chk["spill"])))
            for l in res["probs"][:40]: print("   ", l)
            for l in chk["overlaps"][:25]: print("    over", l[:260])
            for l in chk["clipped"][:10]: print("    clip", l[:200])
            for l in chk["spill"][:14]: print("    spill", l[:200])
            if name == "normal" and pw == 330:
                for l in res["labels"]: print("   ", l)
            if pw == 330:
                el = page.query_selector("#bkSheet"); bb = el.bounding_box()
                rowh = 440 + 14
                for k in range(4):
                    page.screenshot(path=os.path.join(OUT, "%s_%d.png" % (name, k + 1)), full_page=True, clip={"x": 0, "y": 7 + k * 3 * rowh, "width": bb["width"], "height": 3 * rowh if k < 3 else 2 * rowh + 7})
    print("errors:", errs[:6])
    br.close()
