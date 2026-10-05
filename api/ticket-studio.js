"use strict";

const crypto = require("crypto");
const {
  admin,
  getDb,
  readJsonBody,
  requireManager,
  sendJson,
  handleError
} = require("../lib/firebase-admin");

function bad(message, code = "osc/bad-request") {
  const e = new Error(message);
  e.code = code;
  return e;
}
function clamp(n,min,max){ return Math.min(max,Math.max(min,Number(n))); }
function cleanText(v,max=200){ return String(v ?? "").trim().replace(/\s+/g," ").slice(0,max); }
function cleanEventId(v){
  const s=String(v||"").trim();
  if(!s||s.length>180||s.includes("/")) throw bad("Sự kiện không hợp lệ.");
  return s;
}
function cleanCode(v){
  const s=String(v??"").trim().replace(/\s+/g,"").toUpperCase();
  if(!/^[A-Z0-9._-]{2,40}$/.test(s)) throw bad("Mã vé phải từ 2 đến 40 ký tự và chỉ gồm chữ A-Z, số 0-9, dấu chấm, gạch ngang hoặc gạch dưới.", "osc/ticket-code-invalid");
  return s;
}
function cleanPortalToken(v){
  const s=String(v||"").trim();
  if(!/^[A-Za-z0-9_-]{20,120}$/.test(s)) throw bad("Link Ticket Studio không hợp lệ.", "osc/ticket-portal-invalid");
  return s;
}
function cleanQrToken(v){
  const s=String(v||"").trim();
  if(!/^[A-Za-z0-9_-]{20,120}$/.test(s)) throw bad("QR vé không hợp lệ.", "osc/ticket-invalid");
  return s;
}
function randomToken(bytes=24){ return crypto.randomBytes(bytes).toString("base64url"); }
function docIdForCode(code){ return crypto.createHash("sha256").update(code).digest("hex").slice(0,48); }
function millis(v){ try{return v?.toMillis?.()||v?.toDate?.()?.getTime?.()||0}catch{return 0} }
function semesterLocked(state, semester){ return !!state?.semesters?.[semester]?.locked; }
async function loadState(db){ const s=await db.collection("clubState").doc("main").get(); return s.exists?(s.data()?.state || {}):{}; }
async function loadEvent(db,eventId){
  const ref=db.collection("eventPortals").doc(cleanEventId(eventId));
  const snap=await ref.get();
  if(!snap.exists) throw bad("Sự kiện không tồn tại.","osc/event-not-found");
  return {ref,data:{id:ref.id,...(snap.data()||{})}};
}
function defaultLayout(){
  return {
    name:{x:10,y:58,w:54,h:10,fontSize:34,color:"#111111",align:"left",fontWeight:700,visible:true},
    code:{x:10,y:72,w:38,h:8,fontSize:22,color:"#111111",align:"left",fontWeight:700,visible:true},
    mssv:{x:10,y:82,w:30,h:7,fontSize:18,color:"#111111",align:"left",fontWeight:600,visible:false},
    ticketType:{x:43,y:82,w:22,h:7,fontSize:18,color:"#111111",align:"left",fontWeight:600,visible:false},
    seat:{x:67,y:82,w:16,h:7,fontSize:18,color:"#111111",align:"left",fontWeight:700,visible:false},
    qr:{x:72,y:52,w:20,h:31,visible:true}
  };
}
function normalizeBox(src,kind){
  const d=defaultLayout()[kind], s=src&&typeof src==="object"?src:{};
  const w=clamp(s.w??d.w,4,100),h=clamp(s.h??d.h,4,100);
  const out={
    x:clamp(s.x??d.x,0,100-w),y:clamp(s.y??d.y,0,100-h),
    w,h,visible:kind==="qr"?true:(s.visible===undefined?d.visible!==false:s.visible!==false)
  };
  if(kind!=="qr"){
    out.fontSize=clamp(s.fontSize??d.fontSize,8,120);
    out.color=/^#[0-9a-fA-F]{6}$/.test(String(s.color||""))?String(s.color):d.color;
    out.align=["left","center","right"].includes(s.align)?s.align:d.align;
    out.fontWeight=[400,500,600,700,800,900].includes(Number(s.fontWeight))?Number(s.fontWeight):d.fontWeight;
  }
  return out;
}
function normalizeLayout(src){ const s=src&&typeof src==="object"?src:{}; return {name:normalizeBox(s.name,"name"),code:normalizeBox(s.code,"code"),mssv:normalizeBox(s.mssv,"mssv"),ticketType:normalizeBox(s.ticketType,"ticketType"),seat:normalizeBox(s.seat,"seat"),qr:normalizeBox(s.qr,"qr")}; }
function normalizeBackground(dataUrl){
  const s=String(dataUrl||"");
  if(!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(s)) throw bad("Ảnh mẫu vé không hợp lệ.","osc/ticket-template-invalid");
  if(s.length>780000) throw bad("Ảnh mẫu vé quá lớn. Hãy dùng ảnh đã được tối ưu dưới khoảng 550 KB.","osc/ticket-template-too-large");
  return s;
}
function publicTemplate(config){
  if(!config?.backgroundDataUrl) return null;
  return {
    backgroundDataUrl:config.backgroundDataUrl,
    width:Number(config.templateWidth||1600),
    height:Number(config.templateHeight||900),
    layout:normalizeLayout(config.layout)
  };
}
function rowPublic(doc){
  const d=doc.data?doc.data()||{}:doc||{};
  return {
    id:String(doc.id||d.id||""), code:String(d.code||""), name:String(d.name||""), mssv:String(d.mssv||""),
    email:String(d.email||""), ticketType:String(d.ticketType||""), seat:String(d.seat||""),
    source:["registration","upload","manual","mixed"].includes(d.source)?d.source:"upload", sourceSubmissionId:String(d.sourceSubmissionId||""),
    codeMode:["auto","upload","mssv"].includes(d.codeMode)?d.codeMode:"auto",
    status:["issued","checked_in","revoked","cancelled"].includes(d.status)?d.status:"issued",
    claimedAt:millis(d.claimedAt), claimCount:Number(d.claimCount||0),
    checkedInAt:millis(d.checkedInAt), createdAt:millis(d.createdAt), updatedAt:millis(d.updatedAt), reissuedCount:Number(d.reissuedCount||0)
  };
}
async function loadStudio(db,eventId,{create=false,event=null}={}){
  const ref=db.collection("ticketStudios").doc(eventId),snap=await ref.get();
  if(snap.exists) return {ref,data:{eventId,...(snap.data()||{})}};
  if(!create) return {ref,data:null};
  const ev=event||((await loadEvent(db,eventId)).data);
  const data={
    eventId, semester:String(ev.semester||""), title:String(ev.title||"Ticket Studio").slice(0,200),
    portalToken:randomToken(), portalOpen:false, layout:defaultLayout(), templateWidth:1600, templateHeight:900,
    backgroundDataUrl:"", createdAt:admin.firestore.FieldValue.serverTimestamp(), updatedAt:admin.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(data,{merge:false});
  return {ref,data:{...data,eventId}};
}
async function ensureManagerEditable(req,eventId){
  const actor=await requireManager(req),db=getDb();
  const [{data:event},state]=await Promise.all([loadEvent(db,eventId),loadState(db)]);
  if(semesterLocked(state,event.semester)) throw bad("Học kỳ đang bị khóa.","osc/semester-locked");
  return {actor,db,event,state};
}
function normalizeImportRow(row,index){
  if(!row||typeof row!=="object") throw bad(`Dòng ${index+1} không hợp lệ.`);
  return {
    name:cleanText(row.name,160), mssv:cleanText(row.mssv,40).toUpperCase(), email:cleanText(row.email,254).toLowerCase(),
    ticketType:cleanText(row.ticketType,80), seat:cleanText(row.seat,40), ticketCode:cleanText(row.ticketCode,40).toUpperCase(),
    source:(()=>{const x=String(row.source||"");return x.includes("registration")&&x.includes("upload")?"mixed":["registration","upload","manual"].includes(x)?x:"upload"})(),
    sourceSubmissionId:cleanText(row.sourceSubmissionId,180),
    codeMode:["auto","upload","mssv"].includes(String(row.codeMode||""))?String(row.codeMode):""
  };
}
function numericCode(existing,digits){
  const min=Math.pow(10,digits-1),max=Math.pow(10,digits)-1;
  for(let i=0;i<80;i++){
    const c=String(crypto.randomInt(min,max+1));
    if(!existing.has(c)) return c;
  }
  throw bad("Không thể tạo mã vé duy nhất. Hãy tăng số chữ số.","osc/ticket-code-exhausted");
}
function mssvTicketCode(existing,mssv){
  const base=cleanCode(mssv);
  if(!existing.has(base)) return base;
  for(let n=2;n<=999;n++){
    const suffix=String(n), head=base.slice(0,Math.max(2,40-suffix.length)), candidate=head+suffix;
    if(!existing.has(candidate)) return candidate;
  }
  throw bad("MSSV này đã có quá nhiều mã vé. Hãy chuyển sang mã tự tạo.","osc/ticket-code-exhausted");
}
function normLabel(v){ return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function eventField(event,{systemKeys=[],types=[],labels=[]}={}){
  const fields=Array.isArray(event?.fields)?event.fields:[];
  return fields.find(f=>systemKeys.includes(String(f?.systemKey||"")))
    || fields.find(f=>types.includes(String(f?.type||"")))
    || fields.find(f=>labels.some(x=>normLabel(f?.label).includes(x)))
    || null;
}
function answerText(answers,field){
  if(!field)return ""; const v=answers?.[field.id]; return Array.isArray(v)?v.join(", "):cleanText(v,254);
}
async function adminRegistrationRows(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanEventId(body.eventId);
  const {data:event}=await loadEvent(db,eventId);
  const snap=await db.collection("eventPortals").doc(eventId).collection("submissions").get();
  const nameF=eventField(event,{systemKeys:["memberName","name","fullName"],labels:["ho va ten","ho ten","full name","name"]});
  const mssvF=eventField(event,{systemKeys:["mssv","studentId"],types:["mssv"],labels:["mssv","ma so sinh vien","student id"]});
  const emailF=eventField(event,{systemKeys:["email"],types:["email"],labels:["email","e mail"]});
  const typeF=eventField(event,{systemKeys:["ticketType"],labels:["hang ve","loai ve","ticket type"]});
  const seatF=eventField(event,{systemKeys:["seat"],labels:["ghe","so ghe","seat"]});
  const codeF=eventField(event,{systemKeys:["ticketCode"],labels:["ma ve","ticket code"]});
  const rows=snap.docs.map(doc=>{
    const d=doc.data()||{},answers=d.answers||{};
    return {
      name:answerText(answers,nameF)||cleanText(d.submitterLabel,160),
      mssv:answerText(answers,mssvF).toUpperCase(), email:answerText(answers,emailF).toLowerCase(),
      ticketType:answerText(answers,typeF), seat:answerText(answers,seatF), ticketCode:answerText(answers,codeF).toUpperCase(),
      source:"registration", sourceSubmissionId:doc.id, submittedAt:millis(d.createdAt)
    };
  }).filter(r=>r.name||r.mssv||r.email).sort((a,b)=>b.submittedAt-a.submittedAt);
  return {ok:true,version:90,eventId,rows,count:rows.length,actorRole:actor.profile.role};
}
async function adminState(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanEventId(body.eventId);
  const {data:event}=await loadEvent(db,eventId);
  const {data:studio}=await loadStudio(db,eventId,{create:true,event});
  const snap=await db.collection("ticketStudios").doc(eventId).collection("tickets").orderBy("createdAt","desc").limit(1200).get();
  const tickets=snap.docs.map(rowPublic);
  const stats={total:tickets.length,issued:0,checkedIn:0,revoked:0,cancelled:0};
  for(const t of tickets){ if(t.status==="checked_in")stats.checkedIn++; else if(t.status==="revoked")stats.revoked++; else if(t.status==="cancelled")stats.cancelled++; else stats.issued++; }
  return {ok:true,version:90,event:{id:event.id,title:event.title||"",semester:event.semester||""},studio:{portalToken:studio.portalToken,portalOpen:studio.portalOpen===true,hasTemplate:!!studio.backgroundDataUrl,templateWidth:Number(studio.templateWidth||1600),templateHeight:Number(studio.templateHeight||900),layout:normalizeLayout(studio.layout),backgroundDataUrl:studio.backgroundDataUrl||""},tickets,stats,actorRole:actor.profile.role};
}
async function adminSaveTemplate(req,body){
  const eventId=cleanEventId(body.eventId),{actor,db,event}=await ensureManagerEditable(req,eventId);
  const backgroundDataUrl=normalizeBackground(body.backgroundDataUrl);
  const width=Math.round(clamp(body.width||1600,400,4000)),height=Math.round(clamp(body.height||900,250,4000));
  const layout=normalizeLayout(body.layout);
  const {ref,data:studio}=await loadStudio(db,eventId,{create:true,event});
  await ref.set({backgroundDataUrl,templateWidth:width,templateHeight:height,layout,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid,portalToken:studio.portalToken||randomToken()},{merge:true});
  return {ok:true,hasTemplate:true,layout,width,height};
}
async function adminSaveLayout(req,body){
  const eventId=cleanEventId(body.eventId),{actor,db,event}=await ensureManagerEditable(req,eventId);
  const {ref}=await loadStudio(db,eventId,{create:true,event});
  const layout=normalizeLayout(body.layout);
  await ref.set({layout,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
  return {ok:true,layout};
}
async function adminSetPortal(req,body){
  const eventId=cleanEventId(body.eventId),{actor,db,event}=await ensureManagerEditable(req,eventId);
  const {ref,data:studio}=await loadStudio(db,eventId,{create:true,event});
  const open=body.open===true;
  if(open&&!studio?.backgroundDataUrl) throw bad("Hãy lưu mẫu vé trước khi mở cổng nhận vé.","osc/ticket-template-missing");
  await ref.set({portalOpen:open,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
  return {ok:true,open};
}
async function adminImport(req,body){
  const eventId=cleanEventId(body.eventId),{actor,db,event}=await ensureManagerEditable(req,eventId);
  const mode=["auto","upload","mssv"].includes(body.mode)?body.mode:"auto",digits=Math.round(clamp(body.digits||8,8,14));
  const rows=Array.isArray(body.rows)?body.rows:[];
  if(!rows.length||rows.length>250) throw bad("Mỗi lượt tạo vé hỗ trợ từ 1 đến 250 dòng.");
  await loadStudio(db,eventId,{create:true,event});
  const ticketCol=db.collection("ticketStudios").doc(eventId).collection("tickets");
  const existingSnap=await ticketCol.select("code","mssv","email","sourceSubmissionId").get();
  const existing=new Set(),existingMssv=new Set(),existingEmail=new Set(),existingSubmission=new Set();
  for(const d of existingSnap.docs){const x=d.data()||{};if(x.code)existing.add(String(x.code));if(x.mssv)existingMssv.add(String(x.mssv).trim().toUpperCase());if(x.email)existingEmail.add(String(x.email).trim().toLowerCase());if(x.sourceSubmissionId)existingSubmission.add(String(x.sourceSubmissionId));}
  const seen=new Set(),seenMssv=new Set(),seenEmail=new Set(),prepared=[],errors=[];
  for(let i=0;i<rows.length;i++){
    try{
      const r=normalizeImportRow(rows[i],i);
      if(!r.name) throw bad("Thiếu họ tên.");
      const mk=String(r.mssv||"").trim().toUpperCase(),ek=String(r.email||"").trim().toLowerCase();
      if(r.sourceSubmissionId&&existingSubmission.has(r.sourceSubmissionId)){errors.push({row:i+1,reason:"Đăng ký này đã có vé."});continue;}
      if(mk&&(existingMssv.has(mk)||seenMssv.has(mk))){errors.push({row:i+1,reason:`MSSV ${mk} đã có vé trong sự kiện.`});continue;}
      if(!mk&&ek&&(existingEmail.has(ek)||seenEmail.has(ek))){errors.push({row:i+1,reason:"Email này đã có vé trong sự kiện."});continue;}
      const rowMode=["auto","upload","mssv"].includes(r.codeMode)?r.codeMode:mode;
      let code=rowMode==="upload"?cleanCode(r.ticketCode):rowMode==="mssv"?mssvTicketCode(existing,r.mssv):numericCode(existing,digits);
      if(seen.has(code)||existing.has(code)) { errors.push({row:i+1,reason:`Mã vé ${code} đã tồn tại.`}); continue; }
      seen.add(code); existing.add(code); if(mk)seenMssv.add(mk); if(ek)seenEmail.add(ek); if(r.sourceSubmissionId)existingSubmission.add(r.sourceSubmissionId);
      prepared.push({...r,code,codeMode:rowMode,docId:docIdForCode(code),qrToken:randomToken()});
    }catch(e){errors.push({row:i+1,reason:e.message||"Dữ liệu không hợp lệ."});}
  }
  if(!prepared.length) return {ok:true,created:0,skipped:errors.length,errors,codes:[]};
  for(let i=0;i<prepared.length;i+=350){
    const batch=db.batch();
    for(const r of prepared.slice(i,i+350)){
      const ref=ticketCol.doc(r.docId);
      batch.create(ref,{eventId,semester:event.semester,code:r.code,codeMode:r.codeMode,name:r.name,mssv:r.mssv,email:r.email,ticketType:r.ticketType,seat:r.seat,source:r.source,sourceSubmissionId:r.sourceSubmissionId,qrToken:r.qrToken,qrVersion:1,status:"issued",reissuedCount:0,createdAt:admin.firestore.FieldValue.serverTimestamp(),createdBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid});
    }
    await batch.commit();
  }
  return {ok:true,created:prepared.length,skipped:errors.length,errors,codes:prepared.map(x=>x.code)};
}
async function findTicketByCode(db,eventId,code){
  const c=cleanCode(code),ref=db.collection("ticketStudios").doc(eventId).collection("tickets").doc(docIdForCode(c)),snap=await ref.get();
  if(!snap.exists||String(snap.data()?.code||"")!==c) throw bad("Không tìm thấy mã vé.","osc/ticket-not-found");
  return {ref,snap,data:{id:snap.id,...(snap.data()||{})}};
}
async function adminTicketAction(req,body,action){
  const eventId=cleanEventId(body.eventId),{actor,db}=await ensureManagerEditable(req,eventId);
  const {ref,data}=await findTicketByCode(db,eventId,body.code);
  if(action==="revoke"){
    if(data.status==="checked_in") throw bad("Vé đã check-in. Hãy hoàn tác lượt check-in trước khi thu hồi.","osc/ticket-checked-in");
    await ref.set({status:"revoked",revokedAt:admin.firestore.FieldValue.serverTimestamp(),revokedBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
    return {ok:true,status:"revoked"};
  }
  if(action==="cancel"){
    if(data.status==="checked_in") throw bad("Vé đã check-in. Hãy hoàn tác lượt check-in trước khi hủy.","osc/ticket-checked-in");
    await ref.set({status:"cancelled",cancelledAt:admin.firestore.FieldValue.serverTimestamp(),cancelledBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
    return {ok:true,status:"cancelled"};
  }
  if(action==="reissue"){
    if(data.status==="checked_in") throw bad("Vé đã check-in. Hãy hoàn tác lượt check-in trước khi cấp lại.","osc/ticket-checked-in");
    const next=Number(data.reissuedCount||0)+1;
    await ref.set({status:"issued",qrToken:randomToken(),qrVersion:Number(data.qrVersion||1)+1,reissuedCount:next,reissuedAt:admin.firestore.FieldValue.serverTimestamp(),reissuedBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
    return {ok:true,status:"issued",reissuedCount:next};
  }
  throw bad("Thao tác vé không hợp lệ.");
}
async function adminUpdateTicket(req,body){
  const eventId=cleanEventId(body.eventId),{actor,db}=await ensureManagerEditable(req,eventId);
  const {ref,data}=await findTicketByCode(db,eventId,body.code);
  const next={
    name:cleanText(body.name,160), mssv:cleanText(body.mssv,40).toUpperCase(), email:cleanText(body.email,254).toLowerCase(),
    ticketType:cleanText(body.ticketType,80), seat:cleanText(body.seat,40)
  };
  if(!next.name) throw bad("Họ tên không được để trống.");
  if(data.status==="checked_in" && String(next.mssv||"")!==String(data.mssv||"")) throw bad("Vé đã check-in. Hãy hoàn tác check-in trước khi đổi MSSV.","osc/ticket-checked-in");
  await ref.set({...next,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.decoded.uid},{merge:true});
  if(data.status==="checked_in"){
    const checkRef=db.collection("eventPortals").doc(eventId).collection("qrCheckins").doc(`ticket_${data.id}`);
    const check=await checkRef.get();
    if(check.exists) await checkRef.set({memberName:next.name,mssv:next.mssv,ticketType:next.ticketType,seat:next.seat},{merge:true});
  }
  return {ok:true};
}

async function adminDeleteTicket(req,body){
  const eventId=cleanEventId(body.eventId),{db}=await ensureManagerEditable(req,eventId);
  const {ref,data}=await findTicketByCode(db,eventId,body.code);
  if(data.status==="checked_in") throw bad("Không thể xóa vé đã check-in. Hãy hoàn tác check-in trước.","osc/ticket-checked-in");
  await ref.delete();
  return {ok:true,deleted:true};
}
async function adminDeleteMany(req,body){
  const eventId=cleanEventId(body.eventId),{db}=await ensureManagerEditable(req,eventId);
  const codes=[...new Set((Array.isArray(body.codes)?body.codes:[]).map(x=>String(x||"").trim()).filter(Boolean))].slice(0,250);
  if(!codes.length) throw bad("Hãy chọn ít nhất một vé để xóa.");
  const refs=[],skipped=[];
  for(const code of codes){
    try{
      const {ref,data}=await findTicketByCode(db,eventId,code);
      if(data.status==="checked_in"){skipped.push({code,reason:"Vé đã check-in"});continue;}
      refs.push(ref);
    }catch(e){skipped.push({code,reason:e.message||"Không tìm thấy"});}
  }
  for(let i=0;i<refs.length;i+=350){
    const batch=db.batch(); for(const ref of refs.slice(i,i+350))batch.delete(ref); await batch.commit();
  }
  return {ok:true,deleted:refs.length,skipped};
}
function requestIp(req){ return String(req.headers["x-forwarded-for"]||req.headers["x-real-ip"]||"unknown").split(",")[0].trim().slice(0,80); }
function rateDocId(parts){ return crypto.createHash("sha256").update(parts.join("|")).digest("hex"); }
async function incrementRate(db,ref,now,windowMs,max){
  await db.runTransaction(async tx=>{
    const s=await tx.get(ref),d=s.exists?s.data()||{}:{},start=millis(d.windowStart);
    if(!start||now-start>=windowMs){ tx.set(ref,{windowStart:admin.firestore.Timestamp.fromMillis(now),count:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:false}); return; }
    const count=Number(d.count||0);
    if(count>=max) throw bad("Bạn đã thử quá nhiều mã vé. Vui lòng đợi vài phút rồi thử lại.","osc/rate-limited");
    tx.update(ref,{count:count+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  });
}
async function enforceLookupRate(req,db,portalToken,clientId){
  const ip=requestIp(req),ua=String(req.headers["user-agent"]||"").slice(0,180),cid=String(clientId||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,80)||crypto.createHash("sha256").update(ua).digest("hex").slice(0,24);
  const now=Date.now(),windowMs=5*60*1000,col=db.collection("ticketLookupRateLimits");
  // Per browser/session limit prevents brute force; the looser IP cap avoids one device
  // bypassing the protection by constantly changing its client id while not punishing a shared Wi‑Fi too quickly.
  await incrementRate(db,col.doc(rateDocId(["client",portalToken,ip,cid])),now,windowMs,10);
  await incrementRate(db,col.doc(rateDocId(["ip",portalToken,ip])),now,windowMs,80);
}
async function studioFromPortalToken(db,token){
  const t=cleanPortalToken(token),snap=await db.collection("ticketStudios").where("portalToken","==",t).limit(1).get();
  if(snap.empty) throw bad("Link nhận vé không hợp lệ.","osc/ticket-portal-invalid");
  const doc=snap.docs[0],studio={eventId:doc.id,...(doc.data()||{})};
  const {data:event}=await loadEvent(db,studio.eventId);
  return {studio,event};
}
async function adminExport(req,body){
  const actor=await requireManager(req),db=getDb(),eventId=cleanEventId(body.eventId);
  await loadEvent(db,eventId);
  const snap=await db.collection("ticketStudios").doc(eventId).collection("tickets").orderBy("createdAt","asc").limit(5000).get();
  return {ok:true,version:90,tickets:snap.docs.map(rowPublic),actorRole:actor.profile.role};
}
async function publicConfig(body){
  const db=getDb(),{studio,event}=await studioFromPortalToken(db,body.token);
  if(studio.portalOpen!==true) throw bad("Cổng nhận vé đang đóng.","osc/ticket-portal-closed");
  return {ok:true,version:90,title:String(event.title||studio.title||"Vé sự kiện").slice(0,200),semester:String(event.semester||"").slice(0,30),hasTemplate:!!studio.backgroundDataUrl};
}
async function publicTicket(req,body){
  const db=getDb(),token=cleanPortalToken(body.token);
  await enforceLookupRate(req,db,token,body.clientId);
  const {studio,event}=await studioFromPortalToken(db,token);
  if(studio.portalOpen!==true) throw bad("Cổng nhận vé đang đóng.","osc/ticket-portal-closed");
  if(!studio.backgroundDataUrl) throw bad("Ban tổ chức chưa thiết lập mẫu vé.","osc/ticket-template-missing");
  const {ref:ticketRef,data:t}=await findTicketByCode(db,event.id,body.code);
  if(t.status==="revoked") throw bad("Vé này đã bị thu hồi. Vui lòng liên hệ Ban tổ chức.","osc/ticket-revoked");
  if(t.status==="cancelled") throw bad("Vé này đã bị hủy. Vui lòng liên hệ Ban tổ chức.","osc/ticket-cancelled");
  await ticketRef.set({claimedAt:admin.firestore.FieldValue.serverTimestamp(),claimCount:admin.firestore.FieldValue.increment(1),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return {ok:true,version:90,event:{id:event.id,title:String(event.title||"").slice(0,200),semester:String(event.semester||"").slice(0,30)},ticket:{code:String(t.code||""),name:String(t.name||"").slice(0,160),mssv:String(t.mssv||"").slice(0,40),ticketType:String(t.ticketType||"").slice(0,80),seat:String(t.seat||"").slice(0,40),status:t.status||"issued",qrValue:`OSC-TICKET:${cleanQrToken(t.qrToken)}`},template:publicTemplate(studio)};
}

module.exports=async function handler(req,res){
  try{
    if(req.method==="GET") return sendJson(res,200,{ok:true,service:"ticket-studio",version:90});
    if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET/POST."});}
    const body=readJsonBody(req),action=String(body.action||""); let result;
    if(action==="health") result={ok:true,service:"ticket-studio",version:90};
    else if(action==="admin-state") result=await adminState(req,body);
    else if(action==="admin-save-template") result=await adminSaveTemplate(req,body);
    else if(action==="admin-save-layout") result=await adminSaveLayout(req,body);
    else if(action==="admin-set-portal") result=await adminSetPortal(req,body);
    else if(action==="admin-import") result=await adminImport(req,body);
    else if(action==="admin-registration-rows") result=await adminRegistrationRows(req,body);
    else if(action==="admin-update-ticket") result=await adminUpdateTicket(req,body);
    else if(action==="admin-revoke") result=await adminTicketAction(req,body,"revoke");
    else if(action==="admin-cancel") result=await adminTicketAction(req,body,"cancel");
    else if(action==="admin-reissue") result=await adminTicketAction(req,body,"reissue");
    else if(action==="admin-delete") result=await adminDeleteTicket(req,body);
    else if(action==="admin-delete-many") result=await adminDeleteMany(req,body);
    else if(action==="admin-export") result=await adminExport(req,body);
    else if(action==="public-config") result=await publicConfig(body);
    else if(action==="public-ticket") result=await publicTicket(req,body);
    else throw bad("Thao tác Ticket Studio không hợp lệ.");
    return sendJson(res,200,result);
  }catch(error){
    const code=String(error?.code||"");
    const map={
      "osc/bad-request":400,"osc/ticket-code-invalid":400,"osc/ticket-template-invalid":400,"osc/ticket-template-too-large":413,
      "osc/event-not-found":404,"osc/ticket-not-found":404,"osc/ticket-portal-invalid":404,"osc/ticket-portal-closed":409,
      "osc/ticket-template-missing":409,"osc/ticket-revoked":409,"osc/ticket-cancelled":409,"osc/ticket-checked-in":409,
      "osc/semester-locked":409,"osc/rate-limited":429,"osc/ticket-code-exhausted":409
    };
    if(map[code]) return sendJson(res,map[code],{ok:false,error:error.message,code});
    return handleError(res,error);
  }
};
