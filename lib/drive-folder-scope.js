"use strict";

// Defense in depth: a client-supplied Google file ID is never an authorization.
// Every folder must be a real folder beneath the authorized category root.
const FOLDER="application/vnd.google-apps.folder";
const MAX_DEPTH=12;
const VALID_ID=/^[A-Za-z0-9_-]{4,180}$/;
function invalid(){const e=new Error("Thư mục không thuộc danh mục OSC hoặc không còn truy cập được.");e.code="osc/drive-folder-outside";return e}
async function assertDescendant(rootId,folderId,lookup){
 if(!VALID_ID.test(String(rootId||""))||!VALID_ID.test(String(folderId||""))||typeof lookup!=="function")throw invalid();
 if(rootId===folderId)return folderId;
 let current=folderId;
 const seen=new Set();
 for(let depth=0;depth<MAX_DEPTH;depth++){
   if(seen.has(current))throw invalid();
   seen.add(current);
   const node=await lookup(current);
   if(!node||node.id!==current||node.trashed||node.mimeType!==FOLDER||!Array.isArray(node.parents)||node.parents.length!==1)throw invalid();
   const parent=node.parents[0];
   if(parent===rootId)return folderId;
   if(!VALID_ID.test(String(parent||"")))throw invalid();
   current=parent;
 }
 throw invalid();
}
module.exports={assertDescendant,MAX_DEPTH};
