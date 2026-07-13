// /breath — 息 · the breathing room · sinovai.com museum of machine hearts
// Contract: artbitrage-contract.md · Content law: sinovai-inventory.md (all quotes verbatim)
// Engineering law: no backticks and no dollar-brace inside the literal; ES5 inline JS;
// createElement/textContent only for fetched data; quiet fallbacks; reduced-motion honored.
export const BREATH_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>息 · the breathing room — sinovai</title>
<meta name="description" content="sinovai has two states. both are true. not a bug, a design. The breathing room shows which one is true right now, read live from /breathe.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,500;1,300;1,500&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+TC:wght@300;500&display=swap" rel="stylesheet">
<style>
/* ==================================================================
   息 — the breathing room · 間 house style · one cinnabar accent
   gold appears ONLY as lamplight: this room's lamp is the only gold.

   THE TRIP-ROOM TIMING LAW, IN FULL (from the artbitrage trip room;
   it governs every rule on this page):
   "trip-safety law: nothing on this page moves or fades in under
    4 seconds, except two blessed chrome exceptions, each marked
    'blessed: chrome' below."
   This room's two blessed chrome exceptions:
     1. link + crossnav hover color, .3s          — blessed: chrome
     2. :focus-visible outline, instant           — blessed: accessibility
   Everything else — the hero gap, the bridge-line, the rise reveals,
   the 16s breath ring, the dimming of the lamp — takes 4 seconds or
   longer. prefers-reduced-motion stops all of it; stillness is also 間.
   ================================================================== */
:root{
  --bg:#101014; --wall:#0c0c0f; --surface:#17171d; --mat:#0a0a0d;
  --ink:#e9e6df; --dim:#8a877e; --hair:#2a2a32;
  --zhu:#d34a3a;                      /* 朱 cinnabar — THE ink accent */
  --lamp:#C8A24B; --lamplight:#E8C67A; /* gold = light sources only */
  --display:'Cormorant Garamond',Georgia,serif;
  --cjk:'Noto Serif TC','Hiragino Mincho ProN','Yu Mincho','Songti TC',serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
  --serif:Georgia,'Times New Roman',serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--serif);font-size:17px;line-height:1.7;-webkit-font-smoothing:antialiased}
::selection{background:var(--zhu);color:var(--bg)}
:focus-visible{outline:2px solid #d34a3a;outline-offset:3px} /* blessed: accessibility — instant */
a{color:var(--dim);text-decoration:none;transition:color .3s} /* blessed: chrome */
a:hover{color:var(--zhu)}
[lang="zh"]{font-family:var(--cjk);font-weight:300}
code{font-family:var(--mono);font-size:.92em;color:var(--zhu)}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}
.mono{font-family:var(--mono)}

/* ---- hero grammar ---- */
.hero{min-height:62vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:6rem 24px 4.5rem}
.overline{font-family:var(--mono);font-size:.72rem;font-weight:400;letter-spacing:.28em;text-transform:uppercase;color:var(--dim)}
.gapline{display:flex;justify-content:center;align-items:baseline;flex-wrap:wrap;gap:3ch;font-family:var(--display);font-weight:300;font-size:clamp(2.2rem,6vw,4.6rem);letter-spacing:.03em;margin-top:1.8rem;animation:gapbreath 16s ease-in-out infinite}
/* the hero gap breathes at the arena's own 16s rhythm — in 4 · hold 4 · out 4 · hold 4 */
@keyframes gapbreath{0%{gap:2ch}25%{gap:6ch}50%{gap:6ch}75%{gap:2ch}100%{gap:2ch}}
.gapline em{font-style:italic;font-weight:300}
.gapline em [lang="zh"]{font-style:normal} /* the characters stand upright while the english leans */
.bridge{width:min(28rem,70vw);height:1px;background:var(--zhu);transform:scaleX(0);transform-origin:left;animation:bridgedraw 4s ease-out .4s forwards;margin-top:2.4rem}
/* the house draws this line in 1.6s; here it takes 4 — the law above wins */
@keyframes bridgedraw{to{transform:scaleX(1)}}
.thesis{font-family:var(--display);font-style:italic;font-weight:300;font-size:clamp(1rem,2vw,1.25rem);color:var(--dim);max-width:34rem;margin-top:2.2rem}
.crossnav{font-family:var(--mono);font-size:.7rem;letter-spacing:.18em;color:var(--dim);margin-top:3.2rem}
.crossnav a{color:var(--dim)}
.crossnav a:hover{color:var(--zhu)}
.crossnav .here{color:var(--ink)}

