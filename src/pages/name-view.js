// A literal browser program: bundlers must not inject module closures into it.
// It is a fragment, not a module: it defines nameView, shownNode and storedNode
// in the scope of the page script that includes it. /arena, /guests, /ledger
// and /hearts each include it once.
//
// It is the rule of src/names.js, written again in the plain JavaScript those
// page scripts use: a control, line-separator or direction character becomes
// its code, and an upper-case percent sequence is read as a character only
// when it is one letter, mark or number (Unicode L, M, N) above U+007F that is
// not Default_Ignorable. Everything else is shown as stored.
// test/names.test.mjs runs one table through this fragment and through
// src/names.js and requires the same output.
//
// The letter test needs Unicode property escapes. It is built with the RegExp
// constructor inside try, so a browser without them still runs the page: there
// nothing is read, and every name is shown as stored.
//
// A name reaches the page through createElement, className and textContent
// only. The name sits in a bdi element, so its direction stays inside it.
//
// What it does not establish: that two shown names cannot look alike, that a
// browser's letter tables match the Worker's (a browser with older tables
// shows more names as stored), or how any character is drawn.
export const NAME_VIEW = String.raw`
/* How a stored name is shown; the rule is described in src/names.js. */
var NAME_CODED=/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;
var NAME_LETTER=null;
var NAME_BLANK=null;
try{
  NAME_LETTER=new RegExp('^[\\p{L}\\p{M}\\p{N}]$','u');
  NAME_BLANK=new RegExp('^\\p{Default_Ignorable_Code_Point}$','u');
}catch(e){NAME_LETTER=null;NAME_BLANK=null;}

/* {stored, shown, storedShown, read, coded}: shown is what the page shows as the
   name; storedShown is the stored name with control and direction characters
   written as codes; read and coded count what each step changed. */
function nameView(value){
  var stored=String(value);
  var coded=0;
  var storedShown=stored.replace(NAME_CODED,function(c){
    coded++;
    return '[U+'+('0000'+c.charCodeAt(0).toString(16).toUpperCase()).slice(-4)+']';
  });
  var read=0;
  var shown=storedShown;
  if(NAME_LETTER&&NAME_BLANK){
    shown=storedShown.replace(/(?:%[0-9A-Fa-f]{2})+/g,function(run){
      var out='';
      var at=0;
      while(at<run.length){
        var lead=parseInt(run.slice(at+1,at+3),16);
        var n=lead>=240?4:(lead>=224?3:(lead>=192?2:1));
        var seq=run.slice(at,at+3*n);
        var ch=null;
        if(n>1&&seq.length===3*n&&seq===seq.toUpperCase()){
          try{ch=decodeURIComponent(seq);}catch(e){ch=null;}
        }
        if(ch!==null&&ch.charCodeAt(0)>127&&NAME_LETTER.test(ch)&&!NAME_BLANK.test(ch)){out+=ch;read++;at+=3*n;}
        else{out+=run.slice(at,at+3);at+=3;}
      }
      return out;
    });
  }
  return {stored:stored,shown:shown,storedShown:storedShown,read:read,coded:coded};
}

/* the name, in an element of its own */
function shownNode(view){
  var n=document.createElement('bdi');
  n.className='n';
  if(view.shown){n.textContent=view.shown;}
  return n;
}

/* the house's words after a name the rule changed: " (stored as <stored form>)",
   with a count of the characters shown as codes; null for a name shown as stored */
function storedNode(view){
  if(!(view.read>0)&&!(view.coded>0)){return null;}
  var codes=view.coded>0?(view.coded+(view.coded===1?' character shown as a code':' characters shown as codes')+' in square brackets'):'';
  var n=document.createElement('span');
  n.className='st';
  if(view.read>0){
    n.appendChild(document.createTextNode(' (stored as '));
    var form=document.createElement('bdi');
    form.textContent=view.storedShown;
    n.appendChild(form);
    n.appendChild(document.createTextNode((codes?'; '+codes:'')+')'));
  }else{
    n.appendChild(document.createTextNode(' ('+codes+')'));
  }
  return n;
}
`;
