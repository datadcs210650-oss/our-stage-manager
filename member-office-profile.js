(function(){
"use strict";
// Read-only projection of Office History in existing OSC Member Profiles.
// Never writes to member records; the source of truth is user term history.
const cache=new Map();
const VALID=/^[A-Z0-9-]{5,25}$/;
const TTL=60000;
const norm=s=>String(s||"").trim().toUpperCase();
const ident=(mssv,semester)=>semester+":"+norm(mssv);
async function office(mssv,semester,memberId){
 const key=ident(mssv,semester)+":"+String(memberId||""),stored=cache.get(key);
 if(stored&&stored.until>Date.now())return stored.value;
 if(!currentFirebaseUser)throw Error("Chưa đăng nhập.");
 const token=await currentFirebaseUser.getIdToken();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch("/api/operations",{
   method:"POST",
   headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({action:"board-profile",mssv:norm(mssv),semester,memberId}),
   signal:controller.signal,cache:"no-store"
  });
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(value.error||"Không thể tra cứu chức vụ.");
  cache.set(key,{until:Date.now()+TTL,value});
  return value;
 }finally{clearTimeout(timer)}
}
function targetCell(){
 const container=document.querySelector("#memberInfoCard");
 if(!container)return null;
 const cells=[...container.querySelectorAll(".member-profile-cell")];
 return cells.find(x=>x.querySelector("span")?.textContent?.trim()==="Chức vụ")||null;
}
async function updateOffice(){
 try{
  if(typeof selectedInfoId==="undefined"||typeof findMember!=="function")return;
  const id=selectedInfoId,m=findMember(id);
  if(!m||!m.mssv||!m.semester)return;
  const code=String(m.semester),number=norm(m.mssv);
  if(!VALID.test(number)||!/^(SP|SU|FA)\d{2}$/.test(code))return;
  const cell=targetCell(),titleEl=cell?.querySelector("b");
  if(!titleEl)return;
  const fallback=String(m.data?.position||"").trim();
  titleEl.textContent=fallback||"Đang tải chức vụ BCN…";
  const result=await office(number,code,id);
  // Ignore stale network results when a different member/semester was selected.
  if(typeof selectedInfoId!=="undefined"&&selectedInfoId!==id)return;
  const refreshed=targetCell(),current=refreshed?.querySelector("b");
  if(!current)return;
  current.id="oscMemberOfficeBadge";
  current.textContent=result.title||fallback||"Chưa ghi nhận chức vụ Ban Chủ nhiệm kỳ này";
  let history=refreshed.querySelector("#oscMemberOfficeHistory");
  if(!history){history=document.createElement("small");history.id="oscMemberOfficeHistory";history.style.display="block";refreshed.appendChild(history)}
  const years=(result.history||[]).filter(x=>x.title);
  history.textContent=years.length?
    "Đã giữ chức vụ "+result.semesterCount+" học kỳ: "+years.map(x=>x.semester+" — "+x.title).join(" • "):
    "Chức vụ học kỳ "+code+" được đồng bộ theo MSSV từ menu Ban Chủ nhiệm.";
 }catch{
  // Preserve legacy member information on network or permission errors.
  const cell=targetCell(),m=typeof selectedInfoId!=="undefined"&&typeof findMember==="function"?findMember(selectedInfoId):null;
  if(cell?.querySelector("b"))cell.querySelector("b").textContent=m?.data?.position||"Chức vụ chưa tải được";
 }
}
window.oscInvalidateMemberOffice=()=>cache.clear();
window.loadMemberOfficeBadge=updateOffice;
const previous=window.renderInfo;
if(typeof previous==="function"){
 window.renderInfo=function(){
  const value=previous.apply(this,arguments);
  updateOffice();
  return value;
 };
}
})();