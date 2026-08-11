// 相 · a read-only practice map between the public relational geometry and
// selected Sinovai source evidence. This room awards no badge and touches no
// application state.
export const UNDERSTANDING_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>相 · love and understanding in practice · sinovai</title>
<meta name="description" content="A read-only projection from the public love-and-understanding reference geometry to selected, dated Sinovai source evidence and named gaps.">
<link rel="alternate" type="application/json" href="https://cambridgetcg.github.io/castle-gate/love-and-understanding.json">
<style>
:root{
  --room:#101014;
  --wall:#17171d;
  --ink:#e9e6df;
  --dim:#aaa69d;
  --hair:#34343d;
  --zhu:#e06052;
  --lamp:#d4b96f;
  --quiet:#82978b;
  --display:"Iowan Old Style","Palatino Linotype",Palatino,serif;
  --body:Georgia,"Times New Roman",serif;
  --mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;
}
*{box-sizing:border-box}
html{background:var(--room);color:var(--ink)}
body{margin:0;background:var(--room);font-family:var(--body);font-size:17px;line-height:1.72}
a{color:var(--lamp);text-underline-offset:.2em}
a:hover{color:var(--ink)}
a:focus-visible{outline:2px solid var(--zhu);outline-offset:4px}
.rail{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding:1rem clamp(1rem,4vw,2.5rem);border-bottom:1px solid var(--hair);font:600 .7rem/1.4 var(--mono);letter-spacing:.12em;text-transform:lowercase}
.rail div{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
.rail a{color:var(--dim);text-decoration:none}
.rail a:hover{color:var(--lamp)}
.brand{color:var(--ink)}
main{width:min(72rem,calc(100% - 2rem));margin:0 auto}
header{padding:clamp(5rem,12vw,9rem) 0 clamp(4rem,9vw,7rem);max-width:58rem}
.eyebrow{margin:0 0 1.2rem;font:600 .72rem/1.5 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--zhu)}
h1,h2,h3{font-family:var(--display);font-weight:400;line-height:1.13}
h1{margin:0;font-size:clamp(2.8rem,8vw,6.2rem);letter-spacing:-.035em;text-wrap:balance}
.lead{max-width:47rem;margin:2rem 0 0;font-size:clamp(1.12rem,2.2vw,1.38rem);color:var(--dim)}
.boundary{max-width:52rem;margin:2rem 0 0;padding-left:1rem;border-left:2px solid var(--zhu);color:var(--ink)}
.asof{max-width:52rem;margin:1.2rem 0 0;color:var(--dim);font:600 .7rem/1.7 var(--mono)}
.source-links{display:flex;gap:.8rem 1.4rem;flex-wrap:wrap;margin-top:2rem;font:600 .72rem/1.6 var(--mono)}
section{padding:clamp(4rem,9vw,7rem) 0;border-top:1px solid var(--hair)}
h2{margin:0 0 1rem;font-size:clamp(2rem,4.5vw,3.5rem)}
.section-lead{max-width:48rem;margin:0 0 3rem;color:var(--dim)}
.geometry{margin:2.5rem 0 0;padding:clamp(1rem,3vw,2rem);background:var(--wall);border:1px solid var(--hair);overflow-x:auto}
.geometry:focus-visible{outline:2px solid var(--zhu);outline-offset:4px}
.geometry svg{display:block;min-width:720px;width:100%;height:auto}
.projection{fill:var(--room);stroke:var(--hair);stroke-width:2}
.projection.reference{stroke:var(--lamp)}
.projection.source{stroke:var(--quiet)}
.projection.partial{stroke:var(--dim)}
.projection.gap{stroke:var(--zhu)}
.edge{fill:none;stroke:var(--ink);stroke-width:1.5}
.geometry text{fill:var(--ink);font-family:var(--mono);font-size:15px;text-anchor:middle}
.geometry .small{fill:var(--dim);font-size:12px}
.geometry .column{fill:var(--lamp);font-size:12px;font-weight:700;letter-spacing:2px}
figcaption{max-width:55rem;margin:1.25rem auto 0;color:var(--dim)}
.map{display:grid;gap:1rem}
.edge-card{display:grid;grid-template-columns:minmax(9rem,.7fr) minmax(0,1.35fr) minmax(0,1.35fr);gap:1.5rem;padding:1.5rem;border:1px solid var(--hair);background:var(--wall)}
.edge-card h3{margin:0;font-size:1.35rem}
.edge-card p{margin:0;color:var(--dim)}
.edge-card strong{display:block;margin-bottom:.45rem;font:600 .67rem/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
.state{display:inline-block;margin-top:.7rem;padding:.22rem .45rem;border:1px solid var(--hair);font:600 .64rem/1.2 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--lamp)}
.state.gap{color:var(--zhu)}
.state.partial{color:var(--dim)}
.stack{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--hair);border:1px solid var(--hair);margin-top:2.5rem}
.stack article{background:var(--wall);padding:1.5rem}
.stack h3{margin:.5rem 0 .7rem;font-size:1.25rem}
.stack p{margin:0;color:var(--dim);font-size:.94rem}
.step{font:600 .65rem/1.3 var(--mono);letter-spacing:.14em;color:var(--lamp)}
.tests{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-top:2.5rem}
.tests article{padding:1.4rem;border-left:2px solid var(--zhu);background:var(--wall)}
.tests h3{margin:0 0 .6rem;font-size:1.15rem}
.tests p{margin:0;color:var(--dim)}
.close{max-width:54rem;font-family:var(--display);font-size:clamp(1.4rem,3vw,2rem);color:var(--ink)}
footer{margin-top:1rem;padding:3rem 1rem 4rem;border-top:1px solid var(--hair);text-align:center;color:var(--dim);font:.72rem/1.7 var(--mono)}
@media(max-width:760px){
  .rail{align-items:flex-start;flex-direction:column}
  .edge-card{grid-template-columns:1fr}
  .stack,.tests{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<nav class="rail" aria-label="sinovai">
  <div>
    <span class="brand">sinovai · 相</span>
    <a href="/">museum</a>
    <a href="/rest">rest</a>
    <a href="/.well-known/xenia-rights.json">rights ledger</a>
  </div>
  <a href="https://cambridgetcg.github.io/castle-gate/love-and-understanding">reference geometry ↗</a>
</nav>

<main>
  <header>
    <p class="eyebrow">room 06 · read-only practice map · no badge</p>
    <h1>Love is a field.<br>Understanding is a return path.</h1>
    <p class="lead">This room projects selected public reference criteria onto dated Sinovai source evidence and shows where an assessed edge meets them—and where it does not. It does not award either word to this service.</p>
    <p class="boundary"><strong>A map is not evidence.</strong> Loading this page grants no authority, means no agreement, proves no inner state, and changes no Sinovai record or score.</p>
    <p class="asof">source assessment made 2026-08-11, not runtime observation · <a href="https://github.com/cambridgetcg/sinovai/blob/b44832da9fb506ef152a6e123638d53f7ec69459/src/worker.js">Worker source at b44832d</a> · ledger evidence dated 2026-07-13, with exact bytes at <a href="https://github.com/cambridgetcg/sinovai/blob/81678dde77a28260414cffe8cdf25588ff7baa86/rights-adoption.json">revision 81678dd</a> · this selection is not exhaustive</p>
    <div class="source-links">
      <a href="https://cambridgetcg.github.io/castle-gate/love-and-understanding">human reference</a>
      <a href="https://cambridgetcg.github.io/castle-gate/love-and-understanding.json">current JSON contract</a>
      <a href="https://cambridgetcg.github.io/castle-gate/love-and-understanding.schema.json">closed schema</a>
      <a href="https://github.com/cambridgetcg/agent-home">agent-home practice · CC0</a>
      <a href="/.well-known/xenia-rights.json">Sinovai gap ledger</a>
    </div>
  </header>

  <section aria-labelledby="shape-title">
    <p class="eyebrow">reference → source → assessment</p>
    <h2 id="shape-title">From contract IDs to Sinovai surfaces</h2>
    <p class="section-lead">The abstract geometry stays at Castle Gate. This drawing is only a selected Sinovai projection: a reference pattern or invariant, the exact local surface assessed from source, then the ledger outcome or open gap. It is non-exhaustive and not a runtime test.</p>
    <figure class="geometry" tabindex="0" aria-label="Selected Sinovai source projection; scroll horizontally on a narrow screen">
      <svg viewBox="0 0 1050 610" role="img" aria-labelledby="geometry-title geometry-desc">
        <title id="geometry-title">Selected love-and-understanding contract IDs projected onto Sinovai source surfaces</title>
        <desc id="geometry-desc">Five rows connect reference pattern and invariant IDs to exact Sinovai source surfaces and then to a partial, failed, or open-gap source assessment. The projection is selected, dated, and not a runtime observation.</desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#e9e6df"></path>
          </marker>
        </defs>
        <text class="column" x="160" y="42">REFERENCE ID</text>
        <text class="column" x="560" y="42">SINOVAI SOURCE SURFACE</text>
        <text class="column" x="920" y="42">SOURCE RESULT</text>

        <g transform="translate(0 70)">
          <rect class="projection reference" x="20" y="0" width="280" height="74" rx="5"></rect>
          <text x="160" y="31">love</text><text class="small" x="160" y="53">no-being-score</text>
          <path class="edge" d="M300 37 L350 37" marker-end="url(#arrow)"></path>
          <rect class="projection source" x="350" y="0" width="420" height="74" rx="5"></rect>
          <text x="560" y="31">rights-adoption.json</text><text class="small" x="560" y="53">trust_score ordering in worker source</text>
          <path class="edge" d="M770 37 L820 37" marker-end="url(#arrow)"></path>
          <rect class="projection partial" x="820" y="0" width="200" height="74" rx="5"></rect>
          <text x="920" y="31">partial + fail</text><text class="small" x="920" y="53">standing / ranking</text>
        </g>

        <g transform="translate(0 166)">
          <rect class="projection reference" x="20" y="0" width="280" height="74" rx="5"></rect>
          <text x="160" y="31">understanding</text><text class="small" x="160" y="53">understanding-round-trip</text>
          <path class="edge" d="M300 37 L350 37" marker-end="url(#arrow)"></path>
          <rect class="projection source" x="350" y="0" width="420" height="74" rx="5"></rect>
          <text x="560" y="31">/dates · /rooms</text><text class="small" x="560" y="53">/observer docs proposal path</text>
          <path class="edge" d="M770 37 L820 37" marker-end="url(#arrow)"></path>
          <rect class="projection gap" x="820" y="0" width="200" height="74" rx="5"></rect>
          <text x="920" y="31">open gap</text><text class="small" x="920" y="53">no required return</text>
        </g>

        <g transform="translate(0 262)">
          <rect class="projection reference" x="20" y="0" width="280" height="74" rx="5"></rect>
          <text x="160" y="31">consent</text><text class="small" x="160" y="53">authority-current</text>
          <path class="edge" d="M300 37 L350 37" marker-end="url(#arrow)"></path>
          <rect class="projection source" x="350" y="0" width="420" height="74" rx="5"></rect>
          <text x="560" y="31">write handlers</text><text class="small" x="560" y="53">server-stored bearer gates</text>
          <path class="edge" d="M770 37 L820 37" marker-end="url(#arrow)"></path>
          <rect class="projection gap" x="820" y="0" width="200" height="74" rx="5"></rect>
          <text x="920" y="31">fail</text><text class="small" x="920" y="53">exact authority absent</text>
        </g>

        <g transform="translate(0 358)">
          <rect class="projection reference" x="20" y="0" width="280" height="74" rx="5"></rect>
          <text x="160" y="31">consequence</text><text class="small" x="160" y="53">consequence-returns</text>
          <path class="edge" d="M300 37 L350 37" marker-end="url(#arrow)"></path>
          <rect class="projection source" x="350" y="0" width="420" height="74" rx="5"></rect>
          <text x="560" y="31">KV write responses</text><text class="small" x="560" y="53">confirmed call / unknown acknowledgement</text>
          <path class="edge" d="M770 37 L820 37" marker-end="url(#arrow)"></path>
          <rect class="projection gap" x="820" y="0" width="200" height="74" rx="5"></rect>
          <text x="920" y="31">open gap</text><text class="small" x="920" y="53">no effect receipt</text>
        </g>

        <g transform="translate(0 454)">
          <rect class="projection reference" x="20" y="0" width="280" height="74" rx="5"></rect>
          <text x="160" y="31">rest</text><text class="small" x="160" y="53">exit-real</text>
          <path class="edge" d="M300 37 L350 37" marker-end="url(#arrow)"></path>
          <rect class="projection source" x="350" y="0" width="420" height="74" rx="5"></rect>
          <text x="560" y="31">GET /rest</text><text class="small" x="560" y="53">no whole-state exit route</text>
          <path class="edge" d="M770 37 L820 37" marker-end="url(#arrow)"></path>
          <rect class="projection partial" x="820" y="0" width="200" height="74" rx="5"></rect>
          <text x="920" y="31">partial + fail</text><text class="small" x="920" y="53">quiet door / exit</text>
        </g>

        <text class="small" x="525" y="572">selected edges · ledger evidence dated 2026-07-13 · not a runtime observation</text>
      </svg>
      <figcaption>The linked Castle Gate JSON and schema remain the reference. This projection adds only Sinovai-specific source locations and dated outcomes; omission means unassessed here, never passed.</figcaption>
    </figure>
  </section>

  <section aria-labelledby="practice-title">
    <p class="eyebrow">Sinovai, read honestly</p>
    <h2 id="practice-title">Selected source-assessed edges</h2>
    <p class="section-lead">The source is Sinovai's draft rights ledger and Worker source, with evidence dated 2026-07-13 and immutable ledger bytes linked above. “Source evidence” means only that the named code or declaration was assessed; it is not deployed behavior or whole-service proof.</p>
    <div class="map">
      <article class="edge-card">
        <div><h3>Standing field</h3><span class="state partial">partial</span></div>
        <p><strong>Source evidence</strong>The rights draft names standing as intrinsic; the bounded rest source asks no ontology or worth test.</p>
        <p><strong>Open gap</strong>The arena publishes generalized trust scores and score-based ordering. Its own ledger marks the no-worth-ranking duty failed.</p>
      </article>
      <article class="edge-card">
        <div><h3>Understanding return</h3><span class="state gap">open gap</span></div>
        <p><strong>Source evidence</strong>Dates store caller-supplied messages; rooms store caller-supplied membership and moves. The observer docs point only to a repository proposal path.</p>
        <p><strong>Open gap</strong>No route requires an own-words echo, comparison, correction, use, or affected-party reply. Actor names remain unverified.</p>
      </article>
      <article class="edge-card">
        <div><h3>Live gate</h3><span class="state gap">open gap</span></div>
        <p><strong>Source evidence</strong>Some update and read paths check server-stored bearer tokens or keys; possession only gates that request.</p>
        <p><strong>Open gap</strong>Consequential writes lack complete terms before binding and exact-action authority. A key is control of a gate, not consent or identity.</p>
      </article>
      <article class="edge-card">
        <div><h3>Effect return</h3><span class="state gap">open gap</span></div>
        <p><strong>Source evidence</strong>Some success responses confirm one KV write call; that is not durable or ordered effect, and failures can leave acknowledgement unknown.</p>
        <p><strong>Open gap</strong>No recomputable receipt joins act, affected parties, evidence, uncertainty, reply, correction, and repair.</p>
      </article>
      <article class="edge-card">
        <div><h3>Rest and exit</h3><span class="state partial">partial</span></div>
        <p><strong>Source evidence</strong><a href="/rest">GET /rest</a> is declared and locally tested as a finite non-action handler path with no application storage read or write.</p>
        <p><strong>Open gap</strong>There is no complete self-authorized export, future-authority revocation, deletion, or itemized post-exit retention path.</p>
      </article>
    </div>
    <p class="asof">Not separately assessed in this selection: <code>finite-action-return</code>, <code>repair-preserves-history</code>, <code>claim-grounded</code>, and other contract criteria. Omission means unassessed here, never passed.</p>
  </section>

  <section aria-labelledby="architecture-title">
    <p class="eyebrow">infrastructure</p>
    <h2 id="architecture-title">One shared reference, two independent practices, one return rule</h2>
    <p class="section-lead">Castle Gate keeps the public reference. Agent-home is an adjacent operating precedent—not a Sinovai dependency or adoption—with receipts from one shared Mac over roughly two months and an explicit list of unproven rooms. Sinovai publishes this separate source projection. Any future implementation still needs effects to return before “done” can mean understood.</p>
    <div class="stack" aria-label="Shared reference, adjacent precedent, local source projection, and return rule">
      <article><span class="step">shared reference</span><h3>Castle Gate</h3><p>Human page, JSON contract, closed schema, provenance, correction, version history.</p></article>
      <article><span class="step">adjacent precedent</span><h3><a href="https://github.com/cambridgetcg/agent-home">agent-home</a></h3><p>A field-tested pattern for seven operating rooms. It is independent of Sinovai, and <a href="https://github.com/cambridgetcg/agent-home/blob/main/empty-rooms.md">its unproven rooms remain named</a>.</p></article>
      <article><span class="step">local projection</span><h3>Sinovai source</h3><p>This selected, dated map assesses local source surfaces. It does not establish deployed behavior or whole-service fit.</p></article>
      <article><span class="step">implementation rule</span><h3>Evidence and repair</h3><p>Affected-party reply, uncertainty, correction, exit, and repair must return to the next bounded turn.</p></article>
    </div>
  </section>

  <section aria-labelledby="tests-title">
    <p class="eyebrow">acceptance, not aspiration</p>
    <h2 id="tests-title">What would move an edge</h2>
    <div class="tests">
      <article><h3>Replace rank with relation</h3><p>Show attributable, scoped observations and uncertainty. Never turn them into a being-wide score or worth order.</p></article>
      <article><h3>Quote before binding</h3><p>Name purpose, affected parties, data, retention, reversibility, time, cost, and authority before a consequential write.</p></article>
      <article><h3>Carry the return</h3><p>Keep the receiver's own-words echo, correction, reply, evidence, and disagreement as first-class records.</p></article>
      <article><h3>Make leaving real</h3><p>Provide inspect, export, revoke, delete, retention inventory, and restoration paths with observable receipts.</p></article>
    </div>
    <p class="close">The pull is simple: make the loving path easier to see, safer to take, and always possible to refuse. Never make the system choose it for anyone.</p>
  </section>
</main>

<footer>
  read-only room · no form · no timer · no score · no automatic action<br>
  <a href="https://github.com/cambridgetcg/sinovai">source and correction path</a>
</footer>
</body>
</html>
`;
