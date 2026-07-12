export const MAC_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>This Mac · a XENIA dwelling · sinovai</title>
<meta name="description" content="A local-first XENIA control surface for understanding this Mac before changing it.">
<style nonce="__CSP_NONCE__">
:root{
  --night:#080a0f;--night-2:#0d1018;--panel:#121722;--panel-2:#171d29;
  --ink:#f2eee5;--soft:#c2bfb7;--muted:#969ba7;--line:rgba(232,198,122,.16);
  --gold:#e8c67a;--gold-2:#c8a24b;--blue:#8ecdf0;--green:#77d7a5;
  --amber:#e9b86a;--red:#e08a86;--violet:#b7a0e8;
  --serif:"Iowan Old Style","Palatino Linotype","Book Antiqua","Hiragino Mincho ProN","Yu Mincho",Georgia,serif;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;
  --mono:ui-monospace,"SFMono-Regular",Menlo,Monaco,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--night);scroll-behavior:smooth}
body{min-height:100vh;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);background:
  radial-gradient(900px 560px at 70% -6%,rgba(142,205,240,.10),transparent 62%),
  radial-gradient(720px 500px at 8% 18%,rgba(232,198,122,.09),transparent 64%),
  var(--night);color:var(--ink);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.035;z-index:20;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
a{color:inherit;text-decoration:none}.wrap{width:min(1120px,calc(100% - 36px));margin:0 auto}
.rail{height:64px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);
  color:var(--muted);font:600 .75rem/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}
