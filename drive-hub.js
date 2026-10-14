(function(){
"use strict";
const $=q=>document.querySelector(q);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const m=()=>typeof canEditClub==="function"&&canEditClub();
const sup=()=>String(currentProfile?.role||"")==="superadmin";
const S={sem:"",scope:"semester",event:"",category:"",state:null,data:null,files:[],folders:[],folder:"",rootId:"",folderUrl:"",path:[],listVersion:0,busy:false,error:""};
function notice(t){const e=$("#dhNotice");if(e)e.textContent=t||""}
async function api(action,body={}){
 if(!currentFirebaseUser)throw Error("Vui lòng đăng nhập.");
 const token=await currentFirebaseUser.getIdToken();
 const r=await fetch("/api/operations",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"drive-"+action,...body}),cache:"no-store"});
 const j=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(j.error||"Yêu cầu máy chủ thất bại (HTTP "+r.status+").");e.code=j.code||"";throw e}
 return j;
}
function configDiagnostic(){
 const h=S.state?.configuration;
 if(!h)return '<div class="dh-tip">Không thể xác định chi tiết cấu hình. Hãy tải lại trang và kiểm tra Production Environment Variables trên Vercel.</div>';
 const checks=[
  ["DRIVE_OAUTH_CLIENT_ID",h.clientId],
  ["DRIVE_OAUTH_CLIENT_SECRET",h.clientSecret],
  ["DRIVE_TOKEN_ENCRYPTION_KEY",h.encryptionKeyValid]
 ];
 let advice="";
 if(!h.clientId||!h.clientSecret)advice="Kiểm tra giá trị hai biến OAuth trên Vercel và Redeploy.";
 else if(!h.encryptionKeyValid)advice="Khóa mã hóa chưa giải mã thành đúng 32 byte. Mở Terminal, chạy openssl rand -base64 32 rồi dán chính xác KẾT QUẢ vào DRIVE_TOKEN_ENCRYPTION_KEY trên Vercel, sau đó Redeploy.";
 else advice="Các biến có vẻ hợp lệ. Hãy Redeploy bản Production mới nhất và thử làm mới.";
 return '<div class="dh-tip"><strong>Kiểm tra cấu hình Google Drive (chỉ hiển thị trạng thái, không tiết lộ khóa)</strong><div class="dh-config-checks">'+
 checks.map(([name,ok])=>'<div><span>'+esc(name)+'</span><strong class="'+(ok?"dh-good":"dh-bad")+'">'+(ok?"Hợp lệ":"Cần kiểm tra")+'</strong></div>').join("")+
 '</div><p>'+esc(advice)+'</p></div>';
}
function frame(){
 $("#driveHubRoot").innerHTML='<div class="dh-hero"><div><span>OUR STAGE / DRIVE HUB</span><h2>Kho tài liệu OSC</h2><p>Tài liệu nằm trong Google Drive; hệ thống quản lý danh mục theo học kỳ và sự kiện.</p></div><strong>'+(S.state?.connected?"Đã cấp quyền Google":"Chưa kết nối Drive")+'</strong></div>'+
 '<div class="dh-toolbar"><label>Học kỳ <input id="dhSemester" maxlength="4" value="'+esc(S.sem)+'"></label><button data-dh="refresh">Làm mới</button>'+
 (sup()?'<button data-dh="connect">Kết nối Google</button><button class="dh-alt" data-dh="connect-shared">Kết nối thư mục chia sẻ</button><button data-dh="set">Thiết lập thư mục học kỳ</button>':'')+'</div>'+
 '<p id="dhNotice" role="status"></p>'+
 (S.state?.connected?'<p class="dh-tip">Tài khoản kết nối: <strong>'+esc(S.state.ownerEmail||"Không xác định")+
 '</strong>. Phạm vi quyền: <strong>'+esc(S.state.oauthScope==="https://www.googleapis.com/auth/drive"?"Thư mục được chia sẻ (quyền Drive đầy đủ)":"Giới hạn drive.file")+
 '</strong>. Quyền Google không đồng nghĩa với quyền chỉnh sửa từng thư mục.</p>':'')+
 (S.state&&!S.state.configured?configDiagnostic():'')+
 '<div class="dh-tabs"><button data-dh="root" class="'+(S.scope==="root"?"on":"")+'">Kho Drive tổng</button>'+
 '<button data-dh="semester-root" class="'+(S.scope==="semester-root"?"on":"")+'">Thư mục gốc học kỳ</button>'+
 '<button data-dh="semester" class="'+(S.scope==="semester"?"on":"")+'">Tài liệu học kỳ</button>'+
 '<button data-dh="event" class="'+(S.scope==="event"?"on":"")+'">Tài liệu sự kiện</button></div><div id="dhContent"></div>';
 renderContent();
}
function canWriteHere(){return m()&&(S.scope!=="root"||sup())}
function activeCategory(){
 if(S.scope!=="semester"&&S.scope!=="event")return null;
 const cats=S.scope==="event"?(S.data?.events||[]).find(x=>x.id===S.event)?.categories||[]:S.data?.categories||[];
 return cats.find(c=>c.id===S.category)||null;
}
function browseArgs(extra={}){
 return{scope:S.scope,semester:S.sem,eventId:S.event,categoryId:S.category,folderId:S.folder||S.rootId,...extra};
}
function rootLabel(){
 if(S.scope==="root")return"Kho Google Drive tổng";
 if(S.scope==="semester-root")return"Thư mục gốc "+S.sem;
 return activeCategory()?.label||"Danh mục";
}
function copyLink(url){
 const link=String(url||"");
 if(!/^https:\/\/(drive|docs)\.google\.com\//.test(link))return notice("Chưa có liên kết Google Drive hợp lệ.");
 const done=()=>notice("Đã sao chép liên kết Google Drive.");
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(link).then(done).catch(()=>copyFallback(link));return}
 copyFallback(link);
}
function copyFallback(value){
 const input=document.createElement("textarea");input.value=value;input.style.position="fixed";input.style.left="-9999px";
 document.body.appendChild(input);input.focus();input.select();
 const ok=document.execCommand("copy");input.remove();
 notice(ok?"Đã sao chép liên kết.":"Không thể sao chép tự động. Hãy mở liên kết Drive và sao chép từ thanh địa chỉ.");
}
function currentLink(){
 return S.folderUrl||(S.scope==="root"?S.state?.rootFolderUrl:S.scope==="semester-root"?S.data?.folderUrl:"")||"";
}
function renderContent(){
 const el=$("#dhContent");if(!el)return;
 if(!S.state?.connected){el.innerHTML='<div class="dh-empty">Cần kết nối tài khoản Google trước khi truy cập tài liệu.</div>';return}
 if(S.scope==="root"||S.scope==="semester-root"){
  if(S.scope==="semester-root"&&!S.data){
   el.innerHTML='<div class="dh-empty">Học kỳ '+esc(S.sem)+' chưa liên kết thư mục Google Drive.</div>';return;
  }
  const link=S.scope==="root"?S.state.rootFolderUrl:S.data.folderUrl;
  el.innerHTML='<div class="dh-heading"><h3>'+esc(rootLabel())+'</h3><div>'+
   '<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Mở Google Drive ↗</a>'+
   '<button data-dh="copy-url" data-url="'+esc(link)+'">Sao chép link</button></div></div>'+
   '<p class="dh-tip">Hiển thị tệp và thư mục hiện có trên Drive, kể cả tài liệu tạo trực tiếp trong Google Drive (nếu tài khoản kết nối có quyền truy cập). Nhấn vào tệp để xem trên Google Drive.</p><div id="dhFileArea"></div>';
  renderFiles();return;
 }
 if(!S.data){el.innerHTML='<div class="dh-empty">Chưa liên kết thư mục học kỳ này. Super Admin cần thiết lập Drive trước.</div>';return}
 let cats=S.data.categories||[],url=S.data.folderUrl,heading="Tài liệu "+S.sem;
 let html="";
 if(S.scope==="event"){
  const events=S.data.events||[],current=events.find(x=>x.id===S.event);
  html+='<div class="dh-picker"><label>Chọn sự kiện <select id="dhEvent"><option value="">-- Chọn sự kiện --</option>'+
    events.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===S.event?"selected":"")+'>'+esc(x.name)+'</option>').join("")+
    '</select></label><button data-dh="event-add">+ Tạo kho sự kiện</button></div>';
  if(!current){el.innerHTML=html+'<div class="dh-empty">Chọn sự kiện hoặc tạo kho mới từ Cổng sự kiện.</div>';return}
  cats=current.categories||[];url=current.folderUrl;heading=current.name;
 }
 html+='<div class="dh-heading"><h3>'+esc(heading)+'</h3><div>'+
  '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Mở Drive ↗</a>'+
  '<button data-dh="copy-url" data-url="'+esc(url)+'">Sao chép link</button>'+
  '<button data-dh="category-add">+ Danh mục</button></div></div>';
 html+='<div class="dh-grid">'+cats.map(x=>
  '<div class="dh-category-wrap"><button class="dh-category '+(S.category===x.id?"on":"")+'" data-dh="category" data-id="'+esc(x.id)+'">📁 '+esc(x.label)+'</button>'+
  '<button class="dh-small-action" data-dh="category-rename" data-id="'+esc(x.id)+'" data-name="'+esc(x.label)+'" title="Đổi tên danh mục">Đổi tên</button></div>').join("")+
  '</div><div id="dhFileArea"></div>';
 el.innerHTML=html;renderFiles();
}
function renderFiles(){
 const el=$("#dhFileArea");if(!el)return;
 if(!["root","semester-root"].includes(S.scope)&&!activeCategory()){
  el.innerHTML='<div class="dh-empty">Chọn danh mục để xem hoặc tải tệp.</div>';return;
 }
 const heading=S.path.length?S.path[S.path.length-1].name:rootLabel();
 const link=currentLink();
 const breadcrumb='<div class="dh-breadcrumb"><button type="button" data-dh="folder-root">📁 '+esc(rootLabel())+'</button>'+
   S.path.map((p,i)=>'<span aria-hidden="true">›</span><button type="button" data-dh="folder-up-to" data-depth="'+i+'">'+esc(p.name)+'</button>').join("")+'</div>';
 const fileHtml=S.files.length?S.files.map(x=>
   '<div class="dh-file-row"><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">📄 '+esc(x.name)+' <small>'+Math.ceil((x.size||0)/1024)+' KB</small></a>'+
   '<div class="dh-row-actions"><button data-dh="copy-url" data-url="'+esc(x.url)+'">Copy link</button>'+
   (canWriteHere()?'<button data-dh="item-rename" data-id="'+esc(x.id)+'" data-name="'+esc(x.name)+'">Đổi tên</button>':"")+'</div></div>').join(""):
   '<div class="dh-empty">Chưa có tệp trong thư mục này.</div>';
 const folders=S.folders.length?'<div class="dh-subfolders">'+S.folders.map(x=>
   '<div class="dh-folder-row"><button type="button" class="dh-child-folder" data-dh="folder-open" data-id="'+esc(x.id)+'" data-name="'+esc(x.name)+'">📁 '+esc(x.name)+' <span aria-hidden="true">›</span></button>'+
   '<div class="dh-row-actions"><button data-dh="copy-url" data-url="'+esc(x.url)+'">Copy link</button>'+
   (canWriteHere()?'<button data-dh="item-rename" data-id="'+esc(x.id)+'" data-name="'+esc(x.name)+'">Đổi tên</button>':"")+'</div></div>').join("")+'</div>':
   '<div class="dh-empty">Chưa có thư mục con.</div>';
 el.innerHTML=breadcrumb+
   '<div class="dh-heading"><h3>'+esc(heading)+'</h3><div>'+
   (link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Mở thư mục ↗</a>'+
    '<button data-dh="copy-url" data-url="'+esc(link)+'">Copy link thư mục</button>':'')+
   (canWriteHere()?'<button data-dh="folder-create">+ Thư mục con</button>'+
    '<label class="dh-upload">Tải tệp lên <input id="dhFile" type="file" hidden></label>':"")+'</div></div>'+
   '<p class="dh-tip">Thao tác sẽ áp dụng bên trong thư mục đang mở: <strong>'+esc(heading)+
   '</strong>. Không di chuyển tệp khi đổi tên. Tệp vẫn lưu trên Google Drive.</p>'+
   '<h4>Thư mục con</h4>'+folders+'<h4>Tệp hiện có</h4>'+
   '<p id="dhProgress" role="status"></p><div class="dh-files">'+fileHtml+'</div>';
}
async function openFolder(id,name){
 if(S.path.length>=12)return notice("Chỉ hỗ trợ tối đa 12 cấp thư mục con.");
 if(!S.folder&&!S.rootId)return notice("Hãy đợi thư mục hiện tại tải xong rồi thử lại.");
 S.folder=id;S.path.push({id,name});S.files=[];S.folders=[];S.folderUrl="";renderFiles();await files();
}
async function createSubfolder(){
 if(!canWriteHere())return;
 const current=S.path.length?S.path[S.path.length-1].name:rootLabel();
 const name=await ask({title:"Tạo thư mục con",description:"Thư mục mới sẽ nằm NGAY BÊN TRONG: "+current,placeholder:"Tên thư mục con"});
 if(!name)return;
 const expected=S.folder||S.rootId;
 try{
   const result=await api("folder-create",browseArgs({name}));
   if(!result.folder?.id)throw Error("Google Drive chưa xác nhận thư mục mới.");
   if(expected&&result.parentFolderId!==expected)throw Error("Google Drive trả sai thư mục mẹ. Hãy kiểm tra lại Drive.");
   await files();notice("Đã tạo '"+result.folder.name+"' trong '"+current+"'.");
 }catch(e){notice(e.message)}
}
async function renameSelected(itemId,oldName){
 if(!canWriteHere())return;
 // A category is a Firestore-backed folder label. Update both Drive and
 // the OSC category metadata instead of letting the two names drift apart.
 if(S.scope==="semester-root"){
  const category=(S.data?.categories||[]).find(c=>c.folderId===itemId);
  if(category)return renameCategory(category.id,oldName,"semester");
 }
 const name=await ask({title:"Đổi tên tệp hoặc thư mục",description:"Đổi tên trực tiếp trên Google Drive. Vị trí, nội dung và liên kết sẽ không thay đổi.",
   placeholder:"Nhập tên mới",defaultValue:oldName});
 if(name===null||name===oldName)return;
 try{
  await api("item-rename",browseArgs({itemId,name}));
  await files();notice("Đã đổi tên thành '"+name+"'.");
 }catch(e){notice(e.message)}
}
async function renameCategory(id,oldName,scopeOverride=""){
 const name=await ask({title:"Đổi tên danh mục",description:"Đổi tên thư mục trên Google Drive và tên danh mục trong OSC.",
  defaultValue:oldName});
 if(name===null||name===oldName)return;
 try{
  const data=await api("category-rename",{scope:scopeOverride||S.scope,semester:S.sem,eventId:S.event,categoryId:id,name});
  if(S.category===id){S.path=[];S.folder="";S.rootId="";S.folderUrl="";}
  await refresh();if(S.category===id)await files();
  notice("Đã đổi tên danh mục thành '"+data.name+"'.");
 }catch(e){notice(e.message)}
}

