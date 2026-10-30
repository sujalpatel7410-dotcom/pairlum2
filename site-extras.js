/* Pairlum site extras, shared by the public pages (landing, FAQs, legal):
   scroll progress bar, back-to-top, floating contact (with copy), mobile menu,
   FAQ search, confirmation modal, print styles. Everything respects reduced motion. */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement, page = doc.body.dataset.page || 'home';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Signed in on this device (pairlum-core.js): app links open Pairlum instead of sign-up.
  const signedIn = !!(window.PL && PL.auth && PL.auth.signedIn && PL.auth.signedIn());
  const css = doc.createElement('style');
  css.textContent = `
.px-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:120;pointer-events:none;background:transparent}
.px-progress i{display:block;height:100%;width:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#AE1C40,#E7B8BC 60%,#B98A3E)}
.px-float{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));z-index:85;display:flex;flex-direction:column;align-items:flex-end;gap:10px;transition:opacity .35s,transform .35s}
.px-float.hide{opacity:0;transform:translateY(12px);pointer-events:none}
.px-btn{display:inline-grid;place-items:center;width:48px;height:48px;border-radius:50%;border:1px solid #fbede640;background:#2A0F1Ce6;color:#FBEDE6;cursor:pointer;box-shadow:0 12px 28px -14px #000a;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .2s,background .2s}
.px-btn:hover{transform:translateY(-2px);background:#4A1226}
.px-btn:focus-visible,.px-pop a:focus-visible,.px-pop button:focus-visible,.px-menu a:focus-visible,.px-modal button:focus-visible{outline:3px solid #E7B8BC;outline-offset:3px}
.px-btn svg{width:20px;height:20px}
.px-top{opacity:0;pointer-events:none;transform:scale(.8);transition:opacity .3s,transform .3s}
.px-top.show{opacity:1;pointer-events:auto;transform:none}
.px-pop{position:absolute;right:0;bottom:60px;width:min(300px,calc(100vw - 32px));padding:16px;border-radius:18px;background:#2A0F1Cf5;color:#FBEDE6;box-shadow:0 20px 44px -18px #000c;font:400 .92rem/1.45 'Jost','Helvetica Neue',Arial,sans-serif;display:grid;gap:12px}
.px-pop h3{margin:0;font:600 1.3rem/1.1 'Cormorant Garamond',Georgia,serif}
.px-pop .row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:#fbede612}
.px-pop .row span{min-width:0;overflow-wrap:anywhere}
.px-pop button,.px-pop a.pill{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid #fbede659;background:transparent;color:inherit;font:500 .85rem 'Jost','Helvetica Neue',Arial,sans-serif;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;flex:none}
.px-pop button:hover,.px-pop a.pill:hover{background:#fbede61f}
.px-pop .links{display:flex;flex-wrap:wrap;gap:8px}
.px-menubtn{display:none}
.hdr.px-open{z-index:100;color:#FBEDE6!important;background:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.px-menu{position:fixed;inset:0;z-index:95;display:grid;align-content:start;gap:6px;padding:max(84px,calc(env(safe-area-inset-top,0px) + 76px)) max(20px,env(safe-area-inset-right,0px)) 32px max(20px,env(safe-area-inset-left,0px));background:#1A0C12f7;color:#FBEDE6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);animation:px-in .35s cubic-bezier(.22,1,.36,1)}
.px-menu a{display:flex;align-items:center;min-height:56px;border-bottom:1px solid #fbede622;color:inherit;text-decoration:none;font:500 clamp(1.8rem,8vw,2.4rem)/1 'Cormorant Garamond',Georgia,serif}
.px-menu a.cta{margin-top:18px;justify-content:center;border:0;border-radius:999px;background:#FBEDE6;color:#4A1226;font:600 1rem 'Jost','Helvetica Neue',Arial,sans-serif}
@keyframes px-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media(max-width:720px){.px-menubtn{display:inline-grid;place-items:center;width:44px;height:44px;border:0;background:transparent;color:inherit;cursor:pointer}.px-menubtn svg{width:22px;height:22px}}
.px-search{display:flex;align-items:center;gap:10px;margin-top:28px;padding:0 16px;min-height:52px;border:1px solid var(--line,#24101929);border-radius:999px;background:#fffaf8;max-width:560px}
.px-search:focus-within{border-color:#AE1C40;box-shadow:0 0 0 3px #AE1C4026}
.px-search svg{width:18px;height:18px;flex:none;color:#634D55}
.px-search input{flex:1;min-width:0;border:0;background:transparent;font:400 1rem 'Jost','Helvetica Neue',Arial,sans-serif;color:#241019;outline:none}
.px-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;margin-top:14px;font-size:.9rem;color:#634D55}
.px-tools button{border:0;background:none;color:#AE1C40;font:500 .9rem 'Jost',Arial,sans-serif;cursor:pointer;padding:6px 0;text-decoration:underline;text-underline-offset:4px}
.px-empty{margin-top:24px;padding:20px;border-radius:16px;background:#AE1C400f;color:#241019}
.faq-item mark{background:#E7B8BC88;color:inherit;border-radius:3px;padding:0 2px}
.faq-item summary:hover{color:#AE1C40}
.px-updated{margin-top:14px;font-size:.88rem;color:#634D55}
.px-scrim{position:fixed;inset:0;z-index:500;display:grid;place-items:center;padding:20px;background:#15101399;animation:px-fade .25s ease}
@keyframes px-fade{from{opacity:0}to{opacity:1}}
.px-modal{width:min(420px,100%);padding:24px;border-radius:22px;background:#FFFBF9;color:#241019;box-shadow:0 30px 60px -24px #000c;display:grid;gap:14px;font:400 1rem/1.5 'Jost','Helvetica Neue',Arial,sans-serif;animation:px-in .3s cubic-bezier(.22,1,.36,1)}
.px-modal h2{margin:0;font:600 1.7rem/1.1 'Cormorant Garamond',Georgia,serif}
.px-modal p{margin:0;color:#634D55}
.px-modal .acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:6px}
.px-modal button{min-height:44px;padding:0 20px;border-radius:999px;border:1px solid #24101933;background:transparent;color:inherit;font:500 .95rem 'Jost',Arial,sans-serif;cursor:pointer}
.px-modal button.ok{background:#AE1C40;border-color:#AE1C40;color:#FBF1EC}
@media(prefers-reduced-motion:reduce){.px-float,.px-top,.px-menu,.px-modal,.px-scrim{transition:none!important;animation:none!important}}
@media print{
 .px-progress,.px-float,.px-menu,.px-scrim,.px-search,.px-tools,.pl-consent,.hdr,.loader,.stars,.stars2,#heart,.heart-glow,.veil,.hearts,.pact,.chapters,.meter,.sound-pill,.skip,.interest-form,.partner-share,.demo,.book-stage,.hint,.set-btn,.panel{display:none!important}
 html,body{background:#fff!important;color:#000!important}
 body::before,body::after{display:none!important}
 *{box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important}
 main>section,.hero,.information-footer,#start{background:#fff!important;color:#000!important;--ink:#000;--muted:#333;--cream:#000}
 .scene,.journey{height:auto!important}
 .stage,.hero{position:static!important;height:auto!important;min-height:0!important;overflow:visible!important}
 .rv>span,.fade,.day li,.pile .m,.hist-line{opacity:1!important;transform:none!important}
 .world{display:none!important}
 a[href^="http"]::after{content:" (" attr(href) ")";font-size:.8em;color:#555}
 details{display:block}details>*:not(summary){display:block!important}
 section{break-inside:avoid-page}
}`;
  doc.head.append(css);

  const ico = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
  };
  const el = (html) => { const t = doc.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  /* ---------- confirmation modal (built into the page, no browser dialogs) ---------- */
  function confirmModal({ title, text, ok = 'Confirm', cancel = 'Cancel' }) {
    return new Promise((resolve) => {
      const last = doc.activeElement;
      const scrim = el(`<div class="px-scrim" role="presentation"><div class="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-mt"><h2 id="px-mt"></h2><p></p><div class="acts"><button type="button" class="no"></button><button type="button" class="ok"></button></div></div></div>`);
      scrim.querySelector('h2').textContent = title; scrim.querySelector('p').textContent = text;
      scrim.querySelector('.ok').textContent = ok; scrim.querySelector('.no').textContent = cancel;
      const done = (v) => { scrim.remove(); doc.removeEventListener('keydown', key, true); last && last.focus && last.focus(); resolve(v); };
      const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } if (e.key === 'Tab') { const b = [...scrim.querySelectorAll('button')]; const i = b.indexOf(doc.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); b[b.length - 1].focus(); } else if (!e.shiftKey && i === b.length - 1) { e.preventDefault(); b[0].focus(); } } };
      scrim.addEventListener('click', (e) => { if (e.target === scrim) done(false); });
      scrim.querySelector('.ok').addEventListener('click', () => done(true));
      scrim.querySelector('.no').addEventListener('click', () => done(false));
      doc.addEventListener('keydown', key, true); doc.body.append(scrim); scrim.querySelector('.no').focus();
    });
  }
  window.PairlumConfirm = confirmModal;
  doc.querySelectorAll('[data-confirm-analytics]').forEach((b) => b.addEventListener('click', async () => {
    const yes = await confirmModal({ title: 'Change your analytics choice?', text: 'The page will reload and ask again whether Google Analytics may be used. Nothing else changes.', ok: 'Ask me again', cancel: 'Keep my choice' });
    if (yes && window.PairlumConsent) PairlumConsent.reset();
  }));

  /* ---------- scroll progress bar ---------- */
  const bar = el('<div class="px-progress" aria-hidden="true"><i></i></div>'); doc.body.append(bar);
  const fill = bar.firstChild;

  /* ---------- floating: contact + back to top ---------- */
  const EMAIL = 'pairlum.co@gmail.com';
  const float = el(`<div class="px-float hide">
    <button class="px-btn px-top" type="button" aria-label="Back to top">${ico.up}</button>
    <div style="position:relative">
      <div class="px-pop" id="px-pop" role="dialog" aria-label="Contact Pairlum" hidden>
        <h3>Say hello</h3>
        <div class="row"><span id="px-email">${EMAIL}</span><button type="button" id="px-copy">Copy</button></div>
        <div class="links"><a class="pill" href="mailto:${EMAIL}?subject=Hello%20Pairlum">Email us</a><a class="pill" href="https://instagram.com/pairlum.co.in" target="_blank" rel="noopener">Instagram ↗</a><a class="pill" href="faq.html">FAQs</a></div>
      </div>
      <button class="px-btn" id="px-contact" type="button" aria-label="Contact Pairlum" aria-expanded="false" aria-controls="px-pop">${ico.mail}</button>
    </div></div>`);
  doc.body.append(float);
  const topBtn = float.querySelector('.px-top'), pop = float.querySelector('#px-pop'), cBtn = float.querySelector('#px-contact');
  const setPop = (open) => { pop.hidden = !open; cBtn.setAttribute('aria-expanded', String(open)); cBtn.innerHTML = open ? ico.close : ico.mail; cBtn.setAttribute('aria-label', open ? 'Close contact options' : 'Contact Pairlum'); };
  cBtn.addEventListener('click', (e) => { e.stopPropagation(); setPop(pop.hidden); });
  doc.addEventListener('click', (e) => { if (!pop.hidden && !float.contains(e.target)) setPop(false); });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { setPop(false); cBtn.focus(); } });
  float.querySelector('#px-copy').addEventListener('click', function () {
    const b = this, ok = () => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1600); };
    const fb = () => { const r = doc.createRange(); r.selectNodeContents(float.querySelector('#px-email')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; };
    try { navigator.clipboard.writeText(EMAIL).then(ok, fb); } catch { fb(); }
  });
  topBtn.addEventListener('click', () => {
    if (window.PairlumScroll && !reduce) PairlumScroll.to(0); else scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    const target = doc.getElementById('main') || doc.body; target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
  });

  let ticking = false;
  function update() {
    ticking = false;
    const max = Math.max(1, root.scrollHeight - innerHeight), y = scrollY;
    fill.style.transform = `scaleX(${Math.min(1, y / max)})`;
    const past = y > innerHeight * (page === 'home' ? 1.2 : .6);
    const consentOpen = !!doc.querySelector('.pl-consent');
    float.classList.toggle('hide', !past || consentOpen);
    topBtn.classList.toggle('show', y > innerHeight * 1.5);
    if (!past && !pop.hidden) setPop(false);
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  new MutationObserver(onScroll).observe(doc.body, { childList: true });
  update();

  /* ---------- mobile menu (landing page header) ---------- */
  const nav = doc.querySelector('.hdr nav');
  const hdr = doc.querySelector('.hdr');
  if (nav && hdr) {
    const mb = el(`<button class="px-menubtn" type="button" aria-label="Open menu" aria-expanded="false">${ico.menu}</button>`);
    nav.append(mb);
    let menu = null;
    const close = () => { if (!menu) return; menu.remove(); menu = null; mb.innerHTML = ico.menu; mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', 'Open menu'); doc.body.style.overflow = ''; hdr.classList.remove('px-open'); mb.focus(); };
    mb.addEventListener('click', () => {
      if (menu) return close();
      menu = el(`<nav class="px-menu" aria-label="Menu"><a href="#presence">Explore</a><a href="#how-it-works">How it works</a><a href="#membership">Membership</a><a href="faq.html">FAQs</a><a href="#shape">Contact</a><a href="legal.html">Privacy</a>${signedIn ? '' : '<a href="auth.html#login">Log in</a>'}<a class="cta" href="auth.html#signup" data-app-link data-app-place="menu">Open Pairlum</a></nav>`);
      doc.body.append(menu); doc.body.style.overflow = 'hidden'; hdr.classList.add('px-open');
      mb.innerHTML = ico.close; mb.setAttribute('aria-expanded', 'true'); mb.setAttribute('aria-label', 'Close menu');
      menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { menu.remove(); menu = null; doc.body.style.overflow = ''; hdr.classList.remove('px-open'); mb.innerHTML = ico.menu; mb.setAttribute('aria-expanded', 'false'); }));
      menu.querySelector('a').focus();
    });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu) close(); });
    addEventListener('resize', () => { if (menu && innerWidth > 720) close(); });
  }

  /* ---------- FAQ search + expand all + last updated ---------- */
  const list = doc.querySelector('.faq-list');
  if (list && page === 'faq') {
    const items = [...list.querySelectorAll('.faq-item')];
    const orig = items.map((d) => d.innerHTML);
    const box = el(`<div><label class="px-search" for="px-q">${ico.search}<input id="px-q" type="search" placeholder="Search the questions, e.g. refund, partner, Book" autocomplete="off"></label><div class="px-tools"><span id="px-count" aria-live="polite">${items.length} questions</span><span><button type="button" id="px-all">Expand all</button></span></div></div>`);
    list.before(box);
    const empty = el(`<p class="px-empty" hidden>No questions match that yet. <a href="mailto:${EMAIL}?subject=Pairlum%20question">Ask us directly</a> and we'll reply.</p>`);
    list.after(empty);
    const q = box.querySelector('#px-q'), count = box.querySelector('#px-count'), all = box.querySelector('#px-all');
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
    function run() {
      const v = q.value.trim(); let shown = 0;
      items.forEach((d, i) => {
        d.innerHTML = orig[i];
        const hit = !v || d.textContent.toLowerCase().includes(v.toLowerCase());
        d.hidden = !hit; if (hit) shown++;
        if (v && hit) {
          d.open = true;
          const re = new RegExp(esc(v), 'gi'), walk = doc.createTreeWalker(d, NodeFilter.SHOW_TEXT); const nodes = [];
          while (walk.nextNode()) nodes.push(walk.currentNode);
          nodes.forEach((n) => { if (!re.test(n.nodeValue)) return; re.lastIndex = 0; const span = doc.createElement('span'); span.innerHTML = n.nodeValue.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(new RegExp(esc(v.replace(/[&<>]/g, '')), 'gi'), (m) => `<mark>${m}</mark>`); n.replaceWith(...span.childNodes); });
        }
      });
      count.textContent = v ? `${shown} of ${items.length} questions` : `${items.length} questions`;
      empty.hidden = shown > 0;
    }
    all.addEventListener('click', () => { const open = all.textContent === 'Expand all'; items.forEach((d) => { if (!d.hidden) d.open = open; }); all.textContent = open ? 'Collapse all' : 'Expand all'; });
  }
  const upd = doc.body.dataset.updated;
  if (upd) {
    const host = doc.querySelector('[data-updated-slot]');
    if (host) { const p = el(`<p class="px-updated">Last updated <time datetime="${upd}"></time></p>`); p.querySelector('time').textContent = new Date(upd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); host.append(p); }
  }

  /* ---------- app links: open Pairlum when signed in, else sign up; carry campaign tags along, count opens (no personal data) ---------- */
  const q = new URLSearchParams(location.search), tags = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'].filter((k) => q.get(k));
  const wire = (a) => {
    if (a.dataset.appWired) return; a.dataset.appWired = '1';
    if (signedIn) a.setAttribute('href', PL.home());
    if (tags.length) { const u = new URL(a.getAttribute('href'), location.origin); tags.forEach((k) => u.searchParams.set(k, q.get(k).slice(0, 80))); a.href = u.pathname + u.search + u.hash; }
    a.addEventListener('click', () => { if (window.gtag) gtag('event', 'open_app', { place: a.dataset.appPlace || 'link' }); });
  };
  doc.querySelectorAll('[data-app-link]').forEach(wire);
  new MutationObserver(() => doc.querySelectorAll('[data-app-link]:not([data-app-wired])').forEach(wire)).observe(doc.body, { childList: true });
})();
