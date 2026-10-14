"use strict";
// Drive V2: each request uses the current OSC member's consent, not the club owner's token.
const D=require("./osc-drive");
const P=require("./drive-personal");
const {assertDescendant}=require("./drive-folder-scope");
const {getDb,admin,error,semester,safeId,folderLink}=D;
const chair=a=>a.profile.role==="superadmin";
const limitedName=n=>D.itemName(n);
function requireChair(a){if(!chair(a))throw error("Chỉ Chủ tịch được sửa liên kết Drive học kỳ và chính sách chia sẻ.","osc/forbidden")}
function nonemptyEmail(input){
 const value=String(input||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>254)throw error("Email CLB không hợp lệ.");
 return value;
}
async function googleRoot(actor,id,access){
 const node=await P.actorDrive(actor,"GET","files/"+encodeURIComponent(safeId(id)),{
  query:{fields:"id,name,mimeType,trashed,driveId,owners(emailAddress),capabilities(canAddChildren)",supportsAllDrives:"true"}
 },access);
 if(node.mimeType!==D.FOLDER||node.trashed)throw error("Đường dẫn không phải thư mục hợp lệ.");
 if(node.driveId)throw error("Cơ chế lưu dung lượng từng người chỉ hỗ trợ My Drive, không hỗ trợ Shared Drive.","osc/drive-folder-access");
 return node;
}
async function apply(actor,req,res,body){
 const act=String(body.action||"").replace(/^drive2-/,"");
 if(act==="status"){
  const u=await P.userRecord(actor),snap=await getDb().collection("driveHubSemesters").get();
  return{ok:true,configured:D.configured(),connected:!!u,googleEmail:u?.ownerEmail||"",
   uploadLimit:P.UPLOAD_LIMIT,semesters:snap.docs.map(x=>x.id).filter(x=>/^(SP|SU|FA)\d{2}$/.test(x)).sort()};
 }
 if(act==="connect-start"){
  if(!D.configured())throw error("Thiếu cấu hình Google OAuth trên Vercel.","osc/drive-unconfigured");
  const nonce=D.crypto.randomBytes(32).toString("base64url");
  await getDb().collection(D.OAUTH_STATES).doc(D.hash(nonce)).create({
   uid:actor.decoded.uid,scopeMode:"shared",personal:true,used:false,
   expiresMs:Date.now()+10*60*1000,createdAt:admin.firestore.FieldValue.serverTimestamp()
  });
  res.setHeader("Set-Cookie","osc_drive_oauth="+D.hash(nonce)+"; Path=/api/operations; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
  return{ok:true,url:D.authorizeURL(nonce,"shared")};
 }
 if(act==="disconnect"){
  await P.refFor(actor.decoded.uid).delete();
  await P.recordAudit(actor,"personal-disconnect");
  return{ok:true};
 }
 if(act==="semester-get"){
  const p=await P.scopedFolder(actor,{semester:body.semester});
  return{ok:true,semester:p.sem.id,folderId:p.root,folderUrl:folderLink(p.root),
    name:p.info.name,canUpload:p.info.capabilities?.canAddChildren===true,
    canShare:p.info.capabilities?.canShare===true,policy:P.policy(p.sem)};
 }
 if(act==="semester-set"){
  requireChair(actor);
  const code=semester(body.semester);
  if(!body.folderUrl)throw error("Hãy nhập link Drive học kỳ. Không tạo thư mục tự động.");
  const id=D.folderIdFromURL(body.folderUrl);
  const access=await P.userToken(actor),root=await googleRoot(actor,id,access);
  const clubEmail=nonemptyEmail(body.clubEmail);
  if(!root.owners?.some(x=>String(x.emailAddress||"").toLowerCase()===clubEmail))
   throw error("Thư mục phải do email Google CLB được khai báo sở hữu.","osc/drive-folder-access");
  const ref=getDb().collection("driveHubSemesters").doc(code),snap=await ref.get();
  const old=snap.exists?snap.data():{};
  if(old.folderId&&old.folderId!==id&&body.confirmChange!==true)
   throw error("Bạn sắp thay đổi Drive học kỳ. Cần xác nhận; tệp cũ không tự chuyển.","osc/drive-change-confirm");
  const switched=!!old.folderId&&old.folderId!==id;
  const histories=Array.isArray(old.previousLinks)?old.previousLinks.slice(-19):[];
  await ref.set({
   semester:code,folderId:id,clubOwnerEmail:clubEmail,
   // Retire stale references when switching; never expose old folder through V2.
   ...(switched?{categories:[],eventsFolderId:"",
     previousLinks:[...histories,{folderId:old.folderId,changedAt:new Date().toISOString(),changedBy:actor.decoded.uid}]}:{}),
   connectedBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  await P.recordAudit(actor,"semester-link-updated",{semester:code});
  return{ok:true,semester:code,folderId:id,folderUrl:folderLink(id),changed:switched};
 }
 if(act==="policy-set"){
  requireChair(actor);
  const sem=await P.semesterDoc(body.semester);
  const internalOnly=body.internalOnly===true,allowPublic=!internalOnly&&body.allowPublic===true;
  await sem.ref.update({sharePolicy:{internalOnly,allowPublic},
   updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  await P.recordAudit(actor,"sharing-policy-changed",{semester:sem.id});
  return{ok:true,policy:{internalOnly,allowPublic}};
 }
 if(act==="files-list"){
  const p=await P.scopedFolder(actor,body);
  const pageToken=String(body.pageToken||"");
  if(pageToken&&!/^[a-zA-Z0-9_=/+-]{5,500}$/.test(pageToken))throw error("Phân trang không hợp lệ.");
  const q="'"+p.target.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+"' in parents and trashed = false";
  const d=await P.actorDrive(actor,"GET","files",{query:{
   q,fields:"nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents,capabilities(canRename,canShare))",
   pageSize:100,supportsAllDrives:"true",includeItemsFromAllDrives:"true",...(pageToken?{pageToken}:{})
  }},p.access);
  return{ok:true,semester:p.sem.id,folderId:p.target,rootFolderId:p.root,folderUrl:folderLink(p.target),
   canUpload:p.info.capabilities?.canAddChildren===true,canShare:p.info.capabilities?.canShare===true,
   nextPageToken:d.nextPageToken||"",
   folders:(d.files||[]).filter(f=>f.mimeType===D.FOLDER).map(f=>({id:f.id,name:f.name,url:P.mimeUrl(f),
    canShare:f.capabilities?.canShare===true,canRename:f.capabilities?.canRename===true})),
   files:(d.files||[]).filter(f=>f.mimeType!==D.FOLDER).map(f=>({id:f.id,name:f.name,url:P.mimeUrl(f),
    size:Number(f.size||0),mimeType:f.mimeType,canShare:f.capabilities?.canShare===true,
    canRename:f.capabilities?.canRename===true}))};
 }
 if(act==="folder-create"){
  const p=await P.scopedFolder(actor,body,{write:true});
  const name=limitedName(body.name);
  const child=await D.createFolderWithTransport(name,p.target,(method,path,opts)=>P.actorDrive(actor,method,path,opts,p.access));
  await P.recordAudit(actor,"folder-create",{semester:p.sem.id,itemId:child.id});
  return{ok:true,parentId:p.target,folder:{id:child.id,name:child.name,url:folderLink(child.id)}};
 }
 if(act==="item-rename"){
  const p=await P.directItem(actor,body,{canRename:true});
  if(p.itemId===p.root)throw error("Không được đổi tên thư mục gốc học kỳ trực tiếp trong OSC.");
  const name=limitedName(body.name);
  const node=await D.renameItemWithTransport(p.itemId,name,(method,path,opts)=>P.actorDrive(actor,method,path,opts,p.access));
  if(p.itemId!==p.target&&(!node.parents||!node.parents.includes(p.target)))
   throw error("Drive trả về thư mục mẹ không khớp.","osc/drive-parent-mismatch");
  await P.recordAudit(actor,"item-rename",{semester:p.sem.id,itemId:p.itemId});
  return{ok:true,item:{id:p.itemId,name:node.name,url:P.mimeUrl(node)}};
 }
 if(act==="permissions-list"){
  const p=await P.directItem(actor,body);
  const data=await P.actorDrive(actor,"GET","files/"+encodeURIComponent(p.itemId)+"/permissions",{
   query:{fields:"permissions(id,type,role,emailAddress,allowFileDiscovery),nextPageToken",pageSize:100,supportsAllDrives:"true"}
  },p.access);
  return{ok:true,permissions:(data.permissions||[]).map(x=>({id:x.id,type:x.type,role:x.role,
   email:x.emailAddress||"",allowFileDiscovery:x.allowFileDiscovery===true})),canShare:p.node.capabilities?.canShare===true,
   policy:P.policy(p.sem)};
 }
 if(act==="permission-add"){
  const p=await P.directItem(actor,body,{canShare:true});
  const role=String(body.role||"");
  if(!["reader","commenter","writer"].includes(role))throw error("Vai trò chia sẻ không hợp lệ.");
  const type=body.type==="anyone"?"anyone":"user",rule=P.policy(p.sem);
  if(type==="anyone"&&!rule.allowPublic)throw error("Chủ tịch chưa cho phép chia sẻ link công khai trong học kỳ này.","osc/forbidden");
  const permission=type==="anyone"?{type,role,allowFileDiscovery:false}:{type,role,
   emailAddress:rule.internalOnly?await P.ensureInternalRecipient(body.email):nonemptyEmail(body.email)};
  await P.actorDrive(actor,"POST","files/"+encodeURIComponent(p.itemId)+"/permissions",{
   body:permission,query:{supportsAllDrives:"true",sendNotificationEmail:type==="user"?"true":"false",fields:"id,type,role"}
  },p.access);
  await P.recordAudit(actor,"permission-add",{semester:p.sem.id,itemId:p.itemId,email:type==="user"?permission.emailAddress:"anyone"});
  return{ok:true};
 }
 if(act==="permission-remove"){
  const p=await P.directItem(actor,body,{canShare:true});
  const permissionId=safeId(body.permissionId);
  const existing=await P.actorDrive(actor,"GET","files/"+encodeURIComponent(p.itemId)+"/permissions/"+encodeURIComponent(permissionId),{
   query:{fields:"id,role,type,emailAddress",supportsAllDrives:"true"}
  },p.access);
  if(existing.role==="owner")throw error("Không thể thu hồi quyền chủ sở hữu tệp.");
  await P.actorDrive(actor,"DELETE","files/"+encodeURIComponent(p.itemId)+"/permissions/"+encodeURIComponent(permissionId),{
   query:{supportsAllDrives:"true"}
  },p.access);
  await P.recordAudit(actor,"permission-remove",{semester:p.sem.id,itemId:p.itemId,email:existing.emailAddress||""});
  return{ok:true};
 }
 if(act==="upload-start"){
  const p=await P.scopedFolder(actor,body,{write:true}),input=D.uploadSpec(body);
  if(input.size>P.UPLOAD_LIMIT)throw error("Tệp vượt 100 MB; hãy mở chính thư mục trên Google Drive để tải trực tiếp.","osc/drive-file-too-large");
  const upload=await P.actorDrive(actor,"POST","files",{
   upload:true,wantResponse:true,
   query:{uploadType:"resumable",fields:"id,name,mimeType,size,parents,ownedByMe,webViewLink",supportsAllDrives:"true"},
   body:{name:input.name,mimeType:input.mime,parents:[p.target]},
   headers:{"X-Upload-Content-Length":String(input.size),"X-Upload-Content-Type":input.mime}
  },p.access);
  const uploadUrl=upload.headers.get("location");
  if(!uploadUrl||!uploadUrl.startsWith("https://www.googleapis.com/"))
   throw error("Google Drive chưa cấp phiên upload hợp lệ.","osc/drive-provider");
  const ticket=D.crypto.randomBytes(32).toString("base64url");
  await getDb().collection(D.UPLOADS).doc(D.hash(ticket)).create({
   uid:actor.decoded.uid,version:2,semester:p.sem.id,rootId:p.root,folderId:p.target,
   name:input.name,size:input.size,mime:input.mime,complete:false,
   expiresMs:Date.now()+30*60*1000,createdAt:admin.firestore.FieldValue.serverTimestamp()
  });
  return{ok:true,ticket,uploadUrl,maxFileSize:P.UPLOAD_LIMIT};
 }
 if(act==="upload-confirm"){
  const ticket=String(body.ticket||"");
  if(!/^[A-Za-z0-9_-]{30,100}$/.test(ticket))throw error("Phiên upload không hợp lệ.");
  const ref=getDb().collection(D.UPLOADS).doc(D.hash(ticket)),snap=await ref.get(),sess=snap.data();
  if(!snap.exists||sess?.version!==2||sess.uid!==actor.decoded.uid||sess.complete||Number(sess.expiresMs)<Date.now())
   throw error("Phiên upload hết hạn hoặc không hợp lệ.","osc/forbidden");
  const current=await P.semesterDoc(sess.semester);
  if(current.data.folderId!==sess.rootId)throw error("Drive học kỳ đã thay đổi trong lúc tải tệp.","osc/drive-parent-mismatch");
  const id=safeId(body.fileId),access=await P.userToken(actor);
  const file=await P.actorDrive(actor,"GET","files/"+encodeURIComponent(id),{
   query:{fields:"id,name,parents,size,mimeType,trashed,ownedByMe,webViewLink",supportsAllDrives:"true"}
  },access);
  if(file.trashed||!file.parents?.includes(sess.folderId)||file.name!==sess.name||
     Number(file.size)!==sess.size||file.mimeType!==sess.mime||file.ownedByMe!==true)
   throw error("Google Drive chưa xác nhận vị trí, chủ sở hữu hoặc nội dung tệp. Vui lòng kiểm tra trực tiếp trên Drive.","osc/drive-upload-mismatch");
  await getDb().runTransaction(async tx=>{
   const latest=await tx.get(ref);
   if(latest.data()?.complete)throw error("Phiên upload đã được xác nhận.","osc/forbidden");
   tx.set(getDb().collection("driveHubFiles").doc(id),{
    semester:sess.semester,folderId:sess.folderId,uploadedBy:actor.decoded.uid,
    size:sess.size,name:sess.name,mimeType:sess.mime,ownedByUploader:true,
    createdAt:admin.firestore.FieldValue.serverTimestamp()
   },{merge:true});
   tx.update(ref,{complete:true,finishedAt:admin.firestore.FieldValue.serverTimestamp()});
  });
  await P.recordAudit(actor,"upload-complete",{semester:sess.semester,itemId:id});
  return{ok:true,file:{id,name:file.name,url:P.mimeUrl(file)}};
 }
 throw error("Hành động Google Drive không hợp lệ.");
}
module.exports=async function handler(req,res){
 const {requireUser,readJsonBody,sendJson,handleError}=require("./firebase-admin");
 try{
  if(req.method!=="POST")return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ POST."});
  const actor=await requireUser(req),body=readJsonBody(req);
  const out=await apply(actor,req,res,body);
  return sendJson(res,200,out);
 }catch(e){
  if(String(e?.code||"").startsWith("osc/"))return sendJson(res,P.statusCode(e.code),{ok:false,error:String(e.message),code:e.code});
  return handleError(res,e);
 }
};
module.exports.apply=apply;module.exports.googleRoot=googleRoot;
