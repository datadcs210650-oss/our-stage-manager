"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const D=require("../lib/osc-drive");

test("folder URL accepts only genuine Drive folder links",()=>{
 const id="1AbCdefGHijKlmNopQrstuV";
 assert.equal(D.folderIdFromURL("https://drive.google.com/drive/u/0/folders/"+id+"?usp=sharing"),id);
 assert.equal(D.folderIdFromURL("https://drive.google.com/open?id="+id),id);
 assert.throws(()=>D.folderIdFromURL("https://drive.google.com.evil.example/drive/folders/"+id));
 assert.throws(()=>D.folderIdFromURL("https://drive.google.com/file/d/"+id+"/view"));
 assert.throws(()=>D.folderIdFromURL("https://evil.example/?next=https://drive.google.com/drive/folders/"+id));
});

test("OAuth remains restricted by default; shared Drive scope requires opt-in",()=>{
 const previous={
  DRIVE_OAUTH_CLIENT_ID:process.env.DRIVE_OAUTH_CLIENT_ID,
  DRIVE_OAUTH_CLIENT_SECRET:process.env.DRIVE_OAUTH_CLIENT_SECRET,
  DRIVE_TOKEN_ENCRYPTION_KEY:process.env.DRIVE_TOKEN_ENCRYPTION_KEY
 };
 try{
  process.env.DRIVE_OAUTH_CLIENT_ID="test-client-id";
  process.env.DRIVE_OAUTH_CLIENT_SECRET="test-client-secret";
  process.env.DRIVE_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString("base64");
  const limited=new URL(D.authorizeURL("test-state"));
  const shared=new URL(D.authorizeURL("test-state","shared"));
  assert.deepEqual(limited.searchParams.get("scope").split(" ").includes(D.SCOPE),true);
  assert.equal(limited.searchParams.get("scope").split(" ").includes(D.SHARED_SCOPE),false);
  assert.equal(shared.searchParams.get("scope").split(" ").includes(D.SHARED_SCOPE),true);
  assert.equal(shared.searchParams.get("scope").split(" ").includes(D.SCOPE),false);
  assert.throws(()=>D.authorizeURL("test-state","unknown"));
  assert.equal(D.decrypt(D.encrypt("sensitive-test-refresh-token")),"sensitive-test-refresh-token");
 } finally {
  for(const [key,value] of Object.entries(previous))
   if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