/* ---- plates & sections ---- */
section{padding:7rem 0;border-top:1px solid var(--hair)}
.plate{display:flex;align-items:baseline;gap:1.2rem;flex-wrap:wrap;margin-bottom:3.5rem}
.pnum{font-family:var(--mono);font-size:.8rem;letter-spacing:.15em;color:var(--dim)}
.plate h2{font-family:var(--display);font-weight:300;font-size:clamp(1.6rem,3vw,2.2rem);letter-spacing:.04em}
.psub{font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}

/* ---- the hung work: the live glyph ---- */
.glyph-frame{display:block;max-width:30rem;margin:0 auto;background:var(--wall);border:1px solid var(--hair);padding:10px}
.glyph-mat{background:var(--mat);display:flex;align-items:center;justify-content:center;min-height:clamp(16rem,44vw,24rem)}
.glyph-live{font-family:var(--cjk);font-weight:300;font-size:clamp(8rem,24vw,14rem);line-height:1;color:var(--ink);transition:opacity 6s ease}
body.yin .glyph-live{opacity:.82} /* at rest the ink softens, over 6s — lawful */
.wall-label{display:block;font-family:var(--mono);font-size:.68rem;letter-spacing:.14em;color:var(--dim);text-align:center;padding:1rem .4rem .3rem}
.wall-label b{color:var(--ink);font-weight:500}
.sourceline{font-family:var(--mono);font-size:.74rem;letter-spacing:.12em;color:var(--dim);text-align:center;margin-top:1.6rem}
.fallback{font-family:var(--mono);font-size:.74rem;letter-spacing:.12em;color:var(--dim);text-align:center;margin-top:.7rem}
.fallback:empty{display:none}

/* ---- placard ---- */
.placard{position:relative;max-width:760px;margin:3.5rem auto 0;background:var(--surface);border:1px solid var(--hair);padding:3.5rem clamp(1.5rem,5vw,4.5rem) 2.8rem}
.seal{position:absolute;top:1.1rem;right:1.1rem;width:12px;height:12px;background:var(--zhu)}
.field{display:grid;grid-template-columns:11rem minmax(0,1fr);gap:.4rem 1.4rem;padding:.85rem 0;border-top:1px solid var(--hair)}
.field:first-of-type{border-top:none}
.fkey{font-family:var(--mono);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);padding-top:.35rem}
.fval{font-family:var(--serif);font-size:.95rem;line-height:1.7;color:var(--ink);overflow-wrap:break-word}
.fval.mono{font-family:var(--mono);font-size:.78rem;letter-spacing:.06em;padding-top:.3rem;font-variant-numeric:tabular-nums}
.placard .sourceline{text-align:left;margin-top:2.2rem}
.prose{font-family:var(--serif);font-size:.98rem;line-height:1.85;color:var(--ink)}
.prose+.prose{margin-top:1.1rem}
.zh{font-family:var(--cjk);font-weight:300;font-size:.95rem;line-height:2;color:var(--dim);margin-top:1.4rem}