async function refresh(){
 if(S.busy)return;S.busy=true;S.error="";
 try{
  S.state=await api("status");S.data=null;
  if(S.state.connected){
   try{S.data=await api("semester-get",{semester:S.sem})}
   catch(e){if(e.code!=="osc/drive-missing-semester")S.error=e.message}
  }
  frame();
  if(S.scope==="root"||(S.data&&["semester-root","semester","event"].includes(S.scope)&&
     (["root","semester-root"].includes(S.scope)||S.category)))await files();
  notice(S.error||(S.state.connected?"":"Kho tài liệu chưa được kết nối với Drive."));
 }catch(e){S.state=null;S.data=null;S.error=e.message;frame();notice(S.error)}
 finally{S.busy=false}
}
async function connect(mode="limited"){
 if(mode==="shared"){
  const choice=await ask({title:"Kết nối thư mục được chia sẻ",
   description:"Chỉ dùng khi cần nhập link thư mục do người khác sở hữu hoặc thư mục tạo ngoài ứng dụng. Google sẽ yêu cầu quyền truy cập rộng tới Drive của tài khoản kết nối. OSC lưu token đã mã hóa và chỉ dùng trong Kho tài liệu. Nên dùng tài khoản Google riêng cho CLB.",
   options:[{value:"cancel",label:"Hủy, giữ quyền giới hạn"},{value:"agree",label:"Tôi hiểu và tiếp tục đến Google"}]});
  if(choice!=="agree")return;
 }
 try{
  const o=await api("connect-start",{scopeMode:mode});
  const u=new URL(o.url);
  if(u.protocol!=="https:"||u.hostname!=="accounts.google.com")throw Error("URL kết nối không an toàn.");
  location.assign(o.url);
 }catch(e){notice(e.message)}
}

