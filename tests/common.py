"""Shared helpers for the Pairlum browser tests.
These tests drive the real app in headless Chromium (Playwright). They are
browser tests on one computer: they are NOT tests on a phone, with a real
microphone, a screen reader, or two separate devices."""
import sys, os, threading, http.server, functools, json, hashlib, zipfile, io

RESULTS = []
def serve(site):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    handler = functools.partial(Quiet, directory=site)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
    return "http://127.0.0.1:%d/index.html" % srv.server_address[1]

def check(case, name, cond, detail=""):
    RESULTS.append((case, name, bool(cond)))
    print(("PASS  " if cond else "FAIL  ") + "[" + case + "] " + name + (("  | " + str(detail)[:260]) if (detail != "" and not cond) else ""), flush=True)

def finish(label):
    bad = [r for r in RESULTS if not r[2]]
    print("\n%s: %d passed, %d failed" % (label, len(RESULTS) - len(bad), len(bad)))
    out = os.environ.get("PAIRLUM_RESULTS")
    if out:
        with open(out, "a") as f:
            for c, n, ok in RESULTS: f.write(json.dumps({"file": label, "case": c, "name": n, "pass": ok}) + "\n")
    sys.exit(1 if bad else 0)

# Tracks every microphone track the page is ever given, so "is the mic off?" is counted, not assumed.
MIC = """(() => { window.__tracks = []; if(!navigator.mediaDevices) return;
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => (window.__gumDelay ? new Promise(r => setTimeout(r, window.__gumDelay)) : Promise.resolve())
    .then(() => real(c)).then(s => { s.getTracks().forEach(t => window.__tracks.push(t)); return s; }); })();"""
LIVE = "window.__tracks.filter(t => t.readyState === 'live').length"
# Makes chosen localStorage writes fail, the way a full device does.
FAILSTORE = """(() => { const real = Storage.prototype.setItem; window.__failKeys = [];
  Storage.prototype.setItem = function(k, v){ if(this === window.localStorage && window.__failKeys.some(x => String(k).indexOf(x) > -1)) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); }; })();"""
SHARED = "pairlum-shared-space-v1"
SH = "JSON.parse(localStorage.getItem('pairlum-shared-space-v1'))"

IDB = """
// edit the stored record directly, the way a previous session would have left it
window.__db = (fn) => { const d = JSON.parse(localStorage.getItem('pairlum-shared-space-v1'));
  ['moments','notes','letters','someday','requests','dates','memories','plans'].forEach(k => { if(!Array.isArray(d[k])) d[k] = []; });
  ['feel','hearts','dq','ambient','prefs','sleep','facts','days','hold','profiles','dna','comfort','dqPick'].forEach(k => { if(!d[k] || typeof d[k] !== 'object') d[k] = {}; });
  fn(d); localStorage.setItem('pairlum-shared-space-v1', JSON.stringify(d)); };
window.__idb = {
  open: () => new Promise((res, rej) => { const r = indexedDB.open('pairlum-media-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('media'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
  keys: async () => { const db = await window.__idb.open(); return new Promise(res => { const q = db.transaction('media').objectStore('media').getAllKeys(); q.onsuccess = () => res(q.result.map(String).sort()); }); },
  put: async (key, text, type) => { const db = await window.__idb.open(); return new Promise(res => { const tx = db.transaction('media', 'readwrite'); tx.objectStore('media').put(new Blob([text], { type: type || 'image/jpeg' }), key); tx.oncomplete = () => res(true); }); },
  text: async (key) => { const db = await window.__idb.open(); return new Promise(res => { const q = db.transaction('media').objectStore('media').get(key); q.onsuccess = () => q.result ? q.result.text().then(res) : res(null); }); },
  sha: async (key) => { const db = await window.__idb.open(); const blob = await new Promise(res => { const q = db.transaction('media').objectStore('media').get(key); q.onsuccess = () => res(q.result || null); }); if(!blob) return null; const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); },
  // the key the app would read for an id: newest restored set first, then the plain id
  find: async (id) => { const ks = await window.__idb.keys(); const gens = (JSON.parse(localStorage.getItem('pairlum-shared-space-v1') || '{}').mediaGens) || []; for(const g of gens){ if(ks.includes(g + ':' + id)) return g + ':' + id; } return ks.includes(id) ? id : null; }
};"""

def new_context(pw_browser, **kw):
    ctx = pw_browser.new_context(viewport={"width": 390, "height": 844}, permissions=["microphone"], accept_downloads=True, **kw)
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort()); ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
    ctx.add_init_script(MIC); ctx.add_init_script(FAILSTORE); ctx.add_init_script(IDB)
    return ctx

def open_page(ctx, url, errs=None, wait=1300):
    pg = ctx.new_page()
    if errs is not None: pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(wait)
    return pg

def launch(p):
    return p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--disable-features=WebRtcHideLocalIpsWithMdns"])

def toast(pg): return pg.evaluate("(document.getElementById('toast') || {}).textContent || ''")
def js_click(pg, sel): return pg.evaluate("s => { const e = document.querySelector(s); if(!e) return false; e.click(); return true; }", sel)
def shared(pg): return pg.evaluate("localStorage.getItem('pairlum-shared-space-v1')")
def sha(b): return hashlib.sha256(b).hexdigest()
def make_zip(entries):
    """entries: list of (name, bytes) -> stored (uncompressed) zip bytes, like the app writes."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for n, b in entries: z.writestr(zipfile.ZipInfo(n), b)
    return buf.getvalue()
