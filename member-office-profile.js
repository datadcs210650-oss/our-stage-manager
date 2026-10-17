(function(){
"use strict";
// Read-only OSC Board title projection for member profiles and their PDFs.
// Appointments are derived from the member roster, NEVER the website login role.
const cache=new Map();
const TERM=/^(SP|SU|FA)\d{2}$/;
const MSSV=/^[A-Z0-9_-]{3,50}$/;
const TTL=60000;
let generation=0;
const norm=v=>String(v||"").trim().toUpperCase();

async function getForMember(member){
  if(!member||!TERM.test(String(member.semester||""))||!MSSV.test(norm(member.mssv))||!member.id)
    throw Error("Hồ sơ thành viên chưa đủ thông tin để tra cứu chức vụ.");
  if(!currentFirebaseUser)throw Error("Bạn chưa đăng nhập OSC.");
  const uid=currentFirebaseUser.uid,term=member.semester,mssv=norm(member.mssv),id=String(member.id);
  const key=[uid,term,mssv,id].join(":"),cached=cache.get(key);
  if(cached&&cached.until>Date.now())return cached.value;
  const token=await currentFirebaseUser.getIdToken();
  if(currentFirebaseUser?.uid!==uid)throw Error("Phiên đăng nhập đã thay đổi.");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch("/api/operations",{
      method:"POST",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({action:"board-profile",mssv,semester:term,memberId:id}),
      signal:controller.signal,cache:"no-store"
    });
    const value=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(value.error||"Không thể tra cứu chức vụ.");
    if(currentFirebaseUser?.uid!==uid)throw Error("Phiên đăng nhập đã thay đổi.");
    // Only read-only data returned by the authenticated Board API may be shown.
    const result={
      title:String(value.title||"").trim().slice(0,80),
      history:(Array.isArray(value.history)?value.history:[])
        .filter(x=>TERM.test(String(x?.semester||""))&&norm(x?.mssv)===mssv)
        .map(x=>({semester:x.semester,title:String(x.title||"").trim().slice(0,80)}))
        .filter(x=>x.title)
    };
    cache.set(key,{until:Date.now()+TTL,value:result});
    return result;
  }finally{clearTimeout(timer)}
}
function selectedMember(){
  if(typeof selectedInfoId==="undefined"||typeof findMember!=="function")return null;
  return findMember(selectedInfoId);
}
async function updateOffice(){
  const member=selectedMember();
  if(!member)return;
  const id=member.id,gen=++generation,card=document.querySelector("#memberInfoCard");
  const cell=[...(card?.querySelectorAll(".member-profile-cell")||[])]
    .find(x=>x.querySelector("span")?.textContent?.trim()==="Chức vụ");
  const titleEl=cell?.querySelector("b");
  if(!titleEl)return;
  // No appointment => genuinely empty cell, not a synthetic position.
  titleEl.textContent="";
  const currentRows=[...card.querySelectorAll("[data-osc-office-term]")];
  currentRows.forEach(x=>x.textContent="");
  try{
    const value=await getForMember(member);
    if(gen!==generation||selectedMember()?.id!==id||document.querySelector("#memberInfoCard")!==card)return;
    const byTerm=new Map(value.history.map(x=>[x.semester,x.title]));
    titleEl.textContent=value.title||"";
    titleEl.id="oscMemberOfficeBadge";
    currentRows.forEach(x=>{
      if(card.contains(x))x.textContent=byTerm.get(x.getAttribute("data-osc-office-term"))||"";
    });
  }catch(err){
    if(gen===generation&&selectedMember()?.id===id&&card.contains(titleEl)){
      titleEl.textContent="Không tải được chức vụ";
      titleEl.title=String(err?.message||"");
    }
  }
}
window.oscInvalidateMemberOffice=()=>{
  generation++;
  cache.clear();
  if(document.querySelector("#info")&&!document.querySelector("#info").classList.contains("hidden"))
    void updateOffice();
};
window.OSCMemberOffice={getForMember,refresh:updateOffice};
window.loadMemberOfficeBadge=updateOffice;
const previous=window.renderInfo;
if(typeof previous==="function"){
  window.renderInfo=function(){
    const result=previous.apply(this,arguments);
    void updateOffice();
    return result;
  };
}
})();
