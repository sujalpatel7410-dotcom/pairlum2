"""Review case 1: live sound. Two tabs in one browser stand in for two phones;
the microphone is Chromium's fake device. Every track the page receives is
counted, so "microphone off" means zero live tracks."""
import sys
from playwright.sync_api import sync_playwright
from common import *
U = serve(sys.argv[1]); C = "01 live mic"
STATE = "(() => { const t = document.getElementById('livePillRows').innerText; return document.getElementById('livePill').hidden ? 'hidden' : t; })()"

def pair(br):
    ctx = new_context(br); errs = []
    a = open_page(ctx, U, errs); b = open_page(ctx, U + "?as=mira", errs)
    return ctx, a, b, errs
def ask(b): js_click(b, "#liveAskBtn"); b.wait_for_timeout(350)
def go_live(a, b):
    ask(b); js_click(a, "[data-live-act='allow']")
    for _ in range(40):
        a.wait_for_timeout(250)
        if "microphone is live" in a.evaluate(STATE): return True
    return False

with sync_playwright() as p:
    br = launch(p)

    # --- cancel while the permission prompt is still open ---
    ctx, a, b, errs = pair(br)
    ask(b)
    check(C, "sharer sees the request", "would like to listen" in a.evaluate(STATE))
    a.evaluate("() => { window.__gumDelay = 1500; }"); js_click(a, "[data-live-act='allow']"); a.wait_for_timeout(200)
    check(C, "sharer is connecting (permission pending)", "Turning your microphone on" in a.evaluate(STATE))
    js_click(b, "[data-live-act='cancel']"); a.wait_for_timeout(400)
    check(C, "listener's cancel is honoured while connecting", a.evaluate(STATE) == "hidden", a.evaluate(STATE))
    a.wait_for_timeout(1600)
    check(C, "stream granted after the cancel is stopped (0 live tracks)", a.evaluate(LIVE) == 0 and a.evaluate("window.__tracks.length") == 1, a.evaluate("window.__tracks.map(t => t.readyState)"))
    check(C, "no offer went out after the cancel (listener idle)", b.evaluate(STATE) == "hidden")
    ctx.close()

    # --- listener stops while the offer/answer exchange is under way ---
    ctx, a, b, errs = pair(br)
    b.evaluate("() => { RTCPeerConnection.prototype.setRemoteDescription = () => new Promise(() => {}); }")  # the answer never comes
    ask(b); js_click(a, "[data-live-act='allow']"); a.wait_for_timeout(1200)
    check(C, "sharer holds a live mic while connecting", a.evaluate(LIVE) == 1 and "Turning your microphone on" in a.evaluate(STATE))
    check(C, "listener is connecting", "Connecting" in b.evaluate(STATE), b.evaluate(STATE))
    js_click(b, "[data-live-act='stop']"); a.wait_for_timeout(500)
    check(C, "stop during the exchange releases the sharer's mic", a.evaluate(LIVE) == 0 and a.evaluate(STATE) == "hidden")
    ctx.close()

    # --- a connection that never forms is given up (deadline independent of the 15-minute timer) ---
    ctx, a, b, errs = pair(br)
    b.evaluate("() => { RTCPeerConnection.prototype.setRemoteDescription = () => new Promise(() => {}); }")
    a.evaluate("() => { window.__pairlumTestConnectMs = 1500; }")
    ask(b); js_click(a, "[data-live-act='allow']"); a.wait_for_timeout(900)
    check(C, "mic is live before the deadline", a.evaluate(LIVE) == 1)
    a.wait_for_timeout(1400)
    check(C, "connection deadline ends the session and the mic", a.evaluate(LIVE) == 0 and a.evaluate(STATE) == "hidden", a.evaluate(STATE))
    check(C, "status says the microphone is off", "microphone is off" in toast(a), toast(a))
    b.wait_for_timeout(300)
    check(C, "the listener is told too (idle)", b.evaluate(STATE) == "hidden", b.evaluate(STATE))
    ctx.close()

    # --- replaceTrack fails after the new microphone was opened ---
    ctx, a, b, errs = pair(br)
    live_ok = go_live(a, b)
    check(C, "two tabs connect with real WebRTC", live_ok, a.evaluate(STATE))
    if live_ok:
        a.evaluate("() => { RTCRtpSender.prototype.replaceTrack = () => Promise.reject(new Error('refused')); }")
        js_click(a, "[data-live-act='mode-voice']"); a.wait_for_timeout(1200)
        tr = a.evaluate("window.__tracks.map(t => t.readyState)")
        check(C, "failed swap: old AND new track are both stopped", len(tr) == 2 and all(x == "ended" for x in tr), tr)
        check(C, "failed swap: session ended and status is truthful", a.evaluate(STATE) == "hidden" and "microphone is off" in toast(a), toast(a))
    ctx.close()

    # --- stop pressed while the swap is still in progress ---
    ctx, a, b, errs = pair(br)
    if go_live(a, b):
        a.evaluate("() => { const real = RTCRtpSender.prototype.replaceTrack; RTCRtpSender.prototype.replaceTrack = function(t){ return new Promise(r => setTimeout(r, 1200)).then(() => real.call(this, t)); }; }")
        js_click(a, "[data-live-act='mode-voice']"); a.wait_for_timeout(400)
        js_click(a, "[data-live-act='stop']"); a.wait_for_timeout(1800)
        tr = a.evaluate("window.__tracks.map(t => t.readyState)")
        check(C, "stop during replacement: every track ends, including the late one", len(tr) == 2 and all(x == "ended" for x in tr), tr)
        check(C, "stop during replacement: stays stopped", a.evaluate(STATE) == "hidden")
    else: check(C, "stop during replacement (needs a live session)", False)
    ctx.close()

    # --- relationship changes while live ---
    for label, steps in [("disconnect", ["#pairingDisconnectBtn", "#disconnectUnderstand", "#disconnectConfirmBtn"]), ("leave", ["#pairingLeaveBtn", "#leaveConfirmBtn"])]:
        ctx, a, b, errs = pair(br)
        if go_live(a, b):
            js_click(a, "[data-action='open-pairing']"); a.wait_for_timeout(300)
            for sel in steps: js_click(a, sel); a.wait_for_timeout(200)
            a.wait_for_timeout(500)
            check(C, label + " while live: microphone stops", a.evaluate(LIVE) == 0 and a.evaluate(STATE) == "hidden", a.evaluate("window.__tracks.map(t => t.readyState)"))
            check(C, label + " while live: listener's side ends", b.evaluate(STATE) == "hidden", b.evaluate(STATE))
        else: check(C, label + " while live (needs a live session)", False)
        ctx.close()

    ctx, a, b, errs = pair(br)
    if go_live(a, b):
        js_click(a, "[data-action='open-privacy']"); a.wait_for_timeout(300)
        js_click(a, "#privacyDeleteBtn"); a.wait_for_timeout(200)
        a.fill("#deleteConfirmInput", "DELETE"); js_click(a, "#deleteConfirmBtn"); a.wait_for_timeout(500)
        check(C, "delete account while live: microphone stops", a.evaluate(LIVE) == 0, a.evaluate("window.__tracks.map(t => t.readyState)"))
    else: check(C, "delete account while live (needs a live session)", False)
    ctx.close()

    # --- the other tab pausing the space ends my live sound too ---
    ctx, a, b, errs = pair(br)
    if go_live(a, b):
        js_click(b, "[data-action='open-pairing']"); b.wait_for_timeout(300)
        for sel in ["#pairingDisconnectBtn", "#disconnectUnderstand", "#disconnectConfirmBtn"]: js_click(b, sel); b.wait_for_timeout(200)
        a.wait_for_timeout(600)
        check(C, "partner disconnects: my microphone stops", a.evaluate(LIVE) == 0 and a.evaluate(STATE) == "hidden")
    else: check(C, "partner disconnects while live (needs a live session)", False)
    check(C, "no script errors", not errs, errs[:2])
    ctx.close(); br.close()
finish("test_3_live_microphone")
