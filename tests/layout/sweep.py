"""Interaction sweep: put the app into its less-obvious states and run the overlap check in each."""
import sys, os, re, base64, threading, http.server, functools
from playwright.sync_api import sync_playwright
SITE = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit.py")).read()
ns = {"base64": base64, "os": os}; exec(src[src.index("FD ="):src.index("handler =")], ns)
CHECK = re.search(r'CHECK = r"""(.*?)"""', src, re.S).group(1)
STRESS_JS = re.search(r'STRESS_JS = r"""(.*?)"""', src, re.S).group(1)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE); handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/index.html" % srv.server_address[1]
total = 0
def run(page, name, vp):
    global total
    page.wait_for_timeout(450)
    page.evaluate("document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in'))")
    r = page.evaluate(CHECK)
    bad = [(k, v) for k, v in r.items() if (v if isinstance(v, bool) else len(v))]
    if bad:
        total += sum(1 if isinstance(v, bool) else len(v) for k, v in bad)
        print("\n## %d %s" % (vp[0], name))
        for k, v in bad:
            if isinstance(v, bool): print("   hscroll"); continue
            for l in v[:8]: print("  ", k[:4], l[:300])
        page.screenshot(path=os.path.join(OUT, "%d_%s.png" % (vp[0], re.sub(r'[^a-z0-9]+', '_', name.lower()))))
def closeall(page):
    page.evaluate("document.querySelectorAll('.overlay.is-open').forEach(o=>{var b=o.querySelector('[data-close-overlay]'); if(b) b.click(); o.classList.remove('is-open');}); document.body.style.overflow=''; var f=document.querySelector('.bookv.is-open .bookv-close'); if(f) f.click();")
    page.wait_for_timeout(250)
def view(page, v):
    page.evaluate("(v)=>{document.querySelector('[data-view=\"'+v+'\"]').click(); window.scrollTo(0,0)}", v); page.wait_for_timeout(600)
def js(page, code):
    try: return page.evaluate(code)
    except Exception as e: print("   (step failed: %s)" % str(e)[:120]); return None

