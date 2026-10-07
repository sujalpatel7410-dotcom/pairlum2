"""Review cases 12, 13 and 14 (plus the petals defect): today's question
across two tabs, which calendar decides what, and keyboard / hidden-content
behaviour. The accessibility checks read Chromium's accessibility tree and
drive the keyboard; they are NOT a screen-reader test."""
import sys, os, json, zipfile, datetime
from playwright.sync_api import sync_playwright
from common import *
U = serve(sys.argv[1]); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
Q = "document.getElementById('dqQuestionFront').textContent"
def today(pg): return pg.evaluate("(() => { const d = JSON.parse(localStorage.getItem('pairlum-shared-space-v1')); const k = Object.keys(d.dq || {}).map(Number).sort((x, y) => y - x)[0]; return d.dq && k ? Object.assign({ key: k }, d.dq[k]) : null; })()")
def type_answer(pg, t): pg.evaluate("t => { const i = document.getElementById('dqAnswerInput'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }", t)

with sync_playwright() as p:
    br = launch(p); errs = []

    # ================= case 12 =================
    C = "12 question"
    ctx = new_context(br); a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    a.evaluate("() => window.__db(d => { d.dq = {}; d.dqPick = {}; })"); a.reload(); b.reload(); a.wait_for_timeout(1200)
    q1 = a.evaluate(Q); type_answer(a, "half typed")
    js_click(b, "#dqSwapBtn"); b.wait_for_timeout(500)
    q2 = b.evaluate(Q)
    check(C, "swap changes the question for the one who swapped", q2 != q1 and len(q2) > 5, (q1, q2))
    check(C, "the other open tab shows the new wording, front and back", a.evaluate(Q) == q2 and a.evaluate("document.getElementById('dqQuestionBack').textContent") == q2, a.evaluate(Q))
    check(C, "and keeps what was being typed", a.input_value("#dqAnswerInput") == "half typed")
    check(C, "typing alone is a private draft, not an answer", today(a) is None or not today(a).get("u_aarav"), today(a))
    type_answer(b, "B-ANSWER-SECRET"); js_click(b, "#dqRevealBtn"); b.wait_for_timeout(500)
    t = today(a)
    check(C, "the answer is stored with the wording it was written under", t and t.get("u_mira") == "B-ANSWER-SECRET" and t["_q"]["text"] == q2, t)
    # before my answer: nowhere
    check(C, "before my answer: not on Home, not even on the turned side of the card", "B-ANSWER-SECRET" not in a.evaluate("document.body.textContent"))
    js_click(a, "#dqArchiveBtn"); a.wait_for_timeout(300)
    check(C, "before my answer: not in the archive", "B-ANSWER-SECRET" not in a.evaluate("document.getElementById('dqArchiveOverlay').textContent") and "Shown once you answer" in a.evaluate("document.getElementById('dqArchiveOverlay').textContent"))
    a.keyboard.press("Escape")
    check(C, "before my answer: not in the Book", "B-ANSWER-SECRET" not in a.evaluate("JSON.stringify(window.PairlumBookBridge.data())"))
    js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(300); js_click(a, "#privacyExportBtn"); a.wait_for_timeout(200)
    with a.expect_download() as dl: js_click(a, "#exportConfirmBtn")
    pth = os.path.join(OUT, "q.zip"); dl.value.save_as(pth); js_click(a, "#privacyOverlay [data-close-overlay]")
    check(C, "before my answer: not in my export", b"B-ANSWER-SECRET" not in open(pth, "rb").read())
    check(C, "the accessibility tree does not expose it either", "B-ANSWER-SECRET" not in a.locator("body").aria_snapshot())
    check(C, "a swap is refused once someone has answered", a.evaluate("document.getElementById('dqSwapBtn').hidden"))
    a.evaluate("document.getElementById('dqSwapBtn').click()"); a.wait_for_timeout(300)
    check(C, "even a forced swap changes nothing", a.evaluate(Q) == q2 and today(a)["_q"]["text"] == q2)
    js_click(a, "#dqRevealBtn"); a.wait_for_timeout(400)
    check(C, "after my answer: theirs is shown", "B-ANSWER-SECRET" in a.evaluate("document.getElementById('dqAnswerPartner').textContent") and today(a).get("u_aarav") == "half typed")
    ctx.close()

    # answer and swap in the same instant
    ctx = new_context(br); a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    a.evaluate("() => window.__db(d => { d.dq = {}; d.dqPick = {}; })"); a.reload(); b.reload(); a.wait_for_timeout(1200)
    q1 = a.evaluate(Q); before = shared(a)
    type_answer(a, "A-ANSWER"); js_click(a, "#dqRevealBtn"); a.wait_for_timeout(300)
    b.evaluate("s => { window.__pairlumTestStaleRead = s; }", before)      # B swaps from the copy made before A's answer
    b.evaluate("document.getElementById('dqSwapBtn').click()"); a.wait_for_timeout(900)
    t = today(a)
    check(C, "answer vs swap at once: the answer survives, under the wording its writer saw", t and t.get("u_aarav") == "A-ANSWER" and t["_q"]["text"] == q1, t)
    check(C, "answer vs swap at once: both tabs show that wording", a.evaluate(Q) == q1 and b.evaluate(Q) == q1, (a.evaluate(Q), b.evaluate(Q)))
    # my screen is out of date: the day already carries a different question
    b.evaluate("""s => { const d = JSON.parse(s); const k = Object.keys(d.dq)[0]; d.dq[k]._q.text = 'A different question, already answered under'; window.__pairlumTestStaleRead = JSON.stringify(d); }""", shared(a))
    type_answer(b, "WRONG-WORDING"); js_click(b, "#dqRevealBtn"); b.wait_for_timeout(400)
    check(C, "an answer is never attached to wording its writer was not shown", "WRONG-WORDING" not in (shared(a) or "") and "changed while you were writing" in toast(b) and b.input_value("#dqAnswerInput") == "WRONG-WORDING", toast(b))
    ctx.close()

    # ================= case 13 =================
    C = "13 calendar"
    def at(iso): return datetime.datetime.fromisoformat(iso).replace(tzinfo=datetime.timezone.utc)
    def letters(pg): return {l["title"]: l["locked"] for l in pg.evaluate("window.PairlumBookBridge.data().letters")}
    def inbox(pg): return pg.evaluate("localStorage.getItem('pairlum-inbox-v1-u_aarav') || ''")
    def scenario(space_tz, open_date, before_iso, after_iso, label):
        ctx = new_context(br, timezone_id="America/Los_Angeles")          # the phone is somewhere else entirely
        ctx.clock.install(time=at(before_iso))
        a = open_page(ctx, U, errs)
        a.evaluate("([tz, od]) => window.__db(d => { d.spaceTz = tz; d.letters.unshift({ id:'CAL1', by:'u_mira', from:'Mira', title:'CAL-LETTER', body:'words', openDate: od, locked:true, state:'Opens', createdAt: 1 }); })", [space_tz, open_date])
        a.reload(); a.wait_for_timeout(1300)
        q_before = a.evaluate(Q)
        check(C, label + ": before the shared midnight the letter is sealed and no reminder says otherwise", letters(a).get("CAL-LETTER") is True and "opens today" not in inbox(a), (letters(a), inbox(a)[:120]))
        mins = int((at(after_iso) - at(before_iso)).total_seconds() // 60)
        a.clock.fast_forward("%02d:%02d:00" % (mins // 60, mins % 60)); a.wait_for_timeout(600)
        check(C, label + ": after it, with no reload, the letter is open and the reminder says today (they agree)", letters(a).get("CAL-LETTER") is False and "opens today" in inbox(a), (letters(a), inbox(a)[:160]))
        check(C, label + ": today's question moved on at the shared midnight", a.evaluate(Q) != q_before, (q_before, a.evaluate(Q)))
        return ctx, a
    # shared calendar = India; the phone's own date (Los Angeles) is still the day before
    ctx, a = scenario("Asia/Kolkata", "2026-10-07", "2026-10-06T18:20:00", "2026-10-06T18:35:00", "India space, phone in Los Angeles")
    q_mid = a.evaluate(Q)
    a.clock.fast_forward("12:40:00"); a.wait_for_timeout(500)             # the PHONE's midnight passes (07:15Z = 00:15 in Los Angeles)
    check(C, "the phone's own midnight changes nothing: same question, same day", a.evaluate(Q) == q_mid)
    ctx.close()
    ctx, a = scenario("Asia/Kolkata", "2027-01-01", "2026-12-31T18:20:00", "2026-12-31T18:35:00", "year boundary"); ctx.close()
    ctx, a = scenario("Asia/Kolkata", "2026-03-01", "2026-02-28T18:20:00", "2026-02-28T18:35:00", "month boundary"); ctx.close()
    # daylight saving: Berlin leaves summer time on 25 Oct 2026, so that day is 25 hours long
    ctx, a = scenario("Europe/Berlin", "2026-10-25", "2026-10-24T21:50:00", "2026-10-24T22:05:00", "Berlin, the day clocks go back"); ctx.close()
    ctx, a = scenario("Europe/Berlin", "2026-10-26", "2026-10-25T22:50:00", "2026-10-25T23:05:00", "Berlin, the day after (an hour later in UTC)"); ctx.close()
    ctx, a = scenario("Europe/Berlin", "2027-03-29", "2027-03-28T21:50:00", "2027-03-28T22:05:00", "Berlin, after clocks go forward"); ctx.close()

    # ================= case 14 (and review finding 19) =================
    C = "14 keyboard"
    ctx = new_context(br); a = open_page(ctx, U, errs)
    check(C, "every closed sheet is inert and hidden from assistive technology", a.evaluate("[...document.querySelectorAll('.overlay')].every(o => o.hasAttribute('inert') && o.getAttribute('aria-hidden') === 'true' && getComputedStyle(o).visibility === 'hidden')"))
    tree = a.locator("body").aria_snapshot()
    check(C, "controls inside closed sheets are not in the accessibility tree", "Seal it" not in tree and "Prepare export" not in tree and "Add to today" not in tree)
    where = set()
    for _ in range(70):
        a.keyboard.press("Tab")
        where.add(a.evaluate("(() => { const e = document.activeElement; return e.closest('.overlay') ? 'overlay' : e.closest('#photoViewer') ? 'viewer' : e.closest('[inert]') ? 'inert' : 'page'; })()"))
    check(C, "Tab through the page never lands in a closed sheet or anything inert", where == {"page"}, where)
    js_click(a, "[data-view=us]"); a.wait_for_timeout(400)
    a.evaluate("(document.querySelector(\"[aria-controls='usPanelSettings']\") || document.querySelector(\"[data-us-tab='settings']\")).click()"); a.wait_for_timeout(300)
    a.evaluate("document.querySelector(\"[data-action='open-privacy']\").focus()"); a.keyboard.press("Enter"); a.wait_for_timeout(400)
    IN = "(id => { const o = document.getElementById(id); return o.classList.contains('is-open') && o.contains(document.activeElement); })"
    check(C, "opened from the keyboard: focus moves into the sheet", a.evaluate(IN + "('privacyOverlay')"))
    check(C, "the page behind is inert while a sheet is open", a.evaluate("document.getElementById('main').hasAttribute('inert') && document.body.style.overflow === 'hidden'"))
    bad = 0
    for _ in range(60):
        a.keyboard.press("Tab")
        bad += 0 if a.evaluate("(() => { const e = document.activeElement, o = document.getElementById('privacyOverlay'); return o.contains(e) && !e.disabled && e.getClientRects().length > 0; })()") else 1
    for _ in range(10): a.keyboard.press("Shift+Tab")
    check(C, "Tab and Shift+Tab stay inside it, only on visible enabled controls", bad == 0 and a.evaluate(IN + "('privacyOverlay')"), bad)
    a.evaluate("document.querySelector(\"[data-action='open-notifications']\").click()"); a.wait_for_timeout(400)   # a second sheet on top
    check(C, "nested: the upper sheet has focus and the lower one is inert", a.evaluate(IN + "('notifOverlay')") and a.evaluate("document.getElementById('privacyOverlay').hasAttribute('inert')"))
    a.keyboard.press("Escape"); a.wait_for_timeout(300)
    check(C, "nested: Escape closes only the top one; focus and scroll lock return to the one below", a.evaluate(IN + "('privacyOverlay')") and a.evaluate("!document.getElementById('privacyOverlay').hasAttribute('inert') && document.body.style.overflow === 'hidden' && !document.getElementById('notifOverlay').classList.contains('is-open')"))
    a.keyboard.press("Escape"); a.wait_for_timeout(300)
    check(C, "last sheet closed: focus returns to the button that opened it, page scrolls again", a.evaluate("document.activeElement.getAttribute('data-action') === 'open-privacy' && document.body.style.overflow === '' && !document.getElementById('main').hasAttribute('inert')"), a.evaluate("document.activeElement.outerHTML.slice(0, 80)"))
    # a photo opened from inside a sheet
    a.evaluate("() => window.__db(d => { d.memories.push({ id:'MEMX', by:'u_aarav', type:'photo', date:'2025-03-04', caption:'cap', preview:true, at:1 }); })")
    png1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    a.evaluate("b => fetch('data:image/png;base64,' + b).then(r => r.blob()).then(async bl => { const db = await window.__idb.open(); return new Promise(res => { const tx = db.transaction('media', 'readwrite'); tx.objectStore('media').put(bl, 'MEMX'); tx.oncomplete = () => res(1); }); })", png1)
    a.reload(); a.wait_for_timeout(1300); js_click(a, "[data-view=story]"); a.wait_for_timeout(700)
    js_click(a, "[data-tl-id='MEMX']"); a.wait_for_timeout(500); js_click(a, "#memoryViewMedia img"); a.wait_for_timeout(500)
    if a.evaluate("document.getElementById('photoViewer').classList.contains('is-open')"):
        check(C, "photo viewer over a sheet: the sheet beneath is inert, the viewer is not", a.evaluate("document.getElementById('memoryOverlay').hasAttribute('inert') && !document.getElementById('photoViewer').hasAttribute('inert')"))
        a.keyboard.press("Escape"); a.wait_for_timeout(400)
        check(C, "Escape closes the viewer only; the sheet is usable again", a.evaluate("document.getElementById('memoryOverlay').classList.contains('is-open') && !document.getElementById('memoryOverlay').hasAttribute('inert') && document.getElementById('photoViewer').hasAttribute('inert')"))
    else:
        check(C, "photo viewer over a sheet (could not open the viewer in this run)", False)
    a.keyboard.press("Escape"); a.wait_for_timeout(300)
    # the full-screen Book
    js_click(a, "[data-view=us]"); a.wait_for_timeout(500)
    if js_click(a, ".bkv-fullbtn"):
        a.wait_for_timeout(600)
        check(C, "full-screen Book: the page behind is inert", a.evaluate("document.getElementById('main').hasAttribute('inert') && !document.querySelector('.bookv').hasAttribute('inert')"))
        a.keyboard.press("Escape"); a.wait_for_timeout(500)
        check(C, "full-screen Book closed: the page is usable again, the Book is inert", a.evaluate("!document.getElementById('main').hasAttribute('inert') && document.querySelector('.bookv').hasAttribute('inert')"))
    else: check(C, "full-screen Book (button not found)", False)
    # the question card
    js_click(a, "[data-view=home]"); a.wait_for_timeout(300)
    check(C, "question card: the turned-away side is inert until it is the side showing", a.evaluate("(() => { const f = document.querySelectorAll('#dqFlipInner .dq-face'); return !f[0].hasAttribute('inert') && f[1].hasAttribute('inert'); })()"))
    # groups: one Tab stop, arrows move the choice
    js_click(a, "[data-action='open-customize']"); a.wait_for_timeout(400)
    first = a.evaluate("(() => { const r = document.querySelector('#customMood [role=radio]'); r.focus(); return r.getAttribute('data-mood-pick'); })()")
    a.keyboard.press("ArrowRight"); a.wait_for_timeout(300)
    now = a.evaluate("(() => { const e = document.activeElement.closest('[role=radio]') || document.querySelector('#customMood [aria-checked=true]'); return [e && e.getAttribute('data-mood-pick'), document.querySelector('#customMood [aria-checked=true]').getAttribute('data-mood-pick')]; })()")
    check(C, "radio group: the arrow key moves and selects the next choice", now[1] and now[1] != first, (first, now))
    a.keyboard.press("Escape"); a.wait_for_timeout(200)
    js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(400)
    check(C, "switches have a spoken name and state", 'switch "Let Mira ask to listen live"' in a.locator("#privacyOverlay").aria_snapshot(), a.locator("#privacyOverlay").aria_snapshot()[:300])
    a.keyboard.press("Escape")

    C = "20 petals"
    styles = a.evaluate("[...document.querySelectorAll('#petals .petal')].map(p => [p.style.left, p.style.getPropertyValue('--size'), p.style.getPropertyValue('--fall')])")
    check(C, "every petal has a real position, size and timing", len(styles) > 0 and all(s[0].endswith('%') and s[1].endswith('px') and s[2].endswith('s') for s in styles), styles[:2])
    check(C, "petals are spread across the screen, not stacked", len({s[0] for s in styles}) > len(styles) // 2)
    js_click(a, "[data-view=us]"); a.wait_for_timeout(300); js_click(a, "#reducedMotionToggle"); a.wait_for_timeout(400)
    check(C, "reduced motion stops the petals", a.evaluate("document.getElementById('petals').hidden && document.querySelectorAll('#petals .petal').length === 0"))
    check(C, "no script errors", not errs, errs[:2])
    ctx.close(); br.close()
finish("test_7_questions_calendar_keyboard")
