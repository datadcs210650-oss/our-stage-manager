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

/* ===== Room booking: weekly availability + automatic history (Asia/Ho_Chi_Minh) ===== */
const ROOM_MAX_MS=24*60*60*1000;
function roomPublic(doc){
  const d=doc.data?doc.data()||{}:doc||{};
  return{
    id:String(doc.id||d.id||""),semester:String(d.semester||""),roomName:String(d.roomName||""),
    purpose:String(d.purpose||""),eventId:String(d.eventId||""),
    startAt:millis(d.startAt),endAt:millis(d.endAt),
    status:d.status==="cancelled"?"cancelled":"active",
    createdByName:String(d.createdByName||""),updatedByName:String(d.updatedByName||""),
    date:String(d.date||""),slotIds:Array.isArray(d.slotIds)?d.slotIds:[],
    slotSnapshot:Array.isArray(d.slotSnapshot)?d.slotSnapshot:[]
  };
}
function vnDateParts(ms){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date(ms));
  const val=key=>Number(parts.find(x=>x.type===key)?.value||0);
  return{y:val("year"),m:val("month"),d:val("day")};
}
function vnMidnight(ms){
  const p=vnDateParts(ms);
  return Date.UTC(p.y,p.m-1,p.d)-7*60*60*1000;
}
function roomWindow(body){
  const weekStart=dateValue(body.weekStart,"Đầu tuần").getTime();
  if(!Number.isFinite(weekStart)||weekStart!==vnMidnight(weekStart))throw bad("Ngày đầu tuần phải ở 00:00 giờ Việt Nam.");
  if(new Date(weekStart+7*60*60*1000).getUTCDay()!==1)throw bad("Đầu tuần phải là thứ Hai.");
  if(Math.abs(weekStart-Date.now())>2*366*86400000)throw bad("Chỉ xem lịch phòng trong phạm vi hai năm.");
  return{start:weekStart,end:weekStart+7*86400000};
}
function normalizeRoomBooking(body,slots){
  const roomName=clean(body.roomName,100),purpose=clean(body.purpose,240),eventId=clean(body.eventId,180);
  if(!roomName||!purpose)throw bad("Vui lòng nhập phòng và mục đích sử dụng.");
  const roomKey=roomName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");
  return{roomName,roomKey,purpose,eventId,...resolveRoomFromSlots(body,slots)};
}
function ensureRoomManager(actor){
  if(!isManager(actor))throw bad("Chỉ Admin hoặc Super Admin được tạo, sửa và hủy lịch phòng.","osc/forbidden");
}
async function assertNoRoomOverlap(tx,db,data,exceptId=""){
  // Look back 24h because any booking is limited to 24 hours.
  // Filter the room and status in JS so Firestore needs only the startAt single-field index.
  const q=db.collection("roomBookings").where("startAt",">=",admin.firestore.Timestamp.fromMillis(data.start.getTime()-ROOM_MAX_MS))
    .where("startAt","<",admin.firestore.Timestamp.fromDate(data.end));
  const snap=await tx.get(q);
  for(const doc of snap.docs){
    if(doc.id===exceptId)continue;
    const d=doc.data()||{};
    if(d.status==="cancelled")continue;
    const key=String(d.roomKey||d.roomName||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");
    if(key!==data.roomKey)continue;
    if(data.start.getTime()<millis(d.endAt)&&data.end.getTime()>millis(d.startAt))
      throw bad("Phòng "+data.roomName+" đã có lịch trùng thời gian.","osc/room-conflict");
  }
}

/* Admin-managed slot catalog. Booking time is computed on the server from slot IDs. */
const ROOM_SLOT_DOC="roomBookingSettings/slots";
const SLOT_CLOCK=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
function slotMinutes(time,allow24=false){
  if(allow24&&time==="24:00")return 1440;
  if(!SLOT_CLOCK.test(time))throw bad("Giờ slot phải đúng dạng HH:MM (24 giờ).");
  const [h,m]=time.split(":").map(Number);return h*60+m;
}
function validateSlots(raw){
  if(!Array.isArray(raw)||raw.length>48)throw bad("Danh sách slot không hợp lệ (tối đa 48 slot).");
  const used=new Set(),slots=raw.map(x=>{
    if(!x||typeof x!=="object")throw bad("Slot không hợp lệ.");
    const id=clean(x.id,50),label=clean(x.label,60);
    if(!/^[A-Za-z0-9_-]{1,50}$/.test(id)||used.has(id))throw bad("Mã slot không hợp lệ hoặc bị trùng.");
    if(!label)throw bad("Slot phải có tên.");
    used.add(id);
    const start=String(x.start||""),end=String(x.end||"");
    const from=slotMinutes(start),to=slotMinutes(end,true);
    if(to<=from)throw bad("Giờ kết thúc slot phải sau giờ bắt đầu.");
    return{id,label,start,end,from,to};
  }).sort((a,b)=>a.from-b.from||a.to-b.to);
  for(let i=1;i<slots.length;i++)if(slots[i].from<slots[i-1].to)throw bad("Các slot trong danh sách không được trùng giờ.");
  return slots.map(({id,label,start,end})=>({id,label,start,end}));
}
async function fetchSlotDoc(db,tx=null){
  const ref=db.doc(ROOM_SLOT_DOC),snap=tx?await tx.get(ref):await ref.get();
  return snap.exists?validateSlots(snap.data()?.slots||[]):[];
}
async function roomSlotList(req){
  const actor=await requireUser(req),slots=await fetchSlotDoc(getDb());
  return{ok:true,version:99,slots,canEdit:isManager(actor)};
}
async function roomSlotSave(req,body){
  const actor=await requireUser(req);ensureRoomManager(actor);
  const slots=validateSlots(body.slots);
  await getDb().doc(ROOM_SLOT_DOC).set({
    slots,updatedAt:admin.firestore.FieldValue.serverTimestamp(),
    updatedBy:actor.decoded.uid
  },{merge:true});
  return{ok:true,version:99,slots};
}
function resolveRoomFromSlots(body,slots){
  const date=String(body.date||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw bad("Ngày sử dụng phòng không hợp lệ.");
  const localDay=new Date(date+"T00:00:00+07:00");
  if(Number.isNaN(localDay.getTime()))throw bad("Ngày sử dụng phòng không hợp lệ.");
  const parts=vnDateParts(localDay.getTime());
  const roundtrip=parts.y+"-"+String(parts.m).padStart(2,"0")+"-"+String(parts.d).padStart(2,"0");
  if(roundtrip!==date)throw bad("Ngày sử dụng phòng không hợp lệ.");
  const ids=body.slotIds;
  if(!Array.isArray(ids)||ids.length===0||ids.length>48||new Set(ids).size!==ids.length)throw bad("Vui lòng chọn slot hợp lệ.");
  const selected=ids.map(id=>slots.find(x=>x.id===id));
  if(selected.some(x=>!x))throw bad("Slot đã được thay đổi. Hãy tải lại và chọn lại slot.");
  selected.sort((a,b)=>slotMinutes(a.start)-slotMinutes(b.start));
  for(let i=1;i<selected.length;i++)if(selected[i-1].end!==selected[i].start)throw bad("Các slot được chọn phải liền giờ, không có khoảng trống.");
  const start=new Date(localDay.getTime()+slotMinutes(selected[0].start)*60000);
  const end=new Date(localDay.getTime()+slotMinutes(selected[selected.length-1].end,true)*60000);
  return{date,slotIds:selected.map(x=>x.id),slotSnapshot:selected,start,end};
}

async function roomsList(req,body){
  const actor=await requireUser(req),db=getDb(),semester=normalizeSemester(body.semester);
  const snap=await db.collection("roomBookings").where("semester","==",semester).get();
  const rows=snap.docs.map(roomPublic).filter(x=>x.status==="active").sort((a,b)=>a.startAt-b.startAt);
  return{ok:true,version:98,rows,canEdit:isManager(actor)};
}
async function roomBoard(req,body){
  const actor=await requireUser(req),db=getDb(),win=roomWindow(body);
  const snap=await db.collection("roomBookings")
    .where("startAt",">=",admin.firestore.Timestamp.fromMillis(win.start-ROOM_MAX_MS))
    .where("startAt","<",admin.firestore.Timestamp.fromMillis(win.end)).get();
  const rows=snap.docs.map(roomPublic)
    .filter(x=>x.status==="active"&&x.endAt>win.start&&x.startAt<win.end)
    .sort((a,b)=>a.startAt-b.startAt||a.roomName.localeCompare(b.roomName,"vi"));
  return{ok:true,version:98,rows,canEdit:isManager(actor),serverNow:Date.now(),weekStart:win.start};
}
async function roomHistory(req,body){
  const actor=await requireUser(req),db=getDb(),now=Date.now();
  const todayStart=vnMidnight(now),limitExclusive=todayStart+1,before=body.before==null?limitExclusive:Number(body.before);
  if(!Number.isFinite(before)||before<=0)throw bad("Mốc lịch sử không hợp lệ.");
  const until=Math.min(limitExclusive,before),limit=60;
  const snap=await db.collection("roomBookings")
    .where("endAt","<",admin.firestore.Timestamp.fromMillis(until))
    .orderBy("endAt","desc").limit(limit+1).get();
  const page=snap.docs.slice(0,limit),last=page[page.length-1];
  const rows=page.map(roomPublic).filter(x=>x.status==="active");
  return{ok:true,version:98,rows,hasMore:snap.size>limit,nextBefore:last?millis(last.data().endAt):null,canEdit:isManager(actor),serverNow:now};
}
async function roomCreate(req,body){
  const actor=await requireUser(req);ensureRoomManager(actor);
  const db=getDb(),state=await loadState(db),semester=normalizeSemester(body.semester);
  if(semesterLocked(state,semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  const ref=db.collection("roomBookings").doc();
  await db.runTransaction(async tx=>{
    const slots=await fetchSlotDoc(db,tx);
    const data=normalizeRoomBooking(body,slots);
    const mutex=db.collection("roomBookingMutex").doc(require("node:crypto").createHash("sha256").update(data.roomKey).digest("hex"));
    const current=await tx.get(mutex);
    await assertNoRoomOverlap(tx,db,data);
    tx.set(mutex,{revision:(current.data()?.revision||0)+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    tx.set(ref,{
      semester,roomName:data.roomName,roomKey:data.roomKey,purpose:data.purpose,eventId:data.eventId,
      date:data.date,slotIds:data.slotIds,slotSnapshot:data.slotSnapshot,
      status:"active",startAt:admin.firestore.Timestamp.fromDate(data.start),endAt:admin.firestore.Timestamp.fromDate(data.end),
      createdAt:admin.firestore.FieldValue.serverTimestamp(),createdBy:actor.decoded.uid,
      createdByName:clean(actor.profile.displayName||actor.decoded.email||"Admin",120)
    },{merge:false});
  });
  return{ok:true,version:99,bookingId:ref.id};
}
async function roomUpdate(req,body){
  const actor=await requireUser(req);ensureRoomManager(actor);
  const db=getDb(),id=cleanId(body.bookingId,"Lịch phòng"),ref=db.collection("roomBookings").doc(id);
  const state=await loadState(db);
  await db.runTransaction(async tx=>{
    const existing=await tx.get(ref);
    if(!existing.exists||existing.data()?.status==="cancelled")throw bad("Lịch phòng không tồn tại hoặc đã hủy.","osc/not-found");
    if(semesterLocked(state,existing.data().semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
    const slots=await fetchSlotDoc(db,tx);
    const data=normalizeRoomBooking(body,slots);
    const mutex=db.collection("roomBookingMutex").doc(require("node:crypto").createHash("sha256").update(data.roomKey).digest("hex"));
    const current=await tx.get(mutex);
    await assertNoRoomOverlap(tx,db,data,id);
    tx.set(mutex,{revision:(current.data()?.revision||0)+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    tx.update(ref,{
      roomName:data.roomName,roomKey:data.roomKey,purpose:data.purpose,eventId:data.eventId,
      date:data.date,slotIds:data.slotIds,slotSnapshot:data.slotSnapshot,
      startAt:admin.firestore.Timestamp.fromDate(data.start),endAt:admin.firestore.Timestamp.fromDate(data.end),
      updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid,
      updatedByName:clean(actor.profile.displayName||actor.decoded.email||"Admin",120)
    });
  });
  return{ok:true,version:99,bookingId:id,updated:true};
}
async function roomCancel(req,body){
  const actor=await requireUser(req);ensureRoomManager(actor);
  const db=getDb(),id=cleanId(body.bookingId,"Lịch phòng"),ref=db.collection("roomBookings").doc(id),state=await loadState(db);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists)throw bad("Lịch phòng không tồn tại.","osc/not-found");
    const d=snap.data()||{};
    if(d.status==="cancelled")throw bad("Lịch phòng đã bị hủy.");
    if(semesterLocked(state,d.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
    tx.update(ref,{status:"cancelled",cancelledAt:admin.firestore.FieldValue.serverTimestamp(),cancelledBy:actor.decoded.uid});
  });
  return{ok:true,version:98,cancelled:true};
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
    if(action==="room-slot-list")out=await roomSlotList(req);
    else if(action==="room-slot-save")out=await roomSlotSave(req,body);
    else if(action==="rooms-list")out=await roomsList(req,body);
    else if(action==="room-board")out=await roomBoard(req,body);
    else if(action==="room-history")out=await roomHistory(req,body);
    else if(action==="room-update")out=await roomUpdate(req,body);
    else if(action==="room-create")out=await roomCreate(req,body);
    else if(action==="room-cancel")out=await roomCancel(req,body);
    else if(action==="temp-list")out=await tempList(req,body);
    else if(action==="temp-set")out=await tempSet(req,body);
    else if(action==="temp-clear")out=await tempClear(req,body);
    else throw bad("Thao tác Điều hành nâng cao không hợp lệ.");
    return sendJson(res,200,out);
  }catch(e){const code=String(e?.code||"");if(code.startsWith("osc/"))return sendJson(res,status(code),{ok:false,error:String(e.message||"Yêu cầu không thành công."),code});return handleError(res,e)}
};