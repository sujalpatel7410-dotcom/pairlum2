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
    br = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
    for stress in [False, True]:
      for vp in [(320, 640), (390, 844), (1280, 800)]:
        ctx = br.new_context(viewport={"width": vp[0], "height": vp[1]}, has_touch=vp[0] < 800, is_mobile=vp[0] < 800, reduced_motion="reduce", permissions=["microphone", "camera"])
        ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=ns["FONT_CSS"]))
        ctx.route("**/images.unsplash.com/**", lambda r: r.abort())
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL + "?demo=year&fresh=1"); page.wait_for_timeout(1800)
        tag = "stress " if stress else ""
        if stress:
            # very long titles, topics and words in every write-up, and a long name
            page.evaluate("""() => { const K = 'demoyear:pairlum-shared-space-v1', d = JSON.parse(localStorage.getItem(K));
              Object.keys(d.understood).forEach(id => { const u = d.understood[id]; u.title = 'Averyveryverylongtitlewithoutanyspacesatall ' + u.title + ' and then it simply keeps going'; u.topics = (u.topics || []).concat(['supercalifragilisticexpialidocious-topic', 'another quite long topic name', 'x', 'y']); u.transcript = (u.transcript + ' ').repeat(6); });
              d.profiles = d.profiles || {}; d.profiles.u_mira = Object.assign({}, d.profiles.u_mira, { name: 'Miraaaaaaaaaaaaaaaaaaaaaa' });
              d.moments.forEach(m => { if(m.caption) m.caption = m.caption + ' ' + 'and more words about it '.repeat(4); });
              localStorage.setItem(K, JSON.stringify(d)); }"""); page.goto(URL + "?demo=year"); page.wait_for_timeout(1800)
        for _ in range(5):
            js(page, "document.querySelectorAll('.first-tip-x').forEach(b=>b.click())"); page.wait_for_timeout(200)
        view(page, "home"); run(page, tag + "home cards with moment bars", vp)
        for mid in ["dyt2", "dyvp1", "dyvc1", "dyv9"]:
            js(page, "(document.querySelector('[data-open-moment=\"%s\"]') || document.querySelector('[data-tl-id=\"%s\"]') || {click(){}}).click()" % (mid, mid))
            if not js(page, "document.getElementById('momentOverlay').classList.contains('is-open')"):
                view(page, "story"); page.wait_for_timeout(600); js(page, "(document.querySelector('[data-tl-id=\"%s\"]') || {click(){}}).click()" % mid)
            page.wait_for_timeout(700); run(page, tag + "moment " + mid, vp)
            js(page, "document.querySelectorAll('#momentOverlay details').forEach(d => d.open = true)"); page.wait_for_timeout(200); run(page, tag + "moment " + mid + " words open", vp)
            js(page, "document.querySelector('#momentOverlay .sheet').scrollTop = 99999"); page.wait_for_timeout(200); run(page, tag + "moment " + mid + " reply bar", vp)
            closeall(page)
        js(page, "(document.querySelector('[data-open-moment=\"dyt2\"]')||{click(){}}).click()"); page.wait_for_timeout(500)
        js(page, "document.getElementById('replyVoiceBtn') && document.getElementById('replyVoiceBtn').click()"); page.wait_for_timeout(1300); run(page, tag + "voice reply recording", vp)
        js(page, "document.getElementById('replyVoiceBtn') && document.getElementById('replyVoiceBtn').click()"); page.wait_for_timeout(700); run(page, tag + "voice reply draft", vp)
        closeall(page)
        view(page, "story"); page.wait_for_timeout(700); run(page, tag + "our story with find button and badges", vp)
        js(page, "document.getElementById('voiceFindBtn').click()"); page.wait_for_timeout(500); run(page, tag + "find a voice, empty", vp)
        for q in ["Find the voice note where she talked about our Goa trip", "the recording attached to that sunset photo", "zzzz nothing"]:
            js(page, "(()=>{var i=document.getElementById('voiceFindInput'); i.value=%r; i.dispatchEvent(new Event('input',{bubbles:true}));})()" % q); page.wait_for_timeout(400); run(page, tag + "find: " + q[:20], vp)
        closeall(page)
        view(page, "home")
        js(page, "document.querySelector(\"[data-action='open-capture']\").click()"); page.wait_for_timeout(500); run(page, tag + "capture voice", vp)
        for t in ["photo", "video"]:
            js(page, "document.querySelector(\".capture-type[data-type='%s']\").click()" % t); page.wait_for_timeout(300); run(page, tag + "capture " + t, vp)
            js(page, "document.getElementById('captureAttachBtn').click()"); page.wait_for_timeout(1300); run(page, tag + "capture " + t + " voice recording", vp)
            js(page, "document.getElementById('captureAttachBtn').click()"); page.wait_for_timeout(600); run(page, tag + "capture " + t + " voice attached", vp)
        js(page, "document.getElementById('captureClipRec').click()"); page.wait_for_timeout(1500); run(page, tag + "capture clip recording", vp)
        closeall(page)
        js(page, "document.querySelector(\"[data-action='open-privacy']\").click()"); page.wait_for_timeout(400)
        js(page, "document.getElementById('understandToggle').scrollIntoView({block:'center'})"); page.wait_for_timeout(200); run(page, tag + "privacy write-ups", vp); closeall(page)
        if errs: print("   page errors:", errs[:2])
        ctx.close()
    br.close()
print("\nVOICE LAYOUT TOTAL:", total)
