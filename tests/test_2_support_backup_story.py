"""Probes for the support, export/restore, drafts, voice timeline, Day Story and question fixes."""
import sys, threading, http.server, functools, zipfile, json, io, os
from playwright.sync_api import sync_playwright
SITE = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE); handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
U = "http://127.0.0.1:%d/index.html" % srv.server_address[1]
ok_all = True
def check(name, cond, detail=""):
    global ok_all
    ok_all = ok_all and bool(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (("  | " + str(detail)[:300]) if detail != "" else ""), flush=True)
MIC = """(() => { window.__tracks = []; const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => real(c).then(s => { s.getTracks().forEach(t => window.__tracks.push(t)); return s; }); })();"""
LIVE = "window.__tracks.filter(t => t.readyState === 'live').length"
SH = "JSON.parse(localStorage.getItem('pairlum-shared-space-v1'))"
def vis(pg, sel): return pg.evaluate("s => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }", sel)
def show(pg, sel): pg.evaluate("s => document.querySelector(s).scrollIntoView({block:'center'})", sel); pg.wait_for_timeout(250)

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, permissions=["microphone"], accept_downloads=True)
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort()); ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
    errs = []
    def page_new(url):
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.add_init_script(MIC); pg.goto(url); pg.wait_for_timeout(1400); return pg
    a = page_new(U)
    # no first-run tips in the way
    a.evaluate("() => { document.querySelectorAll('.coach, .tip, [data-tip]').forEach(e => e.remove()); }")

    # ---- honest empty state ----
    card = a.evaluate("document.getElementById('needYouCard') ? document.getElementById('needYouCard').innerText : document.getElementById('needPrimaryBtn').closest('section,article,div.card,div').innerText")
    check("no pretend message: button is off", a.evaluate("document.getElementById('needPrimaryBtn').disabled"))
    check("no pretend message: says nothing is here", "Nothing from Mira here yet" in a.evaluate("document.getElementById('needPrimaryTitle').textContent"))
    check("no '2 days ago' claim on the card", "2 days ago" not in card, card)
    ds = a.evaluate("[...document.querySelectorAll('#dayStoryTimeline .day-story-item')].map(e => e.className.includes('is-done') + ':' + e.textContent.trim())")
    check("Day Story: Parallel Moment is not marked done by default", any(x.startswith("false:Parallel") for x in ds), ds)

    # ---- record a message for their hard days ----
    show(a, "#needMineLine"); a.click("[data-comfort='record']"); a.wait_for_timeout(400)
    check("record sheet opens", a.evaluate("document.getElementById('comfortOverlay').classList.contains('is-open') || document.getElementById('comfortOverlay').classList.contains('open') || getComputedStyle(document.getElementById('comfortOverlay')).display !== 'none'"))
    a.click("#comfortRecBtn"); a.wait_for_timeout(1600)
    check("mic is live while recording", a.evaluate(LIVE) == 1)
    a.click("#comfortOverlay [data-close-overlay]"); a.wait_for_timeout(500)
    check("closing mid-recording releases the mic", a.evaluate(LIVE) == 0)
    check("closing mid-recording saves nothing", not a.evaluate("(" + SH + ".comfort || {}).u_aarav"))
    a.click("[data-comfort='record']"); a.wait_for_timeout(300)
    a.click("#comfortRecBtn"); a.wait_for_timeout(2300); a.click("#comfortRecBtn"); a.wait_for_timeout(700)
    check("preview appears after stopping", vis(a, "#comfortPreview"))
    a.click("#comfortSave"); a.wait_for_timeout(900)
    cm = a.evaluate(SH + ".comfort.u_aarav")
    check("message saved to the shared record", bool(cm and cm.get("id") and cm.get("secs") >= 1), cm)
    inidb = a.evaluate("""id => new Promise(res => { const r = indexedDB.open('pairlum-media-v1'); r.onsuccess = () => { const q = r.result.transaction('media').objectStore('media').get(id); q.onsuccess = () => res(q.result ? q.result.size : 0); }; })""", cm["id"])
    check("recording bytes are stored on the device", inidb > 100, inidb)
    check("mic released after saving", a.evaluate(LIVE) == 0)

    # ---- partner sees and plays it ----
    b = page_new(U + "?as=mira")
    check("partner: play button is on", not b.evaluate("document.getElementById('needPrimaryBtn').disabled"))
    check("partner: card names the real age", "just now" in b.evaluate("document.getElementById('needPrimarySub').textContent") or "min ago" in b.evaluate("document.getElementById('needPrimarySub').textContent"))
    show(b, "#needPrimaryBtn"); b.click("#needPrimaryBtn"); b.wait_for_timeout(900)
    check("partner: real player is ready", not b.evaluate("document.getElementById('needVoicePlay').disabled"))
    b.evaluate("() => { window.__played = 0; const P = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function(){ window.__played++; window.__src = this.src; return P.call(this); }; }")
    b.click("#needVoicePlay"); b.wait_for_timeout(500)
    check("partner: pressing play plays the recording", b.evaluate("window.__played") >= 1 and str(b.evaluate("window.__src")).startswith("blob:"), b.evaluate("window.__src"))
    n0 = len(b.evaluate(SH + ".notes"))
    b.click("[data-need-response='helped']"); b.wait_for_timeout(500)
    notes = b.evaluate(SH + ".notes")
    check("'Tell them it helped' really sends a note", len(notes) == n0 + 1 and any("helped" in (n.get("text") or "") for n in notes))

    # ---- a request: urgency is the sender's choice; 'not right now' is recorded ----
    show(a, "#needGrid"); a.click("#needGrid button"); a.wait_for_timeout(400)
    if a.evaluate("!document.querySelector('#needRequestOverlay [data-need-id].is-selected')"): a.click("#needRequestOverlay [data-need-id]")
    check("urgent box starts unticked", not a.evaluate("document.getElementById('needUrgentCheck').checked"))
    a.check("#needUrgentCheck"); a.click("#needRequestSend"); a.wait_for_timeout(1200)
    rq = a.evaluate(SH + ".requests")
    mine = [r for r in rq if r.get("by") == "u_aarav"]
    check("request stored with urgent = true", bool(mine) and mine[0].get("urgent") is True or (bool(mine) and mine[-1].get("urgent") is True), [ (r.get('title'), r.get('urgent')) for r in mine])
    b.wait_for_timeout(600)
    check("partner sees the request", vis(b, "#needIncoming"))
    show(b, "#needIncoming"); b.click("[data-req-reply='later']"); b.wait_for_timeout(700)
    a.wait_for_timeout(500)
    line = a.evaluate("document.getElementById('needSentLine').textContent")
    check("sender is told 'can't right now'", "can't right now" in line, line)
    show(a, "#needHistoryBtn"); a.click("#needHistoryBtn"); a.wait_for_timeout(400)
    hist = a.evaluate("document.getElementById('needHistoryBody').innerText")
    check("history lists the request and its outcome", "You could use" in hist and "couldn't right then" in hist, hist)
    a.click("#needHistoryOverlay [data-close-overlay]"); a.wait_for_timeout(300)

    # ---- letter draft survives closing and reloading ----
    a.evaluate("document.querySelector('[data-view=letters]').click()"); a.wait_for_timeout(600)
    a.evaluate("document.querySelector(\"[data-action='open-letter']\").click()"); a.wait_for_timeout(500)
    a.fill("#letterSubjectInput", "For the flight home"); a.fill("#letterBodyInput", "I started this on the terrace and"); a.wait_for_timeout(200)
    a.reload(); a.wait_for_timeout(1400)
    a.evaluate("document.querySelector(\"[data-action='open-letter']\").click()"); a.wait_for_timeout(500)
    check("draft is back after a reload", a.input_value("#letterBodyInput") == "I started this on the terrace and" and a.input_value("#letterSubjectInput") == "For the flight home")
    check("draft is not in the shared record", "terrace and" not in a.evaluate("localStorage.getItem('pairlum-shared-space-v1')"))
    a.click("#letterSend"); a.wait_for_timeout(700)
    check("sealing clears the draft", a.evaluate("localStorage.getItem('pairlum-letter-draft-v1-u_aarav')") is None)

    # ---- export: one zip, media inside, sealed letter stays sealed ----
    a.evaluate("""() => { const d = JSON.parse(localStorage.getItem('pairlum-shared-space-v1'));
      d.letters.unshift({ id:'SEALED1', by:'u_mira', from:'Mira', title:'Secret title', body:'SECRET-WORDS-DO-NOT-LEAK', openDate:'2099-01-01', locked:true, state:'Opens 1 January', createdAt:Date.now() });
      localStorage.setItem('pairlum-shared-space-v1', JSON.stringify(d)); }""")
    a.reload(); a.wait_for_timeout(1400)
    a.evaluate("document.querySelector(\"[data-action='open-privacy']\").click()"); a.wait_for_timeout(500)
    a.click("#privacyExportBtn"); a.wait_for_timeout(300)
    with a.expect_download() as dl: a.click("#exportConfirmBtn")
    path = os.path.join(OUT, "export.zip"); dl.value.save_as(path)
    raw = open(path, "rb").read()
    z = zipfile.ZipFile(path)
    check("export is a valid zip (checksums pass)", z.testzip() is None, z.namelist()[:6])
    data = json.loads(z.read("pairlum.json"))
    check("export holds the shared record", data["format"] == "pairlum-export" and len(data["shared"]["moments"]) > 0)
    check("export holds the recording itself", any(m["id"] == cm["id"] for m in data["media"]) and len(z.read([m for m in data["media"] if m["id"] == cm["id"]][0]["file"])) == inidb)
    check("sealed letter's words are not in the export", b"SECRET-WORDS" not in raw and b"Secret title" not in raw)
    check("sealed letter is still listed", any(l.get("id") == "SEALED1" and l.get("sealedInExport") for l in data["shared"]["letters"]))
    status = a.evaluate("document.getElementById('exportStatusLine').textContent")
    check("status does not claim missing sample files", "could not be included" not in status, status)

    # ---- restore ----
    a.evaluate("""() => { const d = JSON.parse(localStorage.getItem('pairlum-shared-space-v1')); d.notes.unshift({id:'LATER', by:'u_aarav', text:'added after the backup', at:Date.now()}); localStorage.setItem('pairlum-shared-space-v1', JSON.stringify(d)); }""")
    a.evaluate("id => new Promise(res => { const r = indexedDB.open('pairlum-media-v1'); r.onsuccess = () => { const tx = r.result.transaction('media','readwrite'); tx.objectStore('media').delete(id); tx.oncomplete = () => res(1); }; })", cm["id"])
    a.reload(); a.wait_for_timeout(1300)
    a.evaluate("document.querySelector(\"[data-action='open-privacy']\").click()"); a.wait_for_timeout(400)
    a.click("#privacyRestoreBtn"); a.wait_for_timeout(200)
    bad = os.path.join(OUT, "bad.zip"); open(bad, "wb").write(b"not a zip at all")
    a.set_input_files("#restoreFile", bad); a.wait_for_timeout(400)
    check("a wrong file is refused and changes nothing", "Nothing was changed" in a.evaluate("document.getElementById('restoreStatus').textContent") and a.evaluate("document.getElementById('restoreGo').disabled"))
    a.set_input_files("#restoreFile", path); a.wait_for_timeout(500)
    check("backup is described before restoring", "moments" in a.evaluate("document.getElementById('restoreStatus').textContent"))
    a.click("#restoreGo"); a.wait_for_timeout(2600)
    after = a.evaluate(SH)
    check("restore puts the record back", not any(n.get("id") == "LATER" for n in after["notes"]))
    check("restore keeps the sealed letter's words on the device", any(l.get("id") == "SEALED1" and l.get("body") == "SECRET-WORDS-DO-NOT-LEAK" for l in after["letters"]))
    back = a.evaluate("""id => new Promise(res => { const r = indexedDB.open('pairlum-media-v1'); r.onsuccess = () => { const st = r.result.transaction('media').objectStore('media'); const k = st.getAllKeys(); k.onsuccess = () => { const key = k.result.map(String).find(x => x === id || x.endsWith(':' + id)); if(!key) return res(0); const q = st.get(key); q.onsuccess = () => res(q.result ? q.result.size : 0); }; }; })""", cm["id"])
    check("restore puts the recording back", back == inidb, back)

    # ---- one-year demo ----
    d = page_new(U + "?demo=year&fresh=1")
    DSH = "JSON.parse(localStorage.getItem('demoyear:pairlum-shared-space-v1'))"
    q_today = d.evaluate("document.getElementById('dqQuestion') ? document.getElementById('dqQuestion').textContent : ''")
    keys = d.evaluate("Object.keys(" + DSH + ".dq).map(Number).sort((x,y)=>y-x).slice(0,3)")
    ist_day = d.evaluate("Math.floor((Date.now() + 330*60000) / 86400000)")
    check("demo: today's answers sit on the shared-calendar day", keys[0] == ist_day, (keys, ist_day))
    todayq = d.evaluate(DSH + ".dq[" + str(ist_day) + "]._q.text")
    shown = d.evaluate("[...document.querySelectorAll('#view-home *')].some(e => e.children.length === 0 && e.textContent.trim() === %s)" % json.dumps(todayq))
    check("demo: the question shown is the one stored with the answers", shown, todayq)
    check("demo: partner's hard-day message can be played", not d.evaluate("document.getElementById('needPrimaryBtn').disabled"))
    check("demo: Past answers button is shown", vis(d, "#dqArchiveBtn"))
    d.evaluate("document.getElementById('dqArchiveBtn').click()"); d.wait_for_timeout(500)
    arch = d.evaluate("document.getElementById('dqArchiveOverlay').innerText")
    check("demo: archive pairs each day with its own question", arch.count("?") >= 10, arch[:200])
    check("demo: archive does not reveal today's answer before you answer", "Shown once you answer" in arch and "Just more mornings" not in arch.split("MON,")[0], arch[:160])
    d.keyboard.press("Escape"); d.wait_for_timeout(300)
    d.evaluate("document.querySelector('[data-view=story]').click()"); d.wait_for_timeout(1200)
    nvoice = d.evaluate("(document.querySelector('[data-tl-filter=voice] .tl-col-n') || {}).textContent")
    check("demo: Our Story counts the year's voice notes", nvoice == "24", nvoice)
    d.evaluate("document.querySelector('[data-tl-filter=voice]').click()"); d.wait_for_timeout(500)
    check("demo: voice filter shows only voice tiles", d.evaluate("document.querySelectorAll('#memoryTimeline .tl-item').length === document.querySelectorAll('#memoryTimeline .tl-item--voice').length && document.querySelectorAll('#memoryTimeline .tl-item--voice').length > 0"))
    d.evaluate("(document.querySelector('#memoryTimeline .tl-grid:not([hidden]) .tl-item--voice') || document.querySelector('#memoryTimeline .tl-item--voice')).click()"); d.wait_for_timeout(900)
    dur = d.evaluate("new Promise(res => { const a = document.querySelector('#momentBody audio[src]'); if(!a) return res(-1); a.preload = 'metadata'; a.load(); if(a.readyState >= 1) return res(a.duration); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-2); setTimeout(() => res(-3), 4000); })")
    check("demo: a voice note opens with a real, loadable recording", dur > 5, dur)
    check("no script errors", not errs, errs[:3])
    br.close()
print("ALL PASS" if ok_all else "SOME FAILED")
import sys as _s; _s.exit(0 if ok_all else 1)