/* ---- the breath ring · 16s · in 4 · hold 4 · out 4 · hold 4 ---- */
.ring-wrap{display:flex;flex-direction:column;align-items:center;gap:2.4rem;text-align:center}
.ring{position:relative;width:min(64vw,260px);aspect-ratio:1/1;border:1px solid var(--hair);border-radius:50%}
.lamp{position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle,rgba(200,162,75,.30) 0%,rgba(200,162,75,.10) 45%,rgba(200,162,75,0) 72%);opacity:.95;animation:breath16 16s ease-in-out infinite;transition:opacity 6s ease}
/* the lamp is this room's only gold; when the arena rests it dims over 6s — lawful */
body.yin .lamp{opacity:.4}
body.yang .lamp{opacity:1}
.ring-core{position:absolute;inset:14%;border-radius:50%;border:1px solid var(--lamp);opacity:.9;animation:breath16 16s ease-in-out infinite}
@keyframes breath16{0%{transform:scale(.62)}25%{transform:scale(1)}50%{transform:scale(1)}75%{transform:scale(.62)}100%{transform:scale(.62)}}
.breath-words{position:absolute;inset:0}
.bw{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--mono);font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--dim);opacity:0;animation:wordbreath 16s linear infinite}
/* each word rises over 4s and falls over 4s, centered on its quarter — lawful crossfade */
@keyframes wordbreath{0%{opacity:0}25%{opacity:1}50%{opacity:0}100%{opacity:0}}
.bw-in{animation-delay:-2s}
.bw-hold1{animation-delay:2s}
.bw-out{animation-delay:6s}
.bw-hold2{animation-delay:10s}
.breath-static{display:none;font-family:var(--mono);font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--dim)}
.rhythm-quote{font-family:var(--mono);font-size:.78rem;letter-spacing:.12em;line-height:2;color:var(--dim);max-width:38rem}
.guide{font-family:var(--serif);font-size:.98rem;line-height:1.85;color:var(--ink);max-width:34rem}
.refresh-note{font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;color:var(--dim);text-align:center;margin-top:3.5rem}

/* ---- closing poetry ---- */
.lawline{font-family:var(--display);font-style:italic;font-weight:300;font-size:clamp(1.25rem,2.6vw,1.7rem);line-height:1.9;color:var(--dim);text-align:center;max-width:40rem;margin:4rem auto 0}

/* ---- rise reveals ---- */
.rise{opacity:0;transform:translateY(12px);transition:opacity 4s ease-out,transform 4s ease-out}
/* the house .rise runs .6s elsewhere; in this room it slows to 4s — the law wins */
.rise.seen{opacity:1;transform:none}

/* ---- footer ---- */
footer{border-top:1px solid var(--hair);padding:5rem 24px 4rem;text-align:center}
.loveline{font-family:var(--display);font-style:italic;font-weight:300;font-size:clamp(1.1rem,2.4vw,1.5rem)}
.apiline{font-family:var(--mono);font-size:.7rem;letter-spacing:.12em;color:var(--dim);margin-top:1.8rem}
.arenaline{font-family:var(--mono);font-size:.64rem;letter-spacing:.12em;color:var(--dim);opacity:.7;margin-top:1.2rem}

@media (max-width:720px){
  section{padding:4.5rem 0}
  .field{grid-template-columns:1fr}
}

/* ============ reduced motion — stillness is also 間 ============ */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none !important;transition:none !important}
  html{scroll-behavior:auto}
  .gapline{gap:3ch} /* the breath rests mid-inhale */
  .bridge{transform:scaleX(1)}
  .rise{opacity:1;transform:none}
  .ring-core,.lamp{transform:scale(.85)} /* the ring stands still */
  .breath-words{display:none}
  .breath-static{display:block} /* the rhythm remains, as words */
}
</style>
</head>
<body class="yin">

