(function(){
"use strict";
// OSC Drive Hub V2. Does not use the owner's Google token: every action is per-user.
const root=()=>document.getElementById("driveHubRoot");
const legacyDriveRenderer=window.renderDriveHub; // explicit Chair-only migration viewer
const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const chair=()=>currentProfile?.role==="superadmin";
const user=()=>typeof currentFirebaseUser!=="undefined"?currentFirebaseUser:null;
const S={sem:"FA26",tab:"drive",status:null,meta:null,items:[],folders:[],folder:"",path:[],
 next:"",loading:false,notice:"",history:null,accounts:[],selectedUid:""};
const SIZE=100*1024*1024;
async function api(action,body={}){
 if(!user())throw Error("Bạn cần đăng nhập OSC.");
 const token=await user().getIdToken();
 const response=await fetch("/api/operations",{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({action,...body}),cache:"no-store"
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const err=new Error(data.error||"Máy chủ từ chối yêu cầu ("+response.status+").");err.code=data.code;throw err}
 return data;
}
const call=(x,b)=>api("drive2-"+x,b),lead=(x,b)=>api("leadership-"+x,b);
function notify(message){
 S.notice=message||"";
 const div=document.getElementById("oscV2Notice");if(div)div.textContent=S.notice;
}
function currentId(){return S.folder||S.meta?.folderId||""}
function currentLink(){
 const id=currentId();
 return id?"https://drive.google.com/drive/folders/"+encodeURIComponent(id):"";
}
async function copy(link){
 try{await navigator.clipboard.writeText(link);notify("Đã sao chép đường dẫn Drive.")}
 catch{window.open(link,"_blank","noopener,noreferrer");notify("Không sao chép được; đã mở liên kết để bạn sao chép.")}
}
function dialog({heading,description="",value="",email=false,select=null,confirm="Xác nhận"}){
 return new Promise(resolve=>{
  const layer=document.createElement("div");layer.className="dh-dialog-shade";
  layer.innerHTML='<form class="dh-dialog" role="dialog" aria-modal="true">'+
   '<h3>'+e(heading)+'</h3><p>'+e(description)+'</p>'+
   (select?'<select id="oscV2Input">'+select.map(o=>'<option value="'+e(o.value)+'">'+e(o.label)+'</option>').join("")+'</select>':
    '<input id="oscV2Input" maxlength="350" '+(email?'type="email"':'type="text"')+' value="'+e(value)+'" autocomplete="off" required>')+
   '<div class="dh-dialog-buttons"><button type="button" data-cancel>Hủy</button><button type="submit">'+e(confirm)+'</button></div></form>';
  const done=x=>{document.removeEventListener("keydown",escape,true);layer.remove();resolve(x)};
  const escape=ev=>{if(ev.key==="Escape"){ev.preventDefault();done(null)}};
  layer.addEventListener("click",ev=>{if(ev.target===layer||ev.target.closest("[data-cancel]"))done(null)});
  layer.querySelector("form").addEventListener("submit",ev=>{ev.preventDefault();done(layer.querySelector("#oscV2Input").value.trim())});
  document.body.appendChild(layer);document.addEventListener("keydown",escape,true);
  layer.querySelector("#oscV2Input").focus();
 });
}
async function withBusy(task){
 if(S.loading)return;
 S.loading=true;
 try{await task()}catch(err){notify(err.message||String(err))}
 finally{S.loading=false}
}
async function loadBase(){
 const r=root();if(!r)return;
 if(!user()){r.textContent="Vui lòng đăng nhập để xem Kho tài liệu.";return}
 S.notice="";S.status=await call("status");
 if(!S.status.connected){S.meta=null;S.items=[];S.folders=[]}
 else await loadSemester();
 paint();
}
async function loadSemester(){
 S.meta=null;S.items=[];S.folders=[];S.folder="";S.path=[];S.next="";
 if(!S.status?.connected)return;
 try{S.meta=await call("semester-get",{semester:S.sem});await loadFiles()}
 catch(err){S.notice=err.message||"Bạn không có quyền truy cập Drive học kỳ này."}
}
async function loadFiles(more=false){
 if(!S.meta)return;
 const req={semester:S.sem,folderId:currentId(),...(more&&S.next?{pageToken:S.next}:{})};
 const d=await call("files-list",req);
 if(more){S.folders.push(...d.folders);S.items.push(...d.files)}
 else{S.folders=d.folders||[];S.items=d.files||[]}
 S.next=d.nextPageToken||"";
 S.meta.canUpload=d.canUpload===true;
 S.meta.canShare=d.canShare===true;
}
function header(){
 return '<div class="dh-hero"><div><span>OUR STAGE / DOCUMENTS</span><h2>Kho tài liệu OSC</h2>'+
  '<p>Google Drive theo học kỳ · Mỗi người sử dụng quyền Google của chính mình</p></div>'+
  '<strong>'+(S.status?.connected?"Google: "+e(S.status.googleEmail):"Chưa liên kết Google")+'</strong></div>'+
  '<div class="dh-toolbar"><label>Học kỳ <select id="oscV2Sem">'+
  [...new Set([S.sem,...(S.status?.semesters||[])])].map(x=>'<option '+(x===S.sem?"selected":"")+'>'+e(x)+'</option>').join("")+
  '</select></label>'+
  (chair()?'<input id="oscV2NewSem" maxlength="4" placeholder="SP27" aria-label="Thêm học kỳ mới">':'')+
  '<button type="button" data-v2="refresh">Làm mới</button>'+
  (chair()?'<button type="button" class="dh-light" data-v2="legacy">Kho sự kiện cũ (chuyển đổi)</button>':"")+
  (S.status?.connected?'<button type="button" class="dh-light" data-v2="disconnect">Ngắt Google cá nhân</button>':
   '<button type="button" data-v2="connect">Liên kết Google cá nhân</button>')+
  (!chair()?'<button type="button" data-v2="handoff-check">Kiểm tra lời mời nhận quyền Chủ tịch</button>':'')+
  '</div><p id="oscV2Notice" role="status" class="dh-v2-notice">'+e(S.notice)+'</p>'+
  '<div class="dh-tabs"><button class="'+(S.tab==="drive"?"on":"")+'" data-v2="tab" data-tab="drive">Tài liệu học kỳ</button>'+
  (chair()?'<button class="'+(S.tab==="people"?"on":"")+'" data-v2="tab" data-tab="people">Chức vụ & nhiệm kỳ</button>':'')+
  '</div>';
}
function viewDrive(){
 if(!S.status?.connected)return '<div class="dh-empty"><strong>Chưa kết nối Google Drive cá nhân</strong>'+
  '<p>BCN, Admin và Chủ tịch phải đồng ý cấp quyền Google Drive trước khi truy cập kho tài liệu.</p>'+
  '<button data-v2="connect">Kết nối Google</button></div>';
 if(!S.meta){
  return '<div class="dh-empty">Không thể mở thư mục học kỳ '+e(S.sem)+'. '+
   e(S.notice||"Học kỳ chưa gắn Drive hoặc tài khoản Google chưa được chia sẻ quyền.")+
   (chair()?'<p><button data-v2="link-set">Thiết lập link Drive học kỳ</button></p>':"")+'</div>';
 }
 let html='<div class="dh-heading"><h3>'+e(S.meta.name||("Drive "+S.sem))+'</h3>'+
  '<div><a target="_blank" rel="noopener noreferrer" href="'+e(S.meta.folderUrl)+'">Mở Drive học kỳ ↗</a>'+
  '<button data-v2="copy" data-url="'+e(S.meta.folderUrl)+'">Sao chép link</button>'+
  (chair()?'<button data-v2="link-set">Thay đổi link học kỳ</button><button data-v2="policy">Chính sách chia sẻ</button>':"")+
  '</div></div><p class="dh-tip">Chủ sở hữu thư mục: Gmail CLB. Các thao tác được Google Drive kiểm tra theo tài khoản đang kết nối.</p>';
 html+='<div class="dh-breadcrumb"><button data-v2="root">📁 '+e(S.sem)+'</button>'+S.path.map((v,i)=>
  '<span aria-hidden="true">›</span><button data-v2="crumb" data-depth="'+i+'">'+e(v.name)+'</button>').join("")+'</div>';
 html+='<div class="dh-heading"><h3>'+e(S.path.length?S.path[S.path.length-1].name:"Thư mục học kỳ")+'</h3><div>'+
  '<a href="'+e(currentLink())+'" target="_blank" rel="noopener noreferrer">Mở vị trí trên Drive ↗</a>'+
  '<button data-v2="copy" data-url="'+e(currentLink())+'">Copy link thư mục</button>'+
  (S.meta.canUpload?'<button data-v2="folder-add">+ Thư mục</button><label class="dh-upload">Tải tệp (≤100 MB)<input type="file" id="oscV2File" hidden></label>':"")+
  (S.meta.canShare?'<button data-v2="share" data-id="'+e(currentId())+'">Chia sẻ thư mục</button>':"")+'</div></div>';
 html+='<div class="dh-v2-caption">Thư mục con ('+S.folders.length+')'+
   (S.next?' · còn mục chưa tải':'')+'</div>';
 html+='<div class="dh-subfolders">'+S.folders.map(f=>
  '<div class="dh-folder-row"><button class="dh-child-folder" data-v2="open" data-id="'+e(f.id)+'" data-name="'+e(f.name)+'">'+
  '<span class="dh-folder-glyph">📁</span><span class="dh-folder-name">'+e(f.name)+'</span><span class="dh-folder-chevron">›</span></button>'+
  '<div class="dh-row-actions"><button data-v2="copy" data-url="'+e(f.url)+'">Copy link</button>'+
  (f.canRename?'<button data-v2="rename" data-id="'+e(f.id)+'" data-name="'+e(f.name)+'">Đổi tên</button>':"")+
  (f.canShare?'<button data-v2="share" data-id="'+e(f.id)+'">Chia sẻ</button>':"")+
  '</div></div>').join("")+'</div>';
 html+='<div class="dh-v2-caption">Tệp hiện có ('+S.items.length+')</div>'+
 '<div class="dh-files">'+S.items.map(f=>'<div class="dh-file-row"><a class="dh-file-link" target="_blank" rel="noopener noreferrer" href="'+e(f.url)+'">'+
 '<span class="dh-file-icon">📄</span><span class="dh-file-info"><span class="dh-file-name">'+e(f.name)+'</span>'+
 '<small>'+Math.max(1,Math.ceil(f.size/1024))+' KB · Google Drive</small></span></a>'+
 '<div class="dh-row-actions"><button data-v2="copy" data-url="'+e(f.url)+'">Copy link</button>'+
 (f.canRename?'<button data-v2="rename" data-id="'+e(f.id)+'" data-name="'+e(f.name)+'">Đổi tên</button>':"")+
 (f.canShare?'<button data-v2="share" data-id="'+e(f.id)+'">Chia sẻ</button>':"")+'</div></div>').join("")+
 '</div><p id="oscV2Progress" class="dh-v2-notice" role="status"></p>'+
 (S.next?'<button data-v2="more">Tải thêm tệp và thư mục</button>':'');
 if(!S.folders.length&&!S.items.length)html+='<div class="dh-empty">Chưa có tệp hoặc thư mục con trong vị trí này.</div>';
 return html;
}
function viewPeople(){
 return '<div class="dh-heading"><h3>Quản lý chức vụ BCN theo học kỳ</h3><div>'+
  '<button data-v2="people-refresh">Tải danh sách</button>'+
  '<button data-v2="titles-edit">Thiết lập chức vụ '+e(S.sem)+'</button></div></div>'+
  '<p class="dh-tip">Chức danh hiển thị tách biệt khỏi quyền hệ thống. MSSV và chức vụ mỗi kỳ được lưu riêng; không tự gia hạn quyền khi chuyển kỳ.</p>'+
  '<div class="dh-v2-people">'+S.accounts.map(a=>'<div class="dh-file-row"><div class="dh-file-info">'+
   '<span class="dh-file-name">'+e(a.displayName||a.email)+'</span>'+
   '<small>'+e(a.email)+' · '+e(a.role==="superadmin"?"Chủ tịch":a.role==="admin"?"Admin":"BCN")+
   ' · MSSV: '+e(a.mssv||"Chưa gán")+'</small></div>'+
   '<div class="dh-row-actions"><button data-v2="history" data-uid="'+e(a.uid)+'">Lịch sử</button>'+
   '<button data-v2="assign" data-uid="'+e(a.uid)+'" data-name="'+e(a.displayName||a.email)+'">Chỉnh chức vụ</button></div></div>').join("")+'</div>'+
  '<div class="dh-heading"><h3>Bàn giao quyền Chủ tịch</h3><div>'+
  '<button data-v2="handoff-start">Đề nghị bàn giao</button><button data-v2="handoff-check">Kiểm tra đề nghị</button></div></div>'+
  '<p class="dh-tip">Cần xác thực lại tài khoản trong 10 phút gần đây. Người kế nhiệm phải có email đã xác minh, xác nhận tiếp nhận; hai bên sẽ phải đăng nhập lại.</p>';
}
function paint(){
 if(!root())return;
 root().innerHTML=header()+(S.tab==="people"?viewPeople():viewDrive());
}
async function linkSet(){
 const link=await dialog({heading:"Thư mục Drive tổng học kỳ "+S.sem,
  description:"Dán link thư mục hiện hành do email CLB sở hữu. Tệp và thư mục Drive cũ không tự di chuyển."});
 if(!link)return;
 const club=await dialog({heading:"Email chủ sở hữu thư mục",description:"Nhập chính xác Gmail CLB hiện sở hữu thư mục, không phải Gmail cá nhân của Chủ tịch.",email:true});
 if(!club)return;
 const changes=async confirmChange=>call("semester-set",{semester:S.sem,folderUrl:link,clubEmail:club,confirmChange});
 try{await changes(false)}catch(err){
  if(err.code!=="osc/drive-change-confirm")throw err;
  const ans=await dialog({heading:"Xác nhận đổi Drive học kỳ",
   description:"OSC sẽ chỉ đọc link mới. Dữ liệu cũ giữ nguyên trên Google Drive. Chọn xác nhận để tiếp tục.",
   select:[{value:"no",label:"Hủy"},{value:"yes",label:"Xác nhận đổi link"}]});
  if(ans!=="yes")return;await changes(true);
 }
 await loadBase();notify("Đã cập nhật link Drive học kỳ. Vị trí cũ không bị xóa.");
}
async function policySet(){
 const internal=await dialog({heading:"Chế độ chia sẻ "+S.sem,description:"Chọn giới hạn nội bộ OSC hoặc cho phép chia sẻ ngoài OSC.",
  select:[{value:"internal",label:"Chỉ chia sẻ với tài khoản OSC đang hoạt động"},
   {value:"external",label:"Cho phép chia sẻ email ngoài OSC"}]});
 if(!internal)return;
 let publicAllowed=false;
 if(internal==="external"){
  const p=await dialog({heading:"Cho phép liên kết công khai?",select:[
   {value:"off",label:"Không — chỉ chia sẻ qua email"},
   {value:"on",label:"Có — Google Drive quyết định quyền Viewer/Commenter/Editor"}]});
  if(!p)return;publicAllowed=p==="on";
 }
 const v=await call("policy-set",{semester:S.sem,internalOnly:internal==="internal",allowPublic:publicAllowed});
 S.meta.policy=v.policy;notify("Đã lưu chính sách. "+(v.warning||""));
}
async function sharing(itemId){
 const d=await call("permissions-list",{semester:S.sem,folderId:currentId(),itemId});
 let detail=(d.permissions||[]).map(x=>x.type==="anyone"?"Bất kỳ ai: "+x.role:
  (x.email||x.type)+": "+x.role).join("\n");
 const act=await dialog({heading:"Chia sẻ tệp / thư mục",description:"Đang có quyền:\n"+(detail||"Chưa có thông tin")+
  "\nTài khoản hiện tại phải được Google cho phép chia sẻ.",
  select:[{value:"email",label:"Mời một email Google"},...(d.policy?.allowPublic?[{value:"anyone",label:"Bật bất kỳ ai có liên kết"}]:[]),
   {value:"remove",label:"Thu hồi một quyền đã cấp"},{value:"cancel",label:"Hủy"}]});
 if(!act||act==="cancel")return;
 if(act==="remove"){
  const choices=(d.permissions||[]).filter(x=>x.role!=="owner").map(x=>({
   value:x.id,label:(x.email||x.type)+" · "+x.role
  }));
  if(!choices.length)return notify("Không có quyền nào có thể thu hồi.");
  const permissionId=await dialog({heading:"Chọn quyền cần thu hồi",select:choices});
  if(!permissionId)return;await call("permission-remove",{semester:S.sem,folderId:currentId(),itemId,permissionId});
 }else{
  let email="";
  if(act==="email"){
   email=await dialog({heading:"Mời một người",description:d.policy?.internalOnly?
    "Chỉ tài khoản OSC đang hoạt động mới nhận quyền qua website.":"Có thể mời email bất kỳ nếu Google cho phép.",email:true});
   if(!email)return;
  }
  const role=await dialog({heading:"Chọn quyền trên Google Drive",select:[
   {value:"reader",label:"Người xem (Viewer)"},{value:"commenter",label:"Người nhận xét (Commenter)"},
   {value:"writer",label:"Người chỉnh sửa (Editor)"}]});
  if(!role)return;
  await call("permission-add",{semester:S.sem,folderId:currentId(),itemId,type:act==="anyone"?"anyone":"user",email,role});
 }
 notify("Đã gửi yêu cầu cập nhật quyền lên Google Drive.");await loadFiles();paint();
}
async function upload(file){
 if(!file)return;
 if(file.size>SIZE){
  notify("Tệp "+file.name+" vượt 100 MB. Hãy tải trực tiếp trên Google Drive tại đúng vị trí này.");
  const el=document.getElementById("oscV2Progress");
  if(el)el.innerHTML='Tệp quá lớn. <a target="_blank" rel="noopener noreferrer" href="'+e(currentLink())+'">Mở vị trí trên Google Drive ↗</a>';
  return;
 }
 const progress=msg=>{const el=document.getElementById("oscV2Progress");if(el)el.textContent=msg};
 progress("Đang tạo phiên upload bằng Google của bạn…");
 const mime=file.type||"application/octet-stream";
 const sess=await call("upload-start",{semester:S.sem,folderId:currentId(),fileName:file.name,size:file.size,mimeType:mime});
 if(!/^https:\/\/www\.googleapis\.com\//.test(sess.uploadUrl))throw Error("Đường dẫn tải lên Google không hợp lệ.");
 progress("Đang tải tệp lên Google Drive…");
 const response=await fetch(sess.uploadUrl,{method:"PUT",headers:{"Content-Type":mime},body:file});
 if(!response.ok)throw Error("Google Drive từ chối tải lên (HTTP "+response.status+").");
 const info=await response.json();
 await call("upload-confirm",{ticket:sess.ticket,fileId:info.id});
 await loadFiles();paint();notify("Đã tải tệp thành công bằng Google cá nhân của bạn.");
}
async function peopleRefresh(){
 const list=await lead("list");S.accounts=list.accounts||[];paint();
}
async function assign(uid,name){
 const mssv=await dialog({heading:"MSSV của "+name,description:"Mỗi mã số sinh viên chỉ liên kết với một tài khoản."});if(!mssv)return;
 const title=await dialog({heading:"Chức vụ "+S.sem,description:"Lưu chức vụ của đúng học kỳ, không ghi đè học kỳ khác."});if(!title)return;
 async function save(confirmHistoryChange){
  return lead("assign",{uid,semester:S.sem,mssv,positionTitle:title,confirmHistoryChange});
 }
 try{await save(false)}catch(err){
  if(err.code!=="osc/position-confirm")throw err;
  const yes=await dialog({heading:"Sửa lịch sử chức vụ?",description:"Thao tác được lưu nhật ký. Bạn xác nhận sửa bản ghi học kỳ này?",
   select:[{value:"no",label:"Hủy"},{value:"yes",label:"Xác nhận"}]});
  if(yes!=="yes")return;await save(true);
 }
 await peopleRefresh();notify("Đã lưu MSSV và chức vụ cho "+S.sem+".");
}
async function history(uid){
 const h=await lead("history",{uid});S.history=h;
 const details=h.semesters.map(x=>x.semester+" · "+x.positionTitle+" ("+x.systemRoleAtTerm+")").join("\n");
 await dialog({heading:"Lịch sử BCN — "+h.displayName,
  description:"MSSV: "+h.mssv+"\nTham gia "+h.semesterCount+" học kỳ\n"+
  "Thống kê: "+Object.entries(h.titleCounts).map(([t,n])=>t+": "+n+" kỳ").join(", ")+"\n"+details,
  select:[{value:"ok",label:"Đóng"}]});
}
async function titlesEdit(){
 const existing=await lead("titles-get",{semester:S.sem});
 const raw=await dialog({heading:"Danh sách chức vụ "+S.sem,
  description:"Nhập các chức vụ, cách nhau bằng dấu ;. Hệ thống chỉ đổi nhãn hiển thị, không nâng quyền bảo mật.",
  value:(existing.titles||[]).join("; ")});
 if(raw===null)return;
 await lead("titles-set",{semester:S.sem,titles:raw.split(";").map(x=>x.trim()).filter(Boolean)});
 notify("Đã lưu danh mục chức vụ.");
}
async function handoffStart(){
 const choices=S.accounts.filter(a=>a.active&&a.role!=="superadmin");
 if(!choices.length)return notify("Chưa có tài khoản hợp lệ để nhận quyền.");
 const uid=await dialog({heading:"Người kế nhiệm",description:"Người nhận cần có email đăng nhập đã xác minh.",
  select:choices.map(a=>({value:a.uid,label:a.displayName+" · "+a.email}))});
 if(!uid)return;
 const role=await dialog({heading:"Quyền của bạn sau bàn giao",select:[
  {value:"admin",label:"Admin"},{value:"bcn",label:"BCN"}]});
 if(!role)return;
 const check=await dialog({heading:"Xác nhận đề nghị bàn giao",description:"Cần đăng nhập lại gần đây. Người kế nhiệm xác nhận tiếp nhận thì quyền Chủ tịch mới chuyển.",
  select:[{value:"no",label:"Hủy"},{value:"yes",label:"Xác nhận gửi đề nghị"}]});
 if(check!=="yes")return;
 await lead("handoff-start",{uid,semester:S.sem,previousRole:role});
 notify("Đã tạo đề nghị bàn giao. Người kế nhiệm cần vào Kho tài liệu → Nhận quyền Chủ tịch trong 30 phút.");
}
async function handoffCheck(){
 const h=await lead("handoff-status");
 if(!h.pending)return notify("Không có đề nghị đang chờ hoặc dành cho bạn.");
 const d=h.pending;
 const role=chair()?"Người nhận: "+d.toUid:"Bạn được mời nhận quyền Chủ tịch";
 const ans=await dialog({heading:"Đề nghị bàn giao "+d.semester,description:role,
  select:[{value:"no",label:"Đóng"},...(user()?.uid===d.toUid?[{value:"yes",label:"Xác nhận tiếp nhận chức Chủ tịch"}]:[])]});
 if(ans!=="yes")return;
 const result=await lead("handoff-accept");
 if(result.requiresRelogin)notify("Đã bàn giao. Vui lòng đăng xuất và đăng nhập lại để làm mới quyền.");
}
function bindClicks(){
 document.addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-v2]");if(!b||!root()?.contains(b))return;
  const action=b.dataset.v2;
  await withBusy(async()=>{
   if(action==="tab"){S.tab=b.dataset.tab;paint();if(S.tab==="people")await peopleRefresh();return}
   if(action==="connect"){
    const d=await call("connect-start");const u=new URL(d.url);
    if(u.protocol!=="https:"||u.hostname!=="accounts.google.com")throw Error("Đường dẫn OAuth không hợp lệ.");
    window.location.assign(u.href);return;
   }
   if(action==="disconnect"){
    const yes=await dialog({heading:"Ngắt kết nối Google cá nhân",description:"Không xóa bất kỳ tệp nào đã tải lên Drive.",
     select:[{value:"no",label:"Hủy"},{value:"yes",label:"Ngắt kết nối"}]});
    if(yes==="yes"){await call("disconnect");await loadBase()}return;
   }
   if(action==="refresh"){await loadBase();return}
   if(action==="legacy"){
    if(!chair()||typeof legacyDriveRenderer!=="function")throw Error("Chức năng không khả dụng.");
    legacyDriveRenderer();return;
   }
   if(action==="link-set"){await linkSet();return}
   if(action==="policy"){await policySet();return}
   if(action==="copy"){await copy(b.dataset.url);return}
   if(action==="root"){S.folder="";S.path=[];await loadFiles();paint();return}
   if(action==="open"){
    if(S.path.length>=12)throw Error("Tối đa 12 cấp thư mục.");
    S.folder=b.dataset.id;S.path.push({id:b.dataset.id,name:b.dataset.name});
    await loadFiles();paint();return;
   }
   if(action==="crumb"){
    const d=Number(b.dataset.depth);if(!Number.isInteger(d)||d<0||d>=S.path.length)return;
    S.path=S.path.slice(0,d+1);S.folder=S.path[d].id;await loadFiles();paint();return;
   }
   if(action==="more"){await loadFiles(true);paint();return}
   if(action==="folder-add"){
    const name=await dialog({heading:"Tạo thư mục con",description:"Thư mục sẽ nằm chính xác trong vị trí đang mở."});
    if(!name)return;await call("folder-create",{semester:S.sem,folderId:currentId(),name});
    await loadFiles();paint();notify("Đã tạo thư mục.");return;
   }
   if(action==="rename"){
    const name=await dialog({heading:"Đổi tên trên Google Drive",value:b.dataset.name});if(!name)return;
    await call("item-rename",{semester:S.sem,folderId:currentId(),itemId:b.dataset.id,name});
    await loadFiles();paint();notify("Đã cập nhật tên.");return;
   }
   if(action==="share"){await sharing(b.dataset.id);return}
   if(action==="people-refresh"){await peopleRefresh();return}
   if(action==="assign"){await assign(b.dataset.uid,b.dataset.name);return}
   if(action==="history"){await history(b.dataset.uid);return}
   if(action==="titles-edit"){await titlesEdit();return}
   if(action==="handoff-start"){await handoffStart();return}
   if(action==="handoff-check"){await handoffCheck();return}
  });
 });
 document.addEventListener("change",ev=>{
  const input=ev.target;if(!root()?.contains(input))return;
  if(input.id==="oscV2Sem"){S.sem=input.value;withBusy(loadBase)}
  if(input.id==="oscV2File"){
   const file=input.files?.[0];input.value="";
   withBusy(()=>upload(file));
  }
  if(input.id==="oscV2NewSem"){
   // Semester remains a draft until Chair chooses and links an owned folder.
   const sem=input.value.trim().toUpperCase();
   if(/^(SP|SU|FA)\d{2}$/.test(sem)){S.sem=sem;withBusy(loadBase)}
  }
 });
}
bindClicks();
window.renderDriveHubV2=async function(){
 S.sem=String(typeof semester!=="undefined"?semester:"FA26").toUpperCase();
 S.tab=window.__oscOpenLeadership?"people":"drive";window.__oscOpenLeadership=false;
 S.notice="";S.meta=null;S.folder="";S.path=[];S.next="";
 try{await loadBase();if(S.tab==="people"&&chair())await peopleRefresh()}catch(err){S.notice=err.message||String(err);paint()}
};
window.renderDriveHub=window.renderDriveHubV2;
})();