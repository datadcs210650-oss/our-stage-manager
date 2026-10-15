"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

function getFunction(source,name){
 const start=source.indexOf("function "+name+"(");
 assert.ok(start>=0,"Missing "+name);
 const open=source.indexOf("{",start);
 let depth=0,end=-1;
 for(let i=open;i<source.length;i++){
  if(source[i]==="{")depth++;
  if(source[i]==="}"&&!--depth){end=i+1;break;}
 }
 assert.ok(end>start,"Unbalanced "+name);
 return source.slice(start,end);
}

test("server: only Super Admin may mutate Room Booking",()=>{
 const api=read("api/operations.js");
 const sandbox={
  bad:(message,code)=>Object.assign(new Error(message),{code}),
  isManager:()=>true // If the old broad role checker were reused, Admin could pass.
 };
 vm.runInNewContext(getFunction(api,"roomOwner")+"\n"+getFunction(api,"ensureRoomManager"),sandbox);
 const actor=role=>({profile:{role,active:true}});
 assert.equal(sandbox.roomOwner(actor("superadmin")),true);
 assert.equal(sandbox.roomOwner(actor("admin")),false);
 assert.equal(sandbox.roomOwner(actor("bcn")),false);
 assert.equal(sandbox.roomOwner({}),false);
 assert.doesNotThrow(()=>sandbox.ensureRoomManager(actor("superadmin")));
 for(const role of ["admin","bcn",null]){
  assert.throws(()=>sandbox.ensureRoomManager(actor(role)),{
   code:"osc/forbidden"
  });
 }
});
test("server: all five room mutation endpoints enforce same Super Admin gate",()=>{
 const api=read("api/operations.js");
 for(const name of ["roomSlotSave","roomCreate","roomWeekCreate","roomUpdate","roomCancel"]){
  const fn=getFunction(api,name);
  assert.match(fn,/const actor=await requireUser\(req\);ensureRoomManager\(actor\);/,name);
 }
 for(const name of ["roomSlotList","roomsList","roomBoard","roomHistory"]){
  const fn=getFunction(api,name);
  assert.match(fn,/canEdit:roomOwner\(actor\)/,name);
 }
 assert.match(api,/action==="room-week-create"\)out=await roomWeekCreate/);
});
test("room screen and weekly planner are read-only for Admin and BCN",()=>{
 const room=read("room-booking.js"),weekly=read("room-booking-weekly.js");
 const owner=getFunction(room,"roomOwner");
 const mgr=getFunction(room,"manager");
 const weekMgr=getFunction(weekly,"manager");
 for(const role of ["superadmin","admin","bcn"]){
  const context={currentFirebaseUser:{uid:"test"},currentProfile:{role,active:true}};
  vm.runInNewContext(owner+"\n"+mgr+"\n"+
   "globalThis.results={owner:roomOwner(),manager:manager()}",context);
  const other={currentFirebaseUser:{uid:"test"},currentProfile:{role,active:true}};
  vm.runInNewContext(weekMgr+"\nglobalThis.result=manager()",other);
  assert.equal(context.results.owner,role==="superadmin");
  assert.equal(context.results.manager,role==="superadmin");
  assert.equal(other.result,role==="superadmin");
 }
 const disabled={currentFirebaseUser:{uid:"test"},currentProfile:{role:"superadmin",active:false}};
 vm.runInNewContext(owner+"\n"+mgr+"\nglobalThis.result=manager()",disabled);
 assert.equal(disabled.result,false);
 assert.match(room,/manager\(\)\?'<button type="button" class="rb-button rb-outline" data-action="new"/);
 assert.match(room,/manager\(\)\?'<button class="rb-edit"/);
 assert.match(weekly,/if\(busy\|\|!manager\(\)\)return;/);
 assert.match(weekly,/if\(!manager\(\)\)/);
});
test("client refreshes permission state and rules forbid direct Firestore room writes",()=>{
 const html=read("index.html"),rules=read("firestore_rules_v96.rules");
 assert.match(html,/src="\/room-booking\.js\?v=104"/);
 assert.match(html,/src="\/room-booking-weekly\.js\?v=103"/);
 assert.match(html,/renderRoomBooking\(\);\s*if\(beforeSig&&beforeSig!==afterSig\)/);
 assert.match(rules,/match \/roomBookings\/\{bookingId\} \{\s*allow read, create, update, delete: if false;/);
 assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
test("only the room-specific policy changed; other admin management remains available",()=>{
 const api=read("api/operations.js");
 assert.match(api,/function isManager\(actor\)\{return \["admin","superadmin"\]\.includes\(actor\?\.profile\?\.role\)\}/);
 assert.match(api,/function canEditEvents\(actor\)\{return isManager\(actor\)/);
 assert.match(api,/const actor=await requireManager\(req\)/);
});
