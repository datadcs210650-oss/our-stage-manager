"use strict";
/**
 * Club Board ("Ban Chủ nhiệm") is derived from the member roster, NOT auth accounts.
 * Appointments contain member MSSV/semester and role display only. No Firebase Auth
 * or users/{uid} writes and no Google OAuth dependency.
 */
const {admin,getDb,requireUser,readJsonBody,sendJson,handleError}=require("./firebase-admin");
const {createHash}=require("node:crypto");
const D=require("./osc-drive");
const defaults=["Chủ tịch","Phó Chủ tịch","Thư ký","Trưởng ban","Phó ban","Thành viên BCN"];
const permitted=a=>["superadmin","admin"].includes(a.profile?.role);
const readable=a=>permitted(a)||a.profile?.permissions?.viewMembers===true;
function fail(message,code="osc/bad-request"){throw D.error(message,code)}
function requireManager(a){if(!permitted(a))fail("Chỉ Chủ tịch hoặc Admin mới được quản lý Ban Chủ nhiệm.","osc/forbidden")}
function requireReader(a){if(!readable(a))fail("Bạn chưa được cấp quyền xem Hồ sơ thành viên.","osc/forbidden")}
function semCode(v){return D.semester(v)}
function normalizedMssv(value){
 const s=String(value||"").trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,50}$/.test(s))fail("MSSV trong Danh sách thành viên không hợp lệ.");
 return s;
}
function memberDocId(v){
 const s=String(v||"").trim();
 if(!/^[A-Za-z0-9_-]{4,240}$/.test(s))fail("Mã hồ sơ thành viên không hợp lệ.");
 return s;
}
function positionTitle(v){
 const s=String(v||"").replace(/\s+/g," ").trim();
 if(s.length<2||s.length>80||/[\u0000-\u001f<>]/.test(s))fail("Tên chức vụ không hợp lệ.");
 return s;
}
function docId(sem,id){return sem+"_"+createHash("sha256").update(id).digest("hex")}
function appointmentRef(sem,id){return getDb().collection("oscBoardAppointments").doc(docId(sem,id))}
function publicAppointment(d){
 return{semester:d.semester,mssv:d.mssv,memberId:d.memberId,
  name:d.name||"",title:d.title||"",createdAt:d.createdAt?.toDate?.()?.toISOString?.()||""};
}
async function getMembersForTerm(sem){
 // The roster remains the source of eligible people, including when a
 // member has NO website account at all.
 const snap=await getDb().collection("members").where("semester","==",sem).limit(1000).get();
 return snap.docs.map(d=>({...d.data(),id:d.id})); // Always use Firestore's authoritative document ID.
}
async function listBoard(actor,b){
 requireManager(actor);
 const sem=semCode(b.semester);
 const roster=await getMembersForTerm(sem);
 const byMssv=new Map();
 for(const m of roster){
  try{const key=normalizedMssv(m.mssv);if(!byMssv.has(key))byMssv.set(key,m)}
  catch{} // Old or empty member IDs cannot be appointed until corrected.
 }
 const snap=await getDb().collection("oscBoardAppointments").where("semester","==",sem).limit(300).get();
 return{ok:true,semester:sem,
  members:roster.map(m=>({id:m.id,name:String(m.name||"").slice(0,120),mssv:String(m.mssv||"").slice(0,50),
   division:String(m.data?.department||"").slice(0,120)})),
  appointments:snap.docs.map(d=>publicAppointment(d.data()))
   .filter(d=>byMssv.has(d.mssv))};
}
async function getCatalog(actor,b){
 requireManager(actor);
 const sem=semCode(b.semester);
 const snap=await getDb().collection("oscBoardTitles").doc(sem).get();
 return{ok:true,semester:sem,titles:Array.isArray(snap.data()?.titles)?snap.data().titles:defaults};
}
async function setCatalog(actor,b){
 requireManager(actor);
 const sem=semCode(b.semester);
 if(!Array.isArray(b.titles)||b.titles.length<1||b.titles.length>40)
  fail("Danh sách cần từ 1 đến 40 chức vụ.");
 const titles=b.titles.map(positionTitle);
 if(new Set(titles.map(t=>t.toLocaleLowerCase("vi"))).size!==titles.length)fail("Chức vụ bị trùng.");
 await getDb().collection("oscBoardTitles").doc(sem).set({
  titles,semester:sem,updatedBy:actor.decoded.uid,
  updatedAt:admin.firestore.FieldValue.serverTimestamp()
 },{merge:true});
 return{ok:true,titles};
}
async function assign(actor,b){
 requireManager(actor);
 const sem=semCode(b.semester),id=normalizedMssv(b.mssv),memberId=memberDocId(b.memberId),title=positionTitle(b.title);
 const db=getDb(),member=await db.collection("members").doc(memberId).get();
 if(!member.exists||member.data()?.semester!==sem||normalizedMssv(member.data()?.mssv)!==id)
  fail("Thành viên không có trong Danh sách thành viên của học kỳ này hoặc MSSV đã đổi.","osc/member-not-in-roster");
 const name=String(member.data()?.name||"").trim();
 if(!name)fail("Hồ sơ thành viên chưa có tên.");
 const ref=appointmentRef(sem,id),audit=db.collection("oscBoardAudit").doc();
 let previous="";
 await db.runTransaction(async tx=>{
  const prior=await tx.get(ref);
  if(prior.exists&&prior.data()?.title!==title&&b.confirmChange!==true)
   fail("Thành viên đã giữ chức vụ ở học kỳ này. Xác nhận sửa để lưu nhật ký.","osc/board-confirm-change");
  previous=String(prior.data()?.title||"");
  tx.set(ref,{
   semester:sem,mssv:id,memberId,name:name.slice(0,120),title,
   updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid,
   ...(prior.exists?{}:{createdAt:admin.firestore.FieldValue.serverTimestamp()})
  },{merge:true});
  tx.create(audit,{action:prior.exists?"edit":"appoint",semester:sem,mssv:id,memberId,
   before:previous,after:title,by:actor.decoded.uid,
   at:admin.firestore.FieldValue.serverTimestamp()});
 });
 return{ok:true,semester:sem,mssv:id,memberId,title};
}
async function remove(actor,b){
 requireManager(actor);
 const sem=semCode(b.semester),id=normalizedMssv(b.mssv);
 if(b.confirmRemove!==true)fail("Cần xác nhận trước khi xóa bổ nhiệm.","osc/board-confirm-remove");
 const db=getDb(),ref=appointmentRef(sem,id);
 let removed=false;
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)return;
  tx.delete(ref);
  tx.create(db.collection("oscBoardAudit").doc(),{
   action:"remove",semester:sem,mssv:id,before:snap.data()?.title||"",
   by:actor.decoded.uid,at:admin.firestore.FieldValue.serverTimestamp()
  });
  removed=true;
 });
 return{ok:true,removed};
}
async function profile(actor,b){
 requireReader(actor);
 const sem=semCode(b.semester),id=normalizedMssv(b.mssv);
 // Visibility of appointment for a profile is tied only to an actual member
 // record in the requested semester. Never link to a Firebase login account.
 const memberId=memberDocId(b.memberId);
 const roster=await getDb().collection("members").doc(memberId).get();
 if(!roster.exists||roster.data()?.semester!==sem||normalizedMssv(roster.data()?.mssv)!==id)
   fail("Hồ sơ thành viên không hợp lệ hoặc không thuộc học kỳ này.","osc/forbidden");
 const snap=await appointmentRef(sem,id).get();
 const actual=snap.data();
 const title=snap.exists&&actual?.memberId===memberId?String(actual.title||""):"";
 const hist=await getDb().collection("oscBoardAppointments").where("mssv","==",id).limit(60).get();
 const history=hist.docs.map(d=>publicAppointment(d.data()))
   .filter(d=>/^(SP|SU|FA)\d{2}$/.test(d.semester))
   .sort((x,y)=>Number(x.semester.slice(2))-Number(y.semester.slice(2))||
    ["SP","SU","FA"].indexOf(x.semester.slice(0,2))-["SP","SU","FA"].indexOf(y.semester.slice(0,2)));
 return{ok:true,mssv:id,semester:sem,title,history,semesterCount:history.length};
}
async function history(actor,b){
 requireManager(actor);
 const id=normalizedMssv(b.mssv);
 const snaps=await getDb().collection("oscBoardAppointments").where("mssv","==",id).limit(60).get();
 const rows=snaps.docs.map(d=>publicAppointment(d.data())).sort((x,y)=>{
  const n=t=>Number(t.slice(2))*3+({SP:0,SU:1,FA:2}[t.slice(0,2)]||0);
  return n(x.semester)-n(y.semester)
 });
 const totals={};for(const r of rows)totals[r.title]=(totals[r.title]||0)+1;
 return{ok:true,mssv:id,history:rows,semesterCount:rows.length,titleCounts:totals};
}
async function apply(actor,b){
 switch(String(b.action||"")){
  case"board-list":return listBoard(actor,b);
  case"board-titles-get":return getCatalog(actor,b);
  case"board-titles-set":return setCatalog(actor,b);
  case"board-assign":return assign(actor,b);
  case"board-remove":return remove(actor,b);
  case"board-profile":return profile(actor,b);
  case"board-history":return history(actor,b);
  default:fail("Hành động Ban Chủ nhiệm không hợp lệ.");
 }
}
async function handler(req,res){
 try{
  if(req.method!=="POST")return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ POST."});
  const actor=await requireUser(req),body=readJsonBody(req);
  return sendJson(res,200,await apply(actor,body));
 }catch(err){
  const code=String(err?.code||"");
  if(code.startsWith("osc/")){
   const status=code==="osc/forbidden"?403:code.startsWith("osc/board-confirm")?409:400;
   return sendJson(res,status,{ok:false,error:err.message,code});
  }
  return handleError(res,err);
 }
}
module.exports=handler;
module.exports.apply=apply;
module.exports.docId=docId;
module.exports.normalizedMssv=normalizedMssv;
module.exports.positionTitle=positionTitle;
