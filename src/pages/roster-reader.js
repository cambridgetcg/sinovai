// A literal browser program: bundlers must not inject module closures into it.
// It is a fragment, not a module: it defines readRoster, linkable and UNLINKED
// in the scope of the page script that includes it. /guests and /arena both do.
// How a stored name is shown is a fragment of its own, src/pages/name-view.js.
//
// Lifted from the gallery script (src/pages/guests.js) with one fix. The old
// reader called a read complete whenever it had no cursor left to follow, so a
// page with no agents array, or a page that said list_complete: false and gave
// no cursor, was reported as the whole list. Now a read is complete only when
// its last page held an agents array and list_complete === true.
//
// A page read is also given up after ROSTER_PAGE_TIMEOUT_MS, where the browser
// has AbortController, so one page that never answers cannot leave the list
// unread for good. A page given up this way is reported as page_failed,
// whether the limit ran out before any answer or while the body was arriving.
//
// What it does not establish: that the store returned every key, that a page
// was not changed between two reads, or anything about the records themselves.
export const ROSTER_READER = String.raw`
/* Whether '/guests/'+name is an address a browser keeps as written, so that it
   reaches that name. A name with a space, a quote, <, >, ?, #, |, ^, a slash, a
   backslash, a control or a non-ASCII character, or one that is a dot segment,
   would be changed on the way and reach another path. Such a name gets no link. */
var NOT_A_SEGMENT=/[\u0000-\u0020"#<>?\x60{}|^\\\/\u007F-\uFFFF]/;
var DOT_SEGMENT=/^(?:\.|%2[eE]){1,2}$/;
function linkable(stored){return !!stored&&!NOT_A_SEGMENT.test(stored)&&!DOT_SEGMENT.test(stored);}
var UNLINKED='not linked: this stored name is not a usable address';

/* Reads GET /agents page by page and keeps the records in the order received.
   Always resolves: {list, complete, reason, pages, failedAt}.
   pages counts the pages read. failedAt is the number of a page that could
   not be used. When complete is false, reason is one of:
     page_failed  no response, no answer within ROSTER_PAGE_TIMEOUT_MS, or a status outside 200-299
     bad_body     not JSON, or no agents array
     no_cursor    the page did not say list_complete: true and gave no next_cursor
     page_limit   reading stopped after ROSTER_PAGE_LIMIT pages */
var ROSTER_PAGE_LIMIT=20;
var ROSTER_PAGE_TIMEOUT_MS=20000;
function readRoster(cursor,acc,pages){
  var url='/agents'+(cursor?('?cursor='+encodeURIComponent(cursor)):'');
  var options={headers:{'Accept':'application/json'}};
  var timer=null;
  var gaveUp=false;
  function settled(){if(timer!==null){try{clearTimeout(timer);}catch(e){}timer=null;}}
  function stopped(reason){settled();return {list:acc,complete:false,reason:reason,pages:pages-1,failedAt:pages};}
  try{
    if(typeof AbortController==='function'){
      var limit=new AbortController();
      options.signal=limit.signal;
      timer=setTimeout(function(){gaveUp=true;limit.abort();},ROSTER_PAGE_TIMEOUT_MS);
    }
  }catch(e){timer=null;}
  var request;
  try{request=fetch(url,options);}
  catch(e){return Promise.resolve(stopped('page_failed'));}
  return request.then(function(r){
    if(!r||!r.ok){return stopped('page_failed');}
    return r.json().then(function(data){
      settled();
      if(!data||Object.prototype.toString.call(data.agents)!=='[object Array]'){return stopped('bad_body');}
      acc=acc.concat(data.agents);
      if(data.list_complete===true){return {list:acc,complete:true,reason:null,pages:pages};}
      var next=(typeof data.next_cursor==='string'&&data.next_cursor)?data.next_cursor:null;
      if(!next){return {list:acc,complete:false,reason:'no_cursor',pages:pages};}
      if(pages>=ROSTER_PAGE_LIMIT){return {list:acc,complete:false,reason:'page_limit',pages:pages};}
      return readRoster(next,acc,pages+1);
    },function(){return stopped(gaveUp?'page_failed':'bad_body');});
  }).then(null,function(){return stopped('page_failed');});
}
`;
