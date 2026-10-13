"use strict";
const {requireUser,readJsonBody,sendJson,handleError}=require("../lib/firebase-admin");
const D=require("../lib/osc-drive");
const {getDb,admin,error,clean,semester,safeId,title,DEFAULT_CATEGORIES,folderLink}=D;
const MAX_CATS=25;
const manager=a=>["admin","superadmin"].includes(a.profile.role);
function needManager(actor){if(!manager(actor))throw error("Chỉ Admin hoặc Super Admin được quản lý Kho tài liệu.","osc/forbidden")}
function needSuper(actor){if(actor.profile.role!=="superadmin")throw error("Chỉ Super Admin được kết nối Drive hoặc sửa thư mục học kỳ.","osc/forbidden")}
const eventRef=id=>getDb().collection("driveHubEvents").doc(safeId(id));
const semRef=s=>getDb().collection("driveHubSemesters").doc(semester(s));
async function getSemester(code){
  const id=semester(code),snap=await semRef(id).get();
  if(!snap.exists)throw error("Học kỳ "+id+" chưa gắn thư mục Google Drive.","osc/drive-missing-semester");
  return{id,...snap.data()};
}
async function getEvent(id){
  const ev=safeId(id),snap=await getDb().collection("eventPortals").doc(ev).get();
  if(!snap.exists)throw error("Không tìm thấy sự kiện trên Cổng sự kiện.","osc/not-found");
  return{id:ev,...snap.data()};
}
async function metadataCategory(scope,semesterCode,eventId,categoryId){
  const doc=scope==="event"?await eventRef(eventId).get():await semRef(semesterCode).get();
  if(!doc.exists)throw error("Chưa thiết lập kho tài liệu này.","osc/not-found");
  const meta=doc.data()||{};
  if(semester(meta.semester)!==semester(semesterCode))throw error("Thư mục không thuộc học kỳ đã chọn.","osc/forbidden");
  const categories=Array.isArray(meta.categories)?meta.categories:[];
  const cat=categories.find(x=>x.id===categoryId);
  if(!cat)throw error("Danh mục tài liệu không tồn tại.","osc/not-found");
  return{doc,meta,cat,categories};
}
async function ensureCategoryFolder(context){
  const {doc,meta,cat}=context;
  if(cat.folderId)return cat.folderId;
  const parent=safeId(meta.folderId);
  const child=await D.ensureFolder(parent,cat.label);
  const updated=context.categories.map(c=>c.id===cat.id?{...c,folderId:child.id}:c);
  await doc.ref.set({categories:updated,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return child.id;
}
async function listSemesters(){
  const docs=await getDb().collection("driveHubSemesters").get();
  return docs.docs.map(s=>({semester:s.id,folderId:s.data()?.folderId||"",folderUrl:s.data()?.folderId?folderLink(s.data().folderId):"",categoryCount:(s.data()?.categories||[]).length}))
    .sort((a,b)=>a.semester.localeCompare(b.semester));
}
async function status(){
  const saved=await D.connection();
  return{ok:true,configured:D.configured(),connected:!!saved.data?.encryptedRefreshToken,
    ownerEmail:saved.data?.ownerEmail||"",rootFolderUrl:saved.data?.rootFolderId?folderLink(saved.data.rootFolderId):"",
    semesters:await listSemesters()};
}
async function connectStart(actor){
  needSuper(actor);
  if(!D.configured())throw error("Cần cấu hình 3 biến môi trường Google Drive trên Vercel trước khi kết nối.","osc/drive-unconfigured");
  const nonce=D.crypto.randomBytes(32).toString("base64url");
  await getDb().collection(D.OAUTH_STATES).doc(D.hash(nonce)).create({
    uid:actor.decoded.uid,createdAt:admin.firestore.FieldValue.serverTimestamp(),
    expiresMs:Date.now()+10*60*1000,used:false
  });
  return{ok:true,url:D.authorizeURL(nonce)};
}
async function semesterSetup(actor,body){
  needSuper(actor);
  const id=semester(body.semester);
  const {data:linked}=await D.connection();
  if(!linked?.rootFolderId)throw error("Hãy kết nối tài khoản Google Drive trước.","osc/drive-not-connected");
  let folderId="";
  if(body.folderUrl){
    folderId=D.folderIdFromURL(body.folderUrl);
    await D.verifyFolder(folderId); // drive.file will reject unapproved arbitrary Drive links
  }else{
    const sub=await D.ensureFolder(linked.rootFolderId,id+" — "+id.slice(0,2)+" "+id.slice(2));
    folderId=sub.id;
  }
  const ref=semRef(id),snap=await ref.get();
  if(snap.exists&&snap.data()?.folderId!==folderId&&body.confirmChange!==true)
    throw error("Thư mục học kỳ đã tồn tại; cần xác nhận thay đổi. Tệp cũ sẽ không tự di chuyển.","osc/drive-change-confirm");
  if(snap.exists&&snap.data()?.folderId!==folderId){
    const existingEvents=await getDb().collection("driveHubEvents").where("semester","==",id).limit(1).get();
    if(!existingEvents.empty)throw error("Không thể đổi Drive khi học kỳ đã có kho sự kiện. Hãy di chuyển dữ liệu theo quy trình riêng.","osc/drive-has-events");
  }
  const categories=snap.exists&&snap.data()?.folderId===folderId? snap.data()?.categories||[]:
    [{id:"general",label:"Tài liệu học kỳ",folderId:""},{id:"meetings",label:"Biên bản & Cuộc họp",folderId:""},{id:"reports",label:"Báo cáo học kỳ",folderId:""}];
  const existing=await D.ensureFolder(folderId,"Sự kiện");
  await ref.set({
    semester:id,folderId,eventsFolderId:existing.id,categories,
    connectedBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  return{ok:true,semester:id,folderUrl:folderLink(folderId),categories};
}
async function semesterContents(body){
  const id=semester(body.semester),record=await getSemester(id);
  const events=await getDb().collection("driveHubEvents").where("semester","==",id).get();
  return{ok:true,semester:id,folderUrl:folderLink(record.folderId),
    categories:record.categories||[],
    events:events.docs.map(d=>({id:d.id,name:d.data().name||"",folderUrl:folderLink(d.data().folderId),
      categories:d.data().categories||[]})).sort((a,b)=>a.name.localeCompare(b.name,"vi"))};
}
async function eventEnsure(actor,body){
  needManager(actor);
  const ev=await getEvent(body.eventId),code=semester(ev.semester),sem=await getSemester(code);
  const ref=eventRef(ev.id),current=await ref.get();
  if(current.exists){
    if(current.data().semester!==code)throw error("Sự kiện đang được liên kết sai học kỳ.","osc/forbidden");
    return{ok:true,id:ev.id,folderUrl:folderLink(current.data().folderId),categories:current.data().categories||[]};
  }
  const folder=await D.ensureFolder(sem.eventsFolderId,clean(ev.title||"Sự kiện",120)+" — "+ev.id.slice(0,10));
  const cats=await Promise.all(DEFAULT_CATEGORIES.map(async c=>{
    const child=await D.ensureFolder(folder.id,c.label);
    return{...c,folderId:child.id};
  }));
  await ref.create({
    semester:code,eventId:ev.id,name:clean(ev.title||"Sự kiện",160),
    folderId:folder.id,categories:cats,
    createdBy:actor.decoded.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()
  }).catch(async e=>{if(e.code!==6&&e.code!=="already-exists")throw e});
  return{ok:true,id:ev.id,folderUrl:folderLink(folder.id),categories:cats};
}
async function addCategory(actor,body){
  needManager(actor);
  const scope=String(body.scope||""),code=semester(body.semester);
  if(!["semester","event"].includes(scope))throw error("Phạm vi danh mục không hợp lệ.");
  const eventId=scope==="event"?safeId(body.eventId):"";
  const label=title(body.label);
  const doc=scope==="event"?await eventRef(eventId).get():await semRef(code).get();
  if(!doc.exists||doc.data().semester!==code)throw error("Kho tài liệu chưa thiết lập hoặc không thuộc học kỳ.","osc/not-found");
  const data=doc.data(),categories=Array.isArray(data.categories)?data.categories:[];
  if(categories.length>=MAX_CATS)throw error("Mỗi kho tối đa 25 danh mục.");
  if(categories.some(x=>x.label.toLocaleLowerCase("vi")===label.toLocaleLowerCase("vi")))
    throw error("Danh mục đã tồn tại.");
  const child=await D.ensureFolder(data.folderId,label),id=D.crypto.randomBytes(9).toString("hex");
  await doc.ref.update({categories:[...categories,{id,label,folderId:child.id}],
    updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  return{ok:true,id,label,folderId:child.id};
}
async function listFiles(body){
  const scope=String(body.scope||""),code=semester(body.semester);
  const eventId=scope==="event"?safeId(body.eventId):"";
  const categoryId=String(body.categoryId||"");
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(categoryId))throw error("Danh mục không hợp lệ.");
  const ctx=await metadataCategory(scope,code,eventId,categoryId);
  if(!ctx.cat.folderId)return{ok:true,files:[],category:ctx.cat};
  const files=await D.files(ctx.cat.folderId);
  return{ok:true,files:files.map(f=>({id:f.id,name:f.name,mimeType:f.mimeType,size:Number(f.size||0),
    updatedAt:f.modifiedTime||"",url:f.webViewLink||"https://drive.google.com/file/d/"+encodeURIComponent(f.id)+"/view"})),category:ctx.cat};
}
async function uploadStart(actor,body){
  needManager(actor);
  const scope=String(body.scope||""),code=semester(body.semester);
  if(!["semester","event"].includes(scope))throw error("Phạm vi tải tệp không hợp lệ.");
  const eventId=scope==="event"?safeId(body.eventId):"";
  const categoryId=String(body.categoryId||"");
  const input=D.uploadSpec(body);
  const ctx=await metadataCategory(scope,code,eventId,categoryId);
  const folderId=await ensureCategoryFolder(ctx);
  // The Google resumable session URI is a one-file capability. Do not persist or log it.
  const uploadUrl=await D.startUpload(folderId,input);
  const ticket=D.crypto.randomBytes(32).toString("base64url");
  await getDb().collection(D.UPLOADS).doc(D.hash(ticket)).create({
    uid:actor.decoded.uid,semester:code,scope,eventId,categoryId,folderId,
    name:input.name,size:input.size,mime:input.mime,
    createdAt:admin.firestore.FieldValue.serverTimestamp(),
    expiresMs:Date.now()+30*60*1000,complete:false
  });
  return{ok:true,uploadUrl,ticket,maxFileSize:500*1024*1024};
}
async function uploadConfirm(actor,body){
  needManager(actor);
  const ticket=String(body.ticket||"");
  if(!/^[a-zA-Z0-9_-]{30,100}$/.test(ticket))throw error("Phiên upload không hợp lệ.");
  const ref=getDb().collection(D.UPLOADS).doc(D.hash(ticket)),snap=await ref.get();
  if(!snap.exists)throw error("Phiên tải tệp không tồn tại.","osc/not-found");
  const sess=snap.data()||{};
  if(sess.uid!==actor.decoded.uid||sess.complete===true||Number(sess.expiresMs||0)<Date.now())
    throw error("Phiên upload không hợp lệ hoặc đã hết hạn.","osc/forbidden");
  const fileId=safeId(body.fileId);
  const file=await D.drive("GET","files/"+encodeURIComponent(fileId),{
    query:{fields:"id,name,mimeType,size,parents,trashed,webViewLink,createdTime"}
  });
  if(file.trashed||!(file.parents||[]).includes(sess.folderId)||
    file.name!==sess.name||Number(file.size)!==sess.size||file.mimeType!==sess.mime)
    throw error("File tải lên không khớp thư mục, tên hoặc kích thước đã cấp phép.","osc/drive-upload-mismatch");
  await getDb().runTransaction(async tx=>{
    const latest=await tx.get(ref);
    if(latest.data()?.complete)throw error("Phiên upload đã được xác nhận.","osc/forbidden");
    tx.set(getDb().collection("driveHubFiles").doc(fileId),{
      semester:sess.semester,scope:sess.scope,eventId:sess.eventId||"",categoryId:sess.categoryId,
      folderId:sess.folderId,name:file.name,size:Number(file.size),mimeType:file.mimeType,
      uploadedBy:actor.decoded.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:false});
    tx.update(ref,{complete:true,finishedAt:admin.firestore.FieldValue.serverTimestamp()});
  });
  return{ok:true,file:{id:fileId,name:file.name,size:Number(file.size),
    url:file.webViewLink||"https://drive.google.com/file/d/"+encodeURIComponent(fileId)+"/view"}};
}
function statusError(code){
 if(code==="osc/unauthenticated")return 401;
 if(["osc/forbidden","osc/inactive","osc/no-profile"].includes(code))return 403;
 if(code==="osc/not-found")return 404;
 if(code==="osc/drive-unconfigured"||code==="osc/drive-not-connected"||code==="osc/drive-credential")return 503;
 return 400;
}
module.exports=async function handler(req,res){
 try{
  if(req.method!=="POST"){res.setHeader("Allow","POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ POST."})}
  const actor=await requireUser(req);needManager(actor);
  const body=readJsonBody(req),action=String(body.action||"");
  let out;
  if(action==="status")out=await status();
  else if(action==="connect-start")out=await connectStart(actor);
  else if(action==="semester-set")out=await semesterSetup(actor,body);
  else if(action==="semester-get")out=await semesterContents(body);
  else if(action==="event-ensure")out=await eventEnsure(actor,body);
  else if(action==="category-add")out=await addCategory(actor,body);
  else if(action==="files-list")out=await listFiles(body);
  else if(action==="upload-start")out=await uploadStart(actor,body);
  else if(action==="upload-confirm")out=await uploadConfirm(actor,body);
  else throw error("Hành động Kho tài liệu không hợp lệ.");
  return sendJson(res,200,out);
 }catch(e){
  if(String(e?.code||"").startsWith("osc/"))
    return sendJson(res,statusError(e.code),{ok:false,error:String(e.message),code:e.code});
  return handleError(res,e);
 }
};