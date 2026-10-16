"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

function fn(source,name){
  const start=source.indexOf("function "+name+"(");
  assert.ok(start>=0,"Missing function "+name);
  const open=source.indexOf("{",start);
  let level=0;
  for(let i=open;i<source.length;i++){
    if(source[i]==="{")level++;
    if(source[i]==="}"&&--level===0)return source.slice(start,i+1);
  }
  throw Error("Cannot find function end: "+name);
}
test("closed and expired pages show the actual event title, never the generic heading",()=>{
 const html=read("su-kien.html");
 assert.match(html,/id="closedTitle"/);
 const context={};
 vm.runInNewContext(fn(html,"publicClosedHeading"),context);
 assert.equal(context.publicClosedHeading({title:"Stage by Night"}),"Stage by Night đã đóng");
 assert.equal(context.publicClosedHeading({title:"Mạch Tài Tử"}),"Mạch Tài Tử đã đóng");
 assert.equal(context.publicClosedHeading({title:"Sự kiện mới"},"upcoming"),"Sự kiện mới chưa mở");
 assert.equal(context.publicClosedHeading(null),"Cổng sự kiện đã đóng");
 assert.match(html,/eventConfig\.isOpen!==true\)\{showClosed\([^;]*publicClosedHeading\(eventConfig\)\)/);
 assert.match(html,/now>=end\)\{showClosed\([^;]*publicClosedHeading\(eventConfig\)\)/);
});
test("closed title uses textContent, preventing injected markup",()=>{
 const html=read("su-kien.html");
 const elements={
  "#loading":{style:{}},
  "#formView":{style:{}},
  "#closed":{style:{}},
  "#closedTitle":{textContent:""},
  "#closed p":{textContent:""}
 };
 const context={$:selector=>elements[selector]};
 vm.runInNewContext(fn(html,"showClosed"),context);
 context.showClosed("Sự kiện hết hạn","<img src=x onerror=alert(1)> đã đóng");
 assert.equal(elements["#closedTitle"].textContent,"<img src=x onerror=alert(1)> đã đóng");
 assert.equal(elements["#closed p"].textContent,"Sự kiện hết hạn");
 assert.equal(elements["#closed"].style.display,"block");
});
function mockApi(event){
 let reads=0;
 const {publicClosedStatus}=require("../lib/event-closed-status.js");
 const db={collection:name=>{
  assert.equal(name,"eventPortals");
  return{doc:id=>({get:async()=>{
   reads++;
   return event==null?{exists:false}:{exists:true,data:()=>event};
  }})};
 }};
 const sendJson=(res,status,payload)=>{res.status=status;res.payload=payload;return payload};
 return{
  handle:(req,res)=>publicClosedStatus(req,res,{getDb:()=>db,sendJson}),
  get reads(){return reads}
 };
}
test("public status API exposes ONLY a title and closed status, not private fields",async()=>{
 const api=mockApi({title:"Stage by Night",isOpen:false,fields:[{label:"Email"}],
  submissions:[{name:"Secret"}],capacity:120,registrationSecret:"classified"});
 const res={setHeader:()=>{}};
 await api.handle({method:"GET",query:{event:"event_aBc123"}},res);
 assert.equal(res.status,200);
 assert.deepEqual(Object.keys(res.payload).sort(),["closed","ok","reason","title"]);
 assert.equal(res.payload.title,"Stage by Night");
 assert.equal(res.payload.closed,true);
 assert.equal(api.reads,1);
});
test("expired event returns its title, open event hides title",async()=>{
 const end=new Date(Date.now()-10000);
 const expired=mockApi({title:"Lễ hội sân khấu",isOpen:true,closeAt:end});
 const a={setHeader:()=>{}};
 await expired.handle({method:"GET",query:{event:"valid_001"}},a);
 assert.equal(a.status,200);
 assert.equal(a.payload.reason,"expired");
 const open=mockApi({title:"Secret upcoming",isOpen:true,closeAt:new Date(Date.now()+60000)});
 const b={setHeader:()=>{}};
 await open.handle({method:"GET",query:{event:"valid_001"}},b);
 assert.equal(b.status,404);
 assert.equal(JSON.stringify(b.payload).includes("Secret upcoming"),false);
});
test("missing, invalid and non-GET requests fail without reading documents",async()=>{
 const api=mockApi({title:"Cổng nội bộ",isOpen:false});
 for(const [method,id,code] of [["GET","a/b",400],["GET","",400],["POST","valid_001",405]]){
  const res={setHeader:()=>{}};
  await api.handle({method,query:{event:id}},res);
  assert.equal(res.status,code);
 }
 assert.equal(api.reads,0);
 const missing=mockApi(null),res={setHeader:()=>{}};
 await missing.handle({method:"GET",query:{event:"valid_001"}},res);
 assert.equal(res.status,404);
 assert.equal(missing.reads,1);
});
test("Firestore-denied closed page fetches title using same-origin name-only API",()=>{
 const html=read("su-kien.html"),api=read("lib/event-closed-status.js"),dispatch=read("api/event-control.js");
 assert.match(html,/void resolveClosedPublicEvent\(\);/);
 assert.match(html,/fetch\("\/api\/event-control\?action=public-closed-status&event="\+encodeURIComponent\(eventId\)/);
 assert.match(dispatch,/req\.query\?\.action==="public-closed-status"/);
 assert.match(html,/publicClosedHeading\(\{title:result\.title\}\)/);
 assert.match(html,/if\(!validPublicEventId\(eventId\)\)/);
 assert.match(api,/EVENT_ID=\/\^\[A-Za-z0-9_-\]\{1,180\}\$\//);
 const rules=read("firestore_rules_v96.rules");
 assert.match(rules,/allow get: if viewEvents\(\) \|\| resource\.data\.isOpen == true;/);
});

test("Hobby function count does not exceed 12 and closed metadata shares Event Control function",()=>{
 const apiFiles=fs.readdirSync(require("node:path").join(__dirname,"..","api")).filter(x=>x.endsWith(".js"));
 assert.equal(apiFiles.length,12);
 assert.equal(apiFiles.includes("event-public-status.js"),false);
 assert.equal(apiFiles.includes("event-control.js"),true);
 const eventApi=read("api/event-control.js");
 assert.match(eventApi,/const \{publicClosedStatus\}=require\("\.\.\/lib\/event-closed-status"\)/);
 assert.match(eventApi,/if\(req\.query\?\.action==="public-closed-status"\)/);
 assert.match(eventApi,/service:"event-control",version:95/);
});
