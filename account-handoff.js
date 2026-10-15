(function(){
"use strict";
// Only handles transfer of SYSTEM permissions, not Club Board offices.
// Board offices are exclusively managed from the independent members roster.
async function api(action,data={}){
 if(!currentFirebaseUser)throw Error("Bạn chưa đăng nhập.");
 const token=await currentFirebaseUser.getIdToken();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  const res=await fetch("/api/operations",{method:"POST",headers:{
   "Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({action:"leadership-"+action,...data}),signal:controller.signal,cache:"no-store"});
  const output=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(output.error||"Không thể xử lý bàn giao tài khoản.");
  return output;
 }finally{clearTimeout(timer)}
}
function modal(content){
 return new Promise(resolve=>{
  const shade=document.createElement("div");shade.className="board-shade";
  shade.innerHTML='<form class="board-modal" role="dialog" aria-modal="true">'+content+
   '<footer><button type="button" data-close>Hủy</button><button type="submit" class="primary">Xác nhận</button></footer></form>';
  const finish=data=>{shade.remove();document.removeEventListener("keydown",escape,true);resolve(data)};
  const escape=ev=>{if(ev.key==="Escape"){ev.preventDefault();finish(null)}};
  shade.addEventListener("click",ev=>{if(ev.target===shade||ev.target.closest("[data-close]"))finish(null)});
  shade.querySelector("form").addEventListener("submit",ev=>{ev.preventDefault();finish(Object.fromEntries(new FormData(ev.target).entries()))});
  document.body.appendChild(shade);document.addEventListener("keydown",escape,true);shade.querySelector("select,button")?.focus();
 });
}
const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function check(){
 const data=await api("handoff-status");
 if(!data.pending){alert("Không có đề nghị bàn giao quyền Chủ tịch đang chờ.");return}
 const p=data.pending;
 if(p.toUid!==currentFirebaseUser.uid){alert("Đề nghị đang chờ người kế nhiệm xác nhận. Không làm thay đổi chức vụ Ban Chủ nhiệm.");return}
 const confirm=await modal('<h3>Nhận quyền quản trị website</h3><p>Đề nghị bàn giao quyền Chủ tịch của hệ thống OSC cho tài khoản đang đăng nhập. Thao tác này KHÔNG tự bổ nhiệm chức vụ trong menu Ban Chủ nhiệm hoặc đổi chủ sở hữu tài liệu Google Drive.</p>'+
  '<label>Xác nhận<select name="accept"><option value="no">Chưa nhận</option><option value="yes">Tôi đồng ý nhận quyền truy cập Chủ tịch</option></select></label>');
 if(confirm?.accept!=="yes")return;
 const result=await api("handoff-accept");
 if(result.requiresRelogin)alert("Đã bàn giao quyền website. Cả hai tài khoản cần đăng xuất và đăng nhập lại.");
}
window.openAccountHandoff=async()=>{
 try{
  if(currentProfile?.role!=="superadmin"){await check();return}
  const users=(await api("list")).accounts||[];
  const choices=users.filter(a=>a.active&&a.role!=="superadmin");
  if(!choices.length){alert("Chưa có tài khoản hoạt động để nhận quyền.");return}
  const f=await modal('<h3>Bàn giao quyền Chủ tịch OSC</h3>'+
   '<p>Chỉ chuyển quyền quản trị WEBSITE. Chức vụ Ban Chủ nhiệm và quyền sở hữu tệp Google Drive không thay đổi.</p>'+
   '<label>Tài khoản người kế nhiệm<select name="uid">'+
    choices.map(a=>'<option value="'+e(a.uid)+'">'+e(a.displayName||a.email)+' · '+e(a.email)+'</option>').join("")+'</select></label>'+
   '<label>Quyền cũ của bạn sau khi bàn giao<select name="previousRole">'+
    '<option value="admin">Admin</option><option value="bcn">BCN</option></select></label>'+
   '<label>Xác nhận<select name="confirmed"><option value="no">Chưa bàn giao</option>'+
    '<option value="yes">Tôi đồng ý tạo đề nghị bàn giao</option></select></label>');
  if(!f||f.confirmed!=="yes")return;
  const term=typeof semester==="string"?semester:"FA26";
  await api("handoff-start",{uid:f.uid,previousRole:f.previousRole,semester:term});
  alert("Đã gửi đề nghị. Người kế nhiệm vào Tài khoản BCN → Bàn giao quyền Chủ tịch để chấp nhận trong 30 phút.");
 }catch(ex){alert(ex.message||String(ex))}
};
})();