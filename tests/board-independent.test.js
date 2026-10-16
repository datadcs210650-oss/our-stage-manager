"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const board=require("../lib/board-handler");
const source=fs.readFileSync(path.join(__dirname,"../lib/board-handler.js"),"utf8");
const read=path=>fs.readFileSync(require("node:path").join(__dirname,"..",path),"utf8");

test("board appointment keys are deterministic, isolated by semester, and never auth UIDs",()=>{
 const x=board.docId("FA26","DE210001"),y=board.docId("SP27","DE210001"),z=board.docId("FA26","DE210002");
 assert.equal(x,board.docId("FA26","DE210001"));assert.notEqual(x,y);assert.notEqual(x,z);
 assert.match(x,/^FA26_[a-f0-9]{64}$/);
});
test("BCN logins cannot change board assignments; no website account lookup occurs",async()=>{
 const bcn={profile:{role:"bcn",permissions:{viewMembers:true}},decoded:{uid:"bcn_test_user"}};
 for(const action of ["board-list","board-assign","board-remove","board-titles-set","board-history"]){
  await assert.rejects(board.apply(bcn,{action,semester:"FA26",mssv:"DE210001"}),{code:"osc/forbidden"});
 }
 assert.match(source,/collection\("members"\)/);
 assert.match(source,/collection\("oscBoardAppointments"\)/);
 assert.doesNotMatch(source,/collection\("users"\)|getAuth\(/);
});
test("a BCN without viewMembers cannot use member profile lookup",async()=>{
 const denied={profile:{role:"bcn",permissions:{}},decoded:{uid:"bcn_no_access"}};
 await assert.rejects(board.apply(denied,{action:"board-profile",semester:"FA26",mssv:"DE210001",memberId:"member_test_1"}),{code:"osc/forbidden"});
});
test("board appointment validates member ID and MSSV against roster server-side",()=>{
 assert.match(source,/collection\("members"\)\.doc\(memberId\)\.get\(\)/);
 assert.match(source,/member\.data\(\)\?\.semester!==sem/);
 assert.match(source,/normalizedMssv\(member\.data\(\)\?\.mssv\)!==id/);
 assert.match(source,/tx\.create\(audit/);
 assert.throws(()=>board.normalizedMssv("../x"),{code:"osc/bad-request"});
 assert.throws(()=>board.positionTitle("<script>"),{code:"osc/bad-request"});
});
test("UI contains distinct board and account sections and no login/board cross-binding",()=>{
 const html=read("index.html"),boardJs=read("board-directors.js"),profile=read("member-office-profile.js");
 assert.match(html,/data-tab="boardDirectors"/);
 assert.match(html,/data-tab="accounts"/);
 assert.match(html,/id="boardDirectorsRoot"/);
 assert.match(html,/id="accountBody"/);
 assert.match(html,/board-directors\.js/);
 assert.doesNotMatch(html,/account-terms\.js/);
 assert.doesNotMatch(boardJs,/leadership-assign|getAuth|accountRows|collection\("users"\)/);
 assert.match(profile,/board-profile/);
 assert.match(profile,/memberId/);
 const create=read("lib/account-create.js"),update=read("lib/account-update.js");
 assert.doesNotMatch(create,/oscMssvOwners|oscPositionHistory|positionTitle/);
 assert.doesNotMatch(update,/oscMssvOwners|oscPositionHistory|positionTitle/);
});
