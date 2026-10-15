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
  '</div><div class="dh-v2-steps"><div><b>1</b><span>Kết nối Google cá nhân</span></div>'+
  '<div><b>2</b><span>Chọn học kỳ và mở thư mục được chia sẻ</span></div>'+
  '<div><b>3</b><span>Chỉ tải lên/chia sẻ nếu Google cấp quyền</span></div></div>'+
  '<p id="oscV2Notice" role="status" class="dh-v2-notice">'+e(S.notice)+'</p>';
}
function viewDrive(){
 if(!S.status?.connected)return '<div class="dh-v2-guide"><h3>Chưa liên kết Google Drive</h3>'+
  '<p>Bạn cần đăng nhập bằng Google của chính mình và chọn <strong>Cho phép</strong> để OSC đọc hoặc tải tài liệu. '+
  'Đăng nhập website OSC không đồng nghĩa với đã cấp quyền Drive.</p>'+
  '<button class="primary" data-v2="connect">Kết nối tài khoản Google của tôi ↗</button>'+
  '<p class="dh-v2-muted">Sau khi kết nối, thư mục học kỳ chỉ hiện nếu Gmail CLB đã chia sẻ quyền xem hoặc chỉnh sửa cho bạn.</p></div>';
 if(!S.meta){
  return '<div class="dh-v2-guide"><h3>Chưa truy cập được Drive học kỳ '+e(S.sem)+'</h3>'+
   '<p>'+e(S.notice||"Học kỳ chưa có link hoặc tài khoản Google cá nhân chưa được Gmail CLB chia sẻ quyền.")+'</p>'+
   '<p class="dh-v2-muted">Bạn có thể kiểm tra Gmail đã kết nối, hoặc nhờ người quản lý Gmail CLB cấp quyền Viewer/Editor cho thư mục này.</p>'+
   (chair()?'<button class="primary" data-v2="link-set">Liên kết / sửa link Drive học kỳ</button>':"")+'</div>';
 }
 let html='<div class="dh-heading"><h3>'+e(S.meta.name||("Drive "+S.sem))+'</h3>'+
  '<div><a target="_blank" rel="noopener noreferrer" href="'+e(S.meta.folderUrl)+'">Mở Drive học kỳ ↗</a>'+
  '<button data-v2="copy" data-url="'+e(S.meta.folderUrl)+'">Sao chép link</button>'+
  (chair()?'<button data-v2="link-set">Thay đổi link học kỳ</button><button data-v2="policy">Chính sách chia sẻ</button>':"")+
  '</div></div><p class="dh-v2-permission"><strong>Quyền hiện tại: '+(S.meta.canUpload?"Người chỉnh sửa (Editor)":"Người xem (Viewer)")+
  '</strong> · Tài liệu được Google Drive lưu trữ, không chiếm dung lượng Vercel. '+
  (S.meta.canUpload?"Bạn có thể tải tệp tối đa 100 MB qua OSC.":"Bạn có thể đọc tài liệu nhưng không được tải tệp lên.")+'</p>';
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
function paint(){
 if(!root())return;
 root().innerHTML=header()+viewDrive();
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
 S.tab="drive";
 S.notice="";S.meta=null;S.folder="";S.path=[];S.next="";
 try{await loadBase()}catch(err){S.notice=err.message||String(err);paint()}
};
window.renderDriveHub=window.renderDriveHubV2;
})();