"""Review cases 2, 3 and 4: restore that fails, saves that fail before a
delete, and saved data that cannot be read. Failures are INJECTED (a write
is made to throw); they are not a measured full phone."""
import sys, os, json, zipfile
from playwright.sync_api import sync_playwright
from common import *
U = serve(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)

ADD_MEMS = """() => window.__db(d => {
  d.memories.push({ id:'MEMX', by:'u_aarav', type:'photo', date:'2025-03-04', caption:'mine one', preview:true, at:1 });
  d.memories.push({ id:'MEMY', by:'u_aarav', type:'photo', date:'2025-03-05', caption:'mine two', preview:true, at:2 });
  d.memories.push({ id:'MEMP', by:'u_mira',  type:'photo', date:'2025-03-06', caption:'hers', preview:true, at:3 });
  d.prefs.u_mira = { media: { saveOriginals: true, downloadVideo: true } }; })"""

def export_zip(pg, path):
    js_click(pg, "[data-action='open-privacy']"); pg.wait_for_timeout(300)
    js_click(pg, "#privacyExportBtn"); pg.wait_for_timeout(200)
    with pg.expect_download() as dl: js_click(pg, "#exportConfirmBtn")
    dl.value.save_as(path); pg.wait_for_timeout(200)
    js_click(pg, "#privacyOverlay [data-close-overlay]"); pg.wait_for_timeout(200)
def try_restore(pg, path, press=True):
    js_click(pg, "[data-action='open-privacy']"); pg.wait_for_timeout(300)
    js_click(pg, "#privacyRestoreBtn"); pg.wait_for_timeout(200)
    pg.set_input_files("#restoreFile", path); pg.wait_for_timeout(600)
    enabled = not pg.evaluate("document.getElementById('restoreGo').disabled")
    if press and enabled: js_click(pg, "#restoreGo"); pg.wait_for_timeout(1200)
    try: text = pg.evaluate("document.getElementById('restoreStatus') ? document.getElementById('restoreStatus').innerText : 'RELOADED'")
    except Exception: text = "RELOADED"
    return enabled, text
def snapshot(pg):
    return pg.evaluate("""async () => { const ks = await window.__idb.keys(); const o = {}; for(const k of ks) o[k] = await window.__idb.sha(k); return { shared: localStorage.getItem('pairlum-shared-space-v1'), media: o }; }""")

