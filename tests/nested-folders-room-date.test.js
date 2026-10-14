"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {assertDescendant,MAX_DEPTH}=require("../lib/drive-folder-scope");
const {vnToday,assertNotPast}=require("../lib/room-date-policy");

const root="rootFolder_1234";
const child="childFolder_1234";
const grand="grandFolder_1234";
const outside="outsideFolder_1234";
const MIME="application/vnd.google-apps.folder";

function mockTree(overrides={}){
 const nodes={
  [child]:{id:child,mimeType:MIME,trashed:false,parents:[root]},
  [grand]:{id:grand,mimeType:MIME,trashed:false,parents:[child]},
  [outside]:{id:outside,mimeType:MIME,trashed:false,parents:["anotherRoot_9876"]},
  ...overrides
 };
 return async id=>nodes[id]||null;
}
test("folders may be nested recursively under an authorized Drive category",async()=>{
 assert.equal(await assertDescendant(root,root,mockTree()),root);
 assert.equal(await assertDescendant(root,child,mockTree()),child);
 assert.equal(await assertDescendant(root,grand,mockTree()),grand);
});
test("arbitrary folder IDs cannot escape the authorized category",async()=>{
 await assert.rejects(assertDescendant(root,outside,mockTree()),{code:"osc/drive-folder-outside"});
 await assert.rejects(assertDescendant(root,"../../../escape",mockTree()),{code:"osc/drive-folder-outside"});
 await assert.rejects(assertDescendant(root,grand,mockTree({
   [grand]:{id:grand,mimeType:"application/vnd.google-apps.shortcut",parents:[child],trashed:false}
 })),{code:"osc/drive-folder-outside"});
 await assert.rejects(assertDescendant(root,grand,mockTree({
   [grand]:{id:grand,mimeType:MIME,parents:[child],trashed:true}
 })),{code:"osc/drive-folder-outside"});
 await assert.rejects(assertDescendant(root,grand,mockTree({
   [grand]:{id:grand,mimeType:MIME,parents:[grand],trashed:false}
 })),{code:"osc/drive-folder-outside"});
 await assert.rejects(assertDescendant(root,grand,mockTree({
   [grand]:{id:grand,mimeType:MIME,parents:[child,outside],trashed:false}
 })),{code:"osc/drive-folder-outside"});
});
test("a category enforces a finite nesting limit",async()=>{
 let next=root;
 const nodes={};
 for(let i=0;i<MAX_DEPTH+1;i++){
   const id="nestedFolder_"+String(i).padStart(3,"0");
   nodes[id]={id,mimeType:MIME,trashed:false,parents:[next]};
   next=id;
 }
 await assert.rejects(assertDescendant(root,next,async id=>nodes[id]),{code:"osc/drive-folder-outside"});
});
test("Vietnam local date is independent of server UTC date",()=>{
 // Midnight in Hanoi (October 15) is still October 14 in UTC.
 const moment=Date.parse("2026-10-14T17:30:00Z");
 assert.equal(vnToday(moment),"2026-10-15");
 assert.doesNotThrow(()=>assertNotPast("2026-10-15",moment));
 assert.doesNotThrow(()=>assertNotPast("2026-10-16",moment));
 assert.throws(()=>assertNotPast("2026-10-14",moment),{code:"osc/room-past-date"});
 assert.throws(()=>assertNotPast("2026-09-30",moment),{code:"osc/room-past-date"});
});