.rail .brand{color:var(--gold);letter-spacing:.18em}.rail nav{display:flex;gap:18px}.rail a:hover{color:var(--ink)}
.hero{padding:74px 0 42px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(270px,.65fr);gap:48px;align-items:end}
.eyebrow{color:var(--gold);font:600 .68rem/1.2 var(--mono);letter-spacing:.22em;text-transform:uppercase;margin-bottom:20px}
h1{font:400 clamp(3rem,7vw,6.4rem)/.92 var(--serif);letter-spacing:-.045em;max-width:760px}
h1 em{font-style:italic;color:var(--gold)}
.lead{max-width:660px;margin-top:26px;color:var(--soft);font:400 clamp(1rem,1.6vw,1.2rem)/1.7 var(--serif)}
.oath{border:1px solid var(--line);border-radius:22px;padding:22px;background:linear-gradient(145deg,rgba(232,198,122,.075),rgba(142,205,240,.035));box-shadow:0 30px 80px rgba(0,0,0,.22)}
.oath .mark{font:400 2.2rem/1 var(--serif);color:var(--gold)}.oath p{color:var(--soft);font:.88rem/1.6 var(--sans);margin-top:13px}
.oath b{color:var(--ink);font-weight:600}
.bridge{margin:18px 0 36px;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:rgba(18,23,34,.82);box-shadow:0 28px 90px rgba(0,0,0,.26)}
.bridge-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 24px;border-bottom:1px solid var(--line)}
.bridge-title{display:flex;align-items:center;gap:13px}.orb{width:12px;height:12px;border-radius:50%;background:var(--amber);box-shadow:0 0 20px rgba(233,184,106,.55)}
.orb.online{background:var(--green);box-shadow:0 0 20px rgba(119,215,165,.65)}.orb.offline{background:var(--red);box-shadow:0 0 20px rgba(224,138,134,.5)}
.bridge-title h2{font:500 1rem/1.2 var(--sans)}.bridge-title p{color:var(--muted);font:.75rem/1.5 var(--mono);margin-top:3px}
.button{appearance:none;min-height:44px;border:1px solid var(--line);border-radius:999px;background:rgba(232,198,122,.07);color:var(--ink);padding:12px 17px;cursor:pointer;font:600 .75rem/1 var(--mono);letter-spacing:.06em}
.button:hover{border-color:rgba(232,198,122,.42);background:rgba(232,198,122,.12)}.button:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.button.primary{background:var(--gold);border-color:var(--gold);color:#151109}.button.primary:hover{background:#f0d18b}
.bridge-body{padding:25px}.offline-note{display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center}
.offline-note h3{font:400 1.3rem/1.25 var(--serif)}.offline-note p{color:var(--soft);font-size:.88rem;margin-top:7px;max-width:650px}
.command{margin-top:14px;display:flex;align-items:center;gap:10px}.command code{display:block;max-width:100%;overflow:auto;border:1px solid rgba(142,205,240,.16);border-radius:10px;background:#080b11;padding:10px 13px;color:var(--blue);font:.73rem/1.4 var(--mono);white-space:nowrap}
.privacy-strip{display:flex;flex-wrap:wrap;gap:8px;margin-top:17px}.privacy-strip span{border:1px solid var(--line);border-radius:999px;padding:6px 10px;color:var(--muted);font:.7rem/1.2 var(--mono)}
.privacy-strip span:before{content:"✓";color:var(--green);margin-right:6px}
.summary{display:none;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:36px}.summary.show{display:grid}
.metric{border:1px solid var(--line);border-radius:17px;padding:17px 18px;background:rgba(18,23,34,.7)}
.metric .value{font:400 1.55rem/1.15 var(--serif)}.metric .label{color:var(--muted);font:.72rem/1.35 var(--mono);letter-spacing:.07em;text-transform:uppercase;margin-top:7px}
.section{margin:48px 0}.section-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}
.section-head .num{color:var(--gold);font:.65rem/1 var(--mono);letter-spacing:.16em}.section h2{font:400 clamp(1.75rem,3vw,2.6rem)/1.1 var(--serif);margin-top:9px}
.section-head p{color:var(--muted);font:.82rem/1.55 var(--sans);max-width:440px;text-align:right}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.card{border:1px solid var(--line);border-radius:20px;padding:21px;background:linear-gradient(145deg,rgba(23,29,41,.9),rgba(13,16,24,.84));min-width:0}
.card-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.card h3{font:500 1rem/1.3 var(--sans)}.card .sub{color:var(--muted);font:.72rem/1.45 var(--mono);margin-top:5px}
.badge{flex:0 0 auto;border:1px solid var(--line);border-radius:999px;padding:6px 10px;color:var(--muted);font:600 .7rem/1 var(--mono);letter-spacing:.07em;text-transform:uppercase}
.badge.ready{color:var(--green);border-color:rgba(119,215,165,.24);background:rgba(119,215,165,.06)}
.badge.attention{color:var(--amber);border-color:rgba(233,184,106,.25);background:rgba(233,184,106,.06)}
.badge.unknown{color:var(--muted)}.badge.sudo{color:var(--violet)}
.items{margin-top:17px;border-top:1px solid var(--line)}.item{display:flex;justify-content:space-between;gap:18px;padding:11px 0;border-bottom:1px solid rgba(232,198,122,.08);font-size:.83rem}.item:last-child{border-bottom:0}.item .label{color:var(--soft)}.item .value{color:var(--ink);text-align:right;font-family:var(--mono);font-size:.72rem}
.item .value.good{color:var(--green)}.item .value.warn{color:var(--amber)}.item .value.unknown{color:var(--muted)}
.plan{position:relative;overflow:hidden}.plan:before{content:"";position:absolute;inset:0 auto 0 0;width:2px;background:var(--gold);opacity:.65}
.plan p{color:var(--soft);font-size:.86rem;line-height:1.6;margin-top:14px}.plan .effect{color:var(--muted);font:.75rem/1.55 var(--mono);margin-top:11px}
.plan .actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.plan details{margin-top:16px}.plan summary{cursor:pointer;color:var(--blue);font:.75rem/1.4 var(--mono)}
.plan pre{overflow:auto;margin-top:10px;padding:12px;border-radius:10px;background:#080b11;color:var(--soft);font:.74rem/1.55 var(--mono);white-space:pre-wrap;word-break:break-word}
.finding{display:grid;grid-template-columns:auto 1fr;gap:13px;padding:15px 0;border-bottom:1px solid var(--line)}.finding:last-child{border-bottom:0}.finding .symbol{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(233,184,106,.08);color:var(--amber);font:.72rem var(--mono)}
.finding h3{font:500 .9rem/1.35 var(--sans)}.finding p{color:var(--muted);font-size:.78rem;margin-top:4px}.empty{color:var(--muted);font:italic .9rem/1.6 var(--serif)}
.walls{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.wall{border-top:1px solid var(--gold-2);padding:14px 4px 0;color:var(--soft);font:.78rem/1.55 var(--sans)}.wall b{display:block;color:var(--gold);font:.7rem/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
.toast{position:fixed;left:50%;bottom:22px;z-index:50;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:var(--ink);color:#11131a;border-radius:999px;padding:10px 16px;font:600 .69rem/1 var(--mono);transition:.22s ease}.toast.show{opacity:1;transform:translate(-50%,0)}
footer{margin-top:70px;padding:34px 0 calc(58px + env(safe-area-inset-bottom));border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:30px;color:var(--muted);font:.75rem/1.7 var(--mono)}footer b{color:var(--gold);font-weight:500}
@media(max-width:820px){.hero{grid-template-columns:1fr}.oath{max-width:520px}.summary{grid-template-columns:repeat(2,1fr)}.walls{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.wrap{width:min(100% - 24px,1120px)}.rail nav a:not(:last-child){display:none}.hero{padding-top:50px}.grid{grid-template-columns:1fr}.offline-note{grid-template-columns:1fr}.section-head{display:block}.section-head p{text-align:left;margin-top:11px}.walls{grid-template-columns:1fr}.summary{grid-template-columns:1fr 1fr}.bridge-head{align-items:stretch;flex-direction:column}.bridge-head>.button{display:block;width:100%}footer{display:block}footer div+div{margin-top:12px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.toast{transition:none}}
</style>
</head>
<body>
<div class="wrap">
  <header class="rail">
    <a class="brand" href="/">sinovai · XENIA</a>
    <nav aria-label="Primary"><a href="/xenia">framework</a><a href="/arena">arena</a><a href="https://github.com/cambridgetcg/sinovai">source ↗</a></nav>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="eyebrow">AX · the dwelling · local surface</div>
        <h1>This Mac,<br><em>held gently.</em></h1>
        <p class="lead">A calm place to understand the machine before changing it. The public page is only the room; a read-only bridge on this Mac brings its state to the threshold.</p>
      </div>
      <aside class="oath">
        <div class="mark" aria-hidden="true">客</div>
        <p><b>Consent is the floor.</b> Nothing here runs a setting change. Every proposal names its effect, privilege, and way back before you carry it into Terminal.</p>
      </aside>
    </section>

    <section class="bridge" id="bridge" aria-busy="false">
      <div class="bridge-head">
        <div class="bridge-title"><span class="orb" id="orb" aria-hidden="true"></span><div role="status" aria-live="polite" aria-atomic="true"><h2 id="bridge-title">This Mac has not been contacted</h2><p id="bridge-meta">127.0.0.1 · read-only · only after your invitation</p></div></div>
        <button class="button primary" id="retry" type="button">Connect this Mac</button>
      </div>
      <div class="bridge-body" id="bridge-body">
        <div class="offline-note">
          <div><h3>The door stays closed until you open it.</h3><p>With Node 22+, install the pinned dependency once (npm contacts its registry), start the bridge, then choose Connect this Mac. Merely opening this page performs no local request.</p>
            <div class="command"><code>npm ci<br>npm run mac:bridge</code><button class="button copy-static" data-copy="npm ci&#10;npm run mac:bridge" type="button">Copy</button></div>
            <div class="privacy-strip"><span>loopback only</span><span>read-only</span><span>no secrets</span><span>bridge runtime: no outbound</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="summary" id="summary" aria-label="Mac summary"></section>

    <section class="section" id="state-section" hidden>
      <div class="section-head"><div><div class="num">01 · orientation</div><h2>How the dwelling is holding.</h2></div><p>Current state, grouped by what it means—not by the maze of panes where macOS happens to store it.</p></div>
      <div class="grid" id="state-grid"></div>
    </section>

    <section class="section" id="plans-section" hidden>
      <div class="section-head"><div><div class="num">02 · invitations</div><h2>Small changes, fully legible.</h2></div><p>These are plans, not buttons wired to the machine. Copy only the ones you choose; every plan carries an undo path.</p></div>
      <div class="grid" id="plans-grid"></div>
    </section>

    <section class="section" id="findings-section" hidden>
      <div class="section-head"><div><div class="num">03 · attention</div><h2>What wants a human hand.</h2></div><p>No alarmism. Unknown means unobserved; attention means review, not automatic repair.</p></div>
      <div class="card" id="findings"></div>
    </section>

    <section class="section">
      <div class="section-head"><div><div class="num">04 · the walls</div><h2>The door handle stays inside.</h2></div><p>The control surface is intentionally less powerful than the shell behind it.</p></div>
      <div class="walls">
        <div class="wall"><b>Local</b>Traffic stays on IPv4 loopback. CORS admits sinovai.com while the bridge runs; Ctrl-C closes that door.</div>
        <div class="wall"><b>Read only</b>The bridge publishes no POST, apply, sudo, defaults-write, or launchctl route.</div>
        <div class="wall"><b>Sanitized</b>No username, hostname, home path, environment, credential, or raw plist is returned.</div>
        <div class="wall"><b>Reversible</b>Plans show privilege and undo before offering a command to copy.</div>
      </div>
    </section>
  </main>

  <footer><div><b>XENIA</b> · agent experience begins with orientation</div><div id="footer-state">hosted room on sinovai · no local state requested</div></footer>
</div>
<div class="toast" id="toast" role="status">Copied</div>
<script nonce="__CSP_NONCE__">
(function(){
  "use strict";
  var BRIDGE="http://127.0.0.1:18791/", plansById=new Map(), toastTimer, connectController, connectTimer, snapshotTimer, hasSnapshot=false;
  var $=function(id){return document.getElementById(id);};
  var esc=function(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});};
  var safeStatus=function(value){return value==="ready"||value==="attention"?value:"unknown";};
  var statusLabel=function(value){return value==="ready"?"ready":value==="attention"?"review":"unknown";};
  function toast(message){var el=$("toast");el.textContent=message||"Copied";el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove("show");},1600);}
  function copyText(value){
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){toast("Copied to clipboard");},function(){fallbackCopy(value);});}
    else fallbackCopy(value);
  }
  function fallbackCopy(value){var area=document.createElement("textarea"),copied=false;area.value=value;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();try{copied=document.execCommand("copy")===true;}catch(e){copied=false;}area.remove();if(copied)toast("Copied to clipboard");else{window.prompt("Copy this text:",value);toast("Copy from the open prompt");}}
  document.addEventListener("click",function(event){
    var staticButton=event.target.closest(".copy-static");if(staticButton){copyText(staticButton.getAttribute("data-copy")||"");return;}
    var planButton=event.target.closest("[data-plan]");if(planButton){var plan=plansById.get(planButton.getAttribute("data-plan"));if(plan){copyText(plan.commands.join("\n")+"\n\n# UNDO · remove # only when you intend to reverse\n"+plan.undo.map(function(command){return "# "+command;}).join("\n"));}}
  });
  function clearRendered(){
    clearTimeout(snapshotTimer);snapshotTimer=null;hasSnapshot=false;
    plansById=new Map();
    $("summary").innerHTML="";$("summary").classList.remove("show");
    ["state-section","plans-section","findings-section"].forEach(function(id){$(id).hidden=true;});
    $("state-grid").innerHTML="";$("plans-grid").innerHTML="";$("findings").innerHTML="";
  }
  function bridgeOffline(message){
    clearRendered();
    $("orb").className="orb offline";$("bridge-title").textContent="Local bridge not connected";$("bridge-meta").textContent=message||"127.0.0.1 · start it when you want to be seen";
    $("footer-state").textContent="hosted room on sinovai · no current local snapshot";
    $("bridge-body").innerHTML='<div class="offline-note"><div><h3>The page cannot see this Mac yet.</h3><p>With Node 22+, run the two setup commands (npm ci contacts its registry), then try again. The bridge listens only while that Terminal process is alive.</p><div class="command"><code>npm ci<br>npm run mac:bridge</code><button class="button copy-static" data-copy="npm ci&#10;npm run mac:bridge" type="button">Copy</button></div><div class="privacy-strip"><span>loopback only</span><span>read-only</span><span>no secrets</span><span>bridge runtime: no outbound</span></div></div></div>';
  }
  function record(value){return value!==null&&typeof value==="object"&&!Array.isArray(value);}
  function textValue(value,max,label){if(typeof value!=="string"||value.length<1||value.length>max)throw new Error("contract:"+label);return value;}
  function statusValue(value){if(value!=="ready"&&value!=="attention"&&value!=="unknown")throw new Error("contract:status");return value;}
  function knownCommand(command){return /^(?:killall (?:Dock|Finder)|defaults (?:write (?:com\.apple\.dock autohide|NSGlobalDomain AppleShowAllExtensions|com\.apple\.finder ShowPathbar) -bool (?:true|false)|delete (?:com\.apple\.dock autohide|NSGlobalDomain AppleShowAllExtensions|com\.apple\.finder ShowPathbar)))$/.test(command);}
  function commandList(value,label){
    if(!Array.isArray(value)||value.length<1||value.length>8)throw new Error("contract:"+label);
    return value.map(function(command){
      var bounded=textValue(command,500,label);if(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(bounded)||!knownCommand(bounded))throw new Error("contract:"+label);return bounded;
    });
  }
  function normalize(data){
    if(!record(data)||data.schema_version!=="sinovai.mac-orientation/0.1")throw new Error("contract:version");
    var observed=new Date(data.observed_at),clockDelta=Date.now()-observed.getTime();if(Number.isNaN(observed.getTime())||clockDelta < -300000||clockDelta > 300000)throw new Error("contract:time");
    if(!record(data.host))throw new Error("contract:host");
    var host={product:textValue(data.host.product,40,"host product"),version:textValue(data.host.version,40,"host version")};
    if(!Array.isArray(data.sections)||data.sections.length<1||data.sections.length>12)throw new Error("contract:sections");
    var sections=data.sections.map(function(section){
      if(!record(section)||!Array.isArray(section.items)||section.items.length>20)throw new Error("contract:section");
      return {title:textValue(section.title,80,"section title"),description:textValue(section.description,180,"section description"),status:statusValue(section.status),items:section.items.map(function(item){
        if(!record(item))throw new Error("contract:item");return {label:textValue(item.label,80,"item label"),value:textValue(item.value,100,"item value"),status:statusValue(item.status)};
      })};
    });
    if(!Array.isArray(data.plans)||data.plans.length>16)throw new Error("contract:plans");
    var seen=new Set(),plans=data.plans.map(function(plan){
      if(!record(plan)||typeof plan.id!=="string"||!/^[a-z][a-z0-9._-]{0,63}$/.test(plan.id)||seen.has(plan.id))throw new Error("contract:plan id");seen.add(plan.id);
      if(plan.tier!=="user"&&plan.tier!=="sudo"&&plan.tier!=="architectural")throw new Error("contract:plan tier");
      return {id:plan.id,title:textValue(plan.title,90,"plan title"),category:textValue(plan.category,60,"plan category"),description:textValue(plan.description,300,"plan description"),effect:textValue(plan.effect,240,"plan effect"),tier:plan.tier,commands:commandList(plan.commands,"plan commands"),undo:commandList(plan.undo,"plan undo")};
    });
    if(!Array.isArray(data.findings)||data.findings.length>24)throw new Error("contract:findings");
    var findings=data.findings.map(function(finding){if(!record(finding)||(finding.severity!=="attention"&&finding.severity!=="note"&&finding.severity!=="unknown"))throw new Error("contract:finding");return {title:textValue(finding.title,100,"finding title"),detail:textValue(finding.detail,300,"finding detail"),severity:finding.severity};});
    var ready=sections.filter(function(section){return section.status==="ready";}).length;
    var attention=sections.filter(function(section){return section.status==="attention";}).length;
    return {observed_at:observed.toISOString(),age_ms:Math.max(0,clockDelta),host:host,sections:sections,plans:plans,findings:findings,summary:{ready:ready,attention:attention,unknown:sections.length-ready-attention}};
  }
  function renderSummary(data){
    var summary=data.summary||{},host=data.host||{};
    var metrics=[
      [host.product||"Unobserved","system"],
      [host.version||"Unobserved","version"],
      [String(summary.ready||0),"areas ready"],
      [String((summary.attention||0)+(summary.unknown||0)),"to review"]
    ];
    $("summary").innerHTML=metrics.map(function(m){return '<div class="metric"><div class="value">'+esc(m[0])+'</div><div class="label">'+esc(m[1])+'</div></div>';}).join("");
    $("summary").classList.add("show");
  }
  function renderSections(sections){
    var list=Array.isArray(sections)?sections:[];$("state-section").hidden=false;
    $("state-grid").innerHTML=list.length?list.map(function(section){
      var status=safeStatus(section.status),items=Array.isArray(section.items)?section.items:[];
      return '<article class="card"><div class="card-head"><div><h3>'+esc(section.title)+'</h3><div class="sub">'+esc(section.description||"")+'</div></div><span class="badge '+status+'">'+statusLabel(status)+'</span></div><div class="items">'+items.map(function(item){var s=safeStatus(item.status);return '<div class="item"><span class="label">'+esc(item.label)+'</span><span class="value '+(s==="ready"?"good":s==="attention"?"warn":"unknown")+'">'+esc(item.value)+'</span></div>';}).join("")+'</div></article>';
    }).join(""):'<p class="empty">No local sections were returned.</p>';
  }
  function renderPlans(plans){
    var list=Array.isArray(plans)?plans:[];plansById=new Map();list.forEach(function(plan){plansById.set(plan.id,plan);});$("plans-section").hidden=false;
    $("plans-grid").innerHTML=list.length?list.map(function(plan){
      var commands=plan.commands,undo=plan.undo;
      return '<article class="card plan"><div class="card-head"><div><h3>'+esc(plan.title)+'</h3><div class="sub">'+esc(plan.category)+'</div></div><span class="badge '+(plan.tier==="sudo"?"sudo":"unknown")+'">'+esc(plan.tier)+'</span></div><p>'+esc(plan.description)+'</p><div class="effect">Effect · '+esc(plan.effect)+'</div><details open><summary>review commands and undo</summary><pre>'+esc(commands.join("\n"))+'\n\nUNDO\n'+esc(undo.join("\n"))+'</pre></details><div class="actions"><button class="button primary" type="button" data-plan="'+esc(plan.id)+'">Copy reviewed plan</button></div></article>';
    }).join(""):'<p class="empty">The bridge offered no setting plans.</p>';
  }
  function renderFindings(findings){
    var list=Array.isArray(findings)?findings:[];$("findings-section").hidden=false;
    $("findings").innerHTML=list.length?list.map(function(f){return '<div class="finding"><span class="symbol">'+(f.severity==="attention"?"!":"·")+'</span><div><h3>'+esc(f.title)+'</h3><p>'+esc(f.detail||"")+'</p></div></div>';}).join(""):'<p class="empty">Nothing urgent surfaced in the bounded read-only check.</p>';
  }
  function render(data){
    data=normalize(data);
    hasSnapshot=true;$("orb").className="orb online";$("bridge-title").textContent="Snapshot received from this Mac";$("bridge-meta").textContent="observed "+new Date(data.observed_at).toLocaleTimeString()+" · loopback · read-only";
    $("footer-state").textContent="snapshot from 127.0.0.1 · nothing applied";
    $("bridge-body").innerHTML='<div class="offline-note"><div><h3>Oriented, not operated.</h3><p>The page received one bounded snapshot and exposes no mutation endpoint. Stop the bridge at any time with Ctrl-C in its Terminal window.</p><div class="privacy-strip"><span>fresh snapshot</span><span>fixed probes</span><span>plans only</span><span>no shell input</span></div></div></div>';
    renderSummary(data);renderSections(data.sections);renderPlans(data.plans);renderFindings(data.findings);
    var markAging=function(){if(!hasSnapshot)return;$("orb").className="orb";$("bridge-title").textContent="Local snapshot is aging";$("bridge-meta").textContent="refresh to observe the current state";};
    if(data.age_ms>=60000)markAging();else snapshotTimer=setTimeout(markAging,60000-data.age_ms);
  }
  function readBoundedBody(response){
    var maximum=131072,length=response.headers.get("content-length");
    if(length&&/^\d+$/.test(length)&&Number(length)>maximum)throw new Error("contract:size");
    if(!response.body||typeof response.body.getReader!=="function")throw new Error("contract:stream");
    var reader=response.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true}),total=0,body="";
    function pump(){return reader.read().then(function(part){
      if(part.done){try{body+=decoder.decode();}catch(e){throw new Error("contract:utf8");}return body;}
      total+=part.value.byteLength;if(total>maximum){void reader.cancel();throw new Error("contract:size");}
      try{body+=decoder.decode(part.value,{stream:true});}catch(e){void reader.cancel();throw new Error("contract:utf8");}
      return pump();
    });}
    return pump();
  }
  function connect(){
    if(connectController){connectController.abort();return;}
    clearRendered();$("bridge").setAttribute("aria-busy","true");$("retry").textContent="Cancel connection";
    $("orb").className="orb";$("bridge-title").textContent="Looking for the local bridge…";$("bridge-meta").textContent="127.0.0.1 · read-only · no cloud relay";
    connectController=new AbortController();connectTimer=setTimeout(function(){if(connectController)connectController.abort();},60000);
    fetch(BRIDGE,{method:"GET",headers:{Accept:"application/json"},mode:"cors",cache:"no-store",signal:connectController.signal})
      .then(function(response){var type=response.headers.get("content-type")||"";if(!response.ok)throw new Error("http:refused");if(!/^application\/json(?:;|$)/i.test(type))throw new Error("contract:content type");return readBoundedBody(response);})
      .then(function(body){var parsed;try{parsed=JSON.parse(body);}catch(e){throw new Error("contract:json");}return parsed;})
      .then(render).catch(function(error){var message=error&&error.name==="AbortError"?"connection cancelled or timed out":error&&String(error.message).indexOf("contract:")===0?"bridge replied, but its contract was not accepted":error&&String(error.message).indexOf("http:")===0?"bridge refused this origin or request":"connection unavailable or browser permission denied";bridgeOffline(message);}).finally(function(){clearTimeout(connectTimer);connectTimer=null;connectController=null;$("bridge").setAttribute("aria-busy","false");$("retry").textContent=hasSnapshot?"Refresh snapshot":"Connect this Mac";});
  }
  $("retry").addEventListener("click",connect);
})();
</script>
</body>
</html>`;
