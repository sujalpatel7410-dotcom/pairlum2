"""Phase 1 probes: demo isolation (keys, tab-to-tab events, media), failed writes, recorder cleanup."""
import sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
SITE = sys.argv[1]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE); handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
U = "http://127.0.0.1:%d/index.html" % srv.server_address[1]
ok_all = True
def check(name, cond, detail=""):
    global ok_all
    ok_all = ok_all and bool(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (("  | " + str(detail)) if detail != "" else ""))

MIC = """
(() => {
  window.__tracks = [];
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => (window.__gumDelay ? new Promise(r => setTimeout(r, window.__gumDelay)) : Promise.resolve()).then(() => real(c)).then(s => { s.getTracks().forEach(t => window.__tracks.push(t)); return s; });
})();
"""
LIVE = "window.__tracks.filter(t => t.readyState === 'live').length"

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, permissions=["microphone"])
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort()); ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
    errs = []
    def page_new(url):
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.add_init_script(MIC); pg.goto(url); pg.wait_for_timeout(1300); return pg

    # ---------- real space: something of our own, and a media file ----------
    real = page_new(U)
    real.evaluate("""() => new Promise(res => { const r = indexedDB.open('pairlum-media-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('media'); r.onsuccess = () => { const tx = r.result.transaction('media', 'readwrite'); tx.objectStore('media').put(new Blob(['real photo bytes']), 'REAL-MEDIA'); tx.oncomplete = () => res(true); }; })""")
    real_before = real.evaluate("localStorage.getItem('pairlum-shared-space-v1')")

    # ---------- demo: two partners, two tabs ----------
    a = page_new(U + "?demo=year")
    b = page_new(U + "?demo=year&as=mira")
    check("demo uses its own storage name", a.evaluate("window.PAIRLUM_STORAGE_NS") == "demoyear:")
    check("Storage.prototype is not patched", a.evaluate("Storage.prototype.getItem.toString().indexOf('native code') > -1"))
    n0 = b.evaluate("document.querySelectorAll('#notesRow .note-chip, #notesRow > *').length")
    a.evaluate("(()=>{var i=document.getElementById('noteInput'); i.value='PROBE note from Aarav'; i.form.requestSubmit();})()"); a.wait_for_timeout(900)
    stored = a.evaluate("JSON.parse(localStorage.getItem('demoyear:pairlum-shared-space-v1')).notes[0].text")
    seen_b = b.evaluate("document.body.innerText.indexOf('PROBE note from Aarav') > -1")
    check("note written in tab A is stored in the demo space", stored == "PROBE note from Aarav", stored)
    check("tab B (Mira) updates on its own from the demo event", seen_b)
    check("real space untouched by the demo note", real.evaluate("localStorage.getItem('pairlum-shared-space-v1')") == real_before)

    # demo media database is separate; deleting the demo account leaves real media alone
    dbs = a.evaluate("indexedDB.databases ? indexedDB.databases().then(l => l.map(d => d.name)) : []")
    a.evaluate("document.querySelector('[data-view=us]').click()"); a.wait_for_timeout(400)
    a.evaluate("document.getElementById('usTabSettings').click()"); a.wait_for_timeout(300)
    a.evaluate("document.querySelector('[data-action=open-privacy]').click()"); a.wait_for_timeout(500)
    opened = a.evaluate("(()=>{var b=[...document.querySelectorAll('#privacyBody button')].find(x=>/delete/i.test(x.textContent)); if(b){b.click(); return true} return false})()"); a.wait_for_timeout(400)
    if opened:
        a.fill("#deleteConfirmInput", "DELETE"); a.click("#deleteConfirmBtn"); a.wait_for_timeout(2200)
    still = real.evaluate("""() => new Promise(res => { const r = indexedDB.open('pairlum-media-v1', 1); r.onsuccess = () => { const q = r.result.transaction('media').objectStore('media').get('REAL-MEDIA'); q.onsuccess = () => res(!!q.result); }; })""")
    check("Delete Account inside the demo leaves the real space's media", opened and still, "delete flow opened=%s, databases=%s" % (opened, dbs))
    check("real shared record still untouched", real.evaluate("localStorage.getItem('pairlum-shared-space-v1')") == real_before)
    a.close(); b.close()

    # ---------- failed write: nothing is shown as saved ----------
    real.evaluate("""() => { const set = Storage.prototype.setItem; window.__failWrites = true; Storage.prototype.setItem = function(k, v){ if(window.__failWrites && String(k).indexOf('pairlum-shared-space') > -1) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; }""")
    real.evaluate("(()=>{var i=document.getElementById('noteInput'); i.value='SHOULD NOT STICK'; i.form.requestSubmit();})()"); real.wait_for_timeout(700)
    check("failed note: not in the stored record", "SHOULD NOT STICK" not in real.evaluate("localStorage.getItem('pairlum-shared-space-v1')"))
    check("failed note: not shown on screen", real.evaluate("document.getElementById('view-home').innerText.indexOf('SHOULD NOT STICK') === -1"))
    toast = real.evaluate("document.getElementById('toast').textContent")
    check("failed note: the person is told", "Couldn't save" in toast, toast)
    # a text moment while writes fail: never called shared, kept on screen, retry works once space is back
    real.evaluate("document.getElementById('fabAdd').click()"); real.wait_for_timeout(500)
    real.evaluate("document.querySelector('.capture-type[data-type=text]').click()"); real.wait_for_timeout(200)
    real.fill("#captureTextInput", "PROBE moment during a full disk"); real.click("#captureSubmit"); real.wait_for_timeout(2800)
    st = real.evaluate("(document.querySelector('#sharedDayGrid [data-moment-id] .moment-status-badge')||{getAttribute(){return 'none'}}).getAttribute('data-status')")
    check("moment during failed writes is not marked shared", st in ("failed", "unsaved"), st)
    check("…and is not in the stored record", "PROBE moment during a full disk" not in real.evaluate("localStorage.getItem('pairlum-shared-space-v1')"))
    real.evaluate("window.__failWrites = false"); real.wait_for_timeout(3400)
    real.evaluate("document.querySelector('#sharedDayGrid [data-retry-moment]').click()"); real.wait_for_timeout(2800)
    cnt = real.evaluate("JSON.parse(localStorage.getItem('pairlum-shared-space-v1')).moments.filter(m => m.caption === 'PROBE moment during a full disk').length")
    check("retry after space is back stores it exactly once", cnt == 1, cnt)
    real.evaluate("document.querySelector('#sharedDayGrid [data-moment-id]') && 0")

    # ---------- media write fails: 'Not saved yet', then retry ----------
    real.evaluate("""() => { window.__failMedia = true; const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(){ if(window.__failMedia) throw new DOMException('full', 'QuotaExceededError'); return put.apply(this, arguments); }; }""")
    real.evaluate("document.getElementById('fabAdd').click()"); real.wait_for_timeout(500)
    real.evaluate("document.querySelector('.capture-type[data-type=voice]').click()"); real.wait_for_timeout(200)
    real.click("#captureRecordBtn"); real.wait_for_timeout(1300); real.click("#captureRecordBtn"); real.wait_for_timeout(700)
    check("microphone released after a normal stop", real.evaluate(LIVE) == 0)
    real.click("#captureSubmit"); real.wait_for_timeout(1500)
    st = real.evaluate("document.querySelector('#sharedDayGrid .voice-moment[data-moment-id] .moment-status-badge, #sharedDayGrid [data-moment-id] .moment-status-badge').getAttribute('data-status')")
    check("voice whose bytes could not be stored says 'Not saved yet'", st == "unsaved", st)
    check("…and the unsent queue does not list it as saved", "mo_" not in (real.evaluate("localStorage.getItem('pairlum-offline-queue-v1')") or "[]") or real.evaluate("JSON.parse(localStorage.getItem('pairlum-offline-queue-v1')||'[]').length") == 0)
    real.evaluate("window.__failMedia = false"); real.wait_for_timeout(3400)
    real.evaluate("document.querySelector('#sharedDayGrid [data-retry-moment]').click()"); real.wait_for_timeout(3000)
    vc = real.evaluate("JSON.parse(localStorage.getItem('pairlum-shared-space-v1')).moments.filter(m => m.type === 'voice' && !m.demo).length")
    check("retry stores the voice once the device has room", vc == 1, vc)

    # ---------- recorder cleanup on every way out ----------
    def start_rec(pg):
        pg.evaluate("document.getElementById('fabAdd').click()"); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelector('.capture-type[data-type=voice]').click()"); pg.wait_for_timeout(200)
        pg.click("#captureRecordBtn"); pg.wait_for_timeout(900)
    for way, act in (("close button", lambda: real.click("#captureOverlay [data-close-overlay]")), ("Escape", lambda: real.keyboard.press("Escape")), ("backdrop", lambda: real.mouse.click(195, 30)), ("switching to Text", lambda: real.evaluate("document.querySelector('.capture-type[data-type=text]').click()"))):
        start_rec(real)
        live_before = real.evaluate(LIVE)
        act(); real.wait_for_timeout(500)
        check("recording + %s: microphone released" % way, live_before >= 1 and real.evaluate(LIVE) == 0, "live before=%s after=%s" % (live_before, real.evaluate(LIVE)))
        real.evaluate("document.querySelectorAll('.overlay.is-open [data-close-overlay]').forEach(b=>b.click())"); real.wait_for_timeout(600)
    # permission answered after the sheet has closed
    real.evaluate("window.__gumDelay = 900")
    real.evaluate("document.getElementById('fabAdd').click()"); real.wait_for_timeout(500)
    real.evaluate("document.querySelector('.capture-type[data-type=voice]').click()"); real.wait_for_timeout(200)
    real.click("#captureRecordBtn"); real.wait_for_timeout(150); real.keyboard.press("Escape"); real.wait_for_timeout(1500)
    check("permission arriving after close: microphone released", real.evaluate(LIVE) == 0)
    real.evaluate("window.__gumDelay = 0")
    # I Need You voice request
    real.evaluate("document.querySelector('.need-chip').click()"); real.wait_for_timeout(500)
    real.click("#needRequestVoiceBtn"); real.wait_for_timeout(900)
    lb = real.evaluate(LIVE); real.keyboard.press("Escape"); real.wait_for_timeout(500)
    check("I Need You recording + Escape: microphone released", lb >= 1 and real.evaluate(LIVE) == 0)
    toast = real.evaluate("document.getElementById('toast').textContent")
    check("…and the person is told nothing was sent", "Nothing was" in toast, toast)
    # page goes to the background mid-recording
    start_rec(real)
    real.evaluate("Object.defineProperty(document, 'hidden', {configurable:true, get(){return true}}); document.dispatchEvent(new Event('visibilitychange'))"); real.wait_for_timeout(600)
    kept = real.evaluate("!!document.getElementById('captureVoicePreview') && document.getElementById('captureVoicePreview').style.display !== 'none'")
    check("page hidden mid-recording: microphone released and the take kept as a draft", real.evaluate(LIVE) == 0 and kept, "kept=%s" % kept)

    print("\njs errors:", errs[:5])
    print("ALL PASS" if ok_all and not errs else "SOME FAILED")
    br.close()
import sys as _s; _s.exit(0 if ok_all else 1)
