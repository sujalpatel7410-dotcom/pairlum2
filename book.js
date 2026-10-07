/* ==========================================================================
   PAIRLUM BOOK — 44-page preview
   Front cover, 42 inside pages, back cover. Every page is drawn from the
   couple's own space (names, chapters, moments, notes, letters, dates…).
   Where the space has nothing yet, the page shows a sample line and is
   marked "sample" beside its page number.

   Public API:
     PairlumBook.build(data)        -> array of 44 { label, section, html }
     PairlumBook.mount(host, bridge) -> { refresh(), go(n), open() }
   bridge = { data(), loadPhoto(id, cb), soundOn(), motionOk() }
   ========================================================================== */
(function(){
  "use strict";

  var TOTAL = 44;

  /* ---------------------------------------------------------------- */
  /* small helpers                                                     */
  /* ---------------------------------------------------------------- */
  function esc(s){
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function cut(s, n){
    s = String(s || "").replace(/\s+/g, " ").trim();
    if(s.length <= n) return s;
    var c = s.slice(0, n - 1), sp = c.lastIndexOf(" ");
    return (sp > n * 0.6 ? c.slice(0, sp) : c).replace(/[\s,;:.\-–—]+$/, "") + "…";
  }
  // Long names get a smaller size so a name never runs off its page.
  function fitCls(s, steps){
    var n = String(s || "").length, i;
    for(i = 0; i < steps.length; i++){ if(n > steps[i]) return " bk-fit" + (steps.length - i); }
    return "";
  }
  var PHOTO_POOL = ["first-photo", "sunset-two", "coffee", "sky", "airport", "reunion", "bedroom", "call", "desk", "train", "rain", "commute"];
  function roman(n){
    return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] || String(n);
  }
  function words(n){
    return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] || String(n);
  }

  // A photo frame: one of the app's own photo styles, or a memory the couple imported.
  function photo(p, cls){
    var inner;
    if(p && p.id && (p.preview || p.mem)){
      inner = '<div class="photo" data-bk-mem="' + esc(p.id) + '"' + (p.preview ? ' style="background-image:url(&quot;' + esc(p.preview) + '&quot;)"' : "") + '></div>';
    } else {
      inner = '<div class="photo photo--' + esc((p && p.name) || "sky") + '"></div>';
    }
    return '<div class="bk-ph ' + (cls || "") + '">' + inner + '</div>';
  }
  function fillPhoto(p){ return photo(p, "bk-fill-ph"); }
  function foot(line){ return '<p class="bk-foot bk-c2">' + esc(line) + '</p>'; }
  function monogram(a, b){
    return '<div class="bk-mono" aria-hidden="true"><span>' + esc(a) + '</span><i></i><span>' + esc(b) + '</span></div>';
  }
  function wave(n, seed){
    var out = "", i, h;
    for(i = 0; i < n; i++){
      h = 18 + Math.round(Math.abs(Math.sin((i + 1) * 1.7 + seed) * Math.cos(i * 0.45 + seed * 2)) * 82);
      out += '<i style="height:' + h + '%"></i>';
    }
    return '<div class="bk-wave" aria-hidden="true">' + out + '</div>';
  }

  /* ---------------------------------------------------------------- */
  /* build — returns exactly 44 pages                                  */
  /* ---------------------------------------------------------------- */
  function build(d){
    var A = d.you, B = d.partner, pair = A.name + " & " + B.name;
    var pages = [];
    var volYear = d.year;

    // Every photo the book can draw on, in a steady order.
    var pool = [];
    (d.memories || []).forEach(function(m){ pool.push({ id: m.id, preview: m.preview, mem: true, caption: m.caption, date: m.date }); });
    (d.moments || []).forEach(function(m){ if(m.type === "photo" && m.photo) pool.push({ name: m.photo, caption: m.caption, date: m.time }); });
    var poolSample = !pool.length;
    PHOTO_POOL.forEach(function(n){ pool.push({ name: n, caption: "", date: "", filler: true }); });
    var pi = 0;
    function nextPhoto(){ var p = pool[pi % pool.length]; pi++; return p; }

    function page(kind, section, body, o){
      o = o || {};
      pages.push({ kind: kind, section: section, body: body, dark: !!o.dark, bare: !!o.bare, sample: !!o.sample, head: o.head || section });
    }

    /* 1 — front cover */
    var c0 = (d.chapters && d.chapters[0]) || null;
    var coverPhoto = c0 ? (c0.photo ? { name: c0.photo } : c0.coverId ? { id: c0.coverId, mem: true } : null) : null;
    page("cover", "Front cover",
      '<div class="bk-cover-frame"></div>' +
      '<div class="bk-cover-top"><span>Pairlum Book</span><span>Volume one</span></div>' +
      photo(coverPhoto || { name: "first-photo" }, "bk-cover-arch") +
      '<div class="bk-cover-names' + fitCls(A.name.length > B.name.length ? A.name : B.name, [16, 11, 8]) + '">' +
        '<span class="bk-1l">' + esc(A.name) + '</span><em>&amp;</em><span class="bk-1l">' + esc(B.name) + '</span></div>' +
      '<p class="bk-cover-sub bk-1l">The year we kept · ' + esc(volYear) + '</p>',
      { dark: true, bare: true });

    /* 2 — inside front cover */
    page("endpaper", "Inside cover",
      '<div class="bk-end-pattern" aria-hidden="true"></div>' +
      '<div class="bk-plate"><p class="bk-label">This book belongs to</p>' +
        '<p class="bk-plate-names bk-c2' + fitCls(pair, [30, 22]) + '">' + esc(pair) + '</p>' +
        '<p class="bk-small bk-1l">' + esc(A.city) + ' · ' + esc(B.city) + '</p></div>',
      { bare: true });

    /* 3 — half title */
    page("half", "Opening",
      '<div class="bk-center">' + monogram(A.initial, B.initial) +
        '<p class="bk-half-title">The Pairlum Book</p><p class="bk-label">of ' + esc(pair) + '</p></div>');

    /* 4 — dedication */
    page("dedication", "Opening",
      '<div class="bk-center"><p class="bk-ded bk-c5">For the two people who kept choosing the same day, from two different cities.</p>' +
        '<span class="bk-rule"></span><p class="bk-small bk-c2">' + esc(A.name) + ', ' + esc(A.city) + '<br>' + esc(B.name) + ', ' + esc(B.city) + '</p></div>');

    /* 5 — title page */
    page("title", "Opening",
      '<div class="bk-title-top"><p class="bk-label">A year, kept</p></div>' +
      '<div class="bk-title-mid' + fitCls(A.name.length > B.name.length ? A.name : B.name, [16, 11, 8]) + '"><h3 class="bk-1l">' + esc(A.name) + '</h3><em>and</em><h3 class="bk-1l">' + esc(B.name) + '</h3></div>' +
      '<div class="bk-title-bot"><span class="bk-rule"></span><p class="bk-small bk-1l">Together since ' + esc(d.since) + '</p>' +
        '<p class="bk-small bk-1l">' + esc(A.city) + ' — ' + esc(B.city) + '</p><p class="bk-label bk-title-imprint">Pairlum · ' + esc(volYear) + '</p></div>');

    /* 6 — contents */
    var toc = [["The two of us", 7], ["Our chapters", 10], ["An ordinary day", 22], ["Letters", 29], ["What we know by heart", 33], ["Coming home", 38]];
    page("contents", "Contents",
      '<h3 class="bk-h">Contents</h3><ol class="bk-toc">' + toc.map(function(t, i){
        return '<li><span class="bk-toc-n">' + roman(i + 1) + '</span><span class="bk-toc-t bk-1l">' + esc(t[0]) + '</span><span class="bk-toc-d"></span><span class="bk-toc-p">' + t[1] + '</span></li>';
      }).join("") + '</ol><p class="bk-small bk-toc-foot">Forty-four pages, front cover to back.</p>');

    /* 7 — the two of us */
    function portrait(p, side){
      return '<div class="bk-portrait bk-portrait--' + side + '"><span class="bk-avatar"><b>' + esc(p.initial) + '</b></span>' +
        '<p class="bk-portrait-name bk-1l' + fitCls(p.name, [14, 9]) + '">' + esc(p.name) + '</p>' +
        '<p class="bk-label bk-1l">' + esc(p.city || "Somewhere") + '</p>' +
        (p.birthday ? '<p class="bk-small bk-1l">Born ' + esc(p.birthday) + '</p>' : '') + '</div>';
    }
    page("two", "The two of us",
      '<p class="bk-label">Part ' + roman(1) + '</p><h3 class="bk-h">The two of us</h3>' +
      '<div class="bk-portraits">' + portrait(A, "a") + '<span class="bk-amp" aria-hidden="true">&amp;</span>' + portrait(B, "b") + '</div>' +
      '<p class="bk-body bk-c3 bk-two-foot">Two people, ' + (A.city && B.city && A.city !== B.city ? 'two cities' : 'one story') + ', one space that is only theirs.</p>');

    /* 8 — the distance */
    page("distance", "The two of us",
      '<p class="bk-label">Between us</p>' +
      '<div class="bk-arc" aria-hidden="true"><svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid meet"><path d="M24 126 Q150 -34 276 126" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round"/><circle cx="24" cy="126" r="6" fill="#7C1B33"/><circle cx="276" cy="126" r="6" fill="#A9803F"/></svg></div>' +
      '<div class="bk-arc-cities"><span class="bk-1l">' + esc(A.city || A.name) + '</span><span class="bk-1l">' + esc(B.city || B.name) + '</span></div>' +
      '<p class="bk-bignum bk-1l">' + esc(d.distance || "Close") + '</p>' +
      '<p class="bk-label bk-1l">' + esc(d.apart || "apart, for now") + '</p>' +
      '<p class="bk-body bk-c3 bk-dist-foot">The distance was only ever a number. This book is everything that crossed it.</p>');

    /* 9 — numbers */
    var stats = [
      [String(d.days.toLocaleString ? d.days.toLocaleString("en-US") : d.days), "days together"],
      [String(d.totalMoments && d.totalMoments.toLocaleString ? d.totalMoments.toLocaleString("en-US") : d.totalMoments), "shared moments"],
      [String(d.counts.letters), d.counts.letters === 1 ? "letter" : "letters"],
      [String(d.counts.chapters), d.counts.chapters === 1 ? "chapter" : "chapters"],
      [String(d.counts.notes), "little notes"],
      [String(d.counts.somedayDone) + " / " + String(d.counts.someday), "somedays done"]
    ];
    page("numbers", "The two of us",
      '<p class="bk-label">So far</p><h3 class="bk-h">Us, in numbers</h3><div class="bk-stats">' + stats.map(function(s){
        return '<div class="bk-stat"><b class="bk-1l">' + esc(s[0]) + '</b><span class="bk-1l">' + esc(s[1]) + '</span></div>';
      }).join("") + '</div><p class="bk-small bk-c2 bk-stats-foot">Counted from ' + esc(d.since) + ' to the day this page was made.</p>');

    /* 10–21 — chapters: twelve pages */
    var chPages = [];
    var chs = (d.chapters || []).slice();
    var sampleCh = !chs.length;
    if(sampleCh) chs = [{ title: "Where it started", meta: "Your first chapter", note: "Name a chapter in Our Story and it opens here, with the photos from that season.", photo: "first-photo", memories: [] }];
    var two = chs.length <= 6;                       // room for an opener and a story page each
    chs.slice(0, two ? 6 : 12).forEach(function(c, i){
      var ph = c.photo ? { name: c.photo } : c.coverId ? { id: c.coverId, mem: true } : nextPhoto();
      if(two){
        chPages.push({ kind: "chapter-open", sample: sampleCh, dark: true, bare: true, body:
          photo(ph, "bk-full") + '<div class="bk-shade"></div>' +
          '<div class="bk-ch-open"><p class="bk-label">Chapter ' + words(i + 1) + '</p>' +
          '<h3 class="bk-ch-title bk-c3' + fitCls(c.title, [34, 22]) + '">' + esc(c.title) + '</h3>' +
          '<p class="bk-label bk-1l">' + esc(c.meta) + '</p></div>' });
        var mems = (c.memories || []).slice(0, 2);
        var pics = mems.map(function(m){ return { id: m.id, preview: m.preview, mem: true, caption: m.caption || m.date }; });
        while(pics.length < 2) pics.push({ name: PHOTO_POOL[(i * 2 + pics.length + 3) % PHOTO_POOL.length] });
        chPages.push({ kind: "chapter-story", sample: sampleCh, body:
          '<p class="bk-label bk-1l">Chapter ' + words(i + 1) + ' · ' + esc(c.meta) + '</p>' +
          '<p class="bk-drop bk-c7">' + esc(cut(c.note || "A season of the two of you. Add a few lines to this chapter and they are printed here.", 300)) + '</p>' +
          '<div class="bk-pair">' + pics.map(function(p, k){
            return '<figure class="bk-pair-fig bk-pair-fig--' + k + '">' + photo(p, "bk-pair-ph") + (p.mem && p.caption ? '<figcaption class="bk-1l">' + esc(cut(p.caption, 34)) + '</figcaption>' : '') + '</figure>';
          }).join("") + '</div>' });
      } else {
        chPages.push({ kind: "chapter-one", body:
          photo(ph, "bk-top-ph") +
          '<div class="bk-ch-one"><p class="bk-label bk-1l">Chapter ' + words(i + 1) + ' · ' + esc(c.meta) + '</p>' +
          '<h3 class="bk-h bk-c2">' + esc(c.title) + '</h3>' +
          '<p class="bk-body bk-c6">' + esc(cut(c.note || "A season of the two of you.", 240)) + '</p></div>' });
      }
    });
    if(!two && chs.length > 12){
      var rest = chs.slice(11);
      chPages[11] = { kind: "chapter-list", body:
        '<p class="bk-label">And then</p><h3 class="bk-h">More chapters</h3><ul class="bk-lines">' + rest.slice(0, 8).map(function(c){
          return '<li><b class="bk-1l">' + esc(c.title) + '</b><span class="bk-1l">' + esc(c.meta) + '</span></li>';
        }).join("") + '</ul>' + (rest.length > 8 ? '<p class="bk-small">…and ' + (rest.length - 8) + ' more in your printed Book.</p>' : '') };
    }
    // Fewer than twelve pages of chapters: the rest become photo pages from the same years.
    var fillerLines = ["The in-between days.", "Nothing happened. We kept it anyway.", "Small, and ours.", "A day worth a page.", "Somewhere in the middle of it all.", "Before we knew it mattered."];
    var fk = 0;
    while(chPages.length < 12){
      var odd = fk % 2 === 0, p1 = nextPhoto(), p2 = nextPhoto(), p3 = nextPhoto();
      chPages.push(odd
        ? { kind: "photo-full", sample: poolSample, body:
            photo(p1, "bk-plate-ph") + '<p class="bk-caption bk-c2">' + esc(cut(p1.caption || fillerLines[fk % fillerLines.length], 90)) + '</p>' +
            (p1.date ? '<p class="bk-label bk-1l">' + esc(p1.date) + '</p>' : '') }
        : { kind: "photo-trio", sample: poolSample, body:
            '<div class="bk-trio">' + photo(p1, "bk-trio-a") + photo(p2, "bk-trio-b") + photo(p3, "bk-trio-c") + '</div>' +
            '<p class="bk-caption bk-c2">' + esc(fillerLines[fk % fillerLines.length]) + '</p>' });
      fk++;
    }
    chPages.slice(0, 12).forEach(function(p){ page(p.kind, "Our chapters", p.body, { dark: p.dark, bare: p.bare, sample: p.sample }); });

    /* 22 — divider */
    function divider(n, title, line){
      page("divider", title, '<div class="bk-center"><p class="bk-label">Part ' + roman(n) + '</p><h3 class="bk-div-title bk-c2">' + esc(title) + '</h3><span class="bk-rule"></span><p class="bk-div-line bk-c3">' + esc(line) + '</p></div>', { dark: true });
    }
    divider(3, "An ordinary day", "The days that looked like nothing, kept side by side.");

    /* 23, 24 — your day / their day */
    function dayPage(who, mine){
      var list = (d.moments || []).filter(function(m){ return m.mine === mine; }).slice(0, 4);
      var sample = !list.length;
      if(sample) list = [{ type: "text", caption: "Share a moment and it lands on this page.", time: "Any time" }];
      page("day", "An ordinary day",
        '<p class="bk-label bk-1l">' + esc(who.city || "A day") + '</p><h3 class="bk-h bk-1l">' + esc(who.name) + '’s day</h3><ul class="bk-day">' + list.map(function(m){
          var ic = m.type === "voice" ? "Voice" : m.type === "photo" ? "Photo" : m.type === "video" ? "Video" : "Words";
          return '<li><span class="bk-day-time bk-1l">' + esc(cut(String(m.time).split("·")[0], 12)) + '</span>' +
            (m.type === "photo" && m.photo ? photo({ name: m.photo }, "bk-day-ph") : '<span class="bk-day-kind">' + ic + '</span>') +
            '<p class="bk-day-text bk-c3">' + esc(cut(m.type === "voice" ? "A voice note" + (m.dur ? ", " + m.dur : "") : m.caption, 96)) + '</p></li>';
        }).join("") + '</ul>' + (list.length <= 3 ? foot(mine ? "The same day, from " + (who.city || "one side") + "." : "And the same day, from " + (who.city || "the other side") + ".") : ''), { sample: sample });
    }
    dayPage(A, true);
    dayPage(B, false);

    /* 25 — one photograph */
    var big = nextPhoto();
    page("photo-full", "An ordinary day",
      photo(big, "bk-plate-ph") + '<p class="bk-caption bk-c2">' + esc(cut(big.caption || "One photograph gets a page to itself.", 90)) + '</p>' +
      (big.date ? '<p class="bk-label bk-1l">' + esc(big.date) + '</p>' : ''), { sample: !!big.filler });

    /* 26 — four photographs */
    var four = [nextPhoto(), nextPhoto(), nextPhoto(), nextPhoto()];
    page("grid", "An ordinary day",
      '<div class="bk-grid4">' + four.map(function(p){ return photo(p, "bk-grid4-ph"); }).join("") + '</div>' +
      '<p class="bk-caption bk-c2">Four small things, kept.</p>', { sample: four.every(function(p){ return p.filler; }) });

    /* 27 — little notes */
    var notes = (d.notes || []).slice(0, 6), noteSample = !notes.length;
    if(noteSample) notes = [{ mine: true, text: "saw this and thought of you" }, { mine: false, text: "this song is very you" }];
    page("notes", "An ordinary day",
      '<p class="bk-label">Thinking of you</p><h3 class="bk-h">Little notes</h3><ul class="bk-notes">' + notes.map(function(n){
        return '<li class="' + (n.mine ? "is-a" : "is-b") + '"><p class="bk-c2">“' + esc(cut(n.text, 70)) + '”</p><span class="bk-1l">' + esc(n.mine ? A.name : B.name) + '</span></li>';
      }).join("") + '</ul>', { sample: noteSample });

    /* 28 — a voice */
    var v = (d.moments || []).filter(function(m){ return m.type === "voice"; })[0];
    page("voice", "An ordinary day",
      '<div class="bk-center"><p class="bk-label">A voice note</p>' + wave(34, 2.4) +
        '<p class="bk-voice-line bk-c3">' + esc(v ? (v.mine ? A.name : B.name) + ', ' + cut(String(v.time).split("·")[0], 14) + (v.dur ? " — " + v.dur : "") : "The sound of a voice note, drawn as a line.") + '</p>' +
        '<span class="bk-rule"></span><p class="bk-small bk-c3">A book cannot play a voice. This page keeps who sent it and when. The line is a drawing, not the recording.</p></div>', { sample: !v });

    /* 29 — divider */
    divider(4, "Letters", "Written slowly, opened on the right day.");

    /* 30, 31 — two open letters */
    var open = (d.letters || []).filter(function(l){ return !l.locked && l.body; });
    var sealed = (d.letters || []).filter(function(l){ return l.locked; });
    [0, 1].forEach(function(k){
      var l = open[k], sample = !l;
      if(sample) l = { title: "A letter you have not written yet", from: k ? B.name : A.name, body: "Write a letter in Pairlum and it is set here in your own words. In this preview a long letter shows its opening lines and is marked as an excerpt." };
      var words = String(l.body || "").trim().split(/\s+/).length, isCut = String(l.body || "").replace(/\s+/g, " ").trim().length > 430;
      page("letter", "Letters",
        '<p class="bk-label bk-1l">A letter from ' + esc(l.from) + '</p><h3 class="bk-letter-title bk-c2">' + esc(cut(l.title, 60)) + '</h3>' +
        '<div class="bk-letter-body"><p class="bk-c11">' + esc(cut(l.body, 430)) + '</p></div>' +
        '<p class="bk-sign bk-1l">— ' + esc(l.from) + '</p>' +
        (isCut ? '<p class="bk-small bk-excerpt bk-1l">Excerpt. The whole letter is ' + words + ' words.</p>' : ''), { sample: sample });
    });

    /* 32 — sealed letters: titles only, never the words */
    page("sealed", "Letters",
      '<p class="bk-label">Not yet</p><h3 class="bk-h">Still sealed</h3>' +
      (sealed.length
        ? '<ul class="bk-sealed">' + sealed.slice(0, 4).map(function(l){
            return '<li><span class="bk-seal" aria-hidden="true"></span><div><b class="bk-c2">' + esc(cut(l.title, 52)) + '</b><span class="bk-1l">' + esc(cut(l.state, 40)) + '</span></div></li>';
          }).join("") + '</ul>'
        : '<p class="bk-body bk-c4">No sealed letters right now. A letter with an opening date waits here, closed, until its day.</p>') +
      (sealed.length <= 2 ? fillPhoto({ name: "rain" }) : '') + '<p class="bk-small bk-c3 bk-sealed-foot">A sealed letter is printed as a closed envelope. Its words stay private until it opens.</p>', { sample: !sealed.length });

    /* 33, 34 — questions */
    var qs = (d.questions || []).slice(0, 4);
    [0, 1].forEach(function(k){
      var pairQ = qs.slice(k * 2, k * 2 + 2);
      if(!pairQ.length) pairQ = [{ q: "What are you looking forward to this week?", you: "", them: "", sample: true }];
      page("questions", "What we know by heart",
        (k === 0 ? '<p class="bk-label">Part ' + roman(5) + '</p><h3 class="bk-h">Questions we answered</h3>' : '<p class="bk-label">Questions we answered</p>') +
        '<div class="bk-qs">' + pairQ.map(function(q){
          return '<div class="bk-q"><p class="bk-q-q bk-c3">' + esc(cut(q.q, 96)) + '</p>' +
            (q.you ? '<p class="bk-q-a ' + (k ? "bk-c3" : "bk-c2") + '"><b>' + esc(cut(A.name, 14)) + '</b> ' + esc(cut(q.you, k ? 130 : 110)) + '</p>' : '') +
            (q.them ? '<p class="bk-q-a ' + (k ? "bk-c3" : "bk-c2") + '"><b>' + esc(cut(B.name, 14)) + '</b> ' + esc(cut(q.them, k ? 130 : 110)) + '</p>' : '') +
            (!q.you && !q.them ? '<p class="bk-q-a bk-c2">Your two answers are printed here, side by side.</p>' : '') + '</div>';
        }).join("") + '</div>' + foot(k === 0 ? "Asked once a day. Answered apart, read together." : "The small questions turned out to be the big ones."), { sample: pairQ.every(function(q){ return q.sample; }) });
    });

    /* 35 — our DNA */
    var dn = d.dna || { rows: [] };
    // Two dots on one line: when you both sit at the same spot they are drawn side by side.
    function dots(r){
      var a = Math.max(7, Math.min(93, Number(r.you) || 0)), b = Math.max(7, Math.min(93, Number(r.them) || 0));
      if(Math.abs(a - b) < 12){ var mid = Math.max(13, Math.min(87, (a + b) / 2)); if(a <= b){ a = mid - 6; b = mid + 6; } else { a = mid + 6; b = mid - 6; } }
      return [Math.round(a), Math.round(b)];
    }
    page("dna", "What we know by heart",
      '<p class="bk-label">Our DNA</p><h3 class="bk-h">How we move</h3><ul class="bk-dna">' + (dn.rows || []).slice(0, 6).map(function(r){
        return '<li><span class="bk-1l">' + esc(r.left) + '</span><div class="bk-dna-bar"><i class="is-a" style="left:' + dots(r)[0] + '%"></i><i class="is-b" style="left:' + dots(r)[1] + '%"></i></div><span class="bk-1l">' + esc(r.right) + '</span></li>';
      }).join("") + '</ul><div class="bk-key"><span><i class="is-a"></i>' + esc(cut(A.name, 14)) + '</span><span><i class="is-b"></i>' + esc(cut(B.name, 14)) + '</span></div>' +
      '<p class="bk-small bk-c3">' + esc(dn.set ? cut(dn.line, 150) : "Fill in Our DNA and this page shows where the two of you sit on each line.") + '</p>', { sample: !dn.set });

    /* 36 — little things */
    var fa = (d.facts.partner || []).filter(function(f){ return f.value; }), fb = (d.facts.you || []).filter(function(f){ return f.value; });
    var factRows = fa.map(function(f){ return [B.name, f]; }).concat(fb.map(function(f){ return [A.name, f]; })).slice(0, 6);
    var factSample = !factRows.length;
    if(factSample) factRows = (d.facts.partner || []).slice(0, 5).map(function(f){ return [B.name, { label: f.label, value: "Written in your own words" }]; });
    page("facts", "What we know by heart",
      '<p class="bk-label">Worth knowing from far away</p><h3 class="bk-h">Little things</h3><ul class="bk-facts">' + factRows.map(function(r){
        return '<li><span class="bk-1l">' + esc(cut(r[0], 14)) + ' · ' + esc(r[1].label) + '</span><b class="bk-c2">' + esc(cut(r[1].value, 70)) + '</b></li>';
      }).join("") + '</ul>' + (factRows.length <= 5 ? foot("The small facts that make someone feel known.") : ''), { sample: factSample });

    /* 37 — dates */
    page("dates", "What we know by heart",
      '<p class="bk-label">Every year</p><h3 class="bk-h">The dates we keep</h3><ul class="bk-dates">' + (d.dates || []).slice(0, 6).map(function(x){
        return '<li><b class="bk-1l">' + esc(x.when) + '</b><div><span class="bk-1l">' + esc(cut(x.title, 34)) + '</span><em>' + esc(cut(x.sub, 30)) + '</em></div></li>';
      }).join("") + '</ul>' + ((d.dates || []).length <= 4 ? fillPhoto({ name: "sunset-two" }) + foot("Circled every year, in both time zones.") : ''), { sample: !(d.dates || []).length });

    /* 38 — divider */
    divider(6, "Coming home", "Every countdown in this book ends the same way.");

    /* 39 — reunion */
    var ru = d.reunion;
    page("reunion", "Coming home",
      photo({ name: "reunion" }, "bk-top-ph") +
      '<div class="bk-reunion"><p class="bk-label">The next reunion</p>' +
      (ru ? '<p class="bk-bignum bk-1l">' + esc(ru.big) + (ru.unit ? ' <small>' + esc(ru.unit) + '</small>' : '') + '</p><p class="bk-body bk-c2">' + esc(ru.label ? "Until " + ru.label : "Until we are in the same place") + (ru.place ? ", " + esc(cut(ru.place, 30)) : "") + '.</p>'
          : '<p class="bk-body bk-c3">No date yet. When you set one, the countdown is printed here as it stood on the day your Book was made.</p>') +
      '</div>', { sample: !ru });

    /* 40 — someday */
    var sd = (d.someday || []).slice(0, 7), sdSample = !sd.length;
    if(sdSample) sd = [{ text: "Something to do together, someday", done: false }];
    page("someday", "Coming home",
      '<p class="bk-label">For when the distance is over</p><h3 class="bk-h">Our someday list</h3><ul class="bk-someday">' + sd.map(function(x){
        return '<li class="' + (x.done ? "is-done" : "") + '"><i aria-hidden="true"></i><span class="bk-c2">' + esc(cut(x.text, 64)) + '</span></li>';
      }).join("") + '</ul>' + (sd.length <= 4 ? fillPhoto({ name: "airport" }) + foot("Ticked off one at a time, together.") : ''), { sample: sdSample });

    /* 41 — the hard days */
    page("needs", "Coming home",
      '<div class="bk-center"><p class="bk-label">On the hard days</p><h3 class="bk-needs-title bk-c2">We asked for each other</h3><ul class="bk-needs">' + (d.needs || []).slice(0, 6).map(function(n){
        return '<li class="bk-1l">' + esc(n) + '</li>';
      }).join("") + '</ul><p class="bk-small bk-c2">Each of these is something one of you asked the other for.</p></div>');

    /* 42 — closing */
    page("closing", "Coming home",
      '<div class="bk-center"><p class="bk-closing bk-c4">Still ' + (A.city && B.city && A.city !== B.city ? "two cities" : "us") + '.<br>Still going.</p><span class="bk-rule"></span><p class="bk-label bk-1l">' + esc(pair) + '</p></div>', { dark: true });

    /* 43 — colophon */
    page("colophon", "Colophon",
      '<div class="bk-colophon">' + monogram(A.initial, B.initial) +
      '<p class="bk-small bk-c4">Made from the days ' + esc(pair) + ' kept in Pairlum.</p>' +
      '<p class="bk-small bk-c4">A Pairlum Book is printed after one full year on the Book membership. One Book for each couple space.</p>' +
      '<p class="bk-small bk-c3">Your words in this book are your own. The page titles and short captions are from Pairlum.</p>' +
      '<p class="bk-label">Pairlum · ' + esc(volYear) + '</p></div>');

    /* 44 — back cover */
    page("back", "Back cover",
      '<div class="bk-cover-frame"></div><div class="bk-center">' + monogram(A.initial, B.initial) +
      '<p class="bk-back-line bk-c3">How we lived it — not just the photos we saved.</p></div><p class="bk-back-mark">Pairlum</p>', { dark: true, bare: true });

    // Exactly 44, whatever the space holds.
    pages = pages.slice(0, TOTAL);
    while(pages.length < TOTAL){
      var px = nextPhoto();
      pages.splice(pages.length - 2, 0, { kind: "photo-full", section: "Coming home", head: "Coming home", sample: true,
        body: photo(px, "bk-plate-ph") + '<p class="bk-caption bk-c2">A day worth a page.</p>' });
    }

    return pages.map(function(p, i){
      var n = i + 1;
      var label = n === 1 ? "Front cover" : n === TOTAL ? "Back cover" : n === 2 ? "Inside cover" : "Page " + n;
      var folio = p.bare ? "" : '<div class="bk-folio"><span class="bk-1l">' + esc(p.head) + (p.sample ? ' · sample' : '') + '</span><b>' + n + '</b></div>';
      return {
        n: n, label: label, section: p.section, sample: p.sample,
        html: '<div class="bk-page bk--' + p.kind + (p.dark ? " bk-dark" : "") + (n % 2 ? " bk-recto" : " bk-verso") + '" data-bk-n="' + n + '"><div class="bk-in">' + p.body + folio + '</div></div>'
      };
    });
  }

  /* ---------------------------------------------------------------- */
  /* viewer                                                            */
  /* ---------------------------------------------------------------- */
  var ICON = {
    prev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  var audioCtx = null;
  function paperSound(bridge){
    try{
      if(!bridge || !bridge.soundOn || !bridge.soundOn()) return;
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      if(!audioCtx) audioCtx = new Ctx();
      if(audioCtx.state === "suspended") audioCtx.resume();
      var len = Math.floor(audioCtx.sampleRate * 0.26), buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), ch = buf.getChannelData(0), i;
      for(i = 0; i < len; i++){ var t = i / len; ch[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 2) * (0.6 + 0.4 * Math.sin(t * 40)); }
      var src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
      src.buffer = buf; f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.6; g.gain.value = 0.05;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination); src.start();
    }catch(e){}
  }

  function Viewer(host, bridge, opts){
    var self = this;
    opts = opts || {};
    this.host = host; this.bridge = bridge; this.full = !!opts.full;
    this.pages = opts.pages || build(bridge.data());
    this.p = Math.max(0, Math.min(TOTAL - 1, opts.start || 0));   // index of the page in view
    this.mode = "single"; this.busy = false; this.onChange = opts.onChange || null;

    host.classList.add("bkv");
    if(this.full) host.classList.add("bkv--full");
    host.innerHTML =
      '<div class="bkv-stage"><div class="bkv-book">' +
        '<div class="bkv-slot bkv-slot--l"></div><div class="bkv-slot bkv-slot--r"></div>' +
        '<div class="bkv-spine" aria-hidden="true"></div>' +
        '<button type="button" class="bkv-zone bkv-zone--prev" tabindex="-1" aria-hidden="true"></button>' +
        '<button type="button" class="bkv-zone bkv-zone--next" tabindex="-1" aria-hidden="true"></button>' +
      '</div></div>' +
      '<div class="bkv-bar">' +
        '<button type="button" class="bkv-btn bkv-prev" aria-label="Previous page">' + ICON.prev + '</button>' +
        '<div class="bkv-label" aria-live="polite"><b class="bkv-label-main"></b><span class="bkv-label-sub"></span></div>' +
        '<button type="button" class="bkv-btn bkv-next" aria-label="Next page">' + ICON.next + '</button>' +
        (this.full ? '' : '<button type="button" class="bkv-btn bkv-fullbtn" aria-label="Open the book full screen">' + ICON.full + '</button>') +
      '</div>' +
      (this.full
        ? '<div class="bkv-scrub"><span class="bkv-scrub-n">1</span><input type="range" min="1" max="' + TOTAL + '" step="1" value="1" aria-label="Go to page"><span class="bkv-scrub-n">' + TOTAL + '</span></div>'
        : '<p class="bkv-hint">Use the arrows or swipe to turn a page.</p>');

    this.stage = host.querySelector(".bkv-stage");
    this.book = host.querySelector(".bkv-book");
    this.slotL = host.querySelector(".bkv-slot--l");
    this.slotR = host.querySelector(".bkv-slot--r");
    this.labelMain = host.querySelector(".bkv-label-main");
    this.labelSub = host.querySelector(".bkv-label-sub");
    this.btnPrev = host.querySelector(".bkv-prev");
    this.btnNext = host.querySelector(".bkv-next");
    this.range = host.querySelector(".bkv-scrub input");

    this.btnPrev.addEventListener("click", function(){ self.turn(-1); });
    this.btnNext.addEventListener("click", function(){ self.turn(1); });
    host.querySelector(".bkv-zone--prev").addEventListener("click", function(){ self.turn(-1); });
    host.querySelector(".bkv-zone--next").addEventListener("click", function(){ self.turn(1); });
    var fb = host.querySelector(".bkv-fullbtn");
    if(fb) fb.addEventListener("click", function(){ if(opts.onFull) opts.onFull(self.p); });
    if(this.range) this.range.addEventListener("input", function(){ self.go(Number(self.range.value) - 1, true); });

    // swipe
    var sx = null, sy = null;
    this.stage.addEventListener("touchstart", function(e){ if(e.touches.length === 1){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
    this.stage.addEventListener("touchend", function(e){
      if(sx === null) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      sx = null;
      if(Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4){ self.swiped = Date.now(); self.turn(dx < 0 ? 1 : -1); }
    }, { passive: true });
    // A swipe here turns a page — it must not also slide the app to the next tab.
    host.setAttribute("data-no-page-swipe", "");

    host.setAttribute("tabindex", "0");
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", "Pairlum Book preview, " + TOTAL + " pages");
    host.addEventListener("keydown", function(e){
      if(e.target && e.target.tagName === "INPUT") return;
      if(e.key === "ArrowRight" || e.key === "PageDown"){ e.preventDefault(); self.turn(1); }
      else if(e.key === "ArrowLeft" || e.key === "PageUp"){ e.preventDefault(); self.turn(-1); }
      else if(e.key === "Home"){ e.preventDefault(); self.go(0, true); }
      else if(e.key === "End"){ e.preventDefault(); self.go(TOTAL - 1, true); }
    });

    if(window.ResizeObserver){
      this.ro = new ResizeObserver(function(){ self.layout(); });
      this.ro.observe(host);
    } else {
      window.addEventListener("resize", function(){ self.layout(); });
    }
    this.layout(true);
  }

  // In spread view: which two pages face each other for the page in view.
  Viewer.prototype.spreadOf = function(p){
    if(p <= 0) return { s: 0, l: -1, r: 0 };
    if(p >= TOTAL - 1) return { s: TOTAL / 2, l: TOTAL - 1, r: -1 };
    var s = Math.ceil(p / 2);
    return { s: s, l: 2 * s - 1, r: 2 * s };
  };
  Viewer.prototype.pageEl = function(i){
    var w = document.createElement("div");
    w.className = "bkv-leaf";
    if(i >= 0 && i < TOTAL) w.innerHTML = this.pages[i].html;
    this.hydrate(w);
    return w;
  };
  Viewer.prototype.hydrate = function(root){
    var bridge = this.bridge;
    if(!bridge || !bridge.loadPhoto) return;
    root.querySelectorAll("[data-bk-mem]").forEach(function(node){
      var id = node.getAttribute("data-bk-mem");
      node.removeAttribute("data-bk-mem");
      bridge.loadPhoto(id, function(url){ if(url) node.style.backgroundImage = 'url("' + url + '")'; });
    });
  };
  Viewer.prototype.fill = function(slot, i){
    slot.innerHTML = "";
    slot.classList.toggle("is-empty", i < 0);
    if(i >= 0) slot.appendChild(this.pageEl(i));
  };
  Viewer.prototype.layout = function(force){
    var host = this.host, w = host.clientWidth;
    if(!w) return;
    var mode, pw, RATIO = 4 / 3;
    if(this.full){
      var bar = host.querySelector(".bkv-bar"), scrub = host.querySelector(".bkv-scrub");
      var h = host.clientHeight - (bar ? bar.offsetHeight : 0) - (scrub ? scrub.offsetHeight : 0) - 28;
      mode = (w >= 640 && w / Math.max(1, h) > 1.12) ? "spread" : "single";
      pw = Math.floor(Math.min((w - 24) / (mode === "spread" ? 2 : 1), h / RATIO));
    } else {
      mode = w >= 700 ? "spread" : "single";
      pw = Math.floor(Math.min(mode === "spread" ? 400 : 440, (w - (mode === "spread" ? 8 : 0)) / (mode === "spread" ? 2 : 1)));
    }
    pw = Math.max(120, pw);
    if(!force && mode === this.mode && pw === this.pw) return;
    this.mode = mode; this.pw = pw;
    host.setAttribute("data-mode", mode);
    this.book.style.width = (mode === "spread" ? pw * 2 : pw) + "px";
    this.book.style.height = Math.round(pw * RATIO) + "px";
    this.stage.style.height = Math.round(pw * RATIO) + "px";
    this.show();
  };
  // Draw the current page (or facing pair) with no animation.
  Viewer.prototype.show = function(){
    var old = this.book.querySelector(".bkv-flip"); if(old) old.remove();
    this.busy = false;
    if(this.mode === "spread"){
      var sp = this.spreadOf(this.p);
      this.fill(this.slotL, sp.l); this.fill(this.slotR, sp.r);
      this.book.classList.toggle("is-front", sp.l < 0);
      this.book.classList.toggle("is-back", sp.r < 0);
    } else {
      this.fill(this.slotL, -1); this.fill(this.slotR, this.p);
      this.book.classList.remove("is-front", "is-back");
    }
    this.update();
  };
  Viewer.prototype.update = function(){
    var p = this.p, pg = this.pages[p], main, sub;
    if(this.mode === "spread"){
      var sp = this.spreadOf(p);
      main = sp.l < 0 ? "Front cover" : sp.r < 0 ? "Back cover" : "Pages " + (sp.l + 1) + "–" + (sp.r + 1);
      sub = sp.l < 0 || sp.r < 0 ? TOTAL + " pages" : this.pages[sp.r].section;
      this.btnPrev.disabled = sp.s === 0;
      this.btnNext.disabled = sp.r < 0;
    } else {
      main = pg.label;
      sub = p === 0 || p === TOTAL - 1 ? TOTAL + " pages" : (pg.section === pg.label ? "" : pg.section + " · ") + (p + 1) + " of " + TOTAL;
      this.btnPrev.disabled = p === 0;
      this.btnNext.disabled = p === TOTAL - 1;
    }
    this.labelMain.textContent = main;
    this.labelSub.textContent = sub;
    if(this.range) this.range.value = String(p + 1);
    if(this.onChange) this.onChange(p);
  };
  Viewer.prototype.go = function(i, quiet){
    i = Math.max(0, Math.min(TOTAL - 1, i));
    if(this.mode === "spread" && this.spreadOf(i).s === this.spreadOf(this.p).s){ this.p = i; this.update(); return; }
    if(i === this.p) return;
    this.p = i;
    this.show();
    if(!quiet) paperSound(this.bridge);
  };
  Viewer.prototype.refresh = function(data){
    var next = build(data || this.bridge.data());
    var same = next.length === this.pages.length && next.every(function(pg, i){ return pg.html === this.pages[i].html; }, this);
    if(same) return false;
    this.pages = next;
    this.show();
    return true;
  };
  Viewer.prototype.turn = function(dir){
    var self = this;
    if(this.busy) return;
    var motion = !this.bridge || !this.bridge.motionOk || this.bridge.motionOk();
    var canAnimate = motion && typeof this.book.animate === "function";
    var DUR = 720, EASE = "cubic-bezier(.36,.02,.22,1)";

    function face(i, back){
      var f = document.createElement("div");
      f.className = "bkv-face" + (back ? " bkv-face--back" : "");
      if(i >= 0){ var leaf = self.pageEl(i); while(leaf.firstChild) f.appendChild(leaf.firstChild); }
      else f.classList.add("is-blank");
      var sh = document.createElement("span"); sh.className = "bkv-shade"; f.appendChild(sh);
      return f;
    }
    function finish(flip, done){
      done();
      if(flip && flip.parentNode) flip.parentNode.removeChild(flip);
      self.busy = false;
      self.update();
    }

    if(this.mode === "spread"){
      var cur = this.spreadOf(this.p), ns = cur.s + dir;
      if(ns < 0 || ns > TOTAL / 2) return;
      var nl = ns === 0 ? -1 : 2 * ns - 1, nr = ns === TOTAL / 2 ? -1 : 2 * ns;
      this.p = nr >= 0 ? (nl >= 0 ? nl : nr) : nl;
      paperSound(this.bridge);
      if(!canAnimate){ this.show(); return; }
      this.busy = true;
      var flip = document.createElement("div");
      flip.className = "bkv-flip bkv-flip--" + (dir > 0 ? "r" : "l");
      if(dir > 0){
        flip.appendChild(face(cur.r, false)); flip.appendChild(face(nl, true));
        this.fill(this.slotR, nr);
      } else {
        flip.appendChild(face(cur.l, false)); flip.appendChild(face(nr, true));
        this.fill(this.slotL, nl);
      }
      this.book.appendChild(flip);
      this.book.classList.toggle("is-front", nl < 0);
      this.book.classList.toggle("is-back", nr < 0);
      var a = flip.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(" + (dir > 0 ? -180 : 180) + "deg)" }], { duration: DUR, easing: EASE, fill: "forwards" });
      var ended = false, end = function(){
        if(ended) return; ended = true;
        finish(flip, function(){ if(dir > 0) self.fill(self.slotL, nl); else self.fill(self.slotR, nr); });
      };
      a.onfinish = end; a.oncancel = end; window.setTimeout(end, DUR + 200);
      return;
    }

    var np = this.p + dir;
    if(np < 0 || np > TOTAL - 1) return;
    var from = this.p;
    this.p = np;
    paperSound(this.bridge);
    if(!canAnimate){ this.show(); return; }
    this.busy = true;
    var f1 = document.createElement("div");
    f1.className = "bkv-flip bkv-flip--single";
    if(dir > 0){
      // the page in view lifts away to the left; the next one is already underneath
      f1.appendChild(face(from, false)); f1.appendChild(face(-1, true));
      this.fill(this.slotR, np);
      this.book.appendChild(f1);
      var a1 = f1.animate([{ transform: "rotateY(0deg)", opacity: 1 }, { transform: "rotateY(-96deg)", opacity: 1, offset: .82 }, { transform: "rotateY(-112deg)", opacity: 0 }], { duration: DUR, easing: EASE, fill: "forwards" });
      var e1 = false, end1 = function(){ if(e1) return; e1 = true; finish(f1, function(){}); };
      a1.onfinish = end1; a1.oncancel = end1; window.setTimeout(end1, DUR + 200);
    } else {
      // the earlier page swings back in from the left, over the one in view
      f1.appendChild(face(np, false)); f1.appendChild(face(-1, true));
      this.book.appendChild(f1);
      var a2 = f1.animate([{ transform: "rotateY(-112deg)", opacity: 0 }, { transform: "rotateY(-96deg)", opacity: 1, offset: .18 }, { transform: "rotateY(0deg)", opacity: 1 }], { duration: DUR, easing: EASE, fill: "forwards" });
      var e2 = false, end2 = function(){ if(e2) return; e2 = true; finish(f1, function(){ self.fill(self.slotR, np); }); };
      a2.onfinish = end2; a2.oncancel = end2; window.setTimeout(end2, DUR + 200);
    }
  };

  /* ---------------------------------------------------------------- */
  /* full-screen reader                                                */
  /* ---------------------------------------------------------------- */
  function FullReader(bridge, inline){
    var self = this;
    this.bridge = bridge; this.inline = inline; this.viewer = null; this.lastFocus = null;
    var el = document.createElement("div");
    el.className = "bookv"; el.id = "bookFull";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Pairlum Book preview");
    el.innerHTML =
      '<div class="bookv-top">' +
        '<div class="bookv-title"><b class="bookv-title-main"></b><span class="bookv-title-sub">Pairlum Book preview · ' + TOTAL + ' pages</span></div>' +
        '<button type="button" class="bookv-btn bookv-all" aria-pressed="false">' + ICON.grid + '<span>All pages</span></button>' +
        '<button type="button" class="bookv-btn bookv-close" aria-label="Close the book">' + ICON.close + '</button>' +
      '</div>' +
      '<div class="bookv-main"><div class="bookv-reader"></div><div class="bookv-grid" hidden></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.reader = el.querySelector(".bookv-reader");
    this.grid = el.querySelector(".bookv-grid");
    this.allBtn = el.querySelector(".bookv-all");
    el.querySelector(".bookv-close").addEventListener("click", function(){ self.close(); });
    this.allBtn.addEventListener("click", function(){ self.toggleGrid(); });
    this.grid.addEventListener("click", function(e){
      var b = e.target.closest("[data-bk-go]");
      if(!b) return;
      self.toggleGrid(false);
      self.viewer.go(Number(b.getAttribute("data-bk-go")), true);
      self.viewer.host.focus();
    });
    this.onKey = function(e){
      if(e.key === "Escape"){ e.stopPropagation(); if(!self.grid.hidden) self.toggleGrid(false); else self.close(); return; }
      if(e.key === "Tab"){
        var f = Array.prototype.filter.call(el.querySelectorAll("button, input, [tabindex='0']"), function(n){ return !n.disabled && n.offsetParent !== null; });
        if(!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    };
  }
  FullReader.prototype.open = function(start){
    var d = this.bridge.data();
    this.lastFocus = document.activeElement;
    this.el.querySelector(".bookv-title-main").textContent = d.you.name + " & " + d.partner.name;
    this.reader.innerHTML = '<div class="bookv-view"></div>';
    this.el.classList.add("is-open");
    document.body.classList.add("bookv-lock");
    this.toggleGrid(false);
    var self = this;
    this.viewer = new Viewer(this.reader.firstChild, this.bridge, { full: true, start: start || 0, pages: this.inline ? this.inline.pages : null });
    document.addEventListener("keydown", this.onKey, true);
    window.setTimeout(function(){ if(self.viewer){ self.viewer.layout(true); self.viewer.host.focus(); } }, 30);
  };
  FullReader.prototype.close = function(){
    if(!this.el.classList.contains("is-open")) return;
    this.el.classList.remove("is-open");
    document.body.classList.remove("bookv-lock");
    document.removeEventListener("keydown", this.onKey, true);
    if(this.viewer){
      if(this.inline) this.inline.go(this.viewer.p, true);
      if(this.viewer.ro) this.viewer.ro.disconnect();
      this.viewer = null;
    }
    this.reader.innerHTML = ""; this.grid.innerHTML = "";
    if(this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  };
  FullReader.prototype.toggleGrid = function(on){
    var show = on === undefined ? this.grid.hidden : on;
    this.grid.hidden = !show;
    this.reader.hidden = show;
    this.allBtn.setAttribute("aria-pressed", show ? "true" : "false");
    this.allBtn.querySelector("span").textContent = show ? "Back to book" : "All pages";
    if(show && this.viewer){
      var cur = this.viewer.p, v = this.viewer;
      this.grid.innerHTML = v.pages.map(function(pg, i){
        return '<button type="button" class="bookv-thumb' + (i === cur ? " is-current" : "") + '" data-bk-go="' + i + '" aria-label="' + esc(pg.label) + ', ' + esc(pg.section) + '">' +
          '<span class="bookv-thumb-page">' + pg.html + '</span><span class="bookv-thumb-n">' + (i === 0 ? "Cover" : i === TOTAL - 1 ? "Back" : (i + 1)) + '</span></button>';
      }).join("");
      v.hydrate(this.grid);
      var c = this.grid.querySelector(".is-current"); if(c && c.scrollIntoView) c.scrollIntoView({ block: "center" });
    } else if(this.viewer){
      this.viewer.layout(true);
    }
  };

  function mount(host, bridge){
    var reader = null;
    var inline = new Viewer(host, bridge, {
      onFull: function(p){
        if(!reader) reader = new FullReader(bridge, inline);
        reader.open(p);
      }
    });
    // Catch up with the space whenever the book scrolls back into view.
    if(window.IntersectionObserver){
      new IntersectionObserver(function(entries){
        if(entries.some(function(en){ return en.isIntersecting; }) && !inline.busy) inline.refresh();
      }, { threshold: 0.05 }).observe(host);
    }
    return {
      refresh: function(data){ return inline.refresh(data); },
      go: function(n){ inline.go(n - 1, true); },
      open: function(n){ if(!reader) reader = new FullReader(bridge, inline); reader.open(n ? n - 1 : inline.p); },
      viewer: inline
    };
  }

  window.PairlumBook = { TOTAL: TOTAL, build: build, mount: mount };
})();
