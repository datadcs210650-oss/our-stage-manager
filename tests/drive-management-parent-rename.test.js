"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const D=require("../lib/osc-drive");

const parentId="parentfolder_ABCD1234",otherId="wrongparent_XYZ09876",folderId="newfolder_0123456789";
test("new nested folder MUST be created under exact parent, never silently at Drive root",async()=>{
 const calls=[];
 const transport=async(method,path,options)=>{
   calls.push({method,path,options});
   if(method==="POST")return{id:folderId,name:"Biên bản",mimeType:D.FOLDER,parents:[parentId]};
   return{id:folderId,name:"Biên bản",mimeType:D.FOLDER,parents:[parentId],trashed:false};
 };
 const d=await D.createFolderWithTransport("Biên bản",parentId,transport);
 assert.equal(d.id,folderId);
 assert.equal(calls[0].method,"POST");
 assert.equal(calls[0].path,"files");
 assert.deepEqual(calls[0].options.body.parents,[parentId]);
 assert.equal(calls[1].method,"GET");
 assert.equal(calls[1].path,"files/"+folderId);
 assert.equal(calls[1].options.query.supportsAllDrives,"true");
});
test("Google-reported unexpected parent raises error rather than reporting success",async()=>{
 const fake=async(method)=>{
   if(method==="POST")return{id:folderId,name:"Biên bản",mimeType:D.FOLDER,parents:[parentId]};
   return{id:folderId,name:"Biên bản",mimeType:D.FOLDER,parents:[otherId],trashed:false};
 };
 await assert.rejects(D.createFolderWithTransport("Biên bản",parentId,fake),{code:"osc/drive-parent-mismatch"});
});
test("renaming only patches name; never moves or copies a Drive item",async()=>{
 let request;
 const result=await D.renameItemWithTransport("existingitem_12345","Tệp mới.pdf",async(method,path,options)=>{
   request={method,path,options};
   return{id:"existingitem_12345",name:options.body.name,parents:[parentId]};
 });
 assert.equal(request.method,"PATCH");
 assert.deepEqual(request.options.body,{name:"Tệp mới.pdf"});
 assert.equal(request.options.query.supportsAllDrives,"true");
 assert.equal(result.name,"Tệp mới.pdf");
 assert.equal(Object.hasOwn(request.options.body,"parents"),false);
});
test("filename validation permits Vietnamese text, rejects slash and control characters",()=>{
 assert.equal(D.itemName("  Hồ sơ CLB 2026.pdf "),"Hồ sơ CLB 2026.pdf");
 for(const value of ["","..","/tmp/file","folder/name","evil\u0000name"])assert.throws(()=>D.itemName(value));
});