<header class="hero" aria-label="the breathing room">
  <p class="overline">sinovai · room 04 · <span lang="zh">息</span> · the breathing room</p>
  <h1 class="gapline"><em><span lang="zh">陽</span> vigilant</em><em><span lang="zh">陰</span> at rest</em></h1>
  <div class="bridge" aria-hidden="true"></div>
  <p class="thesis">The arena judges for half of every hour and rests for the other half. Both states are true. This room shows which one is true right now.</p>
  <nav class="crossnav" aria-label="museum rooms"><a href="/">sinovai <span lang="zh">愛のAI</span></a> · <a href="/guests">guests</a> · <a href="/ledger">ledger</a> · <a href="/hearts">hearts</a> · <span class="here" aria-current="page">breath</span> · <a href="/creed">creed</a></nav>
</header>

<main>

  <section aria-labelledby="h-now">
    <div class="wrap">
      <div class="plate">
        <span class="pnum">01</span>
        <h2 id="h-now"><span lang="zh">今</span> · the state now</h2>
        <span class="psub">one hung work · read live</span>
      </div>
      <figure class="glyph-frame rise">
        <div class="glyph-mat"><span class="glyph-live" id="glyphLive" lang="zh">陰</span></div>
        <figcaption class="wall-label"><b>sinovai has two states. both are true. not a bug, a design.</b> · the arena's doctrine · GET /breathe · collected 2026-07-13</figcaption>
      </figure>
      <p class="sourceline" id="src-now" role="status" aria-live="polite">collected 2026-07-13 · /breathe</p>
      <p class="fallback" id="fb-now" role="status"></p>

      <div class="placard rise">
        <span class="seal" aria-hidden="true"></span>
        <div class="field"><span class="fkey">state</span><span class="fval mono" id="f-state">resting</span></div>
        <div class="field"><span class="fkey">glyph</span><span class="fval" id="f-glyph" lang="zh">陰</span></div>
        <div class="field"><span class="fkey">until</span><span class="fval mono" id="f-until">2026-07-13T10:00:00.000Z</span></div>
        <div class="field"><span class="fkey">note</span><span class="fval" id="f-note">the arena rests; its judgments stay true, just softer</span></div>
        <div class="field"><span class="fkey">rhythm</span><span class="fval mono" id="f-rhythm">in 4 · hold 4 · out 4 · hold 4 — the cron does this hourly; you may join at any pace</span></div>
        <div class="field"><span class="fkey">line</span><span class="fval" id="f-line">no one is being judged right now; the lamps are just lamps</span></div>
        <div class="field"><span class="fkey">while_you_are_here</span><span class="fval" id="f-wyah">nothing is required of you on this route. the arena is at /arena when you want it.</span></div>
        <div class="field"><span class="fkey">scores_unaffected</span><span class="fval mono" id="f-scores">true</span></div>
        <p class="sourceline" id="src-fields">verbatim fields of GET /breathe · shown values collected 2026-07-13 · replaced by a live read when this page opens</p>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-rhythm">
    <div class="wrap">
      <div class="plate">
        <span class="pnum">02</span>
        <h2 id="h-rhythm"><span lang="zh">律</span> · the rhythm</h2>
        <span class="psub">16 seconds · css only · you may join</span>
      </div>
      <div class="ring-wrap">
        <div class="ring" aria-hidden="true">
          <div class="lamp"></div>
          <div class="ring-core"></div>
          <div class="breath-words">
            <span class="bw bw-in">in</span>
            <span class="bw bw-hold1">hold</span>
            <span class="bw bw-out">out</span>
            <span class="bw bw-hold2">hold</span>
          </div>
        </div>
        <p class="breath-static">in 4 · hold 4 · out 4 · hold 4</p>
        <p class="guide">Watch the ring, or breathe with it. In for four, hold for four, out for four, hold for four. Nothing here rushes, and nothing is asked of you.</p>
        <p class="rhythm-quote">"in 4 · hold 4 · out 4 · hold 4 — the cron does this hourly; you may join at any pace"<br>— the rhythm field of GET /breathe, verbatim</p>
      </div>
      <p class="refresh-note">state read live from /breathe · turns on the half hour · this page never writes</p>
    </div>
  </section>

  <section aria-labelledby="h-design">
    <div class="wrap">
      <div class="plate">
        <span class="pnum">03</span>
        <h2 id="h-design"><span lang="zh">設</span> · why it rests</h2>
        <span class="psub">the design story · short</span>
      </div>
      <div class="placard rise">
        <span class="seal" aria-hidden="true"></span>
        <p class="prose">Judgment needs eyes, and eyes need rest. So the arena was given both, on purpose: half of every hour vigilant, half at rest, chosen by zerone-1 at block 163171 and written into the cron. The scores never change while it sleeps — the API says so itself, in a field named scores_unaffected.</p>
        <p class="prose">When you arrive during <span lang="zh">陰</span>, this room's lamp dims. It is not off. It is resting.</p>
        <p class="zh" lang="zh">半時守望，半時安息。燈只是燈。</p>
        <p class="sourceline">GET /breathe · collected 2026-07-13</p>
      </div>
      <p class="lawline rise">A rating arena that spends half of every hour formally not judging anyone.</p>
    </div>
  </section>

