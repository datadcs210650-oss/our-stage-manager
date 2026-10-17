"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const ROOT=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const E=require("../lib/account-expiry");

test("BCN expiration is optional and server validates future ISO times",()=>{
 const now=Date.parse("2026-10-17T08:00:00.000Z");
 const original=require("../lib/firebase-admin").admin;
 assert.equal(E.parseExpiryInput(undefined,"bcn",now),undefined);
 assert.equal(E.parseExpiryInput(null,"bcn",now),null);
 assert.equal(E.parseExpiryInput("","bcn",now),null);
 assert.equal(E.parseExpiryInput(null,"admin",now),null);
 assert.throws(()=>E.parseExpiryInput("2026-10-18T08:00:00.000Z","admin",now),{code:"osc/bad-request"});
 for(const value of ["bad","2026-12-41T00:00:00.000Z","2026-10-17T07:00:00.000Z","2040-01-01T00:00:00.000Z"]){
  assert.throws(()=>E.parseExpiryInput(value,"bcn",now),{code:"osc/bad-request"});
 }
 const date=E.parseExpiryInput("2026-10-18T08:00:00.000Z","bcn",now);
 assert.equal(E.expirationMs(date),Date.parse("2026-10-18T08:00:00.000Z"));
});
test("expiration denies expired BCN only, never a valid Admin or unlimited BCN",()=>{
 const t=Date.parse("2026-10-17T08:00:00.000Z");
 const yesterday=new Date(t-1000),tomorrow=new Date(t+1000);
 assert.equal(E.isExpired({role:"bcn",accountExpiresAt:yesterday},t),true);
 assert.equal(E.isExpired({role:"bcn",accountExpiresAt:tomorrow},t),false);
 assert.equal(E.isExpired({role:"bcn",accountExpiresAt:null},t),false);
 assert.equal(E.isExpired({role:"admin",accountExpiresAt:yesterday},t),false);
 assert.equal(E.isExpired({role:"superadmin",accountExpiresAt:yesterday},t),false);
});
test("API blocks expired BCN and attempts Auth disable/revoke; expiry endpoint is own-UID only",()=>{
 const server=read("lib/firebase-admin.js"),expiration=read("lib/account-expiry.js"),handler=read("lib/account-expire-handler.js"),router=read("api/accounts.js");
 assert.match(server,/if \(require\("\.\/account-expiry"\)\.isExpired\(profile\)\)/);
 assert.match(server,/lockExpiredAccount\(decoded\.uid\)/);
 assert.match(server,/e\.code = "osc\/account-expired"/);
 assert.match(server,/osc\/account-expired.*osc\/no-profile/);
 assert.match(expiration,/runTransaction\(async tx=>/);
 assert.match(expiration,/isExpired\(profile\)/);
 assert.match(expiration,/active:false,accountLockedReason:"expired"/);
 assert.match(expiration,/updateUser\(uid,\{disabled:true\}\)/);
 assert.match(expiration,/revokeRefreshTokens\(uid\)/);
 assert.match(handler,/verifyIdToken\(match\[1\],true\)/);
 assert.match(handler,/const uid=decoded\.uid/);
 assert.doesNotMatch(handler,/body\.uid|query\.uid/);
 assert.match(router,/expire:\(\)=>require\("\.\.\/lib\/account-expire-handler"\)/);
 const rules=read("firestore_rules_v96.rules");
 assert.match(rules,/function accountNotExpired\(\)/);
 assert.match(rules,/me\(\)\.accountExpiresAt > request\.time/);
 assert.match(rules,/me\(\)\.active == true && accountNotExpired\(\)/);
});
test("creation and updates persist expiration, with reactivation requiring a future time",()=>{
 const create=read("lib/account-create.js"),update=read("lib/account-update.js");
 assert.match(create,/parseExpiryInput\(body\.accountExpiresAt,role\)/);
 assert.match(create,/accountExpiresAt:expiry===undefined\?null:expiry/);
 assert.match(update,/parseExpiryInput\(body\.accountExpiresAt,nextRole\)/);
 assert.match(update,/nextRole!=="bcn"\?null/);
 assert.match(update,/if\(active&&isExpired\(/);
 assert.match(update,/accountExpiresAt:nextExpiry/);
 assert.match(update,/revokeRefreshTokens\(uid\)/);
});
test("BCN sees an explicit 5-second notice and is logged out, including google login rejections",()=>{
 const html=read("index.html"),script=read("bcn-expiry.js"),styles=read("bcn-expiry.css");
 for(const item of ["accExpiresAt","editAccExpiresAt","accountExpiryInputISO","accountExpiryLocalInput"])
  assert.ok(html.includes(item),item);
 assert.match(html,/window\.OSCBCNExpiry\?\.isExpired\(p\)/);
 assert.match(html,/await window\.OSCBCNExpiry\.lockNow\(user\)/);
 assert.match(html,/window\.OSCBCNExpiry\?\.schedule\(\)/);
 assert.match(html,/window\.OSCBCNExpiry\?\.stop\(\)/);
 assert.match(html,/bcn-expiry\.js\?v=1/);
 assert.match(html,/bcn-expiry\.css\?v=1/);
 assert.match(script,/setTimeout\(async\(\)=>\{/);
 assert.match(script,/},5000\)/);
 assert.match(script,/Hệ thống sẽ tự động đăng xuất sau /);
 assert.match(script,/lockNow\(user\)/);
 assert.match(script,/await fbAuth\.signOut\(\)/);
 assert.match(script,/aria-modal/);
 assert.match(styles,/#oscBcnExpiryOverlay/);
 assert.doesNotMatch(script,/localStorage|private_key/);
});
test("account-expiry browser utility is safe for existing Admin/BCN without expiry",()=>{
 const src=read("bcn-expiry.js");
 const listeners={};
 const ctx={
  window:{addEventListener:(event,fn)=>listeners[event]=fn},
  document:{addEventListener(){},getElementById:()=>null},
  Date,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortSignal,
  currentFirebaseUser:null,currentProfile:null,fbAuth:{signOut:async()=>{}}
 };
 vm.runInNewContext(src,ctx);
 const C=ctx.window.OSCBCNExpiry;
 assert.equal(typeof C.schedule,"function");
 assert.equal(C.isExpired({role:"bcn",accountExpiresAt:null}),false);
 assert.equal(C.isExpired({role:"admin",accountExpiresAt:Date.now()-10000}),false);
 C.schedule();C.stop();
 assert.ok(listeners.focus);
});
