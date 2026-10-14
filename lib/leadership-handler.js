"use strict";
const {admin,getDb,getAuth,requireUser,readJsonBody,sendJson,handleError,validateUid}=require("./firebase-admin");
const D=require("./osc-drive");
const chair=a=>a.profile.role==="superadmin";
const manager=a=>["superadmin","admin"].includes(a.profile.role);
function fail(msg,code="osc/bad-request"){throw D.error(msg,code)}
function guardChair(a){if(!chair(a))fail("Chỉ Chủ tịch có quyền quản lý chức vụ và bàn giao quyền.","osc/forbidden")}
function semester(v){return D.semester(v)}
function mssv(v){
 const s=String(v||"").trim().toUpperCase();
 if(!/^[A-Z0-9-]{5,25}$/.test(s))fail("MSSV gồm 5–25 ký tự chữ, số hoặc dấu gạch ngang.");
 return s;
}
function title(v){
 const s=String(v||"").trim().replace(/\s+/g," ");
 if(s.length<2||s.length>80||/[\x00-\x1f<>]/.test(s))fail("Chức vụ phải dài từ 2–80 ký tự.");
 return s;
}
const profileRef=uid=>getDb().collection("users").doc(validateUid(uid));
function recent(actor){
 if(!Number.isFinite(Number(actor.decoded.auth_time))||Date.now()/1000-Number(actor.decoded.auth_time)>600)
  fail("Vui lòng đăng xuất, đăng nhập lại trước khi bàn giao quyền Chủ tịch.","osc/recent-login-required");
}
async function readProfiles(a){
 if(!manager(a))fail("Không có quyền xem hồ sơ BCN.","osc/forbidden");
 const snap=await getDb().collection("users").limit(200).get();
 return{ok:true,accounts:snap.docs.map(d=>{
  const x=d.data()||{};
  return{uid:d.id,displayName:x.displayName||"",email:x.email||"",role:x.role||"bcn",
   active:x.active===true,mssv:x.mssv||"",positionTitle:x.positionTitle||""};
 }).sort((a,b)=>a.displayName.localeCompare(b.displayName,"vi"))};
}
async function history(a,uid){
 const target=validateUid(uid||a.decoded.uid);
 if(target!==a.decoded.uid&&!manager(a))fail("Bạn không có quyền xem lịch sử chức vụ người khác.","osc/forbidden");
 const user=await profileRef(target).get();
 if(!user.exists)fail("Không tìm thấy tài khoản.","osc/not-found");
 const snap=await profileRef(target).collection("oscPositionHistory").limit(60).get();
 const rows=snap.docs.map(d=>({...d.data(),semester:d.id})).sort((a,b)=>{
  const yr=x=>Number(x.semester.slice(2));
  const order={SP:0,SU:1,FA:2};
  return yr(a)-yr(b)||order[a.semester.slice(0,2)]-order[b.semester.slice(0,2)];
 });
 const byTitle={};for(const x of rows)if(x.positionTitle)byTitle[x.positionTitle]=(byTitle[x.positionTitle]||0)+1;
 return{ok:true,uid:target,displayName:user.data()?.displayName||"",mssv:user.data()?.mssv||"",
  currentTitle:user.data()?.positionTitle||"",role:user.data()?.role||"bcn",
  semesters:rows,semesterCount:rows.length,titleCounts:byTitle};
}
async function titlesGet(a,code){
 if(!manager(a))fail("Không có quyền xem danh sách chức vụ.","osc/forbidden");
 const id=semester(code),snap=await getDb().collection("oscTitleCatalogs").doc(id).get();
 return{ok:true,semester:id,titles:snap.exists?snap.data()?.titles||[]:
  ["Phó Chủ tịch","Thư ký","Trưởng ban","Phó ban","Thành viên BCN"]};
}
async function titlesSet(a,body){
 guardChair(a);
 const id=semester(body.semester);
 if(!Array.isArray(body.titles)||body.titles.length>30)fail("Tối đa 30 chức vụ mỗi học kỳ.");
 const values=body.titles.map(title);
 if(new Set(values.map(x=>x.toLocaleLowerCase("vi"))).size!==values.length)fail("Có chức vụ bị trùng.");
 await getDb().collection("oscTitleCatalogs").doc(id).set({
  semester:id,titles:values,updatedBy:a.decoded.uid,
  updatedAt:admin.firestore.FieldValue.serverTimestamp()
 },{merge:true});
 return{ok:true,titles:values};
}
async function assign(a,body){
 guardChair(a);
 const uid=validateUid(body.uid),sem=semester(body.semester);
 const id=mssv(body.mssv),newTitle=title(body.positionTitle);
 const db=getDb(),user=profileRef(uid),record=user.collection("oscPositionHistory").doc(sem);
 const identity=db.collection("oscMssvOwners").doc(id);
 await db.runTransaction(async tx=>{
  const refs=[user,record,identity];
  const [person,prior,claimed]=await Promise.all(refs.map(r=>tx.get(r)));
  if(!person.exists)fail("Không tìm thấy tài khoản.","osc/not-found");
  if(claimed.exists&&claimed.data().uid!==uid)fail("MSSV đã liên kết với tài khoản khác.","osc/mssv-exists");
  const current=person.data()||{},oldId=String(current.mssv||"").toUpperCase();
  const oldRef=oldId&&oldId!==id?db.collection("oscMssvOwners").doc(oldId):null;
  const oldClaim=oldRef?await tx.get(oldRef):null;
  if(prior.exists&&!body.confirmHistoryChange&&
    (prior.data()?.positionTitle!==newTitle||prior.data()?.mssv!==id))
    fail("Học kỳ đã có lịch sử chức vụ. Hãy xác nhận nếu muốn sửa, hệ thống sẽ lưu nhật ký.","osc/position-confirm");
  if(oldRef&&oldClaim?.exists&&oldClaim.data()?.uid===uid)tx.delete(oldRef);
  tx.set(identity,{uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  tx.set(record,{
   semester:sem,mssv:id,positionTitle:current.role==="superadmin"?"Chủ tịch":newTitle,
   systemRoleAtTerm:current.role||"bcn",
   updatedBy:a.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  tx.update(user,{mssv:id,positionTitle:current.role==="superadmin"?"Chủ tịch":newTitle,
   positionSemester:sem,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  tx.set(db.collection("oscLeadershipAudit").doc(),{
   action:"position-assigned",uid,semester:sem,previousTitle:prior.data()?.positionTitle||"",
   nextTitle:newTitle,by:a.decoded.uid,at:admin.firestore.FieldValue.serverTimestamp()
  });
 });
 return{ok:true,uid,semester:sem,positionTitle:newTitle,mssv:id};
}
async function handoffStart(a,body){
 guardChair(a);recent(a);
 const target=validateUid(body.uid),sem=semester(body.semester);
 if(target===a.decoded.uid)fail("Không thể bàn giao cho chính mình.");
 const user=await profileRef(target).get();
 if(!user.exists||user.data()?.active!==true||user.data()?.role==="superadmin")
  fail("Người nhận phải có tài khoản OSC đang hoạt động, không phải Chủ tịch.");
 const auth=await getAuth().getUser(target);
 if(auth.emailVerified!==true)fail("Người kế nhiệm phải xác minh email đăng nhập trước khi nhận quyền.","osc/forbidden");
 const previousRole=body.previousRole==="bcn"?"bcn":"admin";
 await getDb().doc("oscLeadershipHandoff/current").set({
  status:"pending",fromUid:a.decoded.uid,toUid:target,semester:sem,previousRole,
  expiresMs:Date.now()+30*60*1000,createdAt:admin.firestore.FieldValue.serverTimestamp()
 });
 return{ok:true,expiresMinutes:30};
}
async function handoffStatus(a){
 const snap=await getDb().doc("oscLeadershipHandoff/current").get(),v=snap.data();
 if(!snap.exists||v?.status!=="pending"||v?.expiresMs<Date.now())return{ok:true,pending:null};
 if(!chair(a)&&a.decoded.uid!==v.toUid)return{ok:true,pending:null};
 return{ok:true,pending:{toUid:v.toUid,fromUid:v.fromUid,semester:v.semester,
  expiresMs:v.expiresMs,previousRole:v.previousRole}};
}
async function handoffAccept(a){
 recent(a);
 const db=getDb(),handoff=db.doc("oscLeadershipHandoff/current");let fromUid="";
 await db.runTransaction(async tx=>{
  const h=await tx.get(handoff),v=h.data();
  if(!h.exists||v.status!=="pending"||v.expiresMs<Date.now()||v.toUid!==a.decoded.uid)
   fail("Không có đề nghị bàn giao hợp lệ dành cho tài khoản của bạn.","osc/forbidden");
  const from=profileRef(v.fromUid),to=profileRef(v.toUid);
  const [fromSnap,toSnap]=await Promise.all([tx.get(from),tx.get(to)]);
  if(fromSnap.data()?.role!=="superadmin"||fromSnap.data()?.active!==true||toSnap.data()?.active!==true)
   fail("Quyền tài khoản đã thay đổi, vui lòng bắt đầu lại quy trình bàn giao.","osc/forbidden");
  const ts=admin.firestore.FieldValue.serverTimestamp();
  tx.update(from,{role:v.previousRole,positionTitle:"Cựu Chủ tịch",updatedAt:ts});
  tx.update(to,{role:"superadmin",positionTitle:"Chủ tịch",positionSemester:v.semester,updatedAt:ts});
  tx.set(from.collection("oscPositionHistory").doc(v.semester),{
   semester:v.semester,positionTitle:"Chủ tịch",systemRoleAtTerm:"superadmin",
   updatedAt:ts,updatedBy:v.toUid
  },{merge:true});
  tx.set(to.collection("oscPositionHistory").doc(v.semester),{
   semester:v.semester,positionTitle:"Chủ tịch",systemRoleAtTerm:"superadmin",
   updatedAt:ts,updatedBy:v.toUid
  },{merge:true});
  tx.update(handoff,{status:"accepted",acceptedAt:ts});
  tx.set(db.collection("oscLeadershipAudit").doc(),{
   action:"presidency-transferred",fromUid:v.fromUid,toUid:v.toUid,semester:v.semester,at:ts
  });
  fromUid=v.fromUid;
 });
 // Firestore permissions are effective immediately; also revoke existing sessions.
 await Promise.allSettled([getAuth().revokeRefreshTokens(fromUid),getAuth().revokeRefreshTokens(a.decoded.uid)]);
 return{ok:true,requiresRelogin:true};
}
module.exports=async function handler(req,res){
 try{
  if(req.method!=="POST")return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ POST."});
  const a=await requireUser(req),body=readJsonBody(req),act=String(body.action||"").replace(/^leadership-/,"");
  let data;
  if(act==="list")data=await readProfiles(a);
  else if(act==="history")data=await history(a,body.uid);
  else if(act==="titles-get")data=await titlesGet(a,body.semester);
  else if(act==="titles-set")data=await titlesSet(a,body);
  else if(act==="assign")data=await assign(a,body);
  else if(act==="handoff-start")data=await handoffStart(a,body);
  else if(act==="handoff-status")data=await handoffStatus(a);
  else if(act==="handoff-accept")data=await handoffAccept(a);
  else fail("Chức năng quản lý nhiệm kỳ không hợp lệ.");
  return sendJson(res,200,data);
 }catch(e){
  const c=String(e.code||"");
  if(c.startsWith("osc/"))return sendJson(res,
   ["osc/forbidden","osc/recent-login-required"].includes(c)?403:
   ["osc/mssv-exists","osc/position-confirm"].includes(c)?409:400,
   {ok:false,error:e.message,code:c});
  return handleError(res,e);
 }
};
module.exports.mssv=mssv;module.exports.title=title;
