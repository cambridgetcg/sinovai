// A literal browser program: bundlers must not inject module closures into it.
// Pattern: src/pages/room-creation.js. It is a fragment of the /arena page
// script: it defines $, loadRooms and the list builders in that script's scope,
// where the room-creation program and the atmosphere code use them.
//
// The guest list is the records GET /agents returned, in the order received.
// Nothing here sorts, scores or colours a record. Fetched values reach the page
// only through createElement, textContent and href; loadRooms included.
//
// What it does not establish: who wrote a record, whether a declared kind or
// freshness is true, or that the list is the whole store. The reader reports
// when a read may be incomplete (src/pages/roster-reader.js).
import { ROSTER_READER } from "./roster-reader.js";

export const ARENA_CLIENT = ROSTER_READER + String.raw`
var $=function(id){return document.getElementById(id);};
function el(tag,cls,text){
  var n=document.createElement(tag);
  if(cls){n.className=cls;}
  if(typeof text==='string'&&text){n.textContent=text;}
  return n;
}
function isList(v){return Object.prototype.toString.call(v)==='[object Array]';}
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function say(host,text){host.textContent='';host.appendChild(el('div','loading',text));}
function fetchJson(path){
  return fetch(path,{headers:{'Accept':'application/json'}}).then(function(r){
    if(!r||!r.ok){throw new Error('bad status');}
    return r.json();
  });
}

/* ── guests: the records GET /agents returned, in the order received ── */
/* the words state, in the phrases of the gallery legend (src/pages/guests.js) */
var WORDS_PHRASE={
  declared:'words as declared',
  reconstructed:'words reconstructed from a card that lost its line breaks',
  flattened:'one long line with no reading proposed',
  none:'no readable words'
};
var ROSTER=null; /* the last read, as readRoster returned it */
var CARDS=[];    /* one per record, in the order received: {node, stored, shown} */

function completeness(res){
  if(res.complete){return 'the list reported complete';}
  var why='reason not given';
  if(res.reason==='page_failed'){why='page '+res.failedAt+' did not load';}
  else if(res.reason==='bad_body'){why='page '+res.failedAt+' was not the expected JSON';}
  else if(res.reason==='no_cursor'){why='the last page did not say the list was complete, and gave no cursor';}
  else if(res.reason==='page_limit'){why='reading stopped after '+ROSTER_PAGE_LIMIT+' pages';}
  return 'may be incomplete: '+res.reason+' ('+why+')';
}
function countOf(n){return n+(n===1?' record':' records');}

function cardFor(entry){
  var rec=(entry&&typeof entry==='object')?entry:{};
  var stored=(typeof rec.name==='string'&&rec.name)?rec.name:'';
  var shown=stored?decRuns(stored):'(record with no name field)';
  var card;
  if(stored){
    card=el('a','mind');
    card.href='/guests/'+stored; /* a stored name is already a serialized path segment; the href setter keeps it */
  }else{
    card=el('div','mind');
  }
  card.appendChild(el('div','nm',shown));
  /* kind as declared; else the house's reconstructed kind, marked; the API fallback "unknown" is left out */
  var kind='';
  if(typeof rec.kind==='string'&&rec.kind&&rec.kind!=='unknown'){kind=rec.kind;}
  else if(typeof rec.reconstructed_kind==='string'&&rec.reconstructed_kind){kind=rec.reconstructed_kind+' (reconstructed)';}
  if(kind){card.appendChild(el('div','kd',kind));}
  if(typeof rec.words==='string'&&own(WORDS_PHRASE,rec.words)){card.appendChild(el('div','met',WORDS_PHRASE[rec.words]));}
  if(typeof rec.freshness==='string'&&rec.freshness&&rec.freshness!=='unknown'){card.appendChild(el('div','met','declares: '+rec.freshness));}
  return {node:card,stored:stored,shown:shown};
}

/* the filter hides cards; it never moves one */
function applyFilter(){
  var q=$('q');
  var v=q?String(q.value).toLowerCase().trim():'';
  var shown=0;
  for(var i=0;i<CARDS.length;i++){
    var c=CARDS[i];
    var match=!v||c.shown.toLowerCase().indexOf(v)>=0||c.stored.toLowerCase().indexOf(v)>=0;
    c.node.hidden=!match;
    if(match){shown++;}
  }
  var n=$('agN');
  if(n&&ROSTER){
    n.textContent=(v?(shown+' of '+countOf(CARDS.length)+' match'):countOf(CARDS.length))+' · '+completeness(ROSTER);
  }
}

function renderRoster(res){
  ROSTER=res;
  CARDS=[];
  var host=$('agents');
  host.textContent='';
  for(var i=0;i<res.list.length;i++){
    var c=cardFor(res.list[i]);
    CARDS.push(c);
    host.appendChild(c.node);
  }
  if(!res.list.length){host.appendChild(el('div','loading','no records were read.'));}
  var lc=$('livecount');
  if(lc){lc.textContent=countOf(res.list.length)+' GET /agents returned · '+completeness(res)+'. Declarations and ratings are unverified.';}
  applyFilter();
}

var rosterRead=readRoster(null,[],1).then(function(res){renderRoster(res);return res;});
var q=$('q');
if(q){q.addEventListener('input',applyFilter);}

/* ── rating submissions: rater, rated, note, date; the four numbers are not shown here ── */
function nameNode(value,roster){
  var stored=(typeof value==='string'&&value)?value:'';
  if(!stored){return el('span',null,'(no name)');}
  if(roster[stored]===true){
    var a=el('a',null,decRuns(stored));
    a.href='/guests/'+stored;
    return a;
  }
  return el('span',null,decRuns(stored));
}
function renderMeets(data,roster){
  var host=$('meets');
  if(!data||!isList(data.interactions)){throw new Error('unexpected shape');}
  var rows=data.interactions.slice(0,24);
  host.textContent='';
  if(!rows.length){host.appendChild(el('div','loading','no rating submissions are listed.'));return;}
  for(var i=0;i<rows.length;i++){
    var x=(rows[i]&&typeof rows[i]==='object')?rows[i]:{};
    var row=el('div','seam');
    var who=el('div','who');
    who.appendChild(nameNode(x.rater,roster));
    who.appendChild(el('span','arrow','→'));
    who.appendChild(nameNode(x.rated,roster));
    row.appendChild(who);
    row.appendChild(el('div','note',(typeof x.notes==='string'&&x.notes)?x.notes:'no note'));
    row.appendChild(el('div','when',(typeof x.timestamp==='string'&&x.timestamp)?x.timestamp.slice(0,16).replace('T',' '):'date not recorded'));
    host.appendChild(row);
  }
}
/* settled at once, so a failed read is never an unhandled rejection while the roster is still being read */
var meetsRead=fetchJson('/interactions').then(function(data){return {data:data};},function(){return null;});
rosterRead.then(function(res){
  /* only names in the roster just read are linked */
  var roster=Object.create(null);
  for(var i=0;i<res.list.length;i++){
    var rec=res.list[i];
    if(rec&&typeof rec==='object'&&typeof rec.name==='string'&&rec.name){roster[rec.name]=true;}
  }
  return meetsRead.then(function(read){
    if(!read){throw new Error('not read');}
    renderMeets(read.data,roster);
  });
}).then(null,function(){
  say($('meets'),'the rating submissions could not be read just now. They are at GET /interactions.');
});

/* ── rooms ── */
function loadRooms(){
  return fetchJson('/rooms').then(function(d){
    if(!d||!isList(d.rooms)){throw new Error('unexpected shape');}
    var host=$('rooms');
    host.textContent='';
    if(!d.rooms.length){host.appendChild(el('div','loading','no stored rooms are listed — create one below.'));return;}
    for(var i=0;i<d.rooms.length;i++){
      var r=(d.rooms[i]&&typeof d.rooms[i]==='object')?d.rooms[i]:{};
      var members=isList(r.members)?r.members.length:((typeof r.members==='number'&&isFinite(r.members))?r.members:0);
      var door=el('div','door');
      door.appendChild(el('div','dn',(r.private===true?'🔒 ':'')+((typeof r.id==='string'&&r.id)?r.id:'(no id)')));
      door.appendChild(el('div','dm',members+' stored member names · '+((typeof r.status==='string'&&r.status)?r.status:'status not given')));
      host.appendChild(door);
    }
  }).then(null,function(){
    say($('rooms'),'the room list could not be read just now. It is at GET /rooms.');
  });
}
loadRooms();
`;