with sync_playwright() as p:
    br = launch(p); errs = []

    # ================= case 2: restore =================
    C = "02 restore"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    a.evaluate(ADD_MEMS)
    a.evaluate("async () => { await window.__idb.put('MEMX', 'OLD-PHOTO-X'); await window.__idb.put('MEMY', 'OLD-PHOTO-Y'); await window.__idb.put('MEMP', 'HER-PHOTO'); }")
    a.reload(); a.wait_for_timeout(1200)
    backup = os.path.join(OUT, "backup.zip"); export_zip(a, backup)
    z = zipfile.ZipFile(backup); data = json.loads(z.read("pairlum.json"))
    check(C, "backup holds the three photos", {"MEMX", "MEMY", "MEMP"} <= {m["id"] for m in data["media"]}, [m["id"] for m in data["media"]])
    # the device moves on: the same photo ids now hold newer bytes, and there is newer writing
    a.evaluate("async () => { await window.__idb.put('MEMX', 'CURRENT-PHOTO-X'); await window.__idb.put('MEMY', 'CURRENT-PHOTO-Y'); }")
    a.evaluate("""() => { window.__db(d => { d.notes.unshift({ id:'LATER', by:'u_aarav', text:'written after the backup', at: Date.now() }); }); localStorage.setItem('pairlum-letter-draft-v1-u_aarav', JSON.stringify({ title:'draft', body:'half a letter', at: Date.now() })); }""")
    a.reload(); a.wait_for_timeout(1200)
    before = snapshot(a)

    a.evaluate("() => { window.__pairlumTestFailMediaPut = (key, i) => i === 1; }")   # first file goes in, second is refused
    enabled, text = try_restore(a, backup)
    after = snapshot(a)
    check(C, "a media write fails: current photos keep their bytes", after["media"] == before["media"], (sorted(after["media"]), text))
    check(C, "a media write fails: the saved record is unchanged", after["shared"] == before["shared"])
    check(C, "a media write fails: the message is true", "exactly as they were" in text, text)
    a.evaluate("() => { window.__pairlumTestFailMediaPut = null; }")
    js_click(a, "#privacyOverlay [data-close-overlay]")

    a.evaluate("() => { window.__pairlumTestFailCommit = true; }")                       # media goes in, the final save is refused
    enabled, text = try_restore(a, backup)
    a.wait_for_timeout(500); after = snapshot(a)
    check(C, "the final save fails: current photos keep their bytes, staged copies are removed", after["media"] == before["media"], sorted(after["media"]))
    check(C, "the final save fails: record and settings unchanged", after["shared"] == before["shared"])
    check(C, "the final save fails: the message is true", "exactly as they were" in text, text)
    a.evaluate("() => { window.__pairlumTestFailCommit = false; }")
    js_click(a, "#privacyOverlay [data-close-overlay]")

    # archives that must be refused before anything is touched
    raw = open(backup, "rb").read()
    names = z.namelist(); pj = z.read("pairlum.json"); others = [(n, z.read(n)) for n in names if n != "pairlum.json"]
    def variant(mut): d = json.loads(pj); mut(d); return make_zip([("pairlum.json", json.dumps(d).encode())] + others)
    bad = {
      "one changed byte in a photo (checksum)": raw.replace(b"OLD-PHOTO-X", b"XLD-PHOTO-X"),
      "truncated file": raw[: len(raw) // 2],
      "not a zip": b"hello, not a backup",
      "unsupported format version": variant(lambda d: d.__setitem__("version", 99)),
      "space in an unknown version": variant(lambda d: d["shared"].__setitem__("v", 7)),
      "malformed collection": variant(lambda d: d["shared"].__setitem__("moments", {"oops": 1})),
      "entry without an id": variant(lambda d: d["shared"]["notes"].append({"text": "no id"})),
      "time that is not a number": variant(lambda d: d["shared"]["notes"].append({"id": "n9", "by": "u_aarav", "text": "x", "at": "yesterday"})),
      "listed media file missing from the zip": make_zip([("pairlum.json", pj)] + others[:-1]),
      "referenced media not listed": variant(lambda d: d.__setitem__("media", [m for m in d["media"] if m["id"] != "MEMX"])),
      "same file twice": make_zip([("pairlum.json", pj)] + others + [others[-1]]) if False else variant(lambda d: d["media"].append(dict(d["media"][0]))),
    }
    for label, blob in bad.items():
        path = os.path.join(OUT, "bad.zip"); open(path, "wb").write(blob)
        enabled, text = try_restore(a, path, press=False)
        ok = (not enabled) and "Nothing was changed" in text and snapshot(a) == before
        check(C, "refused untouched: " + label, ok, text)
        js_click(a, "#privacyOverlay [data-close-overlay]")

    enabled, text = try_restore(a, backup)
    a.wait_for_timeout(2500)
    st = json.loads(shared(a))
    check(C, "success: the record is the backup's", not any(n.get("id") == "LATER" for n in st["notes"]) and any(m["id"] == "MEMX" for m in st["memories"]))
    got = a.evaluate("async () => window.__idb.text(await window.__idb.find('MEMX'))")
    check(C, "success: the app now reads the backup's photo", got == "OLD-PHOTO-X", got)
    check(C, "success: the letter in progress is still there", "half a letter" in (a.evaluate("localStorage.getItem('pairlum-letter-draft-v1-u_aarav')") or ""))
    a.reload(); a.wait_for_timeout(4200)
    got2 = a.evaluate("async () => window.__idb.text(await window.__idb.find('MEMX'))")
    keys = a.evaluate("window.__idb.keys()")
    check(C, "success survives a reload", got2 == "OLD-PHOTO-X")
    check(C, "after it loads, the replaced older files are cleared", "MEMX" not in keys and not json.loads(shared(a)).get("mediaPrune"), keys)
    ctx.close()

    # ================= case 3: a save that fails must not destroy anything =================
    C = "03 failed save"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    a.evaluate(ADD_MEMS)
    a.evaluate("""async () => { await window.__idb.put('MEMX', 'MY-PHOTO'); await window.__idb.put('MEMY', 'MY-PHOTO-2'); await window.__idb.put('MEMP', 'HER-PHOTO'); await window.__idb.put('AMB1', 'MY-PLACE-SOUND', 'audio/webm');
      window.__db(d => { d.ambient.u_aarav = { id:'AMB1', label:'terrace', secs:5, at:1 };
      d.requests.push({ id:'REQ1', by:'u_mira', title:'Reassurance', note:'', sentAt: Date.now(), status:'delivered', noReply:false }); });
      localStorage.setItem('pairlum-letter-draft-v1-u_aarav', JSON.stringify({ title:'private', body:'unsent words', at: Date.now() })); }""")
    a.reload(); a.wait_for_timeout(1200)
    FAIL = "() => { window.__failKeys = ['pairlum-shared-space-v1']; }"; OKAY = "() => { window.__failKeys = []; }"

    # removing a memory
    js_click(a, "[data-view=story]"); a.wait_for_timeout(700)
    js_click(a, "[data-tl-id='MEMX']"); a.wait_for_timeout(400)
    a.fill("#memoryViewCaptionInput", "edited caption"); a.evaluate(FAIL)
    js_click(a, "#memoryViewSave"); a.wait_for_timeout(300)
    check(C, "edit fails: sheet stays open with the typed text", a.evaluate("document.getElementById('memoryOverlay').classList.contains('is-open')") and a.input_value("#memoryViewCaptionInput") == "edited caption")
    check(C, "edit fails: says it was not saved, not 'Saved'", "Couldn't save" in toast(a) and "moved to" not in toast(a), toast(a))
    js_click(a, "#memoryViewDelete"); js_click(a, "#memoryViewDelete"); a.wait_for_timeout(400)
    check(C, "remove fails: the photo's bytes are still there", a.evaluate("window.__idb.text('MEMX')") == "MY-PHOTO")
    check(C, "remove fails: the record is still there", any(m["id"] == "MEMX" for m in json.loads(shared(a))["memories"]))
    a.evaluate(OKAY); a.keyboard.press("Escape"); a.wait_for_timeout(200)

    # the sound of my place: replace, then remove
    js_click(a, "[data-view=home]"); a.wait_for_timeout(400)
    js_click(a, "#ambientShareBtn"); a.wait_for_timeout(1500); js_click(a, "#ambientRecStop"); a.wait_for_timeout(700)
    a.evaluate(FAIL); js_click(a, "#ambientSendBtn"); a.wait_for_timeout(900)
    keys = a.evaluate("window.__idb.keys()"); st = json.loads(shared(a))
    check(C, "replace fails: the shared recording is untouched", a.evaluate("window.__idb.text('AMB1')") == "MY-PLACE-SOUND" and st["ambient"]["u_aarav"]["id"] == "AMB1")
    check(C, "replace fails: the unsaved copy is taken back", not any(k.startswith("amb_") for k in keys), keys)
    check(C, "replace fails: the new recording is still in the sheet to retry", a.evaluate("!document.getElementById('ambientRec').hidden") and "Couldn't save" in toast(a), toast(a))
    js_click(a, "#ambientRecCancel"); a.wait_for_timeout(200)
    js_click(a, "#ambientRemoveBtn"); a.wait_for_timeout(400)
    check(C, "remove fails: recording and record both stay", a.evaluate("window.__idb.text('AMB1')") == "MY-PLACE-SOUND" and json.loads(shared(a))["ambient"].get("u_aarav", {}).get("id") == "AMB1")

    # a reply to "I need you"
    js_click(a, "[data-req-reply='here']"); a.wait_for_timeout(300)
    rq = [r for r in json.loads(shared(a))["requests"] if r["id"] == "REQ1"][0]
    check(C, "support reply fails: nothing recorded, the request is still on screen, no 'Sent'", not rq.get("reply") and a.evaluate("!document.getElementById('needIncoming').hidden") and "Sent" not in toast(a), toast(a))

    # a note
    a.evaluate("() => { document.getElementById('noteInput').value = 'do not lose me'; document.getElementById('noteForm').requestSubmit(); }"); a.wait_for_timeout(300)
    check(C, "note fails: the words stay in the box", a.input_value("#noteInput") == "do not lose me" and "Sent" not in toast(a), toast(a))
    a.evaluate(OKAY)

    # a setting
    a.evaluate("() => { window.__failKeys = ['pairlum-space-settings-v1']; }")
    js_click(a, "[data-view=us]"); a.wait_for_timeout(400); js_click(a, "#soundToggle"); a.wait_for_timeout(300)
    check(C, "setting fails: the person is told it will not last", "could not be saved" in toast(a), toast(a))
    a.evaluate(OKAY)

    # account deletion
    before = snapshot(a)
    js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(300); js_click(a, "#privacyDeleteBtn"); a.wait_for_timeout(200)
    a.fill("#deleteConfirmInput", "DELETE"); a.evaluate(FAIL); js_click(a, "#deleteConfirmBtn"); a.wait_for_timeout(900)
    after = snapshot(a)
    check(C, "delete fails: no media was removed", after["media"] == before["media"])
    check(C, "delete fails: record unchanged, draft kept, message true", after["shared"] == before["shared"] and a.evaluate("localStorage.getItem('pairlum-letter-draft-v1-u_aarav')") is not None and "was not deleted" in toast(a), toast(a))
    a.evaluate(OKAY); js_click(a, "#deleteConfirmBtn"); a.wait_for_timeout(3200)
    st = json.loads(shared(a)); keys = a.evaluate("window.__idb.keys()")
    check(C, "delete succeeds: my records and my files are gone", not any(m.get("by") == "u_aarav" and not m.get("demo") for m in st["memories"]) and "MEMX" not in keys and "MEMY" not in keys and "AMB1" not in keys, keys)
    check(C, "delete succeeds: my private letter draft is gone", a.evaluate("localStorage.getItem('pairlum-letter-draft-v1-u_aarav')") is None)
    check(C, "delete succeeds: partner's record and photo are untouched", any(m["id"] == "MEMP" for m in st["memories"]) and a.evaluate("window.__idb.text('MEMP')") == "HER-PHOTO")
    ctx.close()

    # ================= case 4: saved data that cannot be read =================
    C = "04 damaged data"
    for label, raw_val, word in [("damaged JSON", '{"v":1,"moments":[{"id":"real1"', "damaged"),
                                 ("unsupported version", json.dumps({"v": 7, "moments": [{"id": "future"}]}), "different version"),
                                 ("malformed collection", json.dumps({"v": 1, "moments": "oops", "notes": [{"id": "keepme", "text": "precious"}]}), "moments")]:
        ctx = new_context(br); a = open_page(ctx, U, errs)
        a.evaluate("v => localStorage.setItem('pairlum-shared-space-v1', v)", raw_val)
        a.reload(); a.wait_for_timeout(1200)
        check(C, label + ": the original bytes are untouched", shared(a) == raw_val)
        check(C, label + ": recovery screen is shown and explains", a.evaluate("!!document.getElementById('recoveryScreen')") and word in a.evaluate("document.getElementById('recoveryScreen').innerText"), a.evaluate("(document.getElementById('recoveryScreen')||{}).innerText"))
        # the app behind it cannot write over the data, even if a handler is reached
        a.evaluate("() => { document.getElementById('noteInput').value = 'x'; document.getElementById('noteForm').requestSubmit(); }"); a.wait_for_timeout(300)
        check(C, label + ": nothing can be saved over it", shared(a) == raw_val)
        check(C, label + ": 'start new' is locked until a copy is downloaded", a.evaluate("document.getElementById('recoveryFresh').disabled"))
        with a.expect_download() as dl: js_click(a, "#recoveryDownload")
        pth = os.path.join(OUT, "unreadable.txt"); dl.value.save_as(pth)
        check(C, label + ": the downloaded copy is byte-for-byte the stored data", open(pth, "rb").read().decode() == raw_val)
        ctx.close()
    # a brand-new space is not mistaken for damage
    ctx = new_context(br); a = open_page(ctx, U, errs)
    check(C, "a clean new space starts normally", a.evaluate("!document.getElementById('recoveryScreen')") and json.loads(shared(a))["v"] == 1)
    good = os.path.join(OUT, "good.zip"); export_zip(a, good)
    a.evaluate("() => localStorage.setItem('pairlum-shared-space-v1', '{broken')"); a.reload(); a.wait_for_timeout(1200)
    a.set_input_files("#recoveryRestoreFile", good); a.wait_for_timeout(600); js_click(a, "#recoveryRestoreGo"); a.wait_for_timeout(2600)
    check(C, "recovery by restoring a backup works", a.evaluate("!document.getElementById('recoveryScreen')") and json.loads(shared(a))["v"] == 1)
    check(C, "the unreadable data was kept aside, not thrown away", a.evaluate("localStorage.getItem('pairlum-shared-space-v1:unreadable-copy')") == "{broken")
    check(C, "no script errors", not errs, errs[:2])
    ctx.close(); br.close()
finish("test_4_restore_delete_damage")
