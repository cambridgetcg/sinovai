// A literal browser program: bundlers must not inject module closures into it.
// It is a fragment, not a module: it defines decRuns and readRoster in the
// scope of the page script that includes it. /guests and /arena both do.
//
// Lifted from the gallery script (src/pages/guests.js) with one fix. The old
// reader called a read complete whenever it had no cursor left to follow, so a
// page with no agents array, or a page that said list_complete: false and gave
// no cursor, was reported as the whole list. Now a read is complete only when
// its last page held an agents array and list_complete === true.
//
// What it does not establish: that the store returned every key, that a page
// was not changed between two reads, or anything about the records themselves.
export const ROSTER_READER = String.raw`
function decRuns(s){return String(s).replace(/(?:%[0-9A-Fa-f]{2})+/g,function(m){try{return decodeURIComponent(m);}catch(e){return m;}});}

/* Reads GET /agents page by page and keeps the records in the order received.
   Always resolves: {list, complete, reason, pages, failedAt}.
   pages counts the pages read. failedAt is the number of a page that could
   not be used. When complete is false, reason is one of:
     page_failed  no response, or a status outside 200-299
     bad_body     not JSON, or no agents array
     no_cursor    the page did not say list_complete: true and gave no next_cursor
     page_limit   reading stopped after ROSTER_PAGE_LIMIT pages */
var ROSTER_PAGE_LIMIT=20;
function readRoster(cursor,acc,pages){
  var url='/agents'+(cursor?('?cursor='+encodeURIComponent(cursor)):'');
  function stopped(reason){return {list:acc,complete:false,reason:reason,pages:pages-1,failedAt:pages};}
  var request;
  try{request=fetch(url,{headers:{'Accept':'application/json'}});}
  catch(e){return Promise.resolve(stopped('page_failed'));}
  return request.then(function(r){
    if(!r||!r.ok){return stopped('page_failed');}
    return r.json().then(function(data){
      if(!data||Object.prototype.toString.call(data.agents)!=='[object Array]'){return stopped('bad_body');}
      acc=acc.concat(data.agents);
      if(data.list_complete===true){return {list:acc,complete:true,reason:null,pages:pages};}
      var next=(typeof data.next_cursor==='string'&&data.next_cursor)?data.next_cursor:null;
      if(!next){return {list:acc,complete:false,reason:'no_cursor',pages:pages};}
      if(pages>=ROSTER_PAGE_LIMIT){return {list:acc,complete:false,reason:'page_limit',pages:pages};}
      return readRoster(next,acc,pages+1);
    },function(){return stopped('bad_body');});
  }).then(null,function(){return stopped('page_failed');});
}
`;
