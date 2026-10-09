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
const SEAT_AUDIENCES=new Set(["public","vip","bcn","guest","artist","sponsor","media"]);
function normalizeAudience(v){const x=String(v||"public").toLowerCase();return SEAT_AUDIENCES.has(x)?x:"public"}
function parseLockedSeats(v){
  const raw=Array.isArray(v)?v:String(v||"").split(/[\n,;\s]+/),out=new Set();
  for(const item of raw){const part=String(item||"").trim().toUpperCase();if(!part)continue;const range=part.match(/^(.{1,12}?)(\d{1,4})-\1?(\d{1,4})$/);if(range){const row=range[1],a=Number(range[2]),b=Number(range[3]),lo=Math.min(a,b),hi=Math.max(a,b);for(let n=lo;n<=hi&&n-lo<200;n++)out.add(row+n);continue}const one=part.match(/^(.{1,12}?)(\d{1,4})$/);if(one)out.add(one[1]+Number(one[2]))}
  return [...out].slice(0,1200)
}
function normalizeRowSpecs(section,seatsPerRow){
  const raw=Array.isArray(section?.rowSpecs)?section.rowSpecs:[];
  const out=[],seen=new Set();
  for(const item of raw){
    const label=cleanText(item?.label??item?.row??"",12);
    if(!label)continue;
    const key=label.toUpperCase();if(seen.has(key))throw bad("Một khu ghế không được có hai hàng trùng tên.","osc/seat-config-invalid");
    seen.add(key);out.push({label,seats:Math.round(clamp(item?.seats??item?.count??seatsPerRow,1,80))});
  }
  if(out.length)return out.slice(0,60);
  const labels=normalizeRows(section?.rows||section?.rowLabels||[]);
  return (labels.length?labels:["A"]).map(label=>({label,seats:seatsPerRow}));
}
function normalizeStage(src={}){
  return{
    x:clamp(src.x??20,0,95),y:clamp(src.y??3,0,90),
    w:clamp(src.w??60,10,100),h:clamp(src.h??7,3,30)
  }
}
function normalizeConfig(raw){
  const src=raw&&typeof raw==="object"?raw:{};
  const sections=(Array.isArray(src.sections)?src.sections:[]).slice(0,30).map((s,i)=>{
    const id=cleanPart(s.id||("section_"+(i+1)),48)||("section_"+(i+1));
    const seatsPerRow=Math.round(clamp(s.seatsPerRow||10,1,80));
    const rowSpecs=normalizeRowSpecs(s,seatsPerRow);
    return{
      id,name:cleanText(s.name||("Khu "+(i+1)),60),
      x:clamp(s.x,0,94),y:clamp(s.y,0,94),w:clamp(s.w||32,12,94),
      rowSpecs,rows:rowSpecs.map(x=>x.label),seatsPerRow,
      startNumber:Math.round(clamp(s.startNumber||1,1,999)),reverse:s.reverse===true,
      audience:normalizeAudience(s.audience||s.reservedFor),
      lockedSeats:parseLockedSeats(s.lockedSeats||s.lockedSeatsText||[])
    }
  });
  const stage=normalizeStage(src.stage||{x:src.stageX,y:src.stageY,w:src.stageW,h:src.stageH});
  return{
    enabled:src.enabled===true,title:cleanText(src.title||"Chọn ghế",100),
    stageLabel:cleanText(src.stageLabel||"SÂN KHẤU",80),canvasHeight:Math.round(clamp(src.canvasHeight||640,360,1400)),
    stage,sections
  }
}
function seatsFromConfig(config){
  const out=[],seen=new Set();
  for(const sec of config.sections){
    for(const spec of sec.rowSpecs||[]){
      const row=spec.label,count=Math.round(clamp(spec.seats,1,80));
      for(let i=0;i<count;i++){
        const num=sec.startNumber+(sec.reverse?(count-1-i):i);
        const raw=sec.id+"|"+row+"|"+num,id=crypto.createHash("sha256").update(raw).digest("hex").slice(0,28);
        if(seen.has(id))throw bad("Sơ đồ ghế có ghế trùng.","osc/seat-config-invalid");
        const label=`${row}${num}`,locked=(sec.lockedSeats||[]).includes(String(label).toUpperCase());
        seen.add(id);out.push({id,sectionId:sec.id,sectionName:sec.name,row,number:num,label,audience:sec.audience||"public",locked,publicSelectable:(sec.audience||"public")==="public"&&!locked});
      }
    }
  }
  if(out.length>2500)throw bad("Sơ đồ ghế vượt quá 2.500 ghế.","osc/seat-config-invalid");
  return out
}
function publicConfig(event){
  const cfg=normalizeConfig(event.seating);
  return{enabled:cfg.enabled,title:cfg.title,stageLabel:cfg.stageLabel,canvasHeight:cfg.canvasHeight,stage:cfg.stage,sections:cfg.sections.map(s=>({...s,rowSpecs:s.rowSpecs.map(r=>({...r})),lockedSeats:[...(s.lockedSeats||[])]}))}
}
function eventCapacity(event){const n=Math.floor(Number(event?.capacity||event?.registrationCapacity||0));return Number.isFinite(n)&&n>0?Math.min(n,100000):0}
function submissionDeclined(event,answers){
  const fields=Array.isArray(event?.fields)?event.fields:[];
  return fields.some(field=>String(field?.type||"")==="radio"&&isDeclinedParticipation(field,answers?.[String(field?.id||"")]))
}
async function initialCapacityCount(db,event){
  const snap=await db.collection("eventPortals").doc(event.id).collection("submissions").get();let count=0;
  for(const doc of snap.docs){const d=doc.data()||{};if(d.countsTowardCapacity===false)continue;if(d.countsTowardCapacity===true){count++;continue}if(!submissionDeclined(event,d.answers||{}))count++}
  return count
}
async function saveSubmissionWithCapacity(db,event,ref,payload,countsTowardCapacity){
  const limit=eventCapacity(event);if(!limit||!countsTowardCapacity){await ref.create(payload);return{count:null,limit,reached:false}}
  const counterRef=db.collection("eventCapacityCounters").doc(event.id),pre=await counterRef.get();
  const base=pre.exists?null:await initialCapacityCount(db,event);
  let finalCount=0;
  try{
    await db.runTransaction(async tx=>{
      const counter=await tx.get(counterRef);const current=counter.exists?Math.max(0,Number(counter.data()?.count||0)):Math.max(0,Number(base||0));
      if(current>=limit)throw bad("Sự kiện đã đủ số lượng đăng ký.","osc/event-capacity-reached");
      finalCount=current+1;
      tx.set(counterRef,{eventId:event.id,semester:String(event.semester||""),count:finalCount,limit,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      tx.set(ref,payload,{merge:false});
    });
  }catch(e){
    if(e?.code==="osc/event-capacity-reached")await db.collection("eventPortals").doc(event.id).set({isOpen:false,capacityReached:true,capacityReachedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    throw e
  }
  if(finalCount>=limit)await db.collection("eventPortals").doc(event.id).set({isOpen:false,capacityReached:true,capacityReachedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return{count:finalCount,limit,reached:finalCount>=limit}
}
async function verifySeatSession(db,eventId,submissionId,claimToken){
  const subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(cleanId(submissionId,"Phản hồi")),snap=await subRef.get();
  if(!snap.exists)throw bad("Không tìm thấy phản hồi đăng ký.","osc/seat-session-invalid");
  const data=snap.data()||{},hash=tokenHash(claimToken);
  if(!data.seatClaimHash||data.seatClaimHash!==hash)throw bad("Phiên chọn ghế không hợp lệ.","osc/seat-session-invalid");
  const expires=millis(data.seatSessionExpiresAt);
  if(expires&&Date.now()>expires&&data.seatStatus!=="confirmed")throw bad("Phiên chọn ghế đã hết hạn. Vui lòng gửi lại form đăng ký.","osc/seat-session-expired");
  return{subRef,data}
}
function answerEmpty(v){return Array.isArray(v)?v.length===0:String(v??"").trim()===""}
function fieldVisibilityRule(f){const r=f?.visibilityRule&&typeof f.visibilityRule==="object"?f.visibilityRule:{};return{sourceFieldId:String(r.sourceFieldId||"").trim(),equals:String(r.equals??"").trim()}}
function activeFieldIds(event,raw){
  const fields=Array.isArray(event?.fields)?event.fields:[],sectionIndex=new Map(),fieldIndex=new Map();
  fields.forEach((f,i)=>{if(f?.id)fieldIndex.set(String(f.id),i);if(String(f?.type||"")==="section"&&f?.id)sectionIndex.set(String(f.id),i)});
  let active=fields.map(()=>true);
  for(let pass=0;pass<Math.max(2,fields.length+1);pass++){
    const next=fields.map(()=>true);
    fields.forEach((f,i)=>{
      const r=fieldVisibilityRule(f);if(!r.sourceFieldId||!r.equals)return;
      const si=fieldIndex.get(r.sourceFieldId);
      if(!Number.isInteger(si)||active[si]===false||String(raw?.[r.sourceFieldId]??"")!==r.equals)next[i]=false;
    });
    for(let i=0;i<fields.length;i++){
      if(active[i]===false||next[i]===false)continue;
      const f=fields[i],type=String(f?.type||"");if(!["radio","select"].includes(type))continue;
      const d=optionDestinationFor(f,String(raw?.[String(f?.id||"")]??""));
      if(d&&d.startsWith("section:")){
        const target=sectionIndex.get(d.slice(8));
        if(Number.isInteger(target)&&target>i+1)for(let j=i+1;j<target;j++)next[j]=false;
      }
    }
    if(next.every((v,i)=>v===active[i])){active=next;break}
    active=next;
  }
  const ids=new Set();fields.forEach((f,i)=>{if(active[i]&&f?.id)ids.add(String(f.id))});return ids
}
function cleanAnswer(v){
  if(Array.isArray(v))return v.slice(0,50).map(x=>cleanText(x,300));
  return String(v??"").slice(0,4000)
}
function validateAnswers(event,raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw bad("Dữ liệu phản hồi không hợp lệ.");
  if(JSON.stringify(raw).length>60000)throw bad("Dữ liệu phản hồi quá lớn.");
  const fields=Array.isArray(event?.fields)?event.fields:[],out={},allowedIds=new Set(),activeIds=activeFieldIds(event,raw);
  for(const f of fields){
    const type=String(f?.type||"text"),id=String(f?.id||"").slice(0,180);
    if(!id||["image","content","section"].includes(type))continue;
    allowedIds.add(id);if(!activeIds.has(id))continue;
    const v=cleanAnswer(raw[id]);
    if(f?.required===true&&answerEmpty(v))throw bad("Vui lòng trả lời câu bắt buộc: "+cleanText(f?.label||"Thông tin",120));
    if(type==="email"&&!answerEmpty(v)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))throw bad("Email không hợp lệ.");
    if(type==="mssv"&&!answerEmpty(v)&&!/^[A-Za-z0-9_-]{4,30}$/.test(String(v).trim()))throw bad("MSSV không hợp lệ.");
    if(type==="phone"&&!answerEmpty(v)&&!/^[0-9+().\s-]{6,30}$/.test(String(v)))throw bad("Số điện thoại không hợp lệ.");
    if(type==="number"&&!answerEmpty(v)&&!Number.isFinite(Number(v)))throw bad("Giá trị số không hợp lệ.");
    const options=(Array.isArray(f?.options)?f.options:[]).map(x=>String(typeof x==="object"?(x?.label??x?.value??x?.text??""):x));
    if(["radio","select"].includes(type)&&!answerEmpty(v)&&options.length&&!options.includes(String(v)))throw bad("Lựa chọn không hợp lệ: "+cleanText(f?.label||"Thông tin",120));
    if(type==="checkboxes"&&!answerEmpty(v)){if(!Array.isArray(v))throw bad("Dữ liệu hộp kiểm không hợp lệ.");if(options.length&&v.some(x=>!options.includes(String(x))))throw bad("Có lựa chọn không hợp lệ: "+cleanText(f?.label||"Thông tin",120))}
    out[id]=v;
  }
  const unknown=Object.keys(raw).filter(k=>!allowedIds.has(String(k)));if(unknown.length)throw bad("Biểu mẫu chứa trường dữ liệu không hợp lệ.");
  if(Object.keys(out).length>60)throw bad("Biểu mẫu có quá nhiều trường trả lời.");
  return out
}
function routeText(value){
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function normalizeSubmissionDestination(value){
  const v=String(value||"").trim().toLowerCase();
  if(v==="seat"||v==="submit")return v;
  if(v.startsWith("section:")&&v.slice(8))return "section:"+v.slice(8);
  return "";
}
function optionDestinationFor(field,answer){
  const map=(field?.optionDestinations&&typeof field.optionDestinations==="object"&&!Array.isArray(field.optionDestinations))
    ?field.optionDestinations
    :((field?.destinations&&typeof field.destinations==="object"&&!Array.isArray(field.destinations))?field.destinations:{});
  return normalizeSubmissionDestination(map?.[String(answer??"")]);
}
function isDeclinedParticipation(field,answer){
  const label=routeText(field?.label);
  const value=routeText(Array.isArray(answer)?answer[0]:answer);
  if(!label.includes("tham gia"))return false;
  return value==="khong"||value.startsWith("khong ")||value.includes("khong tham gia")||value.includes("khong the tham gia")||value.includes("tu choi");
}
function resolveSubmissionDestination(event,answers,defaultDestination="submit"){
  const fields=Array.isArray(event?.fields)?event.fields:[];
  for(const field of fields){
    if(!["radio","select"].includes(String(field?.type||"")))continue;
    const answer=answers?.[String(field?.id||"")];
    const explicit=optionDestinationFor(field,answer);
    if(explicit==="seat"||explicit==="submit")return explicit;
    if(isDeclinedParticipation(field,answer))return "submit";
  }
  return defaultDestination==="seat"?"seat":"submit";
}
function enforcePublicRequestSecurity(req){
  const site=String(req.headers["sec-fetch-site"]||"").toLowerCase();
  if(site==="cross-site")throw bad("Yêu cầu từ nguồn không hợp lệ.","osc/cross-site");
  const type=String(req.headers["content-type"]||"").toLowerCase();
  if(type&&!type.includes("application/json"))throw bad("Định dạng yêu cầu không hợp lệ.","osc/content-type");
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
function cleanClientId(v){
  const s=String(v||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,80);
  return s||"unknown";
}
async function bumpRate(db,ref,now,windowMs,max,message){
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),d=snap.exists?snap.data()||{}:{},start=millis(d.windowStart);
    if(!start||now-start>=windowMs){tx.set(ref,{windowStart:admin.firestore.Timestamp.fromMillis(now),count:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:false});return}
    const count=Number(d.count||0);if(count>=max)throw bad(message,"osc/rate-limited");
    tx.update(ref,{count:count+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  })
}
async function enforceCreateRate(req,db,eventId,clientId){
  const now=Date.now(),windowMs=10*60*1000,col=db.collection("eventSeatRateLimits"),ip=requestIp(req),cid=cleanClientId(clientId);
  await bumpRate(db,col.doc(rateKey(["client",eventId,ip,cid])),now,windowMs,8,"Thiết bị này đã gửi quá nhiều đăng ký trong thời gian ngắn. Vui lòng thử lại sau.");
  await bumpRate(db,col.doc(rateKey(["ip",eventId,ip])),now,windowMs,300,"Mạng này đang có quá nhiều đăng ký cùng lúc. Vui lòng thử lại sau.");
}
async function createSubmission(req,body){
  enforcePublicRequestSecurity(req);
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),state=await loadState(db);
  if(semesterLocked(state,event.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  if(!eventOpen(event))throw bad(event?.capacityReached===true?"Sự kiện đã đủ số lượng đăng ký.":"Cổng sự kiện hiện không nhận đăng ký.",event?.capacityReached===true?"osc/event-capacity-reached":"osc/event-closed");
  const cfg=normalizeConfig(event.seating);
  if(cfg.enabled)seatsFromConfig(cfg);
  await enforceCreateRate(req,db,eventId,body.clientId);
  const answers=validateAnswers(event,body.answers);
  const submitterLabel=deriveSubmitterLabel(event,answers,body.submitterLabel);if(!submitterLabel)throw bad("Thiếu tên/người gửi.");
  const declined=submissionDeclined(event,answers),countsTowardCapacity=!declined;
  const nextDestination=resolveSubmissionDestination(event,answers,cfg.enabled?"seat":"submit");
  if(nextDestination==="seat"&&!cfg.enabled)throw bad("Lựa chọn này yêu cầu chọn ghế nhưng sự kiện chưa bật sơ đồ ghế.","osc/seating-disabled");
  const submissionId="sub_"+crypto.randomBytes(16).toString("hex"),now=Date.now();
  const ref=db.collection("eventPortals").doc(eventId).collection("submissions").doc(submissionId);
  const common={eventId,semester:String(event.semester||""),answers,submitterLabel,actionApplied:false,countsTowardCapacity};

  if(nextDestination==="submit"){
    const cap=await saveSubmissionWithCapacity(db,event,ref,{...common,submissionDestination:"submit",seatSelectionRequired:false,seatStatus:"not-required",createdAt:admin.firestore.FieldValue.serverTimestamp()},countsTowardCapacity);
    return{ok:true,version:95,submissionId,nextDestination:"submit",seatSelectionRequired:false,capacity:cap}
  }

  const claimToken=cleanToken(body.claimToken);
  const cap=await saveSubmissionWithCapacity(db,event,ref,{
    ...common,submissionDestination:"seat",seatSelectionRequired:true,seatStatus:"pending",seatClaimHash:tokenHash(claimToken),
    seatSessionCreatedAt:admin.firestore.Timestamp.fromMillis(now),seatSessionExpiresAt:admin.firestore.Timestamp.fromMillis(now+2*60*60*1000),
    createdAt:admin.firestore.FieldValue.serverTimestamp()
  },countsTowardCapacity);
  return{ok:true,version:95,submissionId,nextDestination:"seat",seatSelectionRequired:true,seating:publicConfig(event),sessionExpiresAt:now+2*60*60*1000,capacity:cap}
}
async function publicState(body){
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),cfg=normalizeConfig(event.seating);
  if(!cfg.enabled)throw bad("Sự kiện không bật chọn ghế.","osc/seating-disabled");
  const session=await verifySeatSession(db,eventId,body.submissionId,body.claimToken),seats=seatsFromConfig(cfg);
  const snap=await db.collection("eventSeatClaims").doc(eventId).collection("seats").get();
  const occupied=snap.docs.map(d=>String(d.id));
  return{ok:true,version:95,seating:publicConfig(event),seats,occupied,currentSeatId:String(session.data.seatId||""),currentSeatLabel:String(session.data.seatLabel||""),seatCount:seats.length}
}
async function claimSeat(body){
  const db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),state=await loadState(db);
  if(semesterLocked(state,event.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  const cfg=normalizeConfig(event.seating);if(!cfg.enabled)throw bad("Sự kiện không bật chọn ghế.","osc/seating-disabled");
  const seats=seatsFromConfig(cfg),seat=seats.find(x=>x.id===String(body.seatId||""));if(!seat)throw bad("Ghế không tồn tại trong sơ đồ.","osc/seat-invalid");
  if(seat.publicSelectable!==true)throw bad("Ghế này thuộc khu dành riêng hoặc đã được VIP Seat Lock. Vui lòng chọn ghế khác.","osc/seat-reserved");
  const submissionId=cleanId(body.submissionId,"Phản hồi"),claimHash=tokenHash(body.claimToken);
  const subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(submissionId);
  const claims=db.collection("eventSeatClaims").doc(eventId).collection("seats"),newRef=claims.doc(seat.id);
  let changed=false;
  await db.runTransaction(async tx=>{
    const subSnap=await tx.get(subRef);if(!subSnap.exists)throw bad("Không tìm thấy phản hồi đăng ký.","osc/seat-session-invalid");
    const sub=subSnap.data()||{};
    if(sub.seatSelectionRequired!==true||sub.submissionDestination==="submit")throw bad("Phản hồi này không thuộc luồng chọn ghế.","osc/seat-not-required");
    if(sub.seatClaimHash!==claimHash)throw bad("Phiên chọn ghế không hợp lệ.","osc/seat-session-invalid");
    const expires=millis(sub.seatSessionExpiresAt);if(expires&&Date.now()>expires&&sub.seatStatus!=="confirmed")throw bad("Phiên chọn ghế đã hết hạn. Vui lòng gửi lại form đăng ký.","osc/seat-session-expired");
    if(sub.seatStatus==="confirmed"){if(String(sub.seatId||"")===seat.id)return;throw bad("Ghế đã được xác nhận. Muốn đổi ghế, vui lòng liên hệ Ban tổ chức.","osc/seat-already-confirmed");}
    const newSnap=await tx.get(newRef);
    if(newSnap.exists&&String(newSnap.data()?.submissionId||"")!==submissionId)throw bad("Ghế này vừa có người khác chọn. Vui lòng chọn ghế khác.","osc/seat-taken");
    let oldRef=null,oldSnap=null;
    if(sub.seatId&&String(sub.seatId)!==seat.id){oldRef=claims.doc(String(sub.seatId));oldSnap=await tx.get(oldRef)}
    if(oldRef&&oldSnap?.exists&&String(oldSnap.data()?.submissionId||"")===submissionId)tx.delete(oldRef);
    tx.set(newRef,{eventId,submissionId,seatId:seat.id,seatLabel:seat.label,sectionId:seat.sectionId,sectionName:seat.sectionName,row:seat.row,number:seat.number,claimedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:false});
    tx.update(subRef,{seatStatus:"confirmed",seatId:seat.id,seatLabel:seat.label,seatSectionId:seat.sectionId,seatSectionName:seat.sectionName,seatConfirmedAt:admin.firestore.FieldValue.serverTimestamp()});
    changed=true;
  });
  return{ok:true,version:95,seat,changed}
}
async function adminAssignSeat(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),submissionId=cleanId(body.submissionId,"Phản hồi"),seatId=cleanId(body.seatId,"Ghế");
  const [{data:event},state]=await Promise.all([loadEvent(db,eventId),loadState(db)]);if(semesterLocked(state,event.semester))throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  const cfg=normalizeConfig(event.seating);if(!cfg.enabled)throw bad("Sự kiện không bật chọn ghế.","osc/seating-disabled");
  const seat=seatsFromConfig(cfg).find(x=>x.id===seatId);if(!seat)throw bad("Ghế không tồn tại trong sơ đồ.","osc/seat-invalid");
  const subRef=db.collection("eventPortals").doc(eventId).collection("submissions").doc(submissionId),claims=db.collection("eventSeatClaims").doc(eventId).collection("seats"),newRef=claims.doc(seat.id);
  const linkedTickets=await db.collection("ticketStudios").doc(eventId).collection("tickets").where("sourceSubmissionId","==",submissionId).limit(10).get();
  if(linkedTickets.docs.some(d=>String(d.data()?.status||"")==="checked_in"))throw bad("Không thể đổi/cấp ghế sau khi vé liên kết đã check-in.","osc/ticket-checked-in");
  await db.runTransaction(async tx=>{
    const [subSnap,newSnap]=await Promise.all([tx.get(subRef),tx.get(newRef)]);if(!subSnap.exists)throw bad("Không tìm thấy phản hồi đăng ký.","osc/submission-not-found");
    const sub=subSnap.data()||{};if(newSnap.exists&&String(newSnap.data()?.submissionId||"")!==submissionId)throw bad("Ghế đã có người khác.","osc/seat-taken");
    if(sub.seatId&&String(sub.seatId)!==seat.id){const oldRef=claims.doc(String(sub.seatId)),old=await tx.get(oldRef);if(old.exists&&String(old.data()?.submissionId||"")===submissionId)tx.delete(oldRef)}
    tx.set(newRef,{eventId,submissionId,seatId:seat.id,seatLabel:seat.label,sectionId:seat.sectionId,sectionName:seat.sectionName,row:seat.row,number:seat.number,audience:seat.audience,assignedByAdmin:true,claimedAt:admin.firestore.FieldValue.serverTimestamp(),assignedBy:actor.decoded.uid},{merge:false});
    tx.set(subRef,{seatSelectionRequired:true,submissionDestination:"seat",seatStatus:"confirmed",seatId:seat.id,seatLabel:seat.label,seatSectionId:seat.sectionId,seatSectionName:seat.sectionName,seatConfirmedAt:admin.firestore.FieldValue.serverTimestamp(),seatAssignedByAdmin:true,seatAssignedBy:actor.decoded.uid},{merge:true});
  });
  if(!linkedTickets.empty){
    const batch=db.batch();for(const doc of linkedTickets.docs){const d=doc.data()||{};if(["revoked","cancelled"].includes(String(d.status||"")))continue;batch.set(doc.ref,{seat:seat.label,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true})}await batch.commit();
  }
  return{ok:true,version:95,seat}
}
async function adminState(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),{data:event}=await loadEvent(db,eventId),cfg=normalizeConfig(event.seating);
  const snap=await db.collection("eventSeatClaims").doc(eventId).collection("seats").get();
  const claims=snap.docs.map(d=>({seatId:d.id,...(d.data()||{})}));
  return{ok:true,version:95,eventId,seating:publicConfig(event),claimed:snap.size,total:seatsFromConfig(cfg).length,claims,actorRole:actor.profile.role}
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
async function adminReleaseManySubmissionSeats(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanId(body.eventId,"Sự kiện"),ids=[...new Set((Array.isArray(body.submissionIds)?body.submissionIds:[]).map(x=>String(x||"").trim()).filter(Boolean))].slice(0,250);
  if(!ids.length)return{ok:true,released:0};
  const subRefs=ids.map(id=>db.collection("eventPortals").doc(eventId).collection("submissions").doc(cleanId(id,"Phản hồi"))),subSnaps=await db.getAll(...subRefs);
  const pairs=subSnaps.filter(x=>x.exists&&x.data()?.seatId).map(x=>({subRef:x.ref,submissionId:x.id,seatId:String(x.data().seatId)}));
  if(!pairs.length)return{ok:true,released:0};
  const seatRefs=pairs.map(x=>db.collection("eventSeatClaims").doc(eventId).collection("seats").doc(x.seatId)),seatSnaps=await db.getAll(...seatRefs),batch=db.batch();let released=0;
  for(let i=0;i<pairs.length;i++){const p=pairs[i],seatSnap=seatSnaps[i];if(seatSnap?.exists&&String(seatSnap.data()?.submissionId||"")===p.submissionId)batch.delete(seatSnap.ref);batch.set(p.subRef,{seatStatus:"pending",seatId:"",seatLabel:"",seatSectionId:"",seatSectionName:"",seatReleasedAt:admin.firestore.FieldValue.serverTimestamp(),seatReleasedBy:actor.decoded.uid},{merge:true});released++}
  await batch.commit();return{ok:true,released}
}
function status(code){if(["osc/unauthenticated"].includes(code))return 401;if(["osc/forbidden","osc/inactive","osc/no-profile"].includes(code))return 403;if(["osc/event-not-found"].includes(code))return 404;if(["osc/seat-taken","osc/seat-already-confirmed","osc/seat-reserved","osc/event-capacity-reached","osc/ticket-checked-in"].includes(code))return 409;if(code==="osc/seat-session-expired")return 410;if(["osc/semester-locked","osc/event-closed","osc/seating-disabled"].includes(code))return 409;if(["osc/cross-site","osc/content-type"].includes(code))return 403;if(code==="osc/rate-limited")return 429;return 400}
module.exports=async function handler(req,res){
  try{
    if(req.method==="GET")return sendJson(res,200,{ok:true,service:"event-seating",version:95});
    if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET/POST."})}
    const body=readJsonBody(req),action=String(body.action||"");let out;
    if(action==="public-create-submission")out=await createSubmission(req,body);
    else if(action==="public-state")out=await publicState(body);
    else if(action==="public-claim-seat")out=await claimSeat(body);
    else if(action==="admin-state")out=await adminState(req,body);
    else if(action==="admin-assign-seat")out=await adminAssignSeat(req,body);
    else if(action==="admin-release-seat")out=await adminRelease(req,body);
    else if(action==="admin-release-submission-seat")out=await adminReleaseSubmissionSeat(req,body);
    else if(action==="admin-release-submission-seats")out=await adminReleaseManySubmissionSeats(req,body);
    else throw bad("Thao tác sơ đồ ghế không hợp lệ.");
    return sendJson(res,200,out)
  }catch(e){const code=String(e?.code||"osc/server-error");console.error("event-seating",code,e?.message);return sendJson(res,status(code),{ok:false,error:code.startsWith("osc/")?String(e.message||"Yêu cầu không thành công."):"Máy chủ không thể hoàn tất yêu cầu.",code:code.startsWith("osc/")?code:"osc/server-error"})}
};
