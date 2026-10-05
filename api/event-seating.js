"use strict";

const crypto=require("crypto");
const {admin,getDb,readJsonBody,requireManager,sendJson}=require("../lib/firebase-admin");

function bad(message,code="osc/bad-request"){const e=new Error(message);e.code=code;return e}
function cleanId(v,label="ID"){const s=String(v||"").trim();if(!s||s.length>180||s.includes("/"))throw bad(label+" không hợp lệ.");return s}
function cleanText(v,max=200){return String(v??"").trim().replace(/\s+/g," ").slice(0,max)}
function millis(v){try{return v?.toMillis?.()||v?.toDate?.()?.getTime?.()||Number(v||0)||0}catch{return 0}}
function semesterLocked(state,semester){return !!state?.semesters?.[semester]?.locked}
async function loadState(db){const s=await db.collection("clubState").doc("main").get();return s.exists?(s.data()?.state||{}):{}}
async function loadEvent(db,eventId){const ref=db.collection("eventPortals").doc(cleanId(eventId,"Sự kiện")),snap=await ref.get();if(!snap.exists)throw bad("Sự kiện không tồn tại.","osc/event-not-found");return{ref,data:{id:ref.id,...(snap.data()||{})}}}
function eventOpen(event){const now=Date.now(),start=millis(event?.openAt),end=millis(event?.closeAt);return event?.isOpen===true&&(!start||now>=start)&&(!end||now<end)}
function cleanToken(v){const s=String(v||"").trim();if(!/^[A-Za-z0-9_-]{20,160}$/.test(s))throw bad("Phiên chọn ghế không hợp lệ.","osc/seat-session-invalid");return s}
function tokenHash(v){return crypto.createHash("sha256").update(cleanToken(v)).digest("hex")}
function clamp(n,a,b){const x=Number(n);return Math.min(b,Math.max(a,Number.isFinite(x)?x:a))}
function cleanPart(v,max=40){return String(v||"").trim().replace(/[^A-Za-z0-9_-]/g,"_").slice(0,max)}
function normalizeRows(v){const src=Array.isArray(v)?v:String(v||"").split(",");return src.map(x=>cleanText(x,12)).filter(Boolean).slice(0,40)}
function normalizeConfig(raw){
  const src=raw&&typeof raw==="object"?raw:{};
  const sections=(Array.isArray(src.sections)?src.sections:[]).slice(0,30).map((s,i)=>{
    const id=cleanPart(s.id||("section_"+(i+1)),48)||("section_"+(i+1)),rows=normalizeRows(s.rows||s.rowLabels||[]);
    return{
      id,name:cleanText(s.name||("Khu "+(i+1)),60),
      x:clamp(s.x,0,92),y:clamp(s.y,0,92),w:clamp(s.w||32,12,90),
      rows:rows.length?rows:["A"],seatsPerRow:Math.round(clamp(s.seatsPerRow||10,1,60)),
      startNumber:Math.round(clamp(s.startNumber||1,1,999)),reverse:s.reverse===true
    }
  });
  return{
    enabled:src.enabled===true,title:cleanText(src.title||"Chọn ghế",100),
    stageLabel:cleanText(src.stageLabel||"SÂN KHẤU",80),canvasHeight:Math.round(clamp(src.canvasHeight||640,360,1200)),sections
  }
}
function seatsFromConfig(config){
  const out=[],seen=new Set();
  for(const sec of config.sections){
    for(const row of sec.rows){
      for(let i=0;i<sec.seatsPerRow;i++){
        const num=sec.startNumber+(sec.reverse?(sec.seatsPerRow-1-i):i);
        const raw=sec.id+"|"+row+"|"+num,id=crypto.createHash("sha256").update(raw).digest("hex").slice(0,28);
        if(seen.has(id))throw bad("Sơ đồ ghế có ghế trùng.","osc/seat-config-invalid");
        seen.add(id);out.push({id,sectionId:sec.id,sectionName:sec.name,row,number:num,label:`${row}${num}`});
      }
    }
  }
  if(out.length>2500)throw bad("Sơ đồ ghế vượt quá 2.500 ghế.","osc/seat-config-invalid");
  return out
}
function publicConfig(event){const cfg=normalizeConfig(event.seating);return{enabled:cfg.enabled,title:cfg.title,stageLabel:cfg.stageLabel,canvasHeight:cfg.canvasHeight,sections:cfg.sections.map(s=>({...s}))}}
async function verifySeatSession(db,eventId,submissionId,claimToken){
  const subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(cleanId(submissionId,"Phản hồi")),snap=await subRef.get();
  if(!snap.exists)throw bad("Không tìm thấy phản hồi đăng ký.","osc/seat-session-invalid");
  const data=snap.data()||{},hash=tokenHash(claimToken);
  if(!data.seatClaimHash||data.seatClaimHash!==hash)throw bad("Phiên chọn ghế không hợp lệ hoặc đã hết hạn.","osc/seat-session-invalid");
  return{subRef,data}
}
function answerEmpty(v){return Array.isArray(v)?v.length===0:String(v??"").trim()===""}
function cleanAnswer(v){
  if(Array.isArray(v))return v.slice(0,50).map(x=>cleanText(x,300));
  return String(v??"").slice(0,4000)
}
function validateAnswers(event,raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw bad("Dữ liệu phản hồi không hợp lệ.");
  if(JSON.stringify(raw).length>60000)throw bad("Dữ liệu phản hồi quá lớn.");
  const fields=Array.isArray(event?.fields)?event.fields:[],out={};
  for(const f of fields){
    const type=String(f?.type||"text"),id=String(f?.id||"").slice(0,180);
    if(!id||["image","content","section"].includes(type))continue;
    const v=cleanAnswer(raw[id]);
    if(f?.required===true&&answerEmpty(v))throw bad("Vui lòng trả lời câu bắt buộc: "+cleanText(f?.label||"Thông tin",120));
    if(type==="email"&&!answerEmpty(v)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))throw bad("Email không hợp lệ.");
    if(type==="mssv"&&!answerEmpty(v)&&!/^[A-Za-z0-9_-]{4,30}$/.test(String(v).trim()))throw bad("MSSV không hợp lệ.");
    out[id]=v;
  }
  if(Object.keys(out).length>60)throw bad("Biểu mẫu có quá nhiều trường trả lời.");
  return out
}
function deriveSubmitterLabel(event,answers,fallback){
  const fields=Array.isArray(event?.fields)?event.fields:[];
  const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const name=fields.find(f=>{const l=norm(f?.label);return !["image","content","section"].includes(String(f?.type||""))&&((l.includes("ho")&&l.includes("ten"))||l.includes("full name"))});
  const mssv=fields.find(f=>String(f?.type||"")==="mssv");
  return cleanText((name&&answers?.[name.id])||(mssv&&answers?.[mssv.id])||fallback||"Phản hồi",200)
}
function requestIp(req){return String(req.headers["x-forwarded-for"]||req.headers["x-real-ip"]||"unknown").split(",")[0].trim().slice(0,80)}
function rateKey(parts){return crypto.createHash("sha256").update(parts.join("|")).digest("hex")}
async function enforceCreateRate(req,db,eventId){
  const now=Date.now(),windowMs=10*60*1000,ref=db.collection("eventSeatRateLimits").doc(rateKey([eventId,requestIp(req)]));
  await db.runTransaction(async tx=>{const snap=await tx.get(ref),d=snap.exists?snap.data()||{}:{},start=millis(d.windowStart);if(!start||now-start>=windowMs){tx.set(ref,{windowStart:admin.firestore.Timestamp.fromMillis(now),count:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:false});return}const count=Number(d.count||0);if(count>=12)throw bad("Thiết bị này đã gửi quá nhiều đăng ký trong thời gian ngắn. Vui lòng thử lại sau.","osc/rate-limited");tx.update(ref,{count:count+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()})})
}
async function createSubmission(req,body){
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),state=await loadState(db);
  if(semesterLocked(state,event.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  const cfg=normalizeConfig(event.seating);if(!cfg.enabled)throw bad("Sự kiện không bật chọn ghế.","osc/seating-disabled");
  if(!eventOpen(event))throw bad("Cổng sự kiện hiện không nhận đăng ký.","osc/event-closed");
  seatsFromConfig(cfg);
  await enforceCreateRate(req,db,eventId);
  const answers=validateAnswers(event,body.answers);
  const submitterLabel=deriveSubmitterLabel(event,answers,body.submitterLabel);if(!submitterLabel)throw bad("Thiếu tên/người gửi.");
  const claimToken=cleanToken(body.claimToken),submissionId="sub_"+crypto.randomBytes(16).toString("hex");
  const ref=db.collection("eventPortals").doc(eventId).collection("submissions").doc(submissionId);
  await ref.create({
    eventId,semester:String(event.semester||""),answers,submitterLabel,actionApplied:false,
    seatSelectionRequired:true,seatStatus:"pending",seatClaimHash:tokenHash(claimToken),
    createdAt:admin.firestore.FieldValue.serverTimestamp()
  });
  return{ok:true,version:90,submissionId,seating:publicConfig(event)}
}
async function publicState(body){
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),cfg=normalizeConfig(event.seating);
  if(!cfg.enabled)throw bad("Sự kiện không bật chọn ghế.","osc/seating-disabled");
  const session=await verifySeatSession(db,eventId,body.submissionId,body.claimToken),seats=seatsFromConfig(cfg);
  const snap=await db.collection("eventSeatClaims").doc(eventId).collection("seats").get();
  const occupied=snap.docs.map(d=>String(d.id));
  return{ok:true,version:90,seating:publicConfig(event),seats,occupied,currentSeatId:String(session.data.seatId||""),currentSeatLabel:String(session.data.seatLabel||""),seatCount:seats.length}
}
async function claimSeat(body){
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),state=await loadState(db);
  if(semesterLocked(state,event.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  const cfg=normalizeConfig(event.seating);if(!cfg.enabled)throw bad("Sự kiện không bật chọn ghế.","osc/seating-disabled");
  const seats=seatsFromConfig(cfg),seat=seats.find(x=>x.id===String(body.seatId||""));if(!seat)throw bad("Ghế không tồn tại trong sơ đồ.","osc/seat-invalid");
  const submissionId=cleanId(body.submissionId,"Phản hồi"),claimHash=tokenHash(body.claimToken);
  const subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(submissionId);
  const claims=db.collection("eventSeatClaims").doc(eventId).collection("seats"),newRef=claims.doc(seat.id);
  let changed=false;
  await db.runTransaction(async tx=>{
    const subSnap=await tx.get(subRef);if(!subSnap.exists)throw bad("Không tìm thấy phản hồi đăng ký.","osc/seat-session-invalid");
    const sub=subSnap.data()||{};if(sub.seatClaimHash!==claimHash)throw bad("Phiên chọn ghế không hợp lệ hoặc đã hết hạn.","osc/seat-session-invalid");
    if(sub.seatStatus==="confirmed"&&String(sub.seatId||"")===seat.id)return;
    const newSnap=await tx.get(newRef);
    if(newSnap.exists&&String(newSnap.data()?.submissionId||"")!==submissionId)throw bad("Ghế này vừa có người khác chọn. Vui lòng chọn ghế khác.","osc/seat-taken");
    let oldRef=null,oldSnap=null;
    if(sub.seatId&&String(sub.seatId)!==seat.id){oldRef=claims.doc(String(sub.seatId));oldSnap=await tx.get(oldRef)}
    if(oldRef&&oldSnap?.exists&&String(oldSnap.data()?.submissionId||"")===submissionId)tx.delete(oldRef);
    tx.set(newRef,{eventId,submissionId,seatId:seat.id,seatLabel:seat.label,sectionId:seat.sectionId,sectionName:seat.sectionName,row:seat.row,number:seat.number,claimedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:false});
    tx.update(subRef,{seatStatus:"confirmed",seatId:seat.id,seatLabel:seat.label,seatSectionId:seat.sectionId,seatSectionName:seat.sectionName,seatConfirmedAt:admin.firestore.FieldValue.serverTimestamp()});
    changed=true;
  });
  return{ok:true,version:90,seat,changed}
}
async function adminState(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),cfg=normalizeConfig(event.seating);
  const snap=await db.collection("eventSeatClaims").doc(eventId).collection("seats").get();
  return{ok:true,version:90,eventId,seating:publicConfig(event),claimed:snap.size,total:seatsFromConfig(cfg).length,actorRole:actor.profile.role}
}
async function adminRelease(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),seatId=cleanId(body.seatId,"Ghế"),ref=db.collection("eventSeatClaims").doc(eventId).collection("seats").doc(seatId),snap=await ref.get();
  if(!snap.exists)return{ok:true,released:false};
  const claim=snap.data()||{},subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(String(claim.submissionId||""));
  const batch=db.batch();batch.delete(ref);if(claim.submissionId)batch.set(subRef,{seatStatus:"pending",seatId:"",seatLabel:"",seatSectionId:"",seatSectionName:"",seatReleasedAt:admin.firestore.FieldValue.serverTimestamp(),seatReleasedBy:actor.decoded.uid},{merge:true});await batch.commit();
  return{ok:true,released:true}
}
async function adminReleaseSubmissionSeat(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),submissionId=cleanId(body.submissionId,"Phản hồi"),subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(submissionId),subSnap=await subRef.get();
  if(!subSnap.exists)return{ok:true,released:false};
  const sub=subSnap.data()||{},seatId=String(sub.seatId||"");
  if(!seatId)return{ok:true,released:false};
  const seatRef=db.collection("eventSeatClaims").doc(eventId).collection("seats").doc(seatId),seatSnap=await seatRef.get();
  const batch=db.batch();
  if(seatSnap.exists&&String(seatSnap.data()?.submissionId||"")===submissionId)batch.delete(seatRef);
  batch.set(subRef,{seatStatus:"pending",seatId:"",seatLabel:"",seatSectionId:"",seatSectionName:"",seatReleasedAt:admin.firestore.FieldValue.serverTimestamp(),seatReleasedBy:actor.decoded.uid},{merge:true});
  await batch.commit();return{ok:true,released:true}
}
function status(code){if(["osc/unauthenticated"].includes(code))return 401;if(["osc/forbidden","osc/inactive","osc/no-profile"].includes(code))return 403;if(["osc/event-not-found"].includes(code))return 404;if(["osc/seat-taken"].includes(code))return 409;if(["osc/semester-locked","osc/event-closed","osc/seating-disabled"].includes(code))return 409;if(code==="osc/rate-limited")return 429;return 400}
module.exports=async function handler(req,res){
  try{
    if(req.method==="GET")return sendJson(res,200,{ok:true,service:"event-seating",version:90});
    if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET/POST."})}
    const body=readJsonBody(req),action=String(body.action||"");let out;
    if(action==="public-create-submission")out=await createSubmission(req,body);
    else if(action==="public-state")out=await publicState(body);
    else if(action==="public-claim-seat")out=await claimSeat(body);
    else if(action==="admin-state")out=await adminState(req,body);
    else if(action==="admin-release-seat")out=await adminRelease(req,body);
    else if(action==="admin-release-submission-seat")out=await adminReleaseSubmissionSeat(req,body);
    else throw bad("Thao tác sơ đồ ghế không hợp lệ.");
    return sendJson(res,200,out)
  }catch(e){const code=String(e?.code||"osc/server-error");console.error("event-seating",code,e?.message);return sendJson(res,status(code),{ok:false,error:code.startsWith("osc/")?String(e.message||"Yêu cầu không thành công."):"Máy chủ không thể hoàn tất yêu cầu.",code:code.startsWith("osc/")?code:"osc/server-error"})}
};
