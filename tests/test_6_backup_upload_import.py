"""Review cases 9, 10 and 11: a full export put back into an empty browser,
uploads interrupted by a reload, and imports/attachments that overlap."""
import sys, os, json, zipfile, shutil
from PIL import Image
from playwright.sync_api import sync_playwright
from common import *
U = serve(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
def png(name, color, size=(2000, 1500), sub=""):
    d = os.path.join(OUT, sub); os.makedirs(d, exist_ok=True); pth = os.path.join(d, name)
    Image.new("RGB", size, color).save(pth); return pth
def export_zip(pg, path):
    js_click(pg, "[data-action='open-privacy']"); pg.wait_for_timeout(300); js_click(pg, "#privacyExportBtn"); pg.wait_for_timeout(200)
    with pg.expect_download() as dl: js_click(pg, "#exportConfirmBtn")
    dl.value.save_as(path); pg.wait_for_timeout(200); js_click(pg, "#privacyOverlay [data-close-overlay]"); pg.wait_for_timeout(200)
def restore(pg, path):
    js_click(pg, "[data-action='open-privacy']"); pg.wait_for_timeout(300); js_click(pg, "#privacyRestoreBtn"); pg.wait_for_timeout(200)
    pg.set_input_files("#restoreFile", path); pg.wait_for_timeout(700)
    text = pg.evaluate("document.getElementById('restoreStatus').innerText")
    js_click(pg, "#restoreGo"); pg.wait_for_timeout(2800); return text
def import_files(pg, files, wait=1600):
    if not pg.evaluate("document.getElementById('importOverlay').classList.contains('is-open')"):
        js_click(pg, "[data-action='open-import']"); pg.wait_for_timeout(300)
    pg.set_input_files("#importFileInput", files); pg.wait_for_timeout(wait)
REVIEW_N = "document.querySelectorAll('#reviewList [data-imp-id]').length"
mems = lambda pg: json.loads(shared(pg)).get("memories", [])

with sync_playwright() as p:
    br = launch(p); errs = []

    # ================= case 9 =================
    C = "09 backup round trip"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    src = png("holiday.png", (200, 120, 90))
    import_files(a, src); js_click(a, "#importNext"); a.wait_for_timeout(1500); js_click(a, "#importNext"); a.wait_for_timeout(300)
    imp = [m for m in mems(a) if str(m.get("src", "")).startswith("holiday.png")]
    check(C, "a real import kept its original file as well as the resized copy", len(imp) == 1 and imp[0].get("hasOriginal") is True, imp)
    a.evaluate("""async () => {
      const put = window.__idb.put;
      await put('VID1', 'VIDEO-BYTES-1', 'video/mp4'); await put('VO1', 'VOICE-NOTE-1', 'audio/webm'); await put('RQ1', 'VOICE-REQUEST-1', 'audio/webm');
      await put('CMF_A', 'COMFORT-FROM-AARAV', 'audio/webm'); await put('CMF_M', 'COMFORT-FROM-MIRA', 'audio/webm');
      await put('AMB_A', 'PLACE-SOUND-AARAV', 'audio/webm'); await put('AMB_M', 'PLACE-SOUND-MIRA', 'audio/webm');
      await put('PH_P', 'PARTNER-PHOTO', 'image/jpeg'); await put('Q1', 'WAITING-PHOTO', 'image/jpeg');
      const far = '2099-01-01';
      window.__db(d => {
        d.memories.push({ id:'VID1', by:'u_aarav', type:'video', date:'2025-02-02', caption:'a clip', preview:true, at:5 });
        d.memories.push({ id:'PH_P', by:'u_mira', type:'photo', date:'2025-02-03', caption:'hers', preview:true, at:6 });
        d.moments.push({ id:'VO1', by:'u_aarav', type:'voice', caption:'Voice note', dur:'0:05', hasMedia:true, at: Date.now() - 86400000 * 3 });
        d.requests.push({ id:'RQ1', by:'u_aarav', title:'Hear their voice', note:'', voice:true, hasVoice:true, sentAt: Date.now() - 5000, status:'delivered', noReply:true });
        d.comfort.u_aarav = { id:'CMF_A', secs:4, at:1 }; d.comfort.u_mira = { id:'CMF_M', secs:5, at:2 };
        d.ambient.u_aarav = { id:'AMB_A', label:'terrace', secs:4, at:1 }; d.ambient.u_mira = { id:'AMB_M', label:'cafe', secs:5, at:2 };
        d.prefs.u_mira = { media: { saveOriginals: true, downloadVideo: true } };
        d.letters.unshift({ id:'SEAL_M', by:'u_mira', from:'Mira', title:'ZZ-SEALED-TITLE', body:'MIRA-SEALED-WORDS', openDate: far, locked:true, state:'Opens', createdAt: 1 });
        d.letters.unshift({ id:'SEAL_A', by:'u_aarav', from:'Aarav', title:'Mine for her', body:'AARAV-SEALED-WORDS', openDate: far, locked:true, state:'Opens', createdAt: 2 });
      });
      localStorage.setItem('pairlum-offline-queue-v1-u_aarav', JSON.stringify([{ id:'Q1', type:'photo', caption:'waiting to send', status:'queued', createdAt: Date.now(), hasMedia:true, parallel:false }]));
      const s = JSON.parse(localStorage.getItem('pairlum-space-settings-v1-u_aarav') || '{}'); s.simulateOffline = true; s.sound = false; localStorage.setItem('pairlum-space-settings-v1-u_aarav', JSON.stringify(s)); }""")
    a.reload(); a.wait_for_timeout(1500)
    zipA = os.path.join(OUT, "aarav.zip"); export_zip(a, zipA)
    z = zipfile.ZipFile(zipA); data = json.loads(z.read("pairlum.json"))
    have = {m["id"]: m for m in data["media"]}
    want = {"VID1", "VO1", "RQ1", "CMF_A", "CMF_M", "AMB_A", "AMB_M", "PH_P", "Q1", imp[0]["id"], "orig:" + imp[0]["id"]}
    check(C, "export holds every kind: photo, original, video, voice, request, both comfort, both ambient, queued", want <= set(have), sorted(want - set(have)))
    src_sha = {i: a.evaluate("async i => window.__idb.sha(await window.__idb.find(i))", i) for i in want}
    check(C, "each exported file is byte-identical to the one on the device", all(sha(z.read(have[i]["file"])) == src_sha[i] for i in want))
    check(C, "the kept original is the untouched source file", sha(z.read(have["orig:" + imp[0]["id"]]["file"])) == sha(open(src, "rb").read()))
    check(C, "the export says what it covers", data["coverage"]["referenced"] == data["coverage"]["included"] and data["coverage"]["missing"] == 0, data["coverage"])
    check(C, "the letter sealed for me is exported without title or words", b"MIRA-SEALED-WORDS" not in open(zipA, "rb").read() and b"ZZ-SEALED-TITLE" not in open(zipA, "rb").read() and data["notes"]["sealedLetters"] >= 1 and any(l["id"] == "SEAL_M" and l.get("sealedInExport") for l in data["shared"]["letters"]), data["notes"])

    # the owner's choice decides what goes into the partner's export
    a.evaluate("() => window.__db(d => { d.prefs.u_mira = { media: { saveOriginals: false, downloadVideo: true } }; })"); a.reload(); a.wait_for_timeout(1200)
    zipW = os.path.join(OUT, "withheld.zip"); export_zip(a, zipW); dw = json.loads(zipfile.ZipFile(zipW).read("pairlum.json"))
    check(C, "saving switched off by the owner: their photo is left out and listed", "PH_P" not in {m["id"] for m in dw["media"]} and "PH_P" in dw["notes"]["withheldMedia"] and b"PARTNER-PHOTO" not in open(zipW, "rb").read())
    check(C, "my own files are never withheld from my export", {"VID1", "VO1", imp[0]["id"]} <= {m["id"] for m in dw["media"]})

    # the sender's export does carry the sealed words
    m = open_page(ctx, U + "?as=mira", errs); zipM = os.path.join(OUT, "mira.zip"); export_zip(m, zipM)
    dm = json.loads(zipfile.ZipFile(zipM).read("pairlum.json"))
    check(C, "the writer's own export keeps her sealed letter in full", any(l["id"] == "SEAL_M" and l.get("body") == "MIRA-SEALED-WORDS" for l in dm["shared"]["letters"]) and not any(l["id"] == "SEAL_A" and l.get("body") for l in dm["shared"]["letters"]))
    ctx.close()

    # an empty simulation: a different browser profile with nothing in it
    ctx2 = new_context(br); e = open_page(ctx2, U, errs)
    text = restore(e, zipA)
    check(C, "restore warns that the sealed letter cannot come back from the recipient's file", "sealed letter" in text, text)
    e.wait_for_timeout(1200); st = json.loads(shared(e))
    same = all(json.dumps(st[k], sort_keys=True) == json.dumps(data["shared"][k], sort_keys=True) for k in ["moments", "notes", "memories", "requests", "comfort", "ambient", "someday", "dates", "plans", "chapters", "dq", "profiles"])
    check(C, "empty device: every record collection matches the backup", same)
    got = {i: e.evaluate("async i => { const k = await window.__idb.find(i); return k ? window.__idb.sha(k) : null; }", i) for i in want}
    check(C, "empty device: every media file is back, byte for byte", got == src_sha, [i for i in want if got[i] != src_sha[i]])
    us = json.loads(e.evaluate("localStorage.getItem('pairlum-space-settings-v1-u_aarav')") or "{}")
    check(C, "empty device: my device settings came back", us.get("sound") is False and us.get("simulateOffline") is True, us)
    check(C, "empty device: the item waiting to send is back, still waiting", e.evaluate("(() => { const c = document.querySelector(\"[data-moment-id='Q1']\"); return !!c && /Saved on this device/.test(c.textContent); })()"))
    sl = {l["id"]: l for l in st["letters"]}
    check(C, "empty device: my own sealed letter is whole; the one sealed for me is listed without words (documented limit)", sl["SEAL_A"].get("body") == "AARAV-SEALED-WORDS" and not sl["SEAL_M"].get("body") and sl["SEAL_M"].get("sealedInExport") is True)
    ctx2.close()
    ctx3 = new_context(br); e = open_page(ctx3, U + "?as=mira", errs); restore(e, zipM); e.wait_for_timeout(800)
    check(C, "empty device, writer's backup: the sealed letter's words are restored", any(l["id"] == "SEAL_M" and l.get("body") == "MIRA-SEALED-WORDS" for l in json.loads(shared(e))["letters"]))
    ctx3.close()

    # ================= case 10 =================
    C = "10 interrupted upload"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    a.evaluate("""async () => { await window.__idb.put('U1', 'BYTES-U1'); await window.__idb.put('S1', 'BYTES-S1'); await window.__idb.put('D1', 'BYTES-D1');
      window.__db(d => { d.moments.push({ id:'D1', by:'u_aarav', type:'photo', caption:'already sent', hasMedia:true, at: Date.now() }); });
      const q = (id, status, cap) => ({ id, type:'photo', caption:cap, status, createdAt: Date.now(), hasMedia:true, parallel:false });
      localStorage.setItem('pairlum-offline-queue-v1-u_aarav', JSON.stringify([q('U1','uploading','was sending'), q('S1','saving','was saving'), q('D1','uploading','already sent'), q('M1','queued','file is gone')])); }""")
    a.reload(); a.wait_for_timeout(4200)
    st = json.loads(shared(a)); cnt = lambda i: sum(1 for x in st["moments"] if x["id"] == i)
    check(C, "reloaded while sending: shared exactly once", cnt("U1") == 1)
    check(C, "reloaded while saving: shared exactly once", cnt("S1") == 1)
    check(C, "reloaded after it was sent but before the list was updated: still once, one card", cnt("D1") == 1 and a.evaluate("document.querySelectorAll(\"[data-moment-id='D1']\").length") <= 1)
    check(C, "file gone: nothing is published without its media", cnt("M1") == 0)
    card = a.evaluate("(() => { const c = document.querySelector(\"[data-moment-id='M1']\"); return c ? c.textContent : ''; })()")
    check(C, "file gone: the card says so and offers Remove", "no longer on this device" in card and "Remove" in card, card)
    q = json.loads(a.evaluate("localStorage.getItem('pairlum-offline-queue-v1-u_aarav')"))
    check(C, "the waiting list only holds what is really waiting", [x["id"] for x in q] == ["M1"] and q[0]["status"] == "missing", q)
    js_click(a, "[data-moment-id='M1'] [data-remove-moment]"); a.wait_for_timeout(300)
    check(C, "Remove clears the broken item", a.evaluate("!document.querySelector(\"[data-moment-id='M1']\")") and a.evaluate("localStorage.getItem('pairlum-offline-queue-v1-u_aarav')") == "[]")
    # the waiting list itself cannot be saved
    def capture_text(t):
        js_click(a, "[data-action='open-capture']"); a.wait_for_timeout(300); js_click(a, ".capture-type[data-type='text']"); a.wait_for_timeout(150)
        a.fill("#captureTextInput", t); js_click(a, "#captureSubmit")
    a.evaluate("() => { window.__failKeys = ['pairlum-offline-queue']; }"); capture_text("queue write fails"); a.wait_for_timeout(1500)
    st = json.loads(shared(a))
    check(C, "list write fails: marked 'Not saved yet', not shared, with Retry", not any(x.get("caption") == "queue write fails" for x in st["moments"]) and a.evaluate("[...document.querySelectorAll('.moment-status-badge')].some(b => /Not saved yet/.test(b.textContent) && /Retry/.test(b.textContent))"), toast(a))
    a.evaluate("() => { window.__failKeys = []; }"); js_click(a, "[data-retry-moment]"); a.wait_for_timeout(2600)
    st = json.loads(shared(a))
    check(C, "retry after the failure: shared exactly once", sum(1 for x in st["moments"] if x.get("caption") == "queue write fails") == 1)
    # a reload in the middle of a real capture
    capture_text("reloaded mid-send"); a.wait_for_timeout(700); a.reload(); a.wait_for_timeout(4000)
    st = json.loads(shared(a))
    check(C, "real capture, reload mid-way: shared exactly once", sum(1 for x in st["moments"] if x.get("caption") == "reloaded mid-send") == 1)
    ctx.close()

    # ================= case 11 =================
    C = "11 imports and attachments"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    old, new, third = png("old.png", (10, 200, 10)), png("new.png", (10, 10, 200)), png("third.png", (200, 200, 10))
    a.evaluate("() => { const real = HTMLCanvasElement.prototype.toBlob; window.__realToBlob = real; HTMLCanvasElement.prototype.toBlob = function(){ const args = arguments, self = this; setTimeout(() => real.apply(self, args), 900); }; }")
    import_files(a, old, wait=250)                                   # still decoding
    js_click(a, "#importOverlay [data-close-overlay]"); a.wait_for_timeout(100)
    import_files(a, new, wait=2600)
    check(C, "closed and reopened during decoding: only the new file is in the review", a.evaluate(REVIEW_N) == 1, a.evaluate(REVIEW_N))
    js_click(a, "#importNext"); a.wait_for_timeout(2200)
    ms = mems(a)
    check(C, "the old session's file never entered the new import", sum(1 for x in ms if str(x.get("src", "")).startswith("old.png")) == 0 and sum(1 for x in ms if str(x.get("src", "")).startswith("new.png")) == 1, [x.get("src") for x in ms])
    js_click(a, "#importNext"); a.wait_for_timeout(300)
    # restart by choosing again without closing
    js_click(a, "[data-action='open-import']"); a.wait_for_timeout(300)
    a.set_input_files("#importFileInput", old); a.wait_for_timeout(200); a.evaluate("document.getElementById('importFileInput').value = ''"); a.set_input_files("#importFileInput", third); a.wait_for_timeout(2600)
    check(C, "chose again during decoding: one item, from the second choice", a.evaluate(REVIEW_N) == 1)
    keys0 = a.evaluate("window.__idb.keys()"); before = shared(a)
    # the photo files cannot be stored
    a.evaluate("() => { window.__pairlumTestFailMediaPut = () => true; }"); js_click(a, "#importNext"); a.wait_for_timeout(1500)
    check(C, "media write fails: nothing added, no stray files, button works again", shared(a) == before and a.evaluate("window.__idb.keys()") == keys0 and not a.evaluate("document.getElementById('importNext').disabled") and "Add 1" in a.evaluate("document.getElementById('importNext').textContent"), toast(a))
    a.evaluate("() => { window.__pairlumTestFailMediaPut = null; }")
    # the files store, the record does not
    a.evaluate("() => { window.__failKeys = ['pairlum-shared-space-v1']; }"); js_click(a, "#importNext"); a.wait_for_timeout(2200)
    check(C, "record write fails: files are taken back, selection kept, button works again", a.evaluate("window.__idb.keys()") == keys0 and a.evaluate(REVIEW_N) == 1 and not a.evaluate("document.getElementById('importNext').disabled"), (a.evaluate("window.__idb.keys()"), toast(a)))
    a.evaluate("() => { window.__failKeys = []; }"); js_click(a, "#importNext"); a.wait_for_timeout(2400)
    ms = mems(a); t3 = [x for x in ms if str(x.get("src", "")).startswith("third.png")]
    check(C, "the same selection, retried: added exactly once", len(t3) == 1 and sum(1 for x in ms if str(x.get("src", "")).startswith("old.png")) == 0, [x.get("src") for x in ms])
    js_click(a, "#importNext"); a.wait_for_timeout(300)
    a.evaluate("() => { HTMLCanvasElement.prototype.toBlob = window.__realToBlob; }")
    # identity is the content, not the name
    renamed = os.path.join(OUT, "renamed-copy.png"); shutil.copy(third, renamed)
    import_files(a, renamed, wait=1500)
    check(C, "the same photo under a new name is recognised", "already in Our Story" in a.evaluate("document.getElementById('importPickNote').textContent"), a.evaluate("document.getElementById('importPickNote').textContent"))
    s1 = png("same.bmp", (5, 5, 5), size=(64, 64), sub="one"); s2 = png("same.bmp", (250, 5, 5), size=(64, 64), sub="two")
    check(C, "(setup) two different files share a name and a size", os.path.getsize(s1) == os.path.getsize(s2) and sha(open(s1, "rb").read()) != sha(open(s2, "rb").read()))
    import_files(a, s1, wait=1500); js_click(a, "#importNext"); a.wait_for_timeout(1500); js_click(a, "#importNext"); a.wait_for_timeout(300)
    import_files(a, s2, wait=1500)
    check(C, "a different photo with the same name and size is not skipped", a.evaluate(REVIEW_N) == 1, a.evaluate("document.getElementById('importPickNote').textContent"))
    js_click(a, "#importNext"); a.wait_for_timeout(1500)
    check(C, "both same-named photos are kept", sum(1 for x in mems(a) if str(x.get("src", "")).startswith("same.bmp")) == 2)
    js_click(a, "#importNext"); a.wait_for_timeout(300)

    # letter photos
    pics = [png("l%d.png" % i, (40 * i, 80, 120), size=(300, 200)) for i in range(1, 6)]
    broken = os.path.join(OUT, "broken.png"); open(broken, "w").write("this is not a picture")
    a.evaluate("() => { const real = FileReader.prototype.readAsDataURL; window.__realRead = real; FileReader.prototype.readAsDataURL = function(f){ const self = this; setTimeout(() => real.call(self, f), 700); }; }")
    THUMBS = "document.querySelectorAll('#letterPhotoRow .letter-photo-thumb').length"
    js_click(a, "[data-view=letters]"); a.wait_for_timeout(400); js_click(a, "[data-action='open-letter']"); a.wait_for_timeout(400)
    a.set_input_files("#letterPhotoInput", pics[:3]); a.wait_for_timeout(100); a.set_input_files("#letterPhotoInput", pics[3:]); a.wait_for_timeout(2600)
    check(C, "two overlapping selections never exceed three photos", a.evaluate(THUMBS) == 3, a.evaluate(THUMBS))
    a.evaluate("document.getElementById('letterDraftNote').hidden || document.getElementById('letterDraftClear') && document.getElementById('letterDraftClear').click()")
    a.evaluate("document.querySelectorAll('#letterPhotoRow .letter-photo-remove').forEach(() => document.querySelector('#letterPhotoRow .letter-photo-remove').click())"); a.wait_for_timeout(200)
    a.set_input_files("#letterPhotoInput", pics[:2]); a.wait_for_timeout(100)
    js_click(a, "#letterOverlay [data-close-overlay]"); a.wait_for_timeout(100); js_click(a, "[data-action='open-letter']"); a.wait_for_timeout(2400)
    check(C, "closed and reopened during decoding: the old letter's photos do not appear in the new one", a.evaluate(THUMBS) == 0, a.evaluate(THUMBS))
    a.set_input_files("#letterPhotoInput", broken); a.wait_for_timeout(1500)
    check(C, "a file that is not a picture: said so, nothing added, the add tile still works", "could not be opened" in toast(a) and a.evaluate(THUMBS) == 0 and a.evaluate("!!document.getElementById('letterPhotoInput')"), toast(a))
    a.evaluate("() => { FileReader.prototype.readAsDataURL = window.__realRead; }")
    a.fill("#letterBodyInput", "a letter with a picture"); a.set_input_files("#letterPhotoInput", pics[0]); a.wait_for_timeout(900)
    a.reload(); a.wait_for_timeout(1300); js_click(a, "[data-action='open-letter']"); a.wait_for_timeout(900)
    check(C, "a draft's photo is kept privately and comes back with the words", a.evaluate(THUMBS) == 1 and a.input_value("#letterBodyInput") == "a letter with a picture" and "data:image" not in (shared(a) or ""))
    check(C, "no script errors", not errs, errs[:2])
    ctx.close(); br.close()
finish("test_6_backup_upload_import")
