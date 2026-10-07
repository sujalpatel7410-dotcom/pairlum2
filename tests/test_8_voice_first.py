"""Voice-first moments: a voice on a photo or clip, short clips, one flat
reply thread, write-ups from the understanding service, and finding a voice.
The understanding service is a MOCK answered by the test, so this checks the
app's side of the contract, not a real speech-to-text service. The camera
and microphone are Chromium's fake devices."""
import sys, os, json, zipfile
from PIL import Image
from playwright.sync_api import sync_playwright
from common import *
U = serve(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
CLIP8, CLIP35 = os.path.join(HERE, "assets", "clip-8s.webm"), os.path.join(HERE, "assets", "clip-35s.webm")
photo = os.path.join(OUT, "p.png"); Image.new("RGB", (400, 300), (180, 90, 60)).save(photo)
def st(pg): return json.loads(shared(pg))
def moments(pg): return [m for m in st(pg).get("moments", []) if not m.get("demo")]
OPEN = "document.getElementById('momentOverlay').classList.contains('is-open')"

with sync_playwright() as p:
    br = launch(p); errs = []
    def ctx_new():
        c = new_context(br); c.grant_permissions(["microphone", "camera"]); return c

    # ================= making a moment =================
    C = "V1 a moment"
    ctx = ctx_new(); a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    js_click(a, "[data-action='open-capture']"); a.wait_for_timeout(400)
    check(C, "the add sheet opens on Voice, in the order Voice, Photo, Clip, Words", a.evaluate("[...document.querySelectorAll('.capture-type')].map(b => b.getAttribute('data-type') + (b.classList.contains('is-selected') ? '*' : '')).join(',')") == "voice*,photo,video,text")
    # a photo that carries a voice
    js_click(a, ".capture-type[data-type='photo']"); a.wait_for_timeout(200)
    a.set_input_files("#capturePhotoInput", photo); a.wait_for_timeout(500)
    js_click(a, "#captureAttachBtn"); a.wait_for_timeout(1700)
    check(C, "attaching a voice: the mic is on while recording", a.evaluate(LIVE) == 1)
    js_click(a, "#captureAttachBtn"); a.wait_for_timeout(600)
    check(C, "attaching a voice: it can be heard before sending, and the mic is off", a.evaluate("!document.getElementById('captureAttachPreview').hidden") and a.evaluate(LIVE) == 0)
    a.fill("#captureMediaCaption", "the view from here"); js_click(a, "#captureSubmit"); a.wait_for_timeout(2600)
    pm = [m for m in moments(a) if m.get("caption") == "the view from here"]
    check(C, "photo + voice is ONE moment that carries the voice", len(pm) == 1 and pm[0]["type"] == "photo" and pm[0].get("voice", {}).get("id") and pm[0]["voice"]["secs"] >= 1, pm)
    pid, vid = pm[0]["id"], pm[0]["voice"]["id"]
    keys = a.evaluate("window.__idb.keys()")
    check(C, "both files are stored: the photo and the voice", pid in keys and vid in keys, keys)
    b.wait_for_timeout(500)
    bar = b.evaluate("(() => { const x = document.querySelector(\"[data-open-moment='%s']\"); return x ? x.textContent : ''; })()" % pid)
    check(C, "the partner's card shows it has a voice and invites a voice reply", "0:0" in bar and "Reply with your voice" in bar, bar)
    # the voice cannot be stored: nothing half-made is shared
    js_click(a, "[data-action='open-capture']"); a.wait_for_timeout(300); js_click(a, ".capture-type[data-type='photo']"); a.wait_for_timeout(200)
    a.set_input_files("#capturePhotoInput", photo); a.wait_for_timeout(400)
    js_click(a, "#captureAttachBtn"); a.wait_for_timeout(1300); js_click(a, "#captureAttachBtn"); a.wait_for_timeout(500)
    a.fill("#captureMediaCaption", "voice will not save"); before_keys = a.evaluate("window.__idb.keys()")
    a.evaluate("() => { window.__pairlumTestFailMediaPut = (id) => String(id).indexOf('vo_') === 0; }"); js_click(a, "#captureSubmit"); a.wait_for_timeout(1800)
    check(C, "voice fails to store: the moment is not shared and no stray photo is left", not any(m.get("caption") == "voice will not save" for m in moments(a)) and a.evaluate("window.__idb.keys()") == before_keys and "Couldn't save" in toast(a), toast(a))
    a.evaluate("() => { window.__pairlumTestFailMediaPut = null; }"); js_click(a, "[data-retry-moment]"); a.wait_for_timeout(2600)
    again = [m for m in moments(a) if m.get("caption") == "voice will not save"]
    check(C, "retry: shared once, with its voice", len(again) == 1 and bool(again[0].get("voice")))

    # ---- short clips ----
    C = "V2 short clips"
    js_click(a, "[data-action='open-capture']"); a.wait_for_timeout(300); js_click(a, ".capture-type[data-type='video']"); a.wait_for_timeout(300)
    a.set_input_files("#captureVideoInput", CLIP35); a.wait_for_timeout(1500)
    check(C, "a 35-second file is refused, with the reason", "35 seconds" in a.evaluate("document.getElementById('captureClipNote').textContent") and a.evaluate("document.getElementById('captureSubmit').disabled"), a.evaluate("document.getElementById('captureClipNote').textContent"))
    a.set_input_files("#captureVideoInput", CLIP8); a.wait_for_timeout(1500)
    check(C, "an 8-second file is accepted", not a.evaluate("document.getElementById('captureSubmit').disabled"))
    js_click(a, "#captureSurfaceVideoRemove"); a.wait_for_timeout(300)
    js_click(a, "#captureClipRec"); a.wait_for_timeout(1800)
    check(C, "recording a clip: camera and microphone are live, and the picture is shown", a.evaluate(LIVE) == 2 and a.evaluate("!!document.querySelector('#captureSurfaceVideo video') && !!document.querySelector('#captureSurfaceVideo video').srcObject"), a.evaluate(LIVE))
    js_click(a, "#captureClipRec"); a.wait_for_timeout(300)
    check(C, "stopping before 5 seconds keeps recording and says why", a.evaluate(LIVE) == 2 and "at least 5 seconds" in a.evaluate("document.getElementById('captureClipNote').textContent"))
    a.wait_for_timeout(4200); js_click(a, "#captureClipRec"); a.wait_for_timeout(900)
    check(C, "after 5 seconds it stops, shows the clip, and camera and mic are off", a.evaluate(LIVE) == 0 and a.evaluate("!!document.querySelector('#captureSurfaceVideo.has-file video')"))
    a.fill("#captureMediaCaption", "a clip of now"); js_click(a, "#captureSubmit"); a.wait_for_timeout(2800)
    cm = [m for m in moments(a) if m.get("caption") == "a clip of now"]
    check(C, "the clip is shared with its length", len(cm) == 1 and cm[0]["type"] == "video" and 5 <= cm[0].get("secs", 0) <= 30, cm)
    js_click(a, "[data-action='open-capture']"); a.wait_for_timeout(300); js_click(a, ".capture-type[data-type='video']"); a.wait_for_timeout(300)
    js_click(a, "#captureClipRec"); a.wait_for_timeout(1200); js_click(a, "#captureOverlay [data-close-overlay]"); a.wait_for_timeout(500)
    check(C, "closing the sheet while a clip records turns camera and mic off", a.evaluate(LIVE) == 0)
    js_click(a, "[data-action='open-capture']"); a.wait_for_timeout(300); js_click(a, ".capture-type[data-type='video']"); a.wait_for_timeout(300)
    js_click(a, "#captureClipRec"); a.wait_for_timeout(31800)
    check(C, "a clip stops by itself at 30 seconds", a.evaluate(LIVE) == 0 and a.evaluate("!!document.querySelector('#captureSurfaceVideo.has-file video')"), a.evaluate("document.getElementById('captureClipTimer').textContent"))
    js_click(a, "#captureOverlay [data-close-overlay]"); a.wait_for_timeout(300)

    # ================= the reply thread =================
    C = "V3 replies"
    js_click(b, "[data-open-moment='%s']" % pid); b.wait_for_timeout(700)
    check(C, "the moment opens with the photo and the voice that came with it", b.evaluate(OPEN) and b.evaluate("!!document.querySelector('#momentMedia img') && !!document.querySelector('.moment-attached audio[src]')"))
    js_click(b, "[data-react='miss']"); b.wait_for_timeout(400)
    check(C, "a reaction is stored, one per person", st(b)["reacts"].get(pid, {}).get("u_mira") == "miss")
    js_click(b, "[data-react='love']"); b.wait_for_timeout(400)
    s_ = st(b)
    check(C, "choosing another replaces it", s_["hearts"].get(pid, {}).get("u_mira") is True and not s_.get("reacts", {}).get(pid, {}).get("u_mira"))
    js_click(a, "[data-open-moment='%s']" % pid); a.wait_for_timeout(600)
    check(C, "the author sees the reaction on the moment", "Mira loved this" in a.evaluate("document.getElementById('momentThread').textContent"))
    check(C, "the author cannot react to their own moment, but can add to the thread", a.evaluate("!document.querySelector('#momentReply [data-react]') && !!document.getElementById('replyVoiceBtn')"))
    # a voice reply
    js_click(b, "#replyVoiceBtn"); b.wait_for_timeout(1600); js_click(b, "#replyVoiceBtn"); b.wait_for_timeout(600)
    check(C, "voice reply: heard first, then sent", b.evaluate("!document.getElementById('replyVoicePreview').hidden && !document.getElementById('replySend').disabled") and b.evaluate(LIVE) == 0)
    before = shared(b)
    b.evaluate("() => { window.__pairlumTestFailMediaPut = () => true; }"); js_click(b, "#replySend"); b.wait_for_timeout(700)
    check(C, "file cannot be stored: nothing is sent and the reply is still there to send", shared(b) == before and b.evaluate("!document.getElementById('replySend').disabled && !document.getElementById('replyVoicePreview').hidden"), toast(b))
    b.evaluate("() => { window.__pairlumTestFailMediaPut = null; window.__failKeys = ['pairlum-shared-space-v1']; }"); k0 = b.evaluate("window.__idb.keys()")
    js_click(b, "#replySend"); b.wait_for_timeout(700)
    check(C, "record cannot be saved: the file is taken back and the reply is still there", b.evaluate("window.__idb.keys()") == k0 and b.evaluate("!document.getElementById('replySend').disabled"), toast(b))
    b.evaluate("() => { window.__failKeys = []; }"); js_click(b, "#replySend"); b.wait_for_timeout(900)
    rp = [r for r in st(b)["replies"] if r["to"] == pid]
    check(C, "sent: one reply, attached to the moment, with its file", len(rp) == 1 and rp[0]["kind"] == "voice" and rp[0]["by"] == "u_mira" and rp[0]["id"] in b.evaluate("window.__idb.keys()"), rp)
    a.wait_for_timeout(500)
    check(C, "the author's open moment shows the reply without being reopened", a.evaluate("document.querySelectorAll('#momentThread .thread-item').length") == 1 and a.evaluate("!!document.querySelector('#momentThread audio')"))
    check(C, "the author is told in the bell, and it opens that moment", "answered your moment with a voice note" in (a.evaluate("localStorage.getItem('pairlum-inbox-v1-u_aarav')") or ""))
    # a clip reply, from the author this time: both add to the same thread
    a.set_input_files("#replyClipInput", CLIP35); a.wait_for_timeout(1300)
    check(C, "clip reply: a 35-second file is refused", "35 seconds" in a.evaluate("document.getElementById('replyNote').textContent") and a.evaluate("document.getElementById('replyDraft').hidden"))
    a.set_input_files("#replyClipInput", CLIP8); a.wait_for_timeout(1300); js_click(a, "#replySend"); a.wait_for_timeout(900)
    rp = sorted([r for r in st(a)["replies"] if r["to"] == pid], key=lambda r: r["at"])
    check(C, "clip reply sent: the thread is flat and in order (voice, then clip)", [r["kind"] for r in rp] == ["voice", "clip"] and all(set(r.keys()) <= {"id", "to", "by", "kind", "secs", "at", "hasMedia"} for r in rp), rp)
    check(C, "no reply can be replied to: thread items carry no reply or open controls", a.evaluate("document.querySelectorAll('#momentThread .thread-item [data-open-moment], #momentThread .thread-item [data-react], #momentThread .thread-item .reply-actions').length") == 0)
    check(C, "the card on Home counts the answers", "2 replies" in a.evaluate("document.querySelector(\"[data-open-moment='%s']\").textContent" % pid))
    js_click(b, "#replyVoiceBtn"); b.wait_for_timeout(1200); js_click(b, "#momentOverlay [data-close-overlay]"); b.wait_for_timeout(500)
    check(C, "closing while recording a reply: mic off, nothing sent, and it says so", b.evaluate(LIVE) == 0 and len([r for r in st(b)["replies"] if r["to"] == pid]) == 2 and "Nothing was sent" in toast(b), toast(b))
    js_click(a, "#momentOverlay [data-close-overlay]"); a.wait_for_timeout(300)
    js_click(a, "[data-view=story]"); a.wait_for_timeout(900)
    check(C, "Our Story marks the moment: a voice and 2 answers", a.evaluate("(() => { const t = document.querySelector(\"[data-tl-id='%s'] .tl-voice-badge\"); return !!t && t.textContent.trim() === '2' && !!t.querySelector('svg'); })()" % pid))
    js_click(a, "[data-tl-id='%s']" % pid); a.wait_for_timeout(600)
    check(C, "from Our Story the moment opens with its whole thread", a.evaluate(OPEN) and a.evaluate("document.querySelectorAll('#momentThread .thread-item').length") == 2)
    js_click(a, "#momentOverlay [data-close-overlay]")

    # ---- the author's own words ----
    C = "V4 own words"
    js_click(a, "[data-open-moment='%s']" % pid); a.wait_for_timeout(500)
    a.evaluate("() => { const d = document.querySelector('.moment-attached .rec-own'); d.open = true; d.querySelector('[data-own-title]').value = 'Rooftop zebra'; d.querySelector('[data-own-words]').value = 'I talked about the zebra crossing by the bakery'; d.querySelector('[data-own-feel]').value = 'playful'; d.querySelector('[data-own-save]').click(); }"); a.wait_for_timeout(400)
    u = st(a)["understood"].get(vid, {})
    check(C, "the author's title, words and feeling are saved as the write-up", u.get("source") == "you" and u.get("title") == "Rooftop zebra" and u.get("feeling") == "playful", u)
    b.wait_for_timeout(300); js_click(b, "[data-open-moment='%s']" % pid); b.wait_for_timeout(500)
    check(C, "the partner sees it but cannot change it", "Rooftop zebra" in b.evaluate("document.querySelector('.moment-attached').textContent") and b.evaluate("!document.querySelector('.moment-attached .rec-own')"))
    js_click(b, "#momentOverlay [data-close-overlay]"); js_click(a, "#momentOverlay [data-close-overlay]"); a.wait_for_timeout(200)
    js_click(b, "[data-view=story]"); b.wait_for_timeout(600); js_click(b, "#voiceFindBtn"); b.wait_for_timeout(400)
    b.fill("#voiceFindInput", "the one about the zebra"); b.wait_for_timeout(400)
    first = b.evaluate("(() => { const x = document.querySelector('#voiceFindResults .vf-open'); return x ? [x.getAttribute('data-focus-rec'), x.textContent] : null; })()")
    check(C, "it is found by those words, with the photo it belongs to", first and first[0] == vid and "With a photo" in first[1], first)
    js_click(b, "#voiceFindResults .vf-open"); b.wait_for_timeout(600)
    check(C, "the result opens the moment, on that recording", b.evaluate(OPEN) and b.evaluate("!!document.querySelector('#momentOverlay .rec.is-found')") and b.evaluate("!document.getElementById('voiceFindOverlay').classList.contains('is-open')"))
    js_click(b, "#momentOverlay [data-close-overlay]")

    # ---- backup, paused, deletion ----
    C = "V5 kept safe"
    js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(300); js_click(a, "#privacyExportBtn"); a.wait_for_timeout(200)
    a.evaluate("() => window.__db(d => { d.prefs.u_mira = Object.assign({}, d.prefs.u_mira, { media: { saveOriginals: true, downloadVideo: true } }); })")
    with a.expect_download() as dl: js_click(a, "#exportConfirmBtn")
    zp = os.path.join(OUT, "v.zip"); dl.value.save_as(zp); js_click(a, "#privacyOverlay [data-close-overlay]")
    data = json.loads(zipfile.ZipFile(zp).read("pairlum.json")); have = {m["id"] for m in data["media"]}
    rids = {r["id"] for r in rp}
    check(C, "the backup holds the voice on the photo and both replies' files", vid in have and rids <= have, sorted(have))
    check(C, "the backup holds the thread and the write-up", len([r for r in data["shared"]["replies"] if r["to"] == pid]) == 2 and data["shared"]["understood"][vid]["title"] == "Rooftop zebra")
    e_ctx = ctx_new(); e = open_page(e_ctx, U, errs)
    js_click(e, "[data-action='open-privacy']"); e.wait_for_timeout(300); js_click(e, "#privacyRestoreBtn"); e.wait_for_timeout(200)
    e.set_input_files("#restoreFile", zp); e.wait_for_timeout(700); js_click(e, "#restoreGo"); e.wait_for_timeout(3000)
    js_click(e, "[data-open-moment='%s']" % pid); e.wait_for_timeout(900)
    check(C, "restored on an empty browser: the moment plays with its voice and its thread", e.evaluate(OPEN) and e.evaluate("!!document.querySelector('.moment-attached audio[src]')") and e.evaluate("document.querySelectorAll('#momentThread .thread-item [src]').length") == 2)
    e_ctx.close()
    js_click(b, "[data-action='open-pairing']"); b.wait_for_timeout(300)
    for s2 in ["#pairingDisconnectBtn", "#disconnectUnderstand", "#disconnectConfirmBtn"]: js_click(b, s2); b.wait_for_timeout(200)
    base = shared(b)
    js_click(b, "[data-open-moment='%s']" % pid) or b.evaluate("document.querySelector(\"[data-tl-id='%s']\").click()" % pid); b.wait_for_timeout(500)
    js_click(b, "[data-react='hug']"); b.wait_for_timeout(300)
    b.set_input_files("#replyClipInput", CLIP8); b.wait_for_timeout(1200); k0 = b.evaluate("window.__idb.keys()"); js_click(b, "#replySend"); b.wait_for_timeout(700)
    check(C, "paused space: no reaction and no reply can be added, and no file is left behind", shared(b) == base and b.evaluate("window.__idb.keys()") == k0, toast(b))
    js_click(b, "#momentOverlay [data-close-overlay]"); js_click(b, "[data-action='open-pairing']"); b.wait_for_timeout(300); js_click(b, "#pairingCreateBtn"); b.wait_for_timeout(200); js_click(b, "#pairingSimulateBtn"); b.wait_for_timeout(300)
    js_click(b, "#pairingOverlay [data-close-overlay]")
    mine_reply = [r["id"] for r in rp if r["by"] == "u_mira"][0]; theirs_reply = [r["id"] for r in rp if r["by"] == "u_aarav"][0]
    js_click(b, "[data-action='open-privacy']"); b.wait_for_timeout(300); js_click(b, "#privacyDeleteBtn"); b.wait_for_timeout(200)
    b.fill("#deleteConfirmInput", "DELETE"); js_click(b, "#deleteConfirmBtn"); b.wait_for_timeout(3200)
    s_ = st(b); keys = b.evaluate("window.__idb.keys()")
    check(C, "deleting my account removes my reply, its file and my reaction", not any(r["id"] == mine_reply for r in s_["replies"]) and mine_reply not in keys and not s_["hearts"].get(pid, {}).get("u_mira"))
    check(C, "and leaves the other person's moment, voice, reply and write-up", any(m["id"] == pid for m in s_["moments"]) and vid in keys and theirs_reply in keys and s_["understood"].get(vid, {}).get("title") == "Rooftop zebra")
    ctx.close()

    # ================= the understanding service (mocked) =================
    C = "V6 service contract"
    ctx = ctx_new(); calls = {"post": [], "get": [], "search": [], "delete": []}
    EVIL = '<img src=x onerror="window.__xss=1">'
    def handle(route):
        rq = route.request; url = rq.url
        if url.endswith("/v1/recordings") and rq.method == "POST":
            body = rq.post_data_buffer or b""
            calls["post"].append(body); route.fulfill(status=202, content_type="application/json", body='{"status":"pending"}')
        elif "/v1/recordings/" in url and rq.method == "GET":
            rid = url.rsplit("/", 1)[1]; calls["get"].append(rid)
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"recordingId": rid, "status": "ready", "transcript": "We should go to Lisbon in the spring " + EVIL,
                "language": "en", "title": "Lisbon in spring " + EVIL, "feeling": "ecstatic-not-a-real-feeling", "topics": ["Lisbon", "travel", {"text": "spring"}], "people": ["Mira"], "events": ["Trip to Lisbon"], "keywords": ["tram"] * 40}))
        elif "/v1/recordings/" in url and rq.method == "DELETE":
            calls["delete"].append(url.rsplit("/", 1)[1]); route.fulfill(status=204, body="")
        elif url.endswith("/v1/search"):
            calls["search"].append(json.loads(rq.post_data or "{}")); route.fulfill(status=200, content_type="application/json", body=json.dumps({"results": [{"recordingId": calls["get"][0] if calls["get"] else "none", "score": 0.9}]}))
        else: route.fulfill(status=404, body="")
    ctx.route("https://understand.test/**", handle)
    a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    for pg in (a, b): pg.evaluate("() => { window.PAIRLUM_CONFIG.understand = { url: 'https://understand.test', pollMs: [300, 600] }; }")
    def voice_moment(pg, cap):
        js_click(pg, "[data-action='open-capture']"); pg.wait_for_timeout(300)
        js_click(pg, "#captureRecordBtn"); pg.wait_for_timeout(1400); js_click(pg, "#captureRecordBtn"); pg.wait_for_timeout(500)
        pg.fill("#captureVoiceCaption", cap); js_click(pg, "#captureSubmit"); pg.wait_for_timeout(2600)
        return [m for m in moments(pg) if m.get("caption") == cap][0]["id"]
    v1 = voice_moment(a, "first voice")
    check(C, "write-ups are off until the speaker switches them on: nothing is sent", len(calls["post"]) == 0)
    vb = voice_moment(b, "her voice")
    js_click(a, "[data-view=us]"); a.wait_for_timeout(300); js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(300)
    js_click(a, "#understandToggle"); a.wait_for_timeout(1800); js_click(a, "#privacyOverlay [data-close-overlay]")
    check(C, "switched on: my earlier recording is sent, once", len(calls["post"]) == 1, len(calls["post"]))
    body = calls["post"][0] if calls["post"] else b""
    check(C, "what is sent: the audio and who/when, and it is MY recording only", (b'"recordingId":"%s"' % v1.encode()) in body and b'"speaker":"u_aarav"' in body and b'name="audio"' in body and vb.encode() not in body)
    check(C, "my partner's recording is never sent from my device", all(vb.encode() not in x for x in calls["post"]) and vb not in calls["get"])
    u = st(a)["understood"].get(v1, {})
    check(C, "the answer is stored as the write-up", u.get("status") == "ready" and u.get("source") == "service" and u.get("title", "").startswith("Lisbon in spring"), u)
    check(C, "an unknown feeling is dropped; long lists are cut; odd shapes are flattened to text", u.get("feeling") == "" and len(u.get("words", [])) <= 16 and u.get("topics") == ["Lisbon", "travel", "spring"], u)
    js_click(a, "[data-view=home]"); a.wait_for_timeout(300); js_click(a, "[data-open-moment='%s']" % v1); a.wait_for_timeout(600)
    a.evaluate("document.querySelectorAll('#momentOverlay details').forEach(d => d.open = true)")
    check(C, "whatever the service returns is shown as plain text, never as page elements", a.evaluate("document.querySelectorAll('#momentOverlay img[src=\"x\"]').length") == 0 and a.evaluate("window.__xss") is None and "<img" in a.evaluate("document.getElementById('momentBody').textContent"))
    js_click(a, "#momentOverlay [data-close-overlay]")
    v2 = voice_moment(a, "second voice")
    check(C, "a new recording is sent by itself once write-ups are on", len(calls["post"]) == 2 and st(a)["understood"].get(v2, {}).get("status") == "ready", len(calls["post"]))
    js_click(a, "[data-view=story]"); a.wait_for_timeout(600); js_click(a, "#voiceFindBtn"); a.wait_for_timeout(300)
    a.fill("#voiceFindInput", "somewhere warm by the river"); a.wait_for_timeout(1300)
    check(C, "search asks the service and shows what it found, even with no matching word", len(calls["search"]) >= 1 and calls["search"][-1].get("query") == "somewhere warm by the river" and a.evaluate("document.querySelectorAll('#voiceFindResults .vf-item').length") >= 1, calls["search"][-1:])
    a.keyboard.press("Escape")
    # the service is down
    ctx.unroute("https://understand.test/**"); ctx.route("https://understand.test/**", lambda r: r.fulfill(status=500, body="down"))
    v3 = voice_moment(a, "third voice")
    check(C, "service down: the moment is still shared, and the write-up is marked as not through", any(m["id"] == v3 for m in moments(a)) and st(a)["understood"].get(v3, {}).get("status") == "failed")
    a.fill("#voiceFindInput", "x") if False else None
    js_click(a, "[data-view=story]"); js_click(a, "#voiceFindBtn"); a.wait_for_timeout(300); a.fill("#voiceFindInput", "Lisbon"); a.wait_for_timeout(900)
    check(C, "service down: search still works by words", a.evaluate("document.querySelectorAll('#voiceFindResults .vf-item').length") >= 1)
    check(C, "no script errors", not errs, errs[:2])
    ctx.close()

    # ================= finding a voice in a year of them =================
    C = "V7 find a voice"
    ctx = ctx_new()
    def find(pg, q):
        if not pg.evaluate("document.getElementById('voiceFindOverlay').classList.contains('is-open')"):
            js_click(pg, "[data-view=story]"); pg.wait_for_timeout(700); js_click(pg, "#voiceFindBtn"); pg.wait_for_timeout(300)
        pg.fill("#voiceFindInput", q); pg.wait_for_timeout(450)
        return pg.evaluate("[...document.querySelectorAll('#voiceFindResults .vf-item')].map(li => ({ rec: li.querySelector('.vf-open').getAttribute('data-focus-rec'), moment: li.querySelector('.vf-open').getAttribute('data-open-moment'), text: li.querySelector('.vf-open').textContent }))")
    d = open_page(ctx, U + "?demo=year&fresh=1", errs, wait=1900)
    DSH = "JSON.parse(localStorage.getItem('demoyear:pairlum-shared-space-v1'))"
    und = d.evaluate(DSH + ".understood"); mom = {m["id"]: m for m in d.evaluate(DSH + ".moments")}; reps = {r["id"]: r for r in d.evaluate(DSH + ".replies")}
    def by(rec):
        if rec in mom: return mom[rec]["by"]
        if rec in reps: return reps[rec]["by"]
        return [m["by"] for m in mom.values() if m.get("voice", {}).get("id") == rec][0]
    r = find(d, "Find the voice note where she talked about our Goa trip")
    check(C, "“…where she talked about our Goa trip”: her Goa recordings, the planning one first", len(r) >= 2 and "Goa" in und[r[0]["rec"]]["title"] and all(by(x["rec"]) == "u_mira" and "goa" in json.dumps(und[x["rec"]]).lower() for x in r), [x["text"][:40] for x in r])
    r = find(d, "the recording attached to that sunset photo")
    check(C, "“…attached to that sunset photo”: the voice on the sunset photo comes first", r and r[0]["rec"] == "dyvp1v" and r[0]["moment"] == "dyvp1" and all(mom[x["moment"]]["type"] == "photo" for x in r), [x["rec"] for x in r])
    check(C, "the result shows the photo it belongs to", d.evaluate("!!document.querySelector('#voiceFindResults .vf-item .vf-thumb img')"))
    r = find(d, "Show me her voice notes when she was missing me")
    check(C, "“her voice notes when she was missing me” (asked by him): only hers, only missing", len(r) >= 3 and all(by(x["rec"]) == "u_mira" and und[x["rec"]]["feeling"] == "missing" for x in r), [(by(x["rec"]), und[x["rec"]]["feeling"]) for x in r])
    mi = open_page(ctx, U + "?demo=year&as=mira", errs, wait=1900)
    r = find(mi, "Show me his voice notes when he was missing me")
    check(C, "“his voice notes when he was missing me” (asked by her): only his, only missing", len(r) >= 3 and all(by(x["rec"]) == "u_aarav" and und[x["rec"]]["feeling"] == "missing" for x in r), [(by(x["rec"]), und[x["rec"]]["feeling"]) for x in r])
    mi.close()
    r = find(d, "what did I say on diwali")
    check(C, "a word from what was said, and “I” means me", r and und[r[0]["rec"]]["title"] == "Diwali without you" and all(by(x["rec"]) == "u_aarav" for x in r), [x["text"][:30] for x in r])
    r = find(d, "the clip of the sea")
    check(C, "a clip is found by what surrounds it", any(x["moment"] == "dyvc1" for x in r), [x["rec"] for x in r])
    r_all = find(d, "")
    check(C, "with nothing typed, every recording is listed newest first", len(r_all) >= 30)
    js_click(d, "[data-vf-feeling='rough']"); d.wait_for_timeout(300)
    r = d.evaluate("[...document.querySelectorAll('#voiceFindResults .vf-open')].map(x => x.getAttribute('data-focus-rec'))")
    check(C, "the feeling chips filter without typing", len(r) >= 1 and all(und[x]["feeling"] == "rough" for x in r), r)
    note = d.evaluate("document.getElementById('voiceFindNote').textContent")
    check(C, "the screen says honestly what kind of matching this is", "Matching by meaning needs the understanding service" in note, note)
    js_click(d, "[data-vf-feeling='']"); d.wait_for_timeout(200)
    find(d, "Goa trip")
    d.evaluate("() => { window.__played = []; const P = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function(){ window.__played.push(this.src); return P.call(this); }; }")
    js_click(d, "#voiceFindResults .vf-play"); d.wait_for_timeout(600)
    check(C, "a result plays in place", len(d.evaluate("window.__played")) == 1 and d.evaluate("window.__played[0]").endswith(".mp3"), d.evaluate("window.__played"))
    js_click(d, "#voiceFindResults .vf-open"); d.wait_for_timeout(700)
    check(C, "opening a result shows the moment, the words, and that the write-up is a sample", d.evaluate(OPEN) and "Sample write-up" in d.evaluate("document.getElementById('momentBody').textContent") and "Planning our Goa trip" in d.evaluate("document.getElementById('momentBody').textContent"))
    js_click(d, "#momentOverlay [data-close-overlay]"); d.wait_for_timeout(200)
    js_click(d, "[data-tl-id='dyvc1']"); d.wait_for_timeout(900)
    kinds = d.evaluate("[...document.querySelectorAll('#momentThread .thread-item .rec')].map(r => r.querySelector('video') ? 'clip' : 'voice')")
    check(C, "demo: a clip with a voice, answered by a clip and then a voice, in one flat thread", kinds == ["clip", "voice"] and d.evaluate("!!document.querySelector('.moment-attached audio')"), kinds)
    # nothing spills sideways on a small phone
    d.set_viewport_size({"width": 340, "height": 700}); d.wait_for_timeout(400)
    check(C, "on a 340px phone the moment sheet does not scroll sideways", d.evaluate("(() => { const s = document.querySelector('#momentOverlay .sheet'); return s.scrollWidth <= s.clientWidth + 1; })()"))
    js_click(d, "#momentOverlay [data-close-overlay]"); js_click(d, "#voiceFindBtn"); d.wait_for_timeout(400); d.fill("#voiceFindInput", "goa"); d.wait_for_timeout(400)
    check(C, "on a 340px phone the search sheet does not scroll sideways", d.evaluate("(() => { const s = document.querySelector('#voiceFindOverlay .sheet'); return s.scrollWidth <= s.clientWidth + 1; })()"))
    check(C, "no script errors", not errs, errs[:2])
    ctx.close(); br.close()
finish("test_8_voice_first")
