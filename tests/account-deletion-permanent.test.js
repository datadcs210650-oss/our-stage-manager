"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {deleteAccount}=require("../lib/account-delete");
function setup(opts={}){
 const uid="targetOldUid0123",email="old.bcn@example.com",calls=[];
 const state={authExists:true,disabled:false,deleted:false,profileDeleted:false,active:true,failCleanup:!!opts.failCleanup};
 const actor={decoded:{uid:"manager-uid",auth_time:Math.floor(Date.now()/1000)},
  profile:{role:opts.actorRole||"superadmin"}};
 const data={role:opts.targetRole||"bcn",email,active:true,mssv:"DE210001",positionSemester:"FA26"};
 const targetRef={
  async set(value){calls.push("profile.blocked");state.active=value.active;},
  async listCollections(){calls.push("profile.children");return [{id:"oscPositionHistory"}]},
  async delete(){calls.push("profile.deleted");state.profileDeleted=true}
 };
 const targetOverride={ref:targetRef,data};
 const auth={
  async getUser(id){assert.equal(id,uid);calls.push("auth.get");if(!state.authExists)throw Object.assign(new Error("missing"),{code:"auth/user-not-found"});return {uid,email,disabled:state.disabled}},
  async updateUser(id,value){calls.push("auth.disabled");state.disabled=value.disabled},
  async revokeRefreshTokens(){calls.push("auth.revoked")},
  async deleteUser(){calls.push("auth.deleted");state.authExists=false;state.deleted=true},
  async getUserByEmail(lookup){if(lookup===email&&state.authExists)return {uid};throw Object.assign(new Error("missing"),{code:"auth/user-not-found"});}
 };
 const marker={exists:true,data:()=>({uid})};
 const db={
  collection(name){
   if(["members","oscBoardAppointments","eventPortals","driveHubFiles"].includes(name))throw Error("No access to historic club records permitted");
   if(name==="oscSecurityAudit")return{async add(v){calls.push("security.audit");assert.equal(v.action,"website-account-deleted");assert.ok(!("email" in v))}};
   return{
    doc(id){return {
      async get(){return name==="oscMssvOwners"&&id==="DE210001"?marker:{exists:false}},
      async delete(){calls.push(name+".deleted")},
    }},
    where(field,op,value){assert.equal(field,"uid");assert.equal(op,"==");assert.equal(value,uid);
      return{limit(n){assert.equal(n,100);return{async get(){return{empty:true,size:0,docs:[]}}}}}
    }
   }
  },
  doc(p){assert.equal(p,"oscLeadershipHandoff/current");return{async get(){return{exists:false}}}},
  async recursiveDelete(ref){calls.push("profile.historyDeleted");if(state.failCleanup)throw new Error("temporary database failure");assert.equal(ref.id,"oscPositionHistory")}
 };
 return{uid,email,actor,data,auth,db,targetOverride,calls,state,params:{
  actor,uid,confirmationEmail:email,auth,db,targetOverride
 }};
}
test("permanent delete revokes Firebase login before removing profile, and frees email",async()=>{
 const f=setup();
 const result=await deleteAccount(f.params);
 assert.deepEqual({authDeleted:result.authDeleted,profileDeleted:result.profileDeleted,canRecreateSameEmail:result.canRecreateSameEmail},
  {authDeleted:true,profileDeleted:true,canRecreateSameEmail:true});
 assert.equal(f.state.authExists,false);assert.equal(f.state.profileDeleted,true);assert.equal(f.state.active,false);
 assert.ok(f.calls.indexOf("auth.disabled")<f.calls.indexOf("auth.deleted"));
 assert.ok(f.calls.indexOf("auth.revoked")<f.calls.indexOf("auth.deleted"));
 assert.ok(f.calls.indexOf("auth.deleted")<f.calls.indexOf("profile.deleted"));
 assert.ok(f.calls.includes("driveHubUserTokens.deleted"));
 assert.ok(f.calls.includes("oscMssvOwners.deleted"));
 assert.ok(f.calls.includes("profile.historyDeleted"));
 await assert.rejects(f.auth.getUserByEmail(f.email),{code:"auth/user-not-found"});
});
test("stored legacy MSSV and office history no longer block permanent account deletion",async()=>{
 const f=setup();
 assert.equal(f.data.positionSemester,"FA26");
 assert.equal(f.data.mssv,"DE210001");
 assert.equal((await deleteAccount(f.params)).ok,true);
});
test("wrong email confirmation does not disable or remove accounts",async()=>{
 const f=setup();
 await assert.rejects(deleteAccount({...f.params,confirmationEmail:"wrong@example.com"}),{code:"osc/email-confirmation"});
 assert.equal(f.state.authExists,true);
 assert.equal(f.state.active,true);
 assert.equal(f.calls.length,0);
});
test("admins cannot delete a peer Admin; no one can delete Chair/self",async()=>{
 const peer=setup({actorRole:"admin",targetRole:"admin"});
 await assert.rejects(deleteAccount(peer.params),{code:"osc/forbidden"});
 const self=setup();self.actor.decoded.uid=self.uid;
 await assert.rejects(deleteAccount(self.params),{code:"osc/self-target"});
 const chair=setup({targetRole:"superadmin"});
 await assert.rejects(deleteAccount(chair.params),{code:"osc/forbidden"});
});
test("expired manager session prevents destructive deletion",async()=>{
 const f=setup();f.actor.decoded.auth_time=Math.floor(Date.now()/1000)-1000;
 await assert.rejects(deleteAccount(f.params),{code:"osc/recent-login-required"});
 assert.equal(f.state.authExists,true);
});
test("partial Firestore cleanup returns retryable error while Firebase identity is already gone",async()=>{
 const f=setup({failCleanup:true});
 await assert.rejects(deleteAccount(f.params),{code:"osc/cleanup-incomplete"});
 assert.equal(f.state.authExists,false);
 assert.equal(f.state.active,false);
 assert.equal(f.state.profileDeleted,false);
 f.state.failCleanup=false;
 const result=await deleteAccount(f.params);
 assert.equal(result.ok,true);assert.equal(f.state.profileDeleted,true);
});
test("account UI always shows Delete for any manageable BCN and needs typed email",()=>{
 const ui=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 assert.doesNotMatch(ui,/Có lịch sử — hãy Khóa khi rời BCN/);
 assert.match(ui,/data-account-delete-id/);
 assert.match(ui,/confirmationEmail:email/);
 assert.match(ui,/const typed=await oscPrompt/);
 assert.match(ui,/data\.authDeleted!==true\|\|data\.profileDeleted!==true/);
});
