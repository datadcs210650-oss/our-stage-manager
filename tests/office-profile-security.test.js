"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const L=require("../lib/leadership-handler");
const noAccess={decoded:{uid:"bcn-no-member-access"},profile:{role:"bcn",permissions:{viewMembers:false}}};
test("member-profile join requires viewMembers; BCN cannot query arbitrary MSSV",async()=>{
 await assert.rejects(L.memberProfileOffice(noAccess,{mssv:"DE210001",semester:"FA26"}),{code:"osc/forbidden"});
});
test("member-profile join validates requested semester and MSSV before data access",async()=>{
 const viewer={decoded:{uid:"bcn-viewer"},profile:{role:"bcn",permissions:{viewMembers:true}}};
 await assert.rejects(L.memberProfileOffice(viewer,{mssv:"DE210001",semester:"INVALID"}),{code:"osc/bad-request"});
 await assert.rejects(L.memberProfileOffice(viewer,{mssv:"../../unsafe",semester:"FA26"}),{code:"osc/bad-request"});
});
test("the member office source is server-derived and read-only",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../lib/leadership-handler.js"),"utf8");
 const start=source.indexOf("async function memberProfileOffice("),end=source.indexOf("async function handoffStart(",start);
 assert.ok(start>=0&&end>start);
 const code=source.slice(start,end);
 assert.match(code,/oscMssvOwners/);
 assert.match(code,/oscPositionHistory/);
 assert.match(code,/viewMembers/);
 assert.doesNotMatch(code,/\\.update\\(|\\.set\\(|\\.delete\\(/);
});
test("accounts term UI and member profile projection remain in separate modules",()=>{
 const account=fs.readFileSync(path.join(__dirname,"../account-terms.js"),"utf8");
 const office=fs.readFileSync(path.join(__dirname,"../member-office-profile.js"),"utf8");
 const drive=fs.readFileSync(path.join(__dirname,"../drive-hub-v2.js"),"utf8");
 assert.match(account,/window\\.openAccountTerms/);
 assert.match(account,/leadership-\\+/);
 assert.match(office,/leadership-member-profile/);
 assert.match(office,/window\\.renderInfo=function/);
 assert.doesNotMatch(drive,/function viewPeople\\(/);
});
test("new Firestore rules prevent direct client mutation of account role and position history",()=>{
 const rule=fs.readFileSync(path.join(__dirname,"../firestore_rules_v96.rules"),"utf8");
 const p=rule.indexOf("match /users/{uid}");
 const end=rule.indexOf("// ===== Global club configuration",p);
 assert.ok(p>0&&end>p);
 const body=rule.slice(p,end);
 assert.match(body,/allow create, update, delete: if false;/);
 assert.match(rule,/Explicit default deny/);
});
test("privileged password reset requires recent manager authentication",()=>{
 const src=fs.readFileSync(path.join(__dirname,"../api/account-password.js"),"utf8");
 assert.match(src,/actor\\.decoded\\.auth_time/);
 assert.match(src,/600/);
 assert.match(src,/oscSecurityAudit/);
 assert.doesNotMatch(src,/console\\.log\\(password/);
});
