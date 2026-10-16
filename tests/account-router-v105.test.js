"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.join(__dirname,"..");
const file=name=>fs.readFileSync(path.join(ROOT,name),"utf8");
const mappings={
  create:"/api/account-create",
  update:"/api/account-update",
  password:"/api/account-password",
  delete:"/api/account-delete"
};

test("four original OSC account URLs rewrite to one API function, with stable operations",()=>{
 const config=JSON.parse(file("vercel.json"));
 for(const [operation,source] of Object.entries(mappings)){
   const rules=config.rewrites.filter(r=>r.source===source);
   assert.equal(rules.length,1,source+" must have one mapping");
   assert.equal(rules[0].destination,"/api/accounts?operation="+operation);
   assert.ok(config.rewrites.indexOf(rules[0])<4,"API aliases take priority");
 }
 assert.ok(config.rewrites.some(r=>r.source==="/su-kien/:slug"));
 assert.ok(config.rewrites.some(r=>r.source==="/tra-cuu"));
 assert.ok(config.rewrites.some(r=>r.source==="/diem-danh"));
});

test("one account handler function replaces four entries without erasing original implementation",()=>{
 const paths=fs.readdirSync(path.join(ROOT,"api")).filter(f=>f.endsWith(".js"));
 assert.equal(paths.length,9,"Vercel entrypoint total should now be 9");
 assert.ok(paths.includes("accounts.js"));
 for(const operation of Object.keys(mappings)){
   assert.ok(!paths.includes("account-"+operation+".js"));
   const legacy=file("lib/account-"+operation+".js");
   assert.match(legacy,/require\(\x22\.\.\/lib\/firebase-admin\x22\)/);
   assert.match(legacy,/requireManager/);
   assert.match(legacy,/ensurePost/);
 }
 const original=require("../lib/account-delete");
 assert.equal(typeof original.deleteAccount,"function","account cleanup semantics retained");
});

test("dispatcher routes original request and response unchanged, and refuses other operation names",async()=>{
 const calls=[];
 const mock={};
 for(const op of Object.keys(mappings)){
   mock["../lib/account-"+op]=async(req,res)=>{
     calls.push({op,req,res});
     res.handled=op;
   };
 }
 const output={exports:{}};
 const sandbox={
   module:output,
   require:name=>{
     if(name==="../lib/firebase-admin"){
       return{sendJson:(res,code,payload)=>{
         res.statusCode=code;res.payload=payload;return payload
       }};
     }
     if(!(name in mock))throw Error("Unexpected route "+name);
     return mock[name];
   }
 };
 vm.runInNewContext(file("api/accounts.js"),sandbox,{timeout:500});
 const router=output.exports;
 assert.equal(typeof router,"function");
 for(const op of Object.keys(mappings)){
   const req={method:"POST",query:{operation:op},body:{uid:"test"}};
   const res={};
   await router(req,res);
   assert.equal(res.handled,op);
   assert.strictEqual(calls.at(-1).req,req);
   assert.strictEqual(calls.at(-1).res,res);
 }
 for(const operation of ["constructor","toString","__proto__","unknown",null,["delete"]]){
   const res={};
   await router({method:"POST",query:{operation}},res);
   assert.equal(res.statusCode,404,"forbidden dispatcher input "+String(operation));
 }
 assert.equal(calls.length,4,"unknown operations must never dispatch");
});

test("password and deletion protections remain intact after moving modules",()=>{
 const password=file("lib/account-password.js");
 const removal=file("lib/account-delete.js");
 const update=file("lib/account-update.js");
 const create=file("lib/account-create.js");
 assert.match(password,/actor\.decoded\.auth_time/);
 assert.match(password,/auth\.revokeRefreshTokens\(uid\)/);
 assert.match(password,/ensureTargetManageable\(actor, uid, target\.data\)/);
 assert.match(removal,/ensureTargetManageable\(actor,uid,target\.data\)/);
 assert.match(removal,/auth\.revokeRefreshTokens\(uid\)/);
 assert.match(removal,/auth\.deleteUser\(uid\)/);
 assert.match(removal,/confirmationEmail/);
 assert.match(update,/ensureRoleCanBeAssigned/);
 assert.match(update,/ensureTargetManageable/);
 assert.match(create,/ensureRoleCanBeAssigned/);
 assert.match(create,/linkedExisting/);
});

test("account operations remain callable using existing client contract",()=>{
 const ui=file("index.html");
 for(const source of Object.values(mappings))assert.ok(ui.includes(source),source+" client still uses original URL");
 const router=file("api/accounts.js");
 assert.doesNotMatch(router,/eval\s*\(|new Function\s*\(/);
 assert.match(router,/Object\.prototype\.hasOwnProperty\.call\(ROUTES,operation\)/);
 assert.match(router,/ROUTES\[operation\]\(\)\(req,res\)/);
});

test("function budget prevents reintroducing Hobby deployment overages",()=>{
 const files=fs.readdirSync(path.join(ROOT,"api")).filter(f=>f.endsWith(".js"));
 assert.ok(files.length<=10,"OSC reserves at least two of the twelve Hobby Functions");
});
