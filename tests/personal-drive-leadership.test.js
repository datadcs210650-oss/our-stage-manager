"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const D=require("../lib/osc-drive");
const P=require("../lib/drive-personal");
const roles=require("../lib/leadership-handler");

test("per-user Drive transport never falls back to shared Super Admin token",async()=>{
 const old=D.drive;let called=null;
 D.drive=async(method,resource,options)=>{called={method,resource,options};return{id:"valid_item_1234"}};
 try{
  const actor={decoded:{uid:"private-member-user"}};
  const result=await P.actorDrive(actor,"GET","files/valid_item_1234",
   {query:{fields:"id",supportsAllDrives:"true"}},"personal-google-token");
  assert.equal(result.id,"valid_item_1234");
  assert.equal(called.options.access,"personal-google-token");
  assert.equal(called.options.query.supportsAllDrives,"true");
 }finally{D.drive=old}
});

test("sharing policy is fail-closed for unconfigured or internal-only semesters",()=>{
 assert.deepEqual(P.policy({data:{}}),{internalOnly:true,allowPublic:false});
 assert.deepEqual(P.policy({data:{sharePolicy:{internalOnly:true,allowPublic:true}}}),{internalOnly:true,allowPublic:false});
 assert.deepEqual(P.policy({data:{sharePolicy:{internalOnly:false,allowPublic:false}}}),{internalOnly:false,allowPublic:false});
 assert.deepEqual(P.policy({data:{sharePolicy:{internalOnly:false,allowPublic:true}}}),{internalOnly:false,allowPublic:true});
});

test("MSSV and titles are validated and independent of system roles",()=>{
 assert.equal(roles.mssv(" de210001 "),"DE210001");
 assert.equal(roles.title("  Phó Chủ tịch  "),"Phó Chủ tịch");
 for(const input of ["","X","abc/123","a".repeat(40)])assert.throws(()=>roles.mssv(input));
 for(const input of ["","a","bad<script>","x".repeat(100)])assert.throws(()=>roles.title(input));
});

test("100MiB guard and privacy-sensitive dispatch are present at server boundary",()=>{
 assert.equal(P.UPLOAD_LIMIT,100*1024*1024);
 const personal=fs.readFileSync(path.join(__dirname,"../lib/drive-personal-handler.js"),"utf8");
 assert.match(personal,/input\.size>P\.UPLOAD_LIMIT/);
 assert.match(personal,/P\.ensureInternalRecipient\(body\.email\)/);
 assert.match(personal,/canShare:true/);
 assert.match(personal,/file\.ownedByMe!==true/);
 assert.match(personal,/current\.data\.folderId!==sess\.rootId/);
 const operations=fs.readFileSync(path.join(__dirname,"../api/operations.js"),"utf8");
 assert.match(operations,/if\(action\.startsWith\("drive2-"\)\)/);
 assert.match(operations,/actor\.profile\.role!=="superadmin"/);
});
