"use strict";
// Per-user Google Drive credentials. No global Super Admin token fallback is allowed.
const D=require("./osc-drive");
const {assertDescendant}=require("./drive-folder-scope");
const {getDb,admin,error,safeId,semester,folderLink}=D;
const USER_TOKENS="driveHubUserTokens";
const UPLOAD_LIMIT=100*1024*1024;
const POLICY_DEFAULT=Object.freeze({internalOnly:true,allowPublic:false});
const refFor=uid=>getDb().collection(USER_TOKENS).doc(String(uid));
async function userRecord(actor){
 const snap=await refFor(actor.decoded.uid).get();
 const data=snap.exists?snap.data():null;
 return data?.encryptedRefreshToken&&data?.oauthScope===D.SHARED_SCOPE?data:null;
}
async function userToken(actor){
 const record=await userRecord(actor);
 if(!record)throw error("Hãy kết nối Google Drive cá nhân và đồng ý cấp quyền truy cập trước.","osc/drive-personal-required");
 const t=await D.tokenExchange({refresh_token:D.decrypt(record.encryptedRefreshToken),grant_type:"refresh_token"});
 if(!String(t.scope||D.SHARED_SCOPE).split(/\s+/).includes(D.SHARED_SCOPE))
   throw error("Phiên Google Drive chưa có đủ quyền. Vui lòng kết nối lại.","osc/drive-personal-required");
 return t.access_token;
}
async function actorDrive(actor,method,path,options={},access){
 return D.drive(method,path,{...options,access:access||await userToken(actor)});
}
async function semesterDoc(code){
 const id=semester(code),ref=getDb().collection("driveHubSemesters").doc(id),snap=await ref.get();
 if(!snap.exists||!snap.data()?.folderId)throw error("Học kỳ chưa có thư mục Drive được liên kết.","osc/drive-missing-semester");
 return{id,ref,data:snap.data()};
}
async function folderInfo(actor,id,access){
 const data=await actorDrive(actor,"GET","files/"+encodeURIComponent(safeId(id)),{
  query:{fields:"id,name,mimeType,trashed,parents,webViewLink,capabilities(canAddChildren,canShare,canRename)",supportsAllDrives:"true"}
 },access);
 if(data.trashed||data.mimeType!==D.FOLDER)throw error("Không thể mở thư mục Google Drive này.","osc/drive-folder-outside");
 return data;
}
async function scopedFolder(actor,body,{write=false}={}){
 const sem=await semesterDoc(body.semester),root=safeId(sem.data.folderId),target=body.folderId?safeId(body.folderId):root;
 const access=await userToken(actor);
 await assertDescendant(root,target,async id=>actorDrive(actor,"GET","files/"+encodeURIComponent(id),{
  query:{fields:"id,parents,trashed,mimeType",supportsAllDrives:"true"}
 },access));
 const info=await folderInfo(actor,target,access);
 if(write&&info.capabilities?.canAddChildren!==true)
  throw error("Google Drive chỉ cho phép bạn xem. Cần quyền Editor để tải lên hoặc tạo thư mục.","osc/drive-folder-readonly");
 return{sem,root,target,info,access};
}
async function directItem(actor,body,{canShare=false,canRename=false}={}){
 const ctx=await scopedFolder(actor,body);
 const itemId=safeId(body.itemId||ctx.target);
 const node=await actorDrive(actor,"GET","files/"+encodeURIComponent(itemId),{
  query:{fields:"id,name,parents,trashed,mimeType,webViewLink,capabilities(canShare,canRename)",supportsAllDrives:"true"}
 },ctx.access);
 if(node.trashed||(itemId!==ctx.target&&(!Array.isArray(node.parents)||node.parents.length!==1||node.parents[0]!==ctx.target)))
  throw error("Tệp không nằm trong thư mục được cấp phép.","osc/drive-folder-outside");
 if(canShare&&node.capabilities?.canShare!==true)
  throw error("Chủ sở hữu Google Drive không cho phép tài khoản này chia sẻ.","osc/drive-folder-readonly");
 if(canRename&&node.capabilities?.canRename!==true)
  throw error("Bạn không có quyền đổi tên mục này.","osc/drive-folder-readonly");
 return{...ctx,node,itemId};
}
function policy(sem){return{
 internalOnly:sem.data.sharePolicy?.internalOnly!==false,
 allowPublic:sem.data.sharePolicy?.internalOnly!==false?false:sem.data.sharePolicy?.allowPublic===true
}}
function mimeUrl(f){
 if(f.mimeType===D.FOLDER)return folderLink(f.id);
 return f.webViewLink||"https://drive.google.com/file/d/"+encodeURIComponent(safeId(f.id))+"/view";
}
async function ensureInternalRecipient(email){
 const normalized=String(email||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)||normalized.length>254)
   throw error("Email được mời không hợp lệ.");
 const auth=await require("./firebase-admin").getAuth();
 let found;try{found=await auth.getUserByEmail(normalized)}catch{throw error("Email chưa có tài khoản OSC đang hoạt động.","osc/drive-internal-only")}
 const snap=await getDb().collection("users").doc(found.uid).get();
 if(!snap.exists||snap.data()?.active!==true)throw error("Tài khoản OSC đã bị khóa hoặc chưa được cấp quyền.","osc/drive-internal-only");
 return normalized;
}
async function recordAudit(actor,action,body={}){
 // No secrets, Google credentials or upload URLs in audit records.
 await getDb().collection("driveHubAuditV2").add({
  uid:actor.decoded.uid,action,semester:String(body.semester||""),fileId:String(body.itemId||""),
  recipient:String(body.email||""),createdAt:admin.firestore.FieldValue.serverTimestamp()
 });
}
function statusCode(code){
 if(code==="osc/unauthenticated")return 401;
 if(["osc/forbidden","osc/drive-folder-outside","osc/drive-folder-readonly","osc/drive-internal-only","osc/drive-provider-403","osc/drive-provider-404"].includes(code))return 403;
 if(code==="osc/drive-missing-semester")return 404;
 if(["osc/drive-personal-required","osc/drive-not-connected","osc/drive-unconfigured"].includes(code))return 503;
 if(code==="osc/drive-provider-429")return 429;
 if(["osc/drive-change-confirm","osc/drive-parent-mismatch","osc/drive-upload-mismatch"].includes(code))return 409;
 return 400;
}
module.exports={
 USER_TOKENS,UPLOAD_LIMIT,POLICY_DEFAULT,refFor,userRecord,userToken,actorDrive,semesterDoc,folderInfo,scopedFolder,
 directItem,policy,mimeUrl,ensureInternalRecipient,recordAudit,statusCode
};