"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const C=require("../member-compare-core.js");
const source=rel=>fs.readFileSync(path.join(__dirname,"..",rel),"utf8");

test("matched IDs show names from OSC roster, never external uploaded names",()=>{
 const imported=C.parseRows([
  ["Họ và tên","MSSV","Email"],
  ["Wrong name","DE210001","private@example.com"],
  ["Another name","DE210002","private2@example.com"],
  ["Unknown name","DE210003","private3@example.com"]
 ]);
 const official=[
  {id:"member1",mssv:"de210001",name:"Hồ sơ chính thức 1"},
  {id:"member2",mssv:"DE210002",name:"Hồ sơ chính thức 2"}
 ];
 const result=C.joinRoster(imported.codes,official);
 assert.deepEqual(result.rows,[
  {id:"member1",mssv:"DE210001",name:"Hồ sơ chính thức 1",ambiguous:false},
  {id:"member2",mssv:"DE210002",name:"Hồ sơ chính thức 2",ambiguous:false}
 ]);
 assert.equal(result.missing,1);
 assert.equal(result.ambiguous,0);
 assert.doesNotMatch(JSON.stringify(result),/Wrong name|private@example.com|Another name/);
});

test("duplicate IDs inside official roster are flagged, never assigned arbitrarily",()=>{
 const matched=C.joinRoster(["ABC001","ABC002"],[
  {id:"a",mssv:"ABC001",name:"One"},
  {id:"b",mssv:"abc001",name:"Two"},
  {id:"c",mssv:"ABC002",name:"Three"}
 ]);
 assert.equal(matched.ambiguous,1);
 assert.equal(matched.rows[0].ambiguous,true);
 assert.equal(matched.rows[0].id,"");
 assert.equal(matched.rows[1].id,"c");
});

test("recognition follows OSC checkbox/number scoring semantics",()=>{
 assert.equal(C.alreadyJoined("checkbox",true),true);
 assert.equal(C.alreadyJoined("checkbox",false),false);
 assert.equal(C.alreadyJoined("number",1),true);
 assert.equal(C.alreadyJoined("number",5),true);
 assert.equal(C.alreadyJoined("number",0),false);
 assert.equal(C.alreadyJoined("number",null),false);
});

test("dropdown uses semester activities and excludes locked/continuation from writes",()=>{
 const ui=source("member-compare.js"),html=source("index.html");
 assert.match(html,/id="memberCompareActivity"/);
 assert.match(html,/id="memberCompareRecord"/);
 assert.match(html,/id="memberComparePoints"/);
 assert.match(ui,/getAllActivities\(\)/);
 assert.match(ui,/act\.item\.specialType==="continuation"/);
 assert.match(ui,/activityColumnLocked\(a\.item\.id\)/);
 assert.match(ui,/canEditModule\("attendance"\)/);
 assert.match(ui,/activityMaxPoints\(act\.item\)/);
 assert.match(ui,/await oscConfirm\(/);
});

test("transaction guards against stale IDs, concurrent attendance and protected columns",()=>{
 const ui=source("member-compare.js");
 assert.match(ui,/fbDb\.runTransaction\(async tx=>/);
 assert.match(ui,/Promise\.all\(refs\.map\(ref=>tx\.get\(ref\)\)\)/);
 assert.match(ui,/data\?\.semester!==term/);
 assert.match(ui,/C\.clean\(data\.mssv\)!==chunk\[i\]\.mssv/);
 assert.match(ui,/C\.alreadyJoined\(mode,data\.scores\?\.\[activityId\]\)/);
 assert.match(ui,/new firebase\.firestore\.FieldPath\("scores",activityId\)/);
 assert.match(ui,/const MAX_RECORD=300,CHUNK=75/);
 assert.match(ui,/if\(seq!==generation/);
});

test("renders names safely and retains ephemeral no-upload privacy",()=>{
 const ui=source("member-compare.js");
 assert.match(ui,/textContent=String\(txt\)/);
 assert.match(ui,/el\("td","",v\)/);
 assert.match(ui,/matchedRows=details\.rows/);
 assert.match(ui,/window\.addEventListener\("pagehide",clear\)/);
 assert.doesNotMatch(ui,/fetch\s*\(|localStorage|sessionStorage|indexedDB|FormData|XMLHttpRequest/);
 assert.match(ui,/XLSX\.utils\.aoa_to_sheet\(\[\["MSSV"\]/);
});
