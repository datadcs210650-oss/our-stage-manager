"use strict";

const {
  admin,getDb,sendJson,readJsonBody,requireUser,requireManager,
  validateUid,getTargetProfile,ensureTargetManageable,PERMISSION_KEYS,handleError
}=require("../lib/firebase-admin");

function bad(message,code="osc/bad-request"){const e=new Error(message);e.code=code;return e}
function clean(v,max=160){return String(v??"").trim().replace(/\s+/g," ").slice(0,max)}
function cleanId(v,label="ID"){const s=String(v||"").trim();if(!s||s.length>180||s.includes("/"))throw bad(label+" không hợp lệ.");return s}
function isManager(actor){return ["admin","superadmin"].includes(actor?.profile?.role)}
function canEditEvents(actor){return isManager(actor)||(actor?.profile?.role==="bcn"&&actor.profile.permissions?.viewEvents===true&&actor.profile.permissions?.editEvents===true)}
function millis(v){try{return v?.toMillis?.()||v?.toDate?.()?.getTime?.()||Number(v||0)||0}catch{return 0}}
function dateValue(v,label){
  const d=new Date(v);if(!v||Number.isNaN(d.getTime()))throw bad(label+" không hợp lệ.");
  return d;
}
async function loadState(db){const s=await db.collection("clubState").doc("main").get();return s.exists?(s.data()?.state||{}):{}}
function semesterLocked(state,semester){return !!state?.semesters?.[semester]?.locked}
function normalizeSemester(v){const s=String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"");if(!s||s.length>20)throw bad("Học kỳ không hợp lệ.");return s}
function status(code){
  if(code==="osc/unauthenticated")return 401;
  if(["osc/forbidden","osc/inactive","osc/no-profile"].includes(code))return 403;
  if(["osc/not-found","osc/target-not-found"].includes(code))return 404;
  if(["osc/room-conflict","osc/semester-locked"].includes(code))return 409;
  return 400;
}

