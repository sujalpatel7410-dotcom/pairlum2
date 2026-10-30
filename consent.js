/* Pairlum analytics consent: Google Analytics stores no cookies until the visitor allows it.
   The choice is remembered on this device and can be changed from the Cookies & storage link. */
(() => {
  'use strict';
  const KEY = 'pl-analytics';
  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch {}
  const apply = v => { if (window.gtag) gtag('consent', 'update', { analytics_storage: v === 'yes' ? 'granted' : 'denied' }); };
  if (choice) { apply(choice); }
  function save(v) { try { localStorage.setItem(KEY, v); } catch {} apply(v); bar && bar.remove(); }
  window.PairlumConsent = { reset() { try { localStorage.removeItem(KEY); } catch {} location.reload(); } };
  let bar = null;
  if (choice) return;
  function show() {
    const css = document.createElement('style');
    css.textContent = `.pl-consent{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:400;width:min(560px,calc(100vw - 24px));display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 16px;border-radius:18px;background:#2A0F1Cf2;color:#FBEDE6;box-shadow:0 18px 40px -18px #000a;font:400 .9rem/1.45 'Jost','Inter','Helvetica Neue',Arial,sans-serif;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:plc-in .6s cubic-bezier(.22,1,.36,1)}
.pl-consent p{margin:0;flex:1 1 240px}.pl-consent a{color:#E7B8BC}
.pl-consent button{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid #fbede659;background:transparent;color:inherit;font-family:inherit;font-size:.88rem;font-weight:500;cursor:pointer}
.pl-consent button.yes{background:#FBEDE6;color:#2A0F1C;border-color:#FBEDE6}
@keyframes plc-in{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
@media(prefers-reduced-motion:reduce){.pl-consent{animation:none}}`;
    document.head.append(css);
    bar = document.createElement('div');
    bar.className = 'pl-consent'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Analytics choice');
    bar.innerHTML = '<p>May we use Google Analytics to see how people find Pairlum? No ads, no selling. <a href="legal.html#cookies">Learn more</a></p><button type="button" class="no">No thanks</button><button type="button" class="yes">Allow</button>';
    bar.querySelector('.yes').addEventListener('click', () => save('yes'));
    bar.querySelector('.no').addEventListener('click', () => save('no'));
    document.body.append(bar);
  }
  if (document.body) setTimeout(show, 1800); else addEventListener('DOMContentLoaded', () => setTimeout(show, 1800));
})();