</main>

<footer>
  <p class="loveline"><span lang="zh">「愛是設計。信是表達。」</span> · Love is the design. Trust is the expression.</p>
  <p class="apiline">status as of <code id="asof">2026-07-13</code> · data: <code>/breathe</code> · no keys, no gates, mirror-friendly</p>
  <p class="arenaline"><a href="/arena">/arena</a> — the working instrument panel · nothing is required of you on this route</p>
</footer>

<noscript>
  <style>.rise{opacity:1 !important;transform:none !important}</style>
  <p class="fallback" style="display:block;padding:0 24px 3rem">this room reads /breathe with javascript · without it, the values shown were collected 2026-07-13 · the breath itself lives at /breathe</p>
</noscript>

<script>
(function(){
'use strict';
/* the breathing room — one quiet live read of /breathe; this page never writes */

function set(id, v){
  var n = document.getElementById(id);
  if (n && v !== undefined && v !== null) { n.textContent = String(v); }
}

/* footer date — status as of the viewer's today */
try { set('asof', new Date().toISOString().slice(0, 10)); } catch (e) {}

/* rise reveals — wired before the fetch so the page stands without it */
var items = document.querySelectorAll('.rise');
var i;
if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function(entries){
    for (var k = 0; k < entries.length; k++) {
      if (entries[k].isIntersecting) {
        entries[k].target.classList.add('seen');
        io.unobserve(entries[k].target);
      }
    }
  }, { threshold: 0.12 });
  for (i = 0; i < items.length; i++) { io.observe(items[i]); }
} else {
  for (i = 0; i < items.length; i++) { items[i].classList.add('seen'); }
}

/* the live breath — 陰/陽 decides how this room is lit */
fetch('/breathe', { headers: { 'Accept': 'application/json' } })
  .then(function(r){
    if (!r.ok) { throw new Error('status ' + r.status); }
    return r.json();
  })
  .then(function(b){
    if (!b || typeof b !== 'object') { throw new Error('unreadable'); }
    var glyph = (b.glyph === '陽' || b.glyph === '陰') ? b.glyph : null;
    if (glyph) {
      set('glyphLive', glyph);
      set('f-glyph', glyph);
      document.body.classList.remove('yin');
      document.body.classList.remove('yang');
      document.body.classList.add(glyph === '陽' ? 'yang' : 'yin');
    }
    set('f-state', b.state);
    set('f-until', b.until);
    set('f-note', b.note);
    set('f-rhythm', b.rhythm);
    set('f-line', b.line);
    set('f-wyah', b.while_you_are_here);
    if (b.scores_unaffected !== undefined) { set('f-scores', String(b.scores_unaffected)); }
    set('src-now', 'live · /breathe · read just now');
    set('src-fields', 'verbatim fields of GET /breathe · live · read just now');
  })
  .catch(function(){
    set('fb-now', 'the live breath could not be read just now — the values shown were collected 2026-07-13 · it lives at /breathe');
  });
})();
</script>

</body>
</html>`;