/* ===== Room Booking Board ===== */
function roomPublic(doc){
  const d=doc.data?doc.data()||{}:doc||{};
  return{id:String(doc.id||d.id||""),semester:String(d.semester||""),roomName:String(d.roomName||""),purpose:String(d.purpose||""),
    eventId:String(d.eventId||""),startAt:millis(d.startAt),endAt:millis(d.endAt),status:d.status==="cancelled"?"cancelled":"active",
    createdByName:String(d.createdByName||"")};
}
async function roomsList(req,body){
  const actor=await requireUser(req),db=getDb(),semester=normalizeSemester(body.semester);
  const snap=await db.collection("roomBookings").where("semester","==",semester).get();
  const rows=snap.docs.map(roomPublic).filter(x=>x.status==="active").sort((a,b)=>a.startAt-b.startAt);
  return{ok:true,version:95,rows,canEdit:canEditEvents(actor)}
}
async function roomCreate(req,body){
  const actor=await requireUser(req);if(!canEditEvents(actor))throw bad("Bạn chưa có quyền tạo lịch phòng.","osc/forbidden");
  const db=getDb(),state=await loadState(db),semester=normalizeSemester(body.semester);if(semesterLocked(state,semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  const roomName=clean(body.roomName,100),purpose=clean(body.purpose,240),eventId=clean(body.eventId,180);
  if(!roomName||!purpose)throw bad("Vui lòng nhập phòng và mục đích sử dụng.");
  const roomKey=roomName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const start=dateValue(body.startAt,"Giờ bắt đầu"),end=dateValue(body.endAt,"Giờ kết thúc");
  if(end<=start)throw bad("Giờ kết thúc phải sau giờ bắt đầu.");
  if(end.getTime()-start.getTime()>24*60*60*1000)throw bad("Một lượt đặt phòng tối đa 24 giờ.");
  const ref=db.collection("roomBookings").doc(),query=db.collection("roomBookings").where("semester","==",semester);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(query);
    for(const doc of snap.docs){const d=doc.data()||{};if(d.status==="cancelled"||String(d.roomKey||"")!==roomKey)continue;const a=millis(d.startAt),b=millis(d.endAt);if(start.getTime()<b&&end.getTime()>a)throw bad(`Phòng ${roomName} đã được đặt trong khung giờ này.`,"osc/room-conflict")}
    tx.set(ref,{semester,roomName,roomKey,purpose,eventId,status:"active",startAt:admin.firestore.Timestamp.fromDate(start),endAt:admin.firestore.Timestamp.fromDate(end),
      createdAt:admin.firestore.FieldValue.serverTimestamp(),createdBy:actor.decoded.uid,createdByName:clean(actor.profile.displayName||actor.decoded.email||"BCN",120)},{merge:false});
  });
  return{ok:true,version:95,bookingId:ref.id}
}
async function roomCancel(req,body){
  const actor=await requireUser(req);if(!canEditEvents(actor))throw bad("Bạn chưa có quyền hủy lịch phòng.","osc/forbidden");
  const db=getDb(),id=cleanId(body.bookingId,"Lịch phòng"),ref=db.collection("roomBookings").doc(id),snap=await ref.get();if(!snap.exists)throw bad("Lịch phòng không tồn tại.","osc/not-found");
  const d=snap.data()||{},state=await loadState(db);if(semesterLocked(state,d.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  await ref.set({status:"cancelled",cancelledAt:admin.firestore.FieldValue.serverTimestamp(),cancelledBy:actor.decoded.uid},{merge:true});
  return{ok:true,version:95,cancelled:true}
}

/* ===== Temporary Permissions ===== */
function normalizeTempPermissions(input){
  const src=input&&typeof input==="object"?input:{},out={};for(const key of PERMISSION_KEYS)out[key]=src[key]===true;
  out.editAttendance=out.viewAttendance&&out.editAttendance;out.editMembers=out.viewMembers&&out.editMembers;out.editFinance=out.viewFinance&&out.editFinance;out.editEvents=out.viewEvents&&out.editEvents;out.editLookup=false;
  return out;
}
function tempPublic(doc){
  const d=doc.data?doc.data()||{}:doc||{},t=d.temporaryPermissions&&typeof d.temporaryPermissions==="object"?d.temporaryPermissions:null;
  return{uid:String(doc.id||""),displayName:String(d.displayName||""),email:String(d.email||""),role:String(d.role||""),active:d.active===true,
    temporaryPermissions:t?{permissions:t.permissions||{},eventId:String(t.eventId||""),label:String(t.label||""),expiresAt:millis(t.expiresAt),active:millis(t.expiresAt)>Date.now()}:null};
}
async function tempList(req){
  await requireManager(req);const db=getDb(),snap=await db.collection("users").get(),rows=snap.docs.map(tempPublic).filter(x=>x.role==="bcn"&&x.active).sort((a,b)=>a.displayName.localeCompare(b.displayName,"vi"));
  return{ok:true,version:95,rows}
}
async function tempSet(req,body){
  const actor=await requireManager(req),db=getDb(),uid=validateUid(body.uid),target=await getTargetProfile(uid);ensureTargetManageable(actor,uid,target.data);
  if(String(target.data.role||"").toLowerCase()!=="bcn")throw bad("Quyền tạm thời chỉ áp dụng cho tài khoản BCN.");
  const expires=dateValue(body.expiresAt,"Thời gian hết hạn"),max=Date.now()+31*86400000;if(expires.getTime()<=Date.now()||expires.getTime()>max)throw bad("Thời gian hết hạn phải trong tương lai và không quá 31 ngày.");
  const permissions=normalizeTempPermissions(body.permissions);if(!Object.values(permissions).some(Boolean))throw bad("Hãy chọn ít nhất một quyền tạm thời.");
  const eventId=clean(body.eventId,180),label=clean(body.label,120)||"Quyền tạm thời";
  await target.ref.set({temporaryPermissions:{permissions,eventId,label,expiresAt:admin.firestore.Timestamp.fromDate(expires),grantedAt:admin.firestore.FieldValue.serverTimestamp(),grantedBy:actor.decoded.uid},
    updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
  return{ok:true,version:95,uid,expiresAt:expires.getTime()}
}
async function tempClear(req,body){
  const actor=await requireManager(req),uid=validateUid(body.uid),target=await getTargetProfile(uid);ensureTargetManageable(actor,uid,target.data);
  await target.ref.set({temporaryPermissions:admin.firestore.FieldValue.delete(),updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
  return{ok:true,version:95,uid,cleared:true}
}

module.exports=async function handler(req,res){
  try{
    if(req.method==="GET")return sendJson(res,200,{ok:true,service:"operations",version:95});
    if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET/POST."})}
    const body=readJsonBody(req),action=String(body.action||"");let out;
    if(action==="rooms-list")out=await roomsList(req,body);
    else if(action==="room-create")out=await roomCreate(req,body);
    else if(action==="room-cancel")out=await roomCancel(req,body);
    else if(action==="temp-list")out=await tempList(req,body);
    else if(action==="temp-set")out=await tempSet(req,body);
    else if(action==="temp-clear")out=await tempClear(req,body);
    else throw bad("Thao tác Điều hành nâng cao không hợp lệ.");
    return sendJson(res,200,out);
  }catch(e){const code=String(e?.code||"");if(code.startsWith("osc/"))return sendJson(res,status(code),{ok:false,error:String(e.message||"Yêu cầu không thành công."),code});return handleError(res,e)}
};