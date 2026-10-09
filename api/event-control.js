"use strict";

const crypto=require("crypto");
const {getDb,sendJson,readJsonBody,requireUser}=require("../lib/firebase-admin");

function bad(message,code="osc/bad-request"){const e=new Error(message);e.code=code;return e}
function cleanId(v,label="ID"){const s=String(v||"").trim();if(!s||s.length>180||s.includes("/"))throw bad(label+" không hợp lệ.");return s}
function clean(v,max=160){return String(v??"").trim().replace(/\s+/g," ").slice(0,max)}
function millis(v){try{return v?.toMillis?.()||v?.toDate?.()?.getTime?.()||Number(v||0)||0}catch{return 0}}
function isManager(a){return ["admin","superadmin"].includes(a?.profile?.role)}
function canAssign(a){return isManager(a)||(a?.profile?.role==="bcn"&&a.profile.permissions?.viewEvents===true&&a.profile.permissions?.editEvents===true)}
function canView(a){return isManager(a)||(a?.profile?.role==="bcn"&&(a.profile.permissions?.viewAttendance===true||a.profile.permissions?.viewEvents===true))}
function normalizeAudience(v){const x=String(v||"public").toLowerCase();return ["public","vip","bcn","guest","artist","sponsor","media"].includes(x)?x:"public"}
function clamp(n,a,b){const x=Number(n);return Math.min(b,Math.max(a,Number.isFinite(x)?x:a))}
function rows(sec){
  const spr=Math.round(clamp(sec?.seatsPerRow||10,1,80)),src=Array.isArray(sec?.rowSpecs)&&sec.rowSpecs.length?sec.rowSpecs:(Array.isArray(sec?.rows)?sec.rows:[]);
  const out=[];for(const item of src){if(item&&typeof item==="object"){const label=clean(item.label??item.row,12);if(label)out.push({label,seats:Math.round(clamp(item.seats??item.count??spr,1,80))})}else{const label=clean(item,12);if(label)out.push({label,seats:spr})}}
  return out.length?out:[{label:"A",seats:spr}]
}
function lockedSet(sec){return new Set((Array.isArray(sec?.lockedSeats)?sec.lockedSeats:[]).map(x=>String(x).toUpperCase()))}
function seating(event){
  const raw=event?.seating&&typeof event.seating==="object"?event.seating:{},sections=(Array.isArray(raw.sections)?raw.sections:[]).slice(0,30).map((sec,i)=>({
    id:String(sec.id||("section_"+i)).replace(/[^A-Za-z0-9_-]/g,"_").slice(0,48),name:clean(sec.name||("Khu "+(i+1)),60),
    x:clamp(sec.x,0,94),y:clamp(sec.y,0,94),w:clamp(sec.w||32,12,94),startNumber:Math.round(clamp(sec.startNumber||1,1,999)),reverse:sec.reverse===true,
    audience:normalizeAudience(sec.audience||sec.reservedFor),rowSpecs:rows(sec),lockedSeats:[...lockedSet(sec)]
  }));
  return{enabled:raw.enabled===true,title:clean(raw.title||"Chọn ghế",100),stageLabel:clean(raw.stageLabel||"SÂN KHẤU",80),canvasHeight:Math.round(clamp(raw.canvasHeight||640,360,1400)),stage:raw.stage||{},sections}
}
function seatsFrom(cfg){
  const out=[];for(const sec of cfg.sections){const locked=new Set(sec.lockedSeats||[]);for(const r of sec.rowSpecs){for(let i=0;i<r.seats;i++){const number=sec.startNumber+(sec.reverse?(r.seats-1-i):i),label=`${r.label}${number}`,id=crypto.createHash("sha256").update(sec.id+"|"+r.label+"|"+number).digest("hex").slice(0,28),isLocked=locked.has(label.toUpperCase());out.push({id,label,row:r.label,number,sectionId:sec.id,sectionName:sec.name,audience:sec.audience,locked:isLocked,publicSelectable:sec.audience==="public"&&!isLocked})}}}
  return out
}
function mssvKey(v){return String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"")}
function mssvField(event){const fs=Array.isArray(event?.fields)?event.fields:[];return fs.find(f=>f?.systemKey==="mssv")||fs.find(f=>f?.type==="mssv")||null}
function timeline(checkins){
  const buckets=new Map();for(const c of checkins){const ms=c.checkedInAt;if(!ms||c.checkinStatus==="rejected")continue;const d=new Date(ms),key=new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes()).getTime();buckets.set(key,(buckets.get(key)||0)+1)}
  return[...buckets.entries()].sort((a,b)=>a[0]-b[0]).map(([minute,count])=>({minute,count}))
}
async function loadEvent(db,eventId){const ref=db.collection("eventPortals").doc(eventId),snap=await ref.get();if(!snap.exists)throw bad("Sự kiện không tồn tại.","osc/event-not-found");return{id:eventId,...(snap.data()||{})}}
async function live(req,body){
  const actor=await requireUser(req);if(!canView(actor))throw bad("Bạn chưa có quyền xem điều hành sự kiện.","osc/forbidden");
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),event=await loadEvent(db,eventId),cfg=seating(event),allSeats=seatsFrom(cfg);
  const [claimSnap,subSnap,checkSnap,ticketSnap]=await Promise.all([
    db.collection("eventSeatClaims").doc(eventId).collection("seats").get(),
    db.collection("eventPortals").doc(eventId).collection("submissions").get(),
    db.collection("eventPortals").doc(eventId).collection("qrCheckins").get(),
    db.collection("ticketStudios").doc(eventId).collection("tickets").get()
  ]);
  const field=mssvField(event),subs=new Map(),subByMssv=new Map();
  for(const doc of subSnap.docs){const d=doc.data()||{},mssv=field?mssvKey(d.answers?.[field.id]):"";const item={id:doc.id,label:clean(d.submitterLabel||"Phản hồi",160),mssv,seatId:String(d.seatId||""),seatLabel:String(d.seatLabel||""),countsTowardCapacity:d.countsTowardCapacity!==false};subs.set(doc.id,item);if(mssv)subByMssv.set(mssv,item)}
  const checkins=checkSnap.docs.map(doc=>{const d=doc.data()||{};return{id:doc.id,registrationSubmissionId:String(d.registrationSubmissionId||""),mssv:mssvKey(d.mssv),seat:String(d.seat||""),checkinStatus:String(d.checkinStatus||"approved"),checkedInAt:millis(d.checkedInAt)}});
  const checkedSubs=new Set(),checkedMssv=new Set(),checkedSeats=new Set();
  for(const x of checkins){if(x.checkinStatus==="rejected")continue;if(x.registrationSubmissionId)checkedSubs.add(x.registrationSubmissionId);if(x.mssv)checkedMssv.add(x.mssv);if(x.seat)checkedSeats.add(x.seat.toUpperCase())}
  const claims=new Map(claimSnap.docs.map(d=>[d.id,{seatId:d.id,...(d.data()||{})}]));
  const ticketsBySeat=new Map();
  for(const doc of ticketSnap.docs){const t=doc.data()||{},status=String(t.status||"issued");if(["revoked","cancelled"].includes(status))continue;const key=String(t.seat||"").trim().toUpperCase();if(key&&!ticketsBySeat.has(key))ticketsBySeat.set(key,{id:doc.id,status,sourceSubmissionId:String(t.sourceSubmissionId||"")})}
  const seatRows=allSeats.map(seat=>{
    const claim=claims.get(seat.id),sub=claim?subs.get(String(claim.submissionId||"")):null,ticket=ticketsBySeat.get(seat.label.toUpperCase());
    const checked=!!claim&&(checkedSubs.has(String(claim.submissionId||""))||(sub?.mssv&&checkedMssv.has(sub.mssv))||checkedSeats.has(seat.label.toUpperCase()));
    const ticketChecked=!!ticket&&(ticket.status==="checked_in"||checkedSeats.has(seat.label.toUpperCase())||(ticket.sourceSubmissionId&&checkedSubs.has(ticket.sourceSubmissionId)));
    const status=claim?(checked?"checked_in":"not_arrived"):ticket?(ticketChecked?"checked_in":"sold"):(seat.publicSelectable?"free":"reserved");
    return{...seat,status,submissionId:claim?String(claim.submissionId||""):""}
  });
  const counts={total:seatRows.length,free:0,reserved:0,sold:0,not_arrived:0,checked_in:0,registered:subSnap.size,checkedInTotal:checkins.filter(x=>x.checkinStatus!=="rejected").length};
  seatRows.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
  counts.soldTotal=counts.sold+counts.not_arrived+counts.checked_in;
  const capacity=Math.max(0,Math.floor(Number(event.capacity||event.registrationCapacity||0))),counted=[...subs.values()].filter(x=>x.countsTowardCapacity).length;
  const result={ok:true,version:95,event:{id:eventId,title:clean(event.title||"Sự kiện",200),semester:String(event.semester||""),capacity,capacityUsed:counted,isOpen:event.isOpen===true},seating:cfg,seats:seatRows,counts,timeline:timeline(checkins),canAssign:canAssign(actor)};
  if(canAssign(actor))result.submissions=[...subs.values()].filter(x=>x.countsTowardCapacity).sort((a,b)=>a.label.localeCompare(b.label,"vi"));
  return result
}
function status(code){if(code==="osc/unauthenticated")return 401;if(["osc/forbidden","osc/inactive","osc/no-profile"].includes(code))return 403;if(code==="osc/event-not-found")return 404;return 400}
module.exports=async function handler(req,res){
  try{
    if(req.method==="GET")return sendJson(res,200,{ok:true,service:"event-control",version:95});
    if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET/POST."})}
    const body=readJsonBody(req),action=String(body.action||"");if(action!=="admin-live")throw bad("Thao tác Event Control không hợp lệ.");
    return sendJson(res,200,await live(req,body));
  }catch(e){const code=String(e?.code||"osc/server-error");console.error("event-control",code,e?.message);return sendJson(res,status(code),{ok:false,error:code.startsWith("osc/")?String(e.message||"Yêu cầu không thành công."):"Máy chủ không thể hoàn tất yêu cầu.",code:code.startsWith("osc/")?code:"osc/server-error"})}
};