function ask({title,description="",placeholder="",defaultValue="",options=null,optional=false}){
 return new Promise(resolve=>{
  const shade=document.createElement("div");
  shade.className="dh-dialog-shade";
  const optionsMarkup=options?'<select id="dhDialogInput">'+options.map((o,i)=>'<option value="'+esc(o.value)+'">'+esc(o.label)+'</option>').join("")+'</select>':
    '<input id="dhDialogInput" type="text" maxlength="350" placeholder="'+esc(placeholder)+'" value="'+esc(defaultValue)+'" '+(optional?"":"required")+'>';
  shade.innerHTML='<form class="dh-dialog" role="dialog" aria-modal="true" aria-labelledby="dhDialogTitle">'+
   '<h3 id="dhDialogTitle">'+esc(title)+'</h3><p>'+esc(description)+'</p>'+
   '<label>'+esc(options?"Chọn sự kiện":"Thông tin")+'</label>'+optionsMarkup+
   '<div class="dh-dialog-buttons"><button type="button" data-cancel>Hủy</button><button type="submit">Xác nhận</button></div></form>';
  const finish=value=>{document.removeEventListener("keydown",onKey,true);shade.remove();resolve(value)};
  const onKey=e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();finish(null)}};
  shade.addEventListener("click",e=>{if(e.target===shade||e.target.closest("[data-cancel]"))finish(null)});
  shade.querySelector("form").onsubmit=e=>{
   e.preventDefault();
   const value=shade.querySelector("#dhDialogInput").value.trim();
   if(!optional&&!value)return;
   finish(value);
  };
  document.body.appendChild(shade);
  document.addEventListener("keydown",onKey,true);
  shade.querySelector("#dhDialogInput").focus();
 });
}
async function setSemester(){
 if(!sup())return;
 const url=await ask({title:"Thiết lập Drive học kỳ",description:"Dán link thư mục Drive hoặc để trống để OSC tạo tự động trong kho tổng.",placeholder:"https://drive.google.com/drive/folders/…",optional:true});
 if(url===null)return;
 try{await api("semester-set",{semester:S.sem,folderUrl:url.trim()});await refresh()}
 catch(e){
  if(e.code==="osc/drive-change-confirm"){
   const choice=await ask({title:"Xác nhận đổi thư mục học kỳ",description:"Tệp cũ sẽ không tự chuyển. Nếu học kỳ có kho sự kiện, hệ thống sẽ chặn việc thay đổi.",
    options:[{value:"cancel",label:"Hủy"},{value:"agree",label:"Xác nhận đổi thư mục"}]});
   if(choice==="agree")try{await api("semester-set",{semester:S.sem,folderUrl:url.trim(),confirmChange:true});await refresh()}catch(next){notice(next.message)}
  }else notice(e.message);
 }
}
async function addEvent(){
 const events=(state.events||[]).filter(x=>x.semester===S.sem);
 if(!events.length)return notice("Học kỳ này chưa có sự kiện.");
 const selected=await ask({title:"Tạo kho tài liệu sự kiện",description:"Chọn sự kiện đã có trong Cổng sự kiện.",
  options:events.map((x,i)=>({value:String(i),label:x.title||"Sự kiện"}))});
 if(selected===null)return;
 const index=Number(selected);if(!Number.isInteger(index)||index<0||index>=events.length)return notice("Lựa chọn không hợp lệ.");
 try{const a=await api("event-ensure",{eventId:events[index].id});S.event=a.id;await refresh()}catch(e){notice(e.message)}
}
async function addCategory(){
 const label=await ask({title:"Thêm danh mục tài liệu",description:"Danh mục sẽ được tạo trong Google Drive tương ứng.",placeholder:"Ví dụ: Hợp đồng tài trợ"});if(!label)return;
 try{await api("category-add",{semester:S.sem,scope:S.scope,eventId:S.event,label});await refresh()}catch(e){notice(e.message)}
}
async function files(){
 const seq=++S.listVersion,scope=S.scope,semester=S.sem,eventId=S.event,categoryId=S.category;
 const requested=S.folder||S.rootId;
 try{
  const a=await api("files-list",browseArgs());
  if(seq!==S.listVersion||S.scope!==scope||S.sem!==semester||S.event!==eventId||S.category!==categoryId||
     requested!==(S.folder||S.rootId))return;
  S.files=a.files||[];S.folders=a.folders||[];
  S.rootId=a.rootFolderId||"";
  S.folder=a.folderId||"";
  S.folderUrl=a.folderUrl||"";
  renderFiles();notice("");
 }catch(e){
  if(seq!==S.listVersion)return;
  S.files=[];S.folders=[];renderFiles();notice(e.message);
 }
}
async function upload(file){
 const el=$("#dhProgress");if(!file||!el)return;
 if(file.size>500*1024*1024){el.textContent="Tệp vượt 500 MB; hãy mở trực tiếp thư mục trên Drive.";return}
 try{
  el.textContent="Đang cấp phiên tải lên…";
  const d=await api("upload-start",browseArgs({fileName:file.name,size:file.size,mimeType:file.type||"application/octet-stream"}));
  if(!/^https:\/\/www\.googleapis\.com\//.test(d.uploadUrl))throw Error("URL tải lên không hợp lệ.");
  el.textContent="Đang tải "+file.name+" lên Google Drive…";
  const r=await fetch(d.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});
  if(!r.ok)throw Error("Google Drive từ chối tải lên: "+r.status);
  const info=await r.json();
  await api("upload-confirm",{ticket:d.ticket,fileId:info.id});
  el.textContent="Tải lên hoàn tất.";await files();
 }catch(e){el.textContent=e.message||String(e)}
}
function clearFolder(){
 ++S.listVersion;S.folder="";S.rootId="";S.folderUrl="";S.path=[];S.files=[];S.folders=[];
}
window.renderDriveHub=function(){
 if(!m()){const root=$("#driveHubRoot");if(root)root.textContent="Chỉ Admin và Super Admin được truy cập.";return}
 S.sem=String(semester||"FA26");clearFolder();refresh();
};
document.addEventListener("click",e=>{
 if(!$("#driveHubRoot")?.contains(e.target))return;
 const b=e.target.closest("[data-dh]");if(!b)return;
 const a=b.dataset.dh;
 if(a==="refresh"){
  S.sem=$("#dhSemester")?.value.trim().toUpperCase()||S.sem;
  clearFolder();refresh();return;
 }
 if(a==="connect"){connect(S.state?.oauthScope==="https://www.googleapis.com/auth/drive"?"shared":"limited");return}
 if(a==="connect-shared"){connect("shared");return}
 if(a==="set"){setSemester();return}
 if(["root","semester-root","semester","event"].includes(a)){
  S.scope=a;S.category="";clearFolder();frame();
  if(a==="root"||(a==="semester-root"&&S.data))files();
  return;
 }
 if(a==="event-add"){addEvent();return}
 if(a==="category-add"){addCategory();return}
 if(a==="category-rename"){renameCategory(b.dataset.id,b.dataset.name);return}
 if(a==="folder-create"){createSubfolder();return}
 if(a==="item-rename"){renameSelected(b.dataset.id,b.dataset.name);return}
 if(a==="copy-url"){copyLink(b.dataset.url);return}
 if(a==="folder-open"){openFolder(b.dataset.id,b.dataset.name);return}
 if(a==="folder-root"){clearFolder();renderFiles();files();return}
 if(a==="folder-up-to"){
  const depth=Number(b.dataset.depth);
  if(Number.isInteger(depth)&&depth>=0&&depth<S.path.length){
   const next=S.path.slice(0,depth+1);
   clearFolder();S.path=next;S.folder=next[depth].id;renderFiles();files();
  }
  return;
 }
 if(a==="category"){S.category=b.dataset.id;clearFolder();renderContent();files()}
});
document.addEventListener("change",e=>{
 if(e.target?.id==="dhEvent"){S.event=e.target.value;S.category="";clearFolder();renderContent()}
 if(e.target?.id==="dhFile"){upload(e.target.files?.[0]);e.target.value=""}
});
})();