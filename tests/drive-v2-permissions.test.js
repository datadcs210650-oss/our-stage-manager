"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const P=require("../lib/drive-personal");
const V2=require("../lib/drive-personal-handler");
const actor={profile:{role:"bcn"},decoded:{uid:"member_12345"}};
function fakeScope(){
 return{sem:{id:"FA26",data:{sharePolicy:{internalOnly:true,allowPublic:false}}},
  root:"club_folder_id",target:"club_folder_id",access:"token-12345",
  info:{capabilities:{canAddChildren:true,canShare:true}},
  node:{id:"document_12345",capabilities:{canShare:true}},itemId:"document_12345"};
}
async function patched(temp,callback){
 const originals=temp.map(([obj,key,value])=>[obj,key,obj[key]]);
 temp.forEach(([obj,key,value])=>obj[key]=value);
 try{return await callback()}finally{originals.forEach(([obj,key,value])=>obj[key]=value)}
}
test("public sharing is blocked by internal-only default before a Google request",async()=>{
 await patched([[P,"directItem",async()=>fakeScope()]],async()=>{
  await assert.rejects(V2.apply(actor,{},null,{
   action:"drive2-permission-add",semester:"FA26",itemId:"document_12345",
   type:"anyone",role:"writer"
  }),{code:"osc/forbidden"});
 });
});
test("external email is blocked by the internal-only recipient validator",async()=>{
 let apiCalls=0;
 await patched([
  [P,"directItem",async()=>fakeScope()],
  [P,"ensureInternalRecipient",async()=>{throw Object.assign(new Error("Not OSC"),{code:"osc/drive-internal-only"})}],
  [P,"actorDrive",async()=>{apiCalls++;return{}}],
 ],async()=>{
  await assert.rejects(V2.apply(actor,{},null,{
   action:"drive2-permission-add",semester:"FA26",itemId:"document_12345",
   type:"user",role:"reader",email:"outside@example.com"
  }),{code:"osc/drive-internal-only"});
  assert.equal(apiCalls,0);
 });
});
test("100 MB upload limit rejects larger files without contacting Drive",async()=>{
 let apiCalls=0;
 await patched([
  [P,"scopedFolder",async()=>fakeScope()],
  [P,"actorDrive",async()=>{apiCalls++;return{}}],
 ],async()=>{
  await assert.rejects(V2.apply(actor,{},null,{
   action:"drive2-upload-start",semester:"FA26",folderId:"club_folder_id",
   fileName:"large.pdf",size:101*1024*1024,mimeType:"application/pdf"
  }),{code:"osc/drive-file-too-large"});
  assert.equal(apiCalls,0);
 });
});
test("semester link and sharing-policy configuration are Chair-only",async()=>{
 for(const action of ["drive2-semester-set","drive2-policy-set"]){
  await assert.rejects(V2.apply(actor,{},null,{action,semester:"FA26"}),{code:"osc/forbidden"});
 }
});
