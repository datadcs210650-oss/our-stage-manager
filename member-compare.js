(function(){
"use strict";
const q=s=>document.querySelector(s);
const C=window.OSCMemberCompareCore;
if(!C)return;
// All temporary results are kept only in memory. The uploaded file is never
// sent to an API, Firestore, Drive or persistent client storage.
let matched=[],matchedRows=[],selected=new Set(),matchedSemester="",matchedUid="";
let busy=false,recording=false,generation=0,visibleCount=100;
const MAX_RECORD=300,CHUNK=75;
function currentSemester(){return typeof semester==="string"?semester:""}
function allowed(){return typeof canViewModule==="function"&&canViewModule("members")&&!!currentFirebaseUser}
function canRecord(){return allowed()&&typeof canEditModule==="function"&&canEditModule("attendance")}
function validSession(){return allowed()&&matchedSemester===currentSemester()&&matchedUid===currentFirebaseUser?.uid}
function el(tag,cls,txt){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(txt!==undefined)n.textContent=String(txt);
 return n;
}
function clear(){
 generation++;
 matched=[];matchedRows=[];selected.clear();matchedSemester="";matchedUid="";
 busy=false;visibleCount=100;
 const file=q("#memberCompareFile");if(file)file.value="";
 const panel=q("#memberComparePanel");if(panel)panel.hidden=true;
 const output=q("#memberCompareStatus");if(output)output.textContent="Không có dữ liệu đối chiếu nào được lưu.";
 const preview=q("#memberComparePreview");if(preview)preview.replaceChildren();
 const download=q("#memberCompareDownload");if(download)download.disabled=true;
 const choose=q("#memberCompareActivity");if(choose)choose.replaceChildren(new Option("Chọn hoạt động trong kỳ",""));
 const points=q("#memberComparePoints");if(points){points.value="";points.hidden=true;}
 const record=q("#memberCompareRecord");if(record)record.disabled=true;
 const hint=q("#memberCompareRecordHint");if(hint)hint.textContent="Đối chiếu MSSV trước khi ghi nhận tham gia.";
}
function activities(){
 if(typeof getAllActivities!=="function")return [];
 const seen=new Set();
 return getAllActivities().filter(a=>{
  const id=String(a?.item?.id||"");
  if(!id||seen.has(id))return false;
  seen.add(id);return true;
 });
}
function selectedActivity(){
 return activities().find(a=>a.item.id===q("#memberCompareActivity")?.value)||null;
}
function activityEditable(a){
 if(!a||a.item.specialType==="continuation"||!canRecord())return false;
 if(typeof activityColumnLocked==="function"&&activityColumnLocked(a.item.id))return false;
 const mode=activityMode(a.group,a.item);
 return mode!=="number"||activityMaxPoints(a.item)>0;
}
function fillActivities(){
 const select=q("#memberCompareActivity");
 if(!select)return;
 const previous=select.value;
 select.replaceChildren(new Option("Chọn hoạt động trong học kỳ",""));
 for(const a of activities()){
  const locked=!!a.item.locked;
  const special=a.item.specialType==="continuation";
  const mode=activityMode(a.group,a.item);
  const invalid=mode==="number"&&activityMaxPoints(a.item)<=0;
  const label=(a.group.name||"Hoạt động")+" / "+(a.item.name||"Không tên")+
   (a.item.date?" · "+a.item.date:"")+(locked?" · ĐÃ KHÓA":"")+
   (special?" · Form Đồng hành":"")+(invalid?" · Chưa có điểm tối đa":"");
  const opt=new Option(label,a.item.id);
  select.add(opt);
 }
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 select.disabled=recording||!matchedRows.length;
 refreshActivity();
}
function rowState(row,act,roster){
 if(!act)return{label:"Chọn hoạt động",joined:false,eligible:false};
 if(row.ambiguous||!row.id)return{label:"MSSV trùng trong danh sách CLB",joined:false,eligible:false};
 const member=roster.get(row.id);
 if(!member||member.semester!==currentSemester()||C.clean(member.mssv)!==row.mssv)
   return{label:"Hồ sơ đã thay đổi",joined:false,eligible:false};
 const mode=activityMode(act.group,act.item);
 const score=member.scores?.[act.item.id];
 const joined=C.alreadyJoined(mode,score);
 const editable=activityEditable(act);
 return{label:joined?(mode==="number"?"Đã ghi nhận "+score+" điểm":"Đã tham gia"):
    editable?"Chưa ghi nhận":act.item.locked?"Cột đã khóa":"Chỉ xem",
   joined,eligible:editable&&!joined};
}
function currentRoster(){return new Map(members().map(m=>[m.id,m]))}
function pickNextUnrecorded(){
 selected.clear();
 const act=selectedActivity();if(!act||!activityEditable(act))return;
 const roster=currentRoster();
 for(const row of matchedRows){
  if(selected.size>=MAX_RECORD)break;
  if(rowState(row,act,roster).eligible)selected.add(row.id);
 }
}
function refreshActivity(){
 const act=selectedActivity(),points=q("#memberComparePoints");
 if(points){
  const numeric=!!act&&activityMode(act.group,act.item)==="number";
  points.hidden=!numeric;
  if(points.parentElement)points.parentElement.hidden=!numeric;
  points.disabled=recording||!numeric||!activityEditable(act);
  points.max=numeric?String(activityMaxPoints(act.item)):"";
  points.placeholder=numeric?"Điểm (tối đa "+activityMaxPoints(act.item)+")":"";
  if(!numeric)points.value="";
 }
 pickNextUnrecorded();
 renderTable();
}
function updateRecordCount(){
 const act=selectedActivity(),button=q("#memberCompareRecord"),hint=q("#memberCompareRecordHint");
 const allowedWrite=activityEditable(act)&&validSession()&&!recording;
 const n=selected.size;
 if(button){
  button.disabled=!allowedWrite||!n;
  button.textContent="Ghi nhận tham gia ("+n+")";
 }
 if(hint){
  hint.textContent=!act?"Chọn hoạt động để xem trạng thái tham gia.":
   !canRecord()?"Tài khoản chỉ có quyền xem, không được chỉnh sửa điểm danh.":
   act.item.specialType==="continuation"?"Form Đồng hành cần cập nhật bằng quy trình riêng.":
   act.item.locked?"Hoạt động đã khóa, vui lòng mở khóa tại Thiết lập.":
   !activityEditable(act)?"Hoạt động chưa có cấu hình điểm hợp lệ.":
   "Chỉ ghi nhận người chưa tham gia; không ghi đè điểm hiện có. Tối đa "+MAX_RECORD+" người/lần. Đã chọn "+n+" người.";
 }
}
function renderTable(){
 const root=q("#memberComparePreview");if(!root)return;
 root.replaceChildren();
 if(!matchedRows.length){updateRecordCount();return}
 const act=selectedActivity(),roster=currentRoster();
 const head=el("div","osc-compare-summary",matchedRows.length+" MSSV trùng · Hiển thị "+Math.min(visibleCount,matchedRows.length)+" kết quả");
 root.append(head);
 const wrap=el("div","osc-compare-table-wrap"),table=el("table","osc-compare-table");
 const thead=el("thead"),headRow=el("tr");
 for(const title of ["STT","Họ và tên (hồ sơ OSC)","MSSV","Trạng thái hoạt động","Chọn ghi nhận"])
   headRow.append(el("th","",title));
 thead.append(headRow);table.append(thead);
 const body=el("tbody");
 for(const [index,row] of matchedRows.slice(0,visibleCount).entries()){
  const tr=el("tr");
  if(row.ambiguous)tr.className="osc-compare-ambiguous";
  const member=roster.get(row.id);
  const name=row.ambiguous?row.name:(member?.name||row.name);
  const status=rowState(row,act,roster);
  for(const v of [String(index+1),name,row.mssv,status.label])tr.append(el("td","",v));
  const pickCell=el("td"),box=el("input");
  box.type="checkbox";
  box.setAttribute("aria-label","Chọn ghi nhận "+row.mssv);
  box.checked=selected.has(row.id)&&status.eligible;
  box.disabled=recording||!status.eligible;
  box.addEventListener("change",()=>{
   if(box.checked){if(selected.size>=MAX_RECORD){box.checked=false;return}}
   box.checked?selected.add(row.id):selected.delete(row.id);
   updateRecordCount();
  });
  pickCell.append(box);tr.append(pickCell);body.append(tr);
 }
 table.append(body);wrap.append(table);root.append(wrap);
 if(visibleCount<matchedRows.length){
  const more=el("button","secondary osc-compare-more","Xem thêm "+Math.min(100,matchedRows.length-visibleCount)+" thành viên");
  more.type="button";
  more.addEventListener("click",()=>{visibleCount+=100;renderTable()});
  root.append(more);
 }
 updateRecordCount();
}
function open(){
 if(!allowed())return;
 clear();
 const panel=q("#memberComparePanel");if(!panel)return;
 panel.hidden=false;
 q("#memberCompareTerm").textContent=currentSemester();
 fillActivities();
 q("#memberCompareFile")?.focus();
}
async function inspect(file){
 if(!file||busy||recording||!allowed())return;
 matched=[];matchedRows=[];selected.clear();matchedSemester="";matchedUid="";
 q("#memberCompareDownload").disabled=true;
 q("#memberComparePreview").replaceChildren();
 const status=q("#memberCompareStatus"),input=q("#memberCompareFile");
 if(input)input.value="";
 if(Number(file.size)<=0||Number(file.size)>C.MAX_BYTES){
  status.textContent="File phải có dữ liệu và không vượt quá 8 MB.";return;
 }
 busy=true;const sequence=++generation;
 status.textContent="Đang đối chiếu trong trình duyệt…";
 const startedSemester=currentSemester(),startedUid=currentFirebaseUser?.uid;
 try{
  if(typeof readSpreadsheetSecure!=="function"||!window.XLSX)
   throw Error("Bộ đọc Excel chưa sẵn sàng. Vui lòng tải lại trang.");
  const {ws}=await readSpreadsheetSecure(file,{allowCsv:true});
  const table=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:"",blankrows:false});
  const parsed=C.parseRows(table);
  if(sequence!==generation)return;
  if(!allowed()||startedSemester!==currentSemester()||startedUid!==currentFirebaseUser?.uid){
   clear();return;
  }
  const snapshot=members().map(member=>member.mssv);
  const result=C.compare(parsed.codes,snapshot);
  const details=C.joinRoster(parsed.codes,members());
  matched=result.matched;
  matchedRows=details.rows;
  matchedSemester=startedSemester;matchedUid=startedUid;visibleCount=100;
  status.textContent=[
   "Học kỳ "+startedSemester,"MSSV hợp lệ: "+result.validCount,
   "Trùng: "+matched.length,"Không trùng: "+result.missing,
   "Dòng trùng lặp: "+parsed.duplicates,"Dòng không hợp lệ: "+parsed.invalid,
   ...(details.ambiguous?["Cần kiểm tra "+details.ambiguous+" MSSV bị trùng trong danh sách CLB"]:[])
  ].join(" · ")+". Chỉ dùng dữ liệu của hồ sơ OSC để hiển thị tên.";
  fillActivities();
  if(!matched.length)q("#memberComparePreview").textContent="Không tìm thấy MSSV trùng trong học kỳ này.";
  q("#memberCompareDownload").disabled=matched.length===0;
 }catch(e){
  if(sequence===generation){
   matched=[];matchedRows=[];matchedSemester="";matchedUid="";
   status.textContent="Không thể đối chiếu: "+String(e.message||e);
  }
 }finally{if(sequence===generation){busy=false;if(input)input.value=""}}
}
function download(){
 if(!allowed()||!matched.length||matchedSemester!==currentSemester()||
    matchedUid!==currentFirebaseUser?.uid)return;
 if(!window.XLSX)return;
 const sheet=XLSX.utils.aoa_to_sheet([["MSSV"],...matched.map(code=>[code])]);
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,sheet,"MSSV trung");
 XLSX.writeFile(workbook,"OSC_MSSV_Trung_"+matchedSemester+".xlsx");
}
async function record(){
 if(recording||!validSession()||!canRecord()||!selected.size)return;
 const act=selectedActivity();
 if(!activityEditable(act))return;
 const activityId=act.item.id,term=currentSemester(),actor=currentFirebaseUser?.uid;
 const mode=activityMode(act.group,act.item),maximum=activityMaxPoints(act.item);
 let next=true;
 if(mode==="number"){
  const raw=String(q("#memberComparePoints")?.value||"").trim();
  next=Number(raw);
  if(!raw||!Number.isFinite(next)||next<=0||next>maximum)
   return oscAlert("Hãy nhập số điểm lớn hơn 0 và không vượt quá "+maximum+" cho hoạt động này.");
 }
 const roster=currentRoster();
 const rows=matchedRows.filter(r=>selected.has(r.id)&&rowState(r,act,roster).eligible).slice(0,MAX_RECORD);
 if(!rows.length)return;
 const description=(act.group.name||"")+" / "+(act.item.name||"");
 if(!await oscConfirm("Xác nhận ghi nhận "+rows.length+" thành viên tham gia hoạt động \""+description+"\""+
  (mode==="number"?" với "+next+" điểm/người":" (tick tham gia)")+
  "?\nCác điểm đã ghi nhận trước đó sẽ được giữ nguyên."))return;
 if(!validSession()||!canRecord()||!activityEditable(selectedActivity())||selectedActivity()?.item.id!==activityId)return;
 const seq=generation;recording=true;updateRecordCount();
 const chooser=q("#memberCompareActivity"),file=q("#memberCompareFile"),close=q("#memberCompareClose"),points=q("#memberComparePoints");
 for(const x of [chooser,file,close,points])if(x)x.disabled=true;
 let written=0,skipped=0,error=null;
 try{
  for(let offset=0;offset<rows.length;offset+=CHUNK){
   if(seq!==generation||!validSession()||!canRecord()||
       selectedActivity()?.item.id!==activityId||!activityEditable(selectedActivity())){
    error=Error("Phiên làm việc hoặc quyền đã thay đổi; đã dừng ghi nhận.");break;
   }
   const chunk=rows.slice(offset,offset+CHUNK);
   // Firestore transactions read current scores before writing, so attendance
   // entered by someone else cannot be silently overwritten.
   const committed=await fbDb.runTransaction(async tx=>{
    const refs=chunk.map(r=>fbDb.collection("members").doc(r.id));
    const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
    const changed=[];
    for(let i=0;i<snaps.length;i++){
     const snap=snaps[i],data=snap.data();
     if(!snap.exists||data?.semester!==term||C.clean(data.mssv)!==chunk[i].mssv)continue;
     if(C.alreadyJoined(mode,data.scores?.[activityId]))continue;
     tx.update(refs[i],new firebase.firestore.FieldPath("scores",activityId),next,
       "updatedAt",firebase.firestore.FieldValue.serverTimestamp(),"updatedBy",actor);
     changed.push(chunk[i].id);
    }
    return changed;
   });
   written+=committed.length;skipped+=chunk.length-committed.length;
   // Update the existing roster only after the transaction has committed.
   for(const id of committed){
    const m=members().find(x=>x.id===id&&x.semester===term);
    if(m){m.scores=m.scores||{};m.scores[activityId]=next}
    selected.delete(id);
   }
   q("#memberCompareStatus").textContent=
    "Đang ghi nhận: "+(Math.min(offset+CHUNK,rows.length))+"/"+rows.length+" · Thành công "+written+" · Bỏ qua "+skipped;
  }
  if(written>0&&typeof logAudit==="function"){
   await logAudit({action:"update",module:"attendance",entityType:"activity",entityId:activityId,
    semesterKey:term,summary:"Đối chiếu MSSV: ghi nhận "+written+" thành viên tham gia "+description,
    after:{count:written,activityId,mode}});
  }
 }catch(e){error=e}
 finally{
  recording=false;
  if(seq===generation){
   for(const x of [chooser,file,close,points])if(x)x.disabled=false;
   if(written>0&&typeof renderQLTV==="function")renderQLTV();
   pickNextUnrecorded();renderTable();
   q("#memberCompareStatus").textContent="Đã ghi nhận "+written+" thành viên; bỏ qua "+skipped+
    (error?". Dừng do lỗi: "+String(error.message||error):". Điểm cũ được giữ nguyên.");
  }
 }
}
q("#memberCompareOpenBtn")?.addEventListener("click",open);
q("#memberCompareClose")?.addEventListener("click",()=>{if(!recording)clear()});
q("#memberCompareFile")?.addEventListener("change",event=>{
 const file=event.currentTarget.files?.[0];
 if(file)void inspect(file);
});
q("#memberCompareDownload")?.addEventListener("click",download);
q("#memberCompareActivity")?.addEventListener("change",refreshActivity);
q("#memberCompareRecord")?.addEventListener("click",()=>{void record()});
window.addEventListener("pagehide",clear);
window.OSCMemberCompare={clear};
})();