with sync_playwright() as p:
    br = p.chromium.launch()
    for stress in ([False, True] if "--both" in sys.argv else [("--stress" in sys.argv)]):
      for vp in [(320, 640), (390, 844), (1280, 800)]:
        ctx = br.new_context(viewport={"width": vp[0], "height": vp[1]}, has_touch=vp[0] < 800, is_mobile=vp[0] < 800, reduced_motion="reduce")
        ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=ns["FONT_CSS"]))
        ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL + os.environ.get("QS", "")); page.wait_for_timeout(1300)
        if stress: page.evaluate(STRESS_JS); page.reload(); page.wait_for_timeout(1400)
        tag = "stress " if stress else ""
        for _ in range(5):
            js(page, "document.querySelectorAll('.first-tip-x').forEach(b=>b.click())"); page.wait_for_timeout(200)
        # --- Home
        view(page, "home")
        chips = js(page, "document.querySelectorAll('#feelChips .feel-chip').length") or 0
        for i in range(min(chips, 6)):
            js(page, "document.querySelectorAll('#feelChips .feel-chip')[%d].click()" % i); run(page, tag + "home feel %d" % i, vp)
        js(page, "var t=document.getElementById('dqAnswerInput'); if(t){t.value='A long honest answer that goes on for a while so the card has to hold real words, not just two. '.repeat(3).slice(0,300); t.dispatchEvent(new Event('input',{bubbles:true}));} var b=document.getElementById('dqRevealBtn'); if(b) b.click();")
        page.wait_for_timeout(900); run(page, tag + "home daily question revealed", vp)
        js(page, "var n=document.getElementById('noteInput'); if(n){n.value='thinking of you, more than usual today, and here is a long note to prove it properly'; n.form && n.form.requestSubmit ? n.form.requestSubmit() : 0;}")
        run(page, tag + "home note sent", vp)
        js(page, "var b=document.getElementById('sleepBtn'); if(b) b.click();"); run(page, tag + "home good night", vp)
        need = js(page, "document.querySelectorAll('.need-chip').length") or 0
        for i in range(min(need, 6)):
            js(page, "document.querySelectorAll('.need-chip')[%d].click()" % i); page.wait_for_timeout(400); run(page, tag + "need chip %d" % i, vp); closeall(page)
        js(page, "var b=document.getElementById('needPrimaryBtn'); if(b) b.click();"); page.wait_for_timeout(500); run(page, tag + "need primary", vp); closeall(page)
        # quick cards
        for sel in ["#quizCard button", "[data-quiz-pick]", "#dateIdeaCard button", ".thinking-quick-btn", "#ambientCard button"]:
            n = js(page, "document.querySelectorAll('%s').length" % sel) or 0
            for i in range(min(n, 4)):
                js(page, "var b=document.querySelectorAll('%s')[%d]; if(b && b.offsetParent) b.click();" % (sel, i)); page.wait_for_timeout(350); run(page, tag + "home %s %d" % (sel, i), vp); closeall(page)
        # --- Capture
        js(page, "document.getElementById('fabAdd').click()"); page.wait_for_timeout(500)
        for t in ["photo", "video", "voice", "text"]:
            js(page, "var b=document.querySelector('.capture-type[data-type=%s]'); if(b) b.click();" % t); run(page, tag + "capture " + t, vp)
        closeall(page)
        # --- Story
        view(page, "story")
        tiles = js(page, "document.querySelectorAll('.chapter-tile').length") or 0
        for i in range(min(tiles, 3)):
            js(page, "var t=document.querySelectorAll('.chapter-tile')[%d]; t.scrollIntoView({block:'center'}); t.click();" % i); page.wait_for_timeout(700); run(page, tag + "story chapter expanded %d" % i, vp); closeall(page)
        js(page, "var b=document.querySelector('.chapter-edit'); if(b) b.click();"); page.wait_for_timeout(500); run(page, tag + "chapter editor", vp); closeall(page)
        js(page, "document.getElementById('addChapterBtn').click()"); page.wait_for_timeout(500); run(page, tag + "chapter add", vp); closeall(page)
        js(page, "var d=document.querySelector('.story-dot'); if(d){d.focus();}"); run(page, tag + "story dot tip", vp)
        # --- Letters
        view(page, "letters")
        js(page, "var b=document.getElementById('lettersGateBtn'); if(b) b.click();"); page.wait_for_timeout(1600); run(page, tag + "letters open", vp)
        page.screenshot(path=os.path.join(OUT, "%s%d_letters.png" % ("st_" if stress else "", vp[0])), full_page=True)
        n = js(page, "document.querySelectorAll('[data-letter-index]').length") or 0
        for i in range(min(n, 5)):
            js(page, "document.querySelectorAll('[data-letter-index]')[%d].click()" % i); page.wait_for_timeout(600); run(page, tag + "letter %d" % i, vp); closeall(page)
        for sel in ["#writeLetterBtn", "[data-action=open-letter]", ".letters-write", "#lettersWriteBtn"]:
            if js(page, "var b=document.querySelector('%s'); if(b){b.click(); true} else false" % sel):
                page.wait_for_timeout(500); run(page, tag + "letter compose", vp)
                js(page, "document.querySelectorAll('[data-letter-timing]').forEach(b=>b.click())"); run(page, tag + "letter compose dated", vp); closeall(page); break
        # --- Us
        view(page, "us")
        js(page, "document.querySelectorAll('#view-us details').forEach(d=>d.open=true)"); run(page, tag + "us details open", vp)
        js(page, "document.getElementById('usTabSettings').click(); document.querySelectorAll('#view-us details').forEach(d=>d.open=true)"); run(page, tag + "us settings details open", vp)
        js(page, "document.getElementById('usTabTogether').click()")
        js(page, "document.querySelector('[data-action=open-dna]').click()"); page.wait_for_timeout(500)
        tabs = js(page, "document.querySelectorAll('[data-dna-tab]').length") or 0
        for i in range(tabs):
            js(page, "document.querySelectorAll('[data-dna-tab]')[%d].click()" % i); run(page, tag + "dna tab %d" % i, vp)
        closeall(page)
        js(page, "document.querySelector('[data-action=open-membership]').click()"); page.wait_for_timeout(500)
        n = js(page, "document.querySelectorAll('[data-plan-choose]').length") or 0
        for i in range(n):
            js(page, "var b=document.querySelectorAll('[data-plan-choose]')[%d]; if(b) b.click();" % i); page.wait_for_timeout(400); run(page, tag + "membership choose %d" % i, vp)
            js(page, "var c=document.querySelector('#planConfirm button, [data-plan-cancel]'); ")
            js(page, "document.querySelector('[data-action=open-membership]').click()"); page.wait_for_timeout(300)
        closeall(page)
        for a in ["open-appearance", "open-customize", "open-reunion-settings", "open-profile", "open-notifications", "open-privacy", "open-performance", "open-about", "open-inbox", "open-pairing"]:
            js(page, "var b=document.querySelector('[data-action=%s]'); if(b) b.click();" % a); page.wait_for_timeout(450)
            js(page, "var o=document.querySelector('.overlay.is-open'); if(o){o.querySelectorAll('details').forEach(d=>d.open=true); var s=o.querySelector('.sheet'); if(s) s.scrollTop=s.scrollHeight;}"); run(page, tag + a + " bottom", vp)
            closeall(page)
        # each mood
        moods = js(page, "[...new Set([...document.querySelectorAll('[data-mood-id]')].map(e=>e.dataset.moodId))]") or []
        for m in moods:
            js(page, "document.documentElement.setAttribute('data-mood','%s')" % m)
            for v in ["home", "us"]:
                view(page, v); run(page, tag + "mood %s %s" % (m, v), vp)
        if errs: print("  JS errors:", errs[:4])
        ctx.close()
    br.close()
print("\nSWEEP TOTAL:", total)
