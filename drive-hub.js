(function(){
"use strict";
const $=q=>document.querySelector(q);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const m=()=>typeof canEditClub==="function"&&canEditClub();
const sup=()=>String(currentProfile?.role||"")==="superadmin";
const S={sem:"",scope:"semester",event:"",category:"",state:null,data:null,files:[],busy:false};
function notice(t){const e=$("#dhNotice");if(e)e.textContent=t||""}
async function api(action,body={}){
 if(!currentFirebaseUser)throw Error("Vui lòng đăng nhập.");
 const token=await currentFirebaseUser.getIdToken();
 const r=await fetch("/api/drive-hub",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action,...body}),cache:"no-store"});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Không thể hoàn tất yêu cầu.");return j;
}
function frame(){
 $("#driveHubRoot").innerHTML='<div class="dh-hero"><div><span>OUR STAGE / DRIVE HUB</span><h2>Kho tài liệu OSC</h2><p>Tài liệu nằm trong Google Drive; hệ thống quản lý danh mục theo học kỳ và sự kiện.</p></div><strong>'+(S.state?.connected?"Đã kết nối Drive":"Chưa kết nối Drive")+'</strong></div>'+
 '<div class="dh-toolbar"><label>Học kỳ <input id="dhSemester" maxlength="4" value="'+esc(S.sem)+'"></label><button data-dh="refresh">Làm mới</button>'+
 (sup()?'<button data-dh="connect">Kết nối Google</button><button data-dh="set">Thiết lập thư mục học kỳ</button>':'')+'</div>'+
 '<p id="dhNotice" role="status"></p>'+(S.state&&!S.state.configured?'<div class="dh-tip">Cần cấu hình OAuth Client ID, Client Secret và khóa mã hóa trên Vercel để kích hoạt. Không nhập mật khẩu Google vào OSC.</div>':'')+
 '<div class="dh-tabs"><button data-dh="semester" class="'+(S.scope==="semester"?"on":"")+'">Tài liệu học kỳ</button><button data-dh="event" class="'+(S.scope==="event"?"on":"")+'">Tài liệu sự kiện</button></div><div id="dhContent"></div>';
 renderContent();
}
function renderContent(){
 const el=$("#dhContent");if(!el)return;
 if(!S.data){el.innerHTML='<div class="dh-empty">Chưa liên kết thư mục học kỳ này. Super Admin cần thiết lập Drive trước.</div>';return}
 let cats=S.data.categories||[],url=S.data.folderUrl,heading="Tài liệu "+S.sem;
 let html="";
 if(S.scope==="event"){
  const events=S.data.events||[],current=events.find(x=>x.id===S.event);
  html+='<div class="dh-picker"><label>Chọn sự kiện <select id="dhEvent"><option value="">-- Chọn sự kiện --</option>'+events.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===S.event?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label><button data-dh="event-add">+ Tạo kho sự kiện</button></div>';
  if(!current){el.innerHTML=html+'<div class="dh-empty">Chọn một sự kiện hoặc tạo kho mới từ Cổng sự kiện.</div>';return}
  cats=current.categories||[];url=current.folderUrl;heading=current.name;
 }
 html+='<div class="dh-heading"><h3>'+esc(heading)+'</h3><div><a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Mở Drive ↗</a><button data-dh="category-add">+ Danh mục</button></div></div>';
 html+='<div class="dh-grid">'+cats.map(x=>'<button class="dh-category '+(S.category===x.id?"on":"")+'" data-dh="category" data-id="'+esc(x.id)+'">📁 '+esc(x.label)+'</button>').join("")+'</div><div id="dhFileArea"></div>';
 el.innerHTML=html;renderFiles();
}
function renderFiles(){
 const el=$("#dhFileArea");if(!el)return;
 const cats=S.scope==="event"?(S.data.events||[]).find(x=>x.id===S.event)?.categories||[]:S.data.categories||[];
 const cat=cats.find(x=>x.id===S.category);
 if(!cat){el.innerHTML='<div class="dh-empty">Chọn danh mục để xem hoặc tải tệp.</div>';return}
 el.innerHTML='<div class="dh-heading"><h3>'+esc(cat.label)+'</h3><label class="dh-upload">Tải tệp lên <input id="dhFile" type="file" hidden></label></div>'+
 '<p class="dh-tip">Tệp được gửi đến Google Drive qua phiên upload tạm thời. Giới hạn 500 MB mỗi tệp. Không lưu nội dung tệp trên Firestore.</p>'+
 '<p id="dhProgress" role="status"></p><div class="dh-files">'+(S.files.length?S.files.map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">📄 '+esc(x.name)+' <small>'+Math.ceil((x.size||0)/1024)+' KB</small></a>').join(""):'<div class="dh-empty">Danh mục chưa có tệp.</div>')+'</div>';
}
async function refresh(){
 if(S.busy)return;S.busy=true;
 try{
  S.state=await api("status");
  S.data=S.state.connected?await api("semester-get",{semester:S.sem}).catch(()=>null):null;
  frame();notice(S.state.connected?"":"Kho tài liệu chưa được kết nối với Drive.");
 }catch(e){notice(e.message)}
 finally{S.busy=false}
}
async function connect(){try{const o=await api("connect-start");if(!o.url.startsWith("https://accounts.google.com/"))throw Error("URL kết nối không an toàn.");location.assign(o.url)}catch(e){notice(e.message)}}
async function setSemester(){
 if(!sup())return;
 const url=prompt("Link thư mục Drive học kỳ; để trống để tạo thư mục tự động:","");
 if(url===null)return;
 try{await api("semester-set",{semester:S.sem,folderUrl:url.trim()});await refresh()}catch(e){notice(e.message)}
}
async function addEvent(){
 const events=(state.events||[]).filter(x=>x.semester===S.sem);
 if(!events.length)return notice("Học kỳ này chưa có sự kiện.");
 const ans=prompt("Chọn số thứ tự sự kiện:\n"+events.map((x,i)=>(i+1)+". "+x.title).join("\n"),"1");
 if(ans===null)return;
 const index=Number(ans)-1;if(!Number.isInteger(index)||index<0||index>=events.length)return notice("Số thứ tự không hợp lệ.");
 try{const a=await api("event-ensure",{eventId:events[index].id});S.event=a.id;await refresh()}catch(e){notice(e.message)}
}
async function addCategory(){
 const label=prompt("Tên danh mục mới:","");if(!label)return;
 try{await api("category-add",{semester:S.sem,scope:S.scope,eventId:S.event,label});await refresh()}catch(e){notice(e.message)}
}
async function files(){
 try{const a=await api("files-list",{semester:S.sem,scope:S.scope,eventId:S.event,categoryId:S.category});S.files=a.files||[];renderFiles()}catch(e){notice(e.message)}
}
async function upload(file){
 const el=$("#dhProgress");if(!file||!el)return;
 if(file.size>500*1024*1024){el.textContent="Tệp vượt 500 MB; hãy mở trực tiếp thư mục trên Drive.";return}
 try{
  el.textContent="Đang cấp phiên tải lên…";
  const d=await api("upload-start",{semester:S.sem,scope:S.scope,eventId:S.event,categoryId:S.category,fileName:file.name,size:file.size,mimeType:file.type||"application/octet-stream"});
  if(!/^https:\/\/www\.googleapis\.com\//.test(d.uploadUrl))throw Error("URL tải lên không hợp lệ.");
  el.textContent="Đang tải "+file.name+" lên Google Drive…";
  const r=await fetch(d.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});
  if(!r.ok)throw Error("Google Drive từ chối tải lên: "+r.status);
  const info=await r.json();
  await api("upload-confirm",{ticket:d.ticket,fileId:info.id});
  el.textContent="Tải lên hoàn tất.";await files();
 }catch(e){el.textContent=e.message||String(e)}
}
window.renderDriveHub=function(){
 if(!m()){const root=$("#driveHubRoot");if(root)root.textContent="Chỉ Admin và Super Admin được truy cập.";return}
 S.sem=String(semester||"FA26");refresh();
};
document.addEventListener("click",e=>{
 if(!$("#driveHubRoot")?.contains(e.target))return;
 const b=e.target.closest("[data-dh]");if(!b)return;
 const a=b.dataset.dh;
 if(a==="refresh"){S.sem=$("#dhSemester").value.trim().toUpperCase();S.category="";refresh()}
 if(a==="connect")connect();
 if(a==="set")setSemester();
 if(a==="semester"||a==="event"){S.scope=a;S.category="";S.files=[];frame()}
 if(a==="event-add")addEvent();
 if(a==="category-add")addCategory();
 if(a==="category"){S.category=b.dataset.id;S.files=[];renderContent();files()}
});
document.addEventListener("change",e=>{
 if(e.target?.id==="dhEvent"){S.event=e.target.value;S.category="";S.files=[];renderContent()}
 if(e.target?.id==="dhFile"){upload(e.target.files?.[0]);e.target.value=""}
});
})();