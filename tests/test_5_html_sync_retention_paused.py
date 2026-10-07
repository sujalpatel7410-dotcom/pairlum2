"""Review cases 5, 6, 7 and 8: typed text stays text, two partners' changes
both survive, nothing is trimmed away, and a paused space cannot be changed."""
import sys, os, json, zipfile
from playwright.sync_api import sync_playwright
from common import *
U = serve(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
XSS = "() => { window.X = () => { window.__xss = (window.__xss || 0) + 1; }; }"
BAD = "document.querySelectorAll('img[src=\"x\"], #xn, [onerror]').length + (window.__xss || 0)"
ACTIONS = "[...new Set([...document.querySelectorAll('[data-action]')].map(e => e.getAttribute('data-action')))]"

def crawl(pg, label, C):
    """Every view, every sheet that has an opener, the pairing and privacy sub-screens and the Book."""
    worst = 0; seen = []
    def look(where):
        nonlocal worst
        n = pg.evaluate(BAD)
        if n: seen.append(where)
        worst = max(worst, n)
    for v in ["home", "story", "letters", "us"]:
        js_click(pg, "[data-view=%s]" % v); pg.wait_for_timeout(350); look("view " + v)
    for act in pg.evaluate(ACTIONS):
        if act in ("toast",): continue
        js_click(pg, "[data-action='%s']" % act); pg.wait_for_timeout(300); look("action " + act)
        for sub in ["#privacyExportBtn", "#exportBack", "#privacyRestoreBtn", "#restoreBack", "#privacyDeleteBtn", "#deleteBack",
                    "#pairingDisconnectBtn", "#disconnectBack", "#pairingLeaveBtn", "#leaveBack"]:
            if js_click(pg, sub): pg.wait_for_timeout(120); look(act + " > " + sub)
        pg.evaluate("document.querySelectorAll('.overlay.is-open [data-close-overlay]').forEach(b => b.click())"); pg.wait_for_timeout(150)
    # every moment that can be opened, with its voice, write-up and thread; and the voice search with all its results
    for mid in pg.evaluate("[...new Set([...document.querySelectorAll('[data-open-moment]')].map(e => e.getAttribute('data-open-moment')))].slice(0, 6)") + pg.evaluate("[...document.querySelectorAll('.tl-voice-badge')].slice(0, 6).map(b => b.closest('[data-tl-id]').getAttribute('data-tl-id'))"):
        pg.evaluate("id => { const b = document.querySelector('[data-open-moment=\"' + id + '\"]') || document.querySelector('[data-tl-id=\"' + id + '\"]'); if(b) b.click(); }", mid); pg.wait_for_timeout(350)
        pg.evaluate("document.querySelectorAll('#momentOverlay details').forEach(d => d.open = true)"); look("moment " + mid)
        pg.evaluate("document.querySelectorAll('.overlay.is-open [data-close-overlay]').forEach(b => b.click())"); pg.wait_for_timeout(120)
    if js_click(pg, "#voiceFindBtn"):
        pg.wait_for_timeout(400); look("voice search"); pg.fill("#voiceFindInput", "img"); pg.wait_for_timeout(300); look("voice search results")
        pg.evaluate("document.querySelectorAll('.overlay.is-open [data-close-overlay]').forEach(b => b.click())"); pg.wait_for_timeout(120)
    for sel in ["#needHistoryBtn", "#dqArchiveBtn", "#bookTeaserBtn", ".bkv-open", "[data-book-open]"]:
        if js_click(pg, sel): pg.wait_for_timeout(500); look("open " + sel); pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    look("end")
    check(C, label + ": typed text never becomes page elements or runs", worst == 0, seen[:6])

with sync_playwright() as p:
    br = launch(p); errs = []

    # ================= case 5 =================
    C = "05 html text"
    ctx = new_context(br); ctx.add_init_script("window.X = () => { window.__xss = (window.__xss || 0) + 1; };")
    a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    NAME = "<img src=x onerror=X()>"
    js_click(a, "[data-action='open-profile']"); a.wait_for_timeout(300)
    a.fill("#profileName", NAME); a.fill("#profileCity", "<img src=x onerror=X()> City")
    a.evaluate("document.getElementById('profileForm').requestSubmit()"); a.wait_for_timeout(500)
    saved = json.loads(shared(a))["profiles"]["u_aarav"]
    check(C, "the profile form accepted the HTML-like name as typed", saved["name"] == NAME, saved)
    js_click(b, "[data-action='open-customize']"); b.wait_for_timeout(300)
    b.fill("#customNick", "<i id=xn>x</i>"); b.evaluate("document.getElementById('customNickForm').requestSubmit()"); b.wait_for_timeout(400)
    js_click(b, "#customizeOverlay [data-close-overlay]")
    check(C, "partner's side shows the name literally", NAME in a.evaluate("document.getElementById('usCoupleNames').textContent"))
    crawl(a, "own view after saving", C)
    b.reload(); b.wait_for_timeout(1200); crawl(b, "partner's view (with an HTML-like nickname)", C)
    # each pairing state has its own screen
    for step, sel in [("not started", ["[data-action='open-pairing']", "#pairingDisconnectBtn", "#disconnectUnderstand", "#disconnectConfirmBtn", "[data-action='open-pairing']"]),
                      ("waiting", ["#pairingCreateBtn"]), ("joined again", ["#pairingSimulateBtn"]), ("left", ["#pairingLeaveBtn", "#leaveConfirmBtn", "[data-action='open-pairing']"])]:
        for s_ in sel: js_click(b, s_); b.wait_for_timeout(200)
        check(C, "pairing screen '" + step + "' shows the name as text", b.evaluate(BAD) == 0 and "<" in b.evaluate("document.getElementById('pairingBody').innerText + document.getElementById('spacePausedText').textContent"))
    ctx.close()

    # every stored string, as a restore or a partner could supply it, in the richest space available
    ctx = new_context(br); ctx.add_init_script("window.X = () => { window.__xss = (window.__xss || 0) + 1; };")
    d = open_page(ctx, U + "?demo=year&fresh=1", errs, wait=1800)
    n = d.evaluate("""() => { const KEY = 'demoyear:pairlum-shared-space-v1', P = '<img src=x onerror=X()>';
      const SKIP = new Set(['id','by','type','date','openDate','plan','since','status','reply','timezone','birthday','freq','mode','sharer','listener','dateSource','src','hash','photo','cover','size','kind','preview','relStart','spaceTz','song','photos','feel','dqPick','days','prefs','membership','mediaGens','ops','quiz','sleep','hold','stats']);
      let count = 0;
      const walk = (o) => { for(const k of Object.keys(o)){ if(SKIP.has(k)) continue; const v = o[k];
        if(typeof v === 'string'){ o[k] = P + ' ' + v.slice(0, 20); count++; } else if(v && typeof v === 'object') walk(v); } };
      const db = JSON.parse(localStorage.getItem(KEY)); walk(db); localStorage.setItem(KEY, JSON.stringify(db)); return count; }""")
    check(C, "poisoned every free-text field in a year of data (over 1,000 strings)", n > 1000, n)
    for who in ["", "&as=mira"]:
        pg = open_page(ctx, U + "?demo=year" + who, errs, wait=1800)
        crawl(pg, "poisoned year, " + ("partner" if who else "own") + " view", C)
        bk = pg.evaluate("(() => { const d = window.PairlumBookBridge.data(); return JSON.stringify(d).indexOf('<img') > -1; })()")
        js_click(pg, "[data-view=us]"); pg.wait_for_timeout(600)
        check(C, "poisoned year, Book pages (" + ("partner" if who else "own") + "): text only", bk and pg.evaluate(BAD) == 0)
        pg.close()
    ctx.close()

    # ================= case 6 =================
    C = "06 both changes survive"
    ctx = new_context(br); a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    def note(pg, t): pg.evaluate("t => { document.getElementById('noteInput').value = t; document.getElementById('noteForm').requestSubmit(); }", t)
    def someday(pg, t): pg.evaluate("t => { document.getElementById('somedayInput').value = t; document.getElementById('somedayForm').requestSubmit(); }", t)
    old = shared(a)
    note(b, "B-NOTE"); b.wait_for_timeout(250)
    a.evaluate("s => { window.__pairlumTestStaleRead = s; }", old)        # A's save uses the copy from before B's note
    # read storage in the same instant as A's save, before B's tab has had a chance to react
    mid = json.loads(a.evaluate("() => { document.getElementById('somedayInput').value = 'A-SOMEDAY'; document.getElementById('somedayForm').requestSubmit(); return localStorage.getItem('pairlum-shared-space-v1'); }"))
    check(C, "the interleaving really overwrote B's note for an instant", not any(n.get("text") == "B-NOTE" for n in mid["notes"]) and any(x.get("text") == "A-SOMEDAY" for x in mid["someday"]))
    a.wait_for_timeout(700)
    st = json.loads(shared(a))
    check(C, "create vs create: both are in storage afterwards", any(n.get("text") == "B-NOTE" for n in st["notes"]) and any(x.get("text") == "A-SOMEDAY" for x in st["someday"]))
    check(C, "the note is there once, not twice", sum(1 for n in st["notes"] if n.get("text") == "B-NOTE") == 1)
    # an edit and a removal against a create
    sid = [x for x in st["someday"] if x.get("text") == "A-SOMEDAY"][0]["id"]
    old = shared(b)
    js_click(a, "[data-someday-toggle='%s']" % sid); a.wait_for_timeout(250)                      # A edits (marks done)
    b.evaluate("s => { window.__pairlumTestStaleRead = s; }", old)
    b.evaluate("() => { document.getElementById('addDateTitle').value = 'B-DATE'; document.getElementById('addDateInput').value = '2026-12-01'; document.getElementById('addDateForm').requestSubmit(); }")
    b.wait_for_timeout(700); st = json.loads(shared(a))
    check(C, "edit vs create: the edit and the new date both hold", [x for x in st["someday"] if x["id"] == sid][0].get("done") is True and any(x.get("title") == "B-DATE" for x in st["dates"]))
    old = shared(a)
    js_click(b, "[data-view=us]"); b.wait_for_timeout(300)
    did = [x for x in st["dates"] if x.get("title") == "B-DATE"][0]["id"]
    js_click(b, "[data-remove-date='%s']" % did); b.wait_for_timeout(250)                         # B removes
    a.evaluate("s => { window.__pairlumTestStaleRead = s; }", old); note(a, "A-NOTE-2"); a.wait_for_timeout(700)
    st = json.loads(shared(a))
    check(C, "removal vs create: the removal sticks and the note is kept", not any(x.get("id") == did for x in st["dates"]) and any(n.get("text") == "A-NOTE-2" for n in st["notes"]))
    # real tabs acting in the same instant, 15 rounds
    for pg, fn in [(a, "someday"), (b, "note")]:
        pg.evaluate("""fn => { const T = Math.ceil((Date.now() + 500) / 100) * 100; for(let i = 0; i < 15; i++){ setTimeout(() => {
            if(fn === 'note'){ document.getElementById('noteInput').value = 'burst-note-' + i; document.getElementById('noteForm').requestSubmit(); }
            else { document.getElementById('somedayInput').value = 'burst-someday-' + i; document.getElementById('somedayForm').requestSubmit(); } }, T - Date.now() + i * 60); } }""", fn)
    a.wait_for_timeout(3200); st = json.loads(shared(a))
    got = (sum(1 for n in st["notes"] if str(n.get("text")).startswith("burst-note-")), sum(1 for x in st["someday"] if str(x.get("text")).startswith("burst-someday-")))
    check(C, "two real tabs saving at the same moments: all 30 changes present, none doubled", got == (15, 15), got)
    ctx.close()

    # ================= case 7 =================
    C = "07 nothing trimmed"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    a.evaluate("() => { for(let i = 0; i < 105; i++){ document.getElementById('noteInput').value = 'kept-note-' + i; document.getElementById('noteForm').requestSubmit(); } }")
    a.wait_for_timeout(600)
    js_click(a, "[data-action='open-dna']"); a.wait_for_timeout(400)
    for t in a.evaluate("[...document.querySelectorAll('[data-dna-tab]')].map(e => e.getAttribute('data-dna-tab'))"):
        js_click(a, "[data-dna-tab='%s']" % t); a.wait_for_timeout(150)
        if a.evaluate("!!document.querySelector('[data-dna-add=\"collection\"]')"): break
    a.evaluate("() => { const f = document.querySelector('[data-dna-add=\"collection\"]'); const ins = f.querySelectorAll('input[type=text]'); ins[ins.length - 1].value = 'Kept list'; f.requestSubmit(); }"); a.wait_for_timeout(300)
    for i in range(104):
        a.evaluate("i => { const f = document.querySelector('[data-dna-add=\"collitem\"]'); f.querySelector('input[type=text]').value = 'kept-item-' + i; f.requestSubmit(); }", i)
    a.wait_for_timeout(400)
    a.reload(); a.wait_for_timeout(1300); st = json.loads(shared(a))
    notes_n = sum(1 for n in st["notes"] if str(n.get("text")).startswith("kept-note-"))
    items_n = max([len(c.get("items") or []) for c in st["dna"].get("collections", [])] or [0])
    check(C, "105 notes are all still saved after a reload", notes_n == 105, notes_n)
    check(C, "104 collection entries are all still saved after a reload", items_n == 104, items_n)
    check(C, "the screen draws the newest notes and offers the earlier ones", a.evaluate("document.querySelectorAll('#notesRow .note-pill').length") <= 42 and a.evaluate("!!document.querySelector('.note-pill--more')"))
    js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(300); js_click(a, "#privacyExportBtn"); a.wait_for_timeout(200)
    with a.expect_download() as dl: js_click(a, "#exportConfirmBtn")
    pth = os.path.join(OUT, "retention.zip"); dl.value.save_as(pth)
    ex = json.loads(zipfile.ZipFile(pth).read("pairlum.json"))["shared"]
    check(C, "the export carries all of them", sum(1 for n in ex["notes"] if str(n.get("text")).startswith("kept-note-")) == 105 and max(len(c.get("items") or []) for c in ex["dna"]["collections"]) == 104)
    ctx.close()

    # ================= case 8 =================
    C = "08 paused"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    a.evaluate("""() => window.__db(d => { d.memories.push({ id:'MEMX', by:'u_aarav', type:'photo', date:'2025-03-04', caption:'before', preview:true, at:1 });
      for(let i = 0; i < 60; i++) d.notes.push({ id:'cap' + i, by:'u_aarav', text:'cap ' + i, at: i });
      d.someday.push({ id:'SD1', by:'u_aarav', text:'one day', done:false, at:1 }); d.dates.push({ id:'D1', by:'u_aarav', title:'a date', month:5, day:5 });
      d.plans.push({ id:'P1', by:'u_aarav', title:'a plan', at: Date.now() + 86400000 }); })""")
    a.evaluate("window.__idb.put('MEMX', 'PHOTO')"); a.reload(); a.wait_for_timeout(1200)
    js_click(a, "[data-action='open-pairing']"); a.wait_for_timeout(300)
    for s_ in ["#pairingDisconnectBtn", "#disconnectUnderstand", "#disconnectConfirmBtn"]: js_click(a, s_); a.wait_for_timeout(200)
    check(C, "the space is paused", "paused" in toast(a).lower() or a.evaluate("!document.getElementById('spacePausedNotice').hidden"))
    base = shared(a)
    def blocked(name, action):
        try: a.evaluate(action)
        except Exception as e: check(C, "while paused, blocked: " + name, False, "test could not act: " + str(e)[:120]); return
        a.wait_for_timeout(220)
        check(C, "while paused, blocked: " + name, shared(a) == base, toast(a))
        a.evaluate("document.querySelectorAll('.overlay.is-open [data-close-overlay]').forEach(b => b.click())"); a.wait_for_timeout(80)
    blocked("add a note when 60 already exist (replacement at the old limit)", "() => { document.getElementById('noteInput').value = 'new'; document.getElementById('noteForm').requestSubmit(); }")
    blocked("add a someday", "() => { document.getElementById('somedayInput').value = 'new'; document.getElementById('somedayForm').requestSubmit(); }")
    blocked("toggle a someday", "() => document.querySelector(\"[data-someday-toggle='SD1']\").click()")
    blocked("remove a someday", "() => document.querySelector(\"[data-someday-remove='SD1']\").click()")
    blocked("add a date", "() => { document.getElementById('addDateTitle').value = 'x'; document.getElementById('addDateInput').value = '2026-12-01'; document.getElementById('addDateForm').requestSubmit(); }")
    blocked("remove a date", "() => document.querySelector(\"[data-remove-date='D1']\").click()")
    blocked("remove a plan", "() => document.querySelector(\"[data-plan-remove='P1']\").click()")
    blocked("clear the reunion date", "() => document.getElementById('reunionClear').click()")
    blocked("edit an existing memory's caption", "() => { document.querySelector(\"[data-view=story]\").click(); document.querySelector(\"[data-tl-id='MEMX']\").click(); document.getElementById('memoryViewCaptionInput').value = 'after'; document.getElementById('memoryViewSave').click(); }")
    blocked("remove a memory", "() => { document.querySelector(\"[data-tl-id='MEMX']\").click(); document.getElementById('memoryViewDelete').click(); document.getElementById('memoryViewDelete').click(); }")
    check(C, "while paused: the memory's photo was not removed either", a.evaluate("window.__idb.text('MEMX')") == "PHOTO")
    blocked("edit an existing chapter's title", "() => { document.querySelector('[data-chapter-edit]').click(); document.getElementById('chapterTitleInput').value = 'Renamed'; document.getElementById('chapterSave').click(); }")
    blocked("add a chapter", "() => { document.getElementById('addChapterBtn').click(); document.getElementById('chapterTitleInput').value = 'New'; document.getElementById('chapterDateInput').value = '2024-01-01'; document.getElementById('chapterSave').click(); }")
    blocked("change a fact about me", "() => { document.querySelector(\"[data-action='open-dna']\"); const i = document.querySelector('[data-fact]'); if(!i) throw new Error('no fact field'); i.value = 'changed'; i.dispatchEvent(new Event('change', { bubbles:true })); }")
    blocked("say how today feels", "() => document.querySelector('[data-feel]').click()")
    blocked("love a moment", "() => document.querySelector('[data-heart-id]').click()")
    blocked("answer today's question", "() => { const i = document.getElementById('dqAnswerInput'); i.value = 'an answer'; i.dispatchEvent(new Event('input', { bubbles:true })); document.getElementById('dqRevealBtn').click(); }")
    blocked("save my profile", "() => { document.querySelector(\"[data-action='open-profile']\").click(); document.getElementById('profileName').value = 'Changed'; document.getElementById('profileForm').requestSubmit(); }")
    blocked("say good night", "() => document.getElementById('sleepBtn').click()")
    blocked("change the plan (membership)", "() => { document.querySelector(\"[data-action='open-membership']\").click(); const b = document.querySelector('#membershipOverlay [data-plan-pick], #membershipOverlay .plan-card button'); if(!b) throw new Error('no plan button'); b.click(); const c = document.getElementById('planConfirm'); if(!c) throw new Error('no confirm'); c.click(); }")
    js_click(a, "[data-action='open-dna']"); a.wait_for_timeout(300)
    for t in a.evaluate("[...document.querySelectorAll('[data-dna-tab]')].map(e => e.getAttribute('data-dna-tab'))"):
        js_click(a, "[data-dna-tab='%s']" % t); a.wait_for_timeout(150)
        if a.evaluate("!!document.querySelector('[data-dna-add]')"): break
    blocked("add to Our DNA", "() => { const f = document.querySelector('[data-dna-add]'); if(!f) throw new Error('no add form'); const ins = f.querySelectorAll('input[type=text]'); ins[ins.length - 1].value = 'new thing'; f.requestSubmit(); }")
    # the documented exception
    a.evaluate("() => { document.querySelector(\"[data-action='open-privacy']\").click(); document.getElementById('liveRequestsToggle').click(); }"); a.wait_for_timeout(300)
    st = json.loads(shared(a))
    check(C, "documented exception: my own privacy switch still saves", st["prefs"].get("u_aarav", {}).get("liveRequests") is False)
    b0 = json.loads(base)
    diff = [k for k in b0 if k not in ("prefs", "ops", "rev") and st.get(k) != b0[k]]
    check(C, "and that exception changed nothing else", not diff, diff)
    check(C, "no script errors", not errs, errs[:2])
    ctx.close(); br.close()
finish("test_5_html_sync_retention_paused")
