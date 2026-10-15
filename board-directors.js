(function(){
"use strict";
/* OSC Board — wholly independent of website login accounts */
const root=()=>document.getElementById("boardDirectorsRoot");
const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const V={term:"FA26",members:[],appointments:[],titles:[],busy:false,search:"",notice:"",active:false};
async function request(action,params={}){
 if(!currentFirebaseUser)throw Error("Vui lòng đăng nhập OSC.");
 const idToken=await currentFirebaseUser.getIdToken();
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),18000);
 try{
  const res=await fetch("/api/operations",{
   method:"POST",headers:{"Authorization":"Bearer "+idToken,"Content-Type":"application/json"},
   body:JSON.stringify({action:"board-"+action,...params}),cache:"no-store",signal:control.signal
  });
  const j=await res.json().catch(()=>({}));
  if(!res.ok){const err=new Error(j.error||"Không thể kết nối dữ liệu Ban Chủ nhiệm.");err.code=j.code;throw err}
  return j;
 }finally{clearTimeout(timer)}
}
function notify(msg){V.notice=String(msg||"");const n=document.getElementById("boardNotice");if(n)n.textContent=V.notice}
function knownTerms(){
 const terms=typeof window.oscAvailableTerms==="function"?window.oscAvailableTerms():[];
 return [...new Set([...terms,V.term])].filter(s=>/^(SP|SU|FA)\d{2}$/.test(s))
 .sort((x,y)=>Number(y.slice(2))*3+({SP:0,SU:1,FA:2}[y.slice(0,2)]||0)
  -(Number(x.slice(2))*3+({SP:0,SU:1,FA:2}[x.slice(0,2)]||0)));
}
function key(s){return String(s||"").trim().toUpperCase()}
function roster(){
 const used=new Set();return V.members.filter(m=>{
  const id=key(m.mssv);
  if(!id||used.has(id))return false;
  used.add(id);return /^[A-Z0-9_-]{3,50}$/.test(id)
 });
}
function modal({heading,description="",fields=[],confirm="Xác nhận"}){
 return new Promise(resolve=>{
  const overlay=document.createElement("div");overlay.className="board-shade";
  overlay.innerHTML='<form class="board-modal" role="dialog" aria-modal="true">'+
   '<header><h3>'+escape(heading)+'</h3><button type="button" data-close aria-label="Đóng">×</button></header>'+
   '<p>'+escape(description)+'</p>'+fields.map(f=>'<label>'+escape(f.label)+(f.options?
    '<select name="'+escape(f.name)+'" required>'+f.options.map(o=>'<option value="'+escape(o.value)+'" '+(o.value===f.value?'selected':'')+'>'+escape(o.label)+'</option>').join("")+'</select>':
    '<input type="text" name="'+escape(f.name)+'" value="'+escape(f.value||'')+'" required maxlength="'+(f.max||120)+'">')+'</label>').join("")+
   '<footer><button type="button" data-close>Hủy</button><button class="primary" type="submit">'+escape(confirm)+'</button></footer></form>';
  const done=x=>{document.removeEventListener("keydown",esc,true);overlay.remove();resolve(x)};
  const esc=ev=>{if(ev.key==="Escape"){ev.preventDefault();done(null)}};
  overlay.addEventListener("click",ev=>{if(ev.target===overlay||ev.target.closest("[data-close]"))done(null)});
  overlay.querySelector("form").addEventListener("submit",ev=>{ev.preventDefault();done(Object.fromEntries(new FormData(ev.target).entries()))});
  document.body.appendChild(overlay);document.addEventListener("keydown",esc,true);
  overlay.querySelector("input,select,button")?.focus();
 });
}
function paint(){
 const el=root();if(!el)return;
 const assigned=new Map(V.appointments.map(a=>[key(a.mssv),a]));
 const available=roster().filter(m=>!assigned.has(key(m.mssv)));
 const q=V.search.trim().toLocaleLowerCase("vi");
 const visible=V.appointments.filter(a=>[a.name,a.mssv,a.title].some(z=>String(z||"").toLocaleLowerCase("vi").includes(q)));
 const termOptions=knownTerms();
 el.innerHTML='<section class="board-page">'+
  '<header class="board-hero"><div><small>OUR STAGE · CƠ CẤU TỔ CHỨC</small><h2>Ban Chủ nhiệm</h2>'+
  '<p>Quản lý nhân sự và chức vụ dựa trên <strong>Danh sách thành viên</strong>, hoàn toàn độc lập với tài khoản đăng nhập website.</p></div>'+
  '<div class="board-hero-right"><span class="board-count">'+V.appointments.length+' thành viên BCN</span>'+
  '<button data-board="refresh" type="button">↻ Làm mới</button></div></header>'+
  '<div class="board-note"><strong>Lưu ý:</strong> Bổ nhiệm chức vụ ở đây không tạo tài khoản BCN, không cấp quyền truy cập OSC và không thay đổi thông tin đăng nhập.</div>'+
  '<div class="board-toolbar"><label>Học kỳ đang quản lý<select id="boardTerm">'+termOptions.map(t=>'<option value="'+escape(t)+'" '+(t===V.term?'selected':'')+'>'+escape(t)+'</option>').join("")+'</select></label>'+
  '<label>Tìm trong Ban Chủ nhiệm<input id="boardSearch" value="'+escape(V.search)+'" placeholder="Tên, MSSV, chức vụ…"></label>'+
  '<div class="board-buttons"><button data-board="titles" type="button">Chức vụ tùy chỉnh</button>'+
  '<button class="primary" data-board="appoint" type="button">+ Bổ nhiệm từ DS thành viên</button></div></div>'+
  '<p id="boardNotice" class="board-notice" role="status">'+escape(V.notice)+'</p>'+
  '<div class="board-stats"><div><small>BCN học kỳ '+escape(V.term)+'</small><strong>'+V.appointments.length+'</strong></div>'+
  '<div><small>Thành viên chưa bổ nhiệm</small><strong>'+available.length+'</strong></div>'+
  '<div><small>Chức vụ đã thiết lập</small><strong>'+V.titles.length+'</strong></div></div>'+
  '<div class="board-section-title"><h3>Danh sách Ban Chủ nhiệm</h3><span>'+visible.length+' kết quả</span></div>'+
  '<div class="board-list">'+visible.map(a=>
   '<article class="board-person"><span class="board-avatar">'+escape((a.name||"?").trim().slice(0,1))+'</span>'+
   '<div class="board-person-info"><b>'+escape(a.name)+'</b><small>'+escape(a.mssv)+' · '+escape(V.term)+'</small>'+
   '<span class="board-position">'+escape(a.title)+'</span></div>'+
   '<div class="board-actions"><button data-board="history" data-mssv="'+escape(a.mssv)+'">Lịch sử</button>'+
   '<button data-board="edit" data-mssv="'+escape(a.mssv)+'">Sửa chức vụ</button>'+
   '<button data-board="remove" data-mssv="'+escape(a.mssv)+'">Gỡ bổ nhiệm</button></div></article>').join("")+'</div>'+
  (!visible.length?'<div class="board-empty">Chưa có nhân sự BCN phù hợp ở học kỳ này. Nhấn “Bổ nhiệm từ DS thành viên” để bắt đầu.</div>':"")+
  '<div class="board-footer-info">Nguồn nhân sự: Danh sách thành viên học kỳ '+escape(V.term)+
  '. Khi chuyển học kỳ, chức vụ kỳ cũ vẫn được lưu. Tài khoản BCN được quản lý độc lập ở menu Tài khoản BCN.</div></section>';
}
async function refresh(){
 if(!root())return;
 const [one,two]=await Promise.all([request("list",{semester:V.term}),request("titles-get",{semester:V.term})]);
 V.members=one.members||[];V.appointments=one.appointments||[];V.titles=two.titles||[];
 paint();
}
async function withBusy(fn){
 if(V.busy)return;
 V.busy=true;
 try{await fn()}catch(err){notify(err?.message||String(err))}
 finally{V.busy=false}
}
async function saveAppointment({member,title},confirmChange=false){
 try{
  await request("assign",{semester:V.term,mssv:key(member.mssv),memberId:member.id,title,confirmChange});
 }catch(e){
  if(e.code!=="osc/board-confirm-change")throw e;
  const yes=await modal({heading:"Xác nhận sửa chức vụ đã lưu",
   description:"Đổi chức vụ học kỳ "+V.term+" sẽ được lưu nhật ký và không thay đổi quyền đăng nhập.",
   fields:[{name:"confirmation",label:"Bạn muốn tiếp tục?",options:[
    {value:"no",label:"Không, giữ nguyên"},{value:"yes",label:"Đồng ý sửa chức vụ"}]}],confirm:"Xác nhận"});
  if(yes?.confirmation!=="yes")return;
  await request("assign",{semester:V.term,mssv:key(member.mssv),memberId:member.id,title,confirmChange:true});
 }
 await refresh();notify("Đã lưu chức vụ "+title+" của "+member.name+" trong "+V.term+".");
 window.oscInvalidateMemberOffice?.();
}
async function appoint(){
 const used=new Set(V.appointments.map(a=>key(a.mssv)));
 const candidates=roster().filter(m=>!used.has(key(m.mssv)));
 if(!candidates.length)return notify("Không còn thành viên chưa bổ nhiệm hoặc Danh sách thành viên kỳ này đang trống.");
 if(!V.titles.length)return notify("Bạn cần thêm ít nhất một chức vụ trong mục Chức vụ tùy chỉnh.");
 const f=await modal({heading:"Bổ nhiệm Ban Chủ nhiệm · "+V.term,
  description:"Chọn thành viên đã có trong Danh sách thành viên. Không tạo tài khoản đăng nhập mới.",
  fields:[{name:"memberId",label:"Thành viên (MSSV)",options:candidates.map(m=>({value:m.id,label:m.name+" · "+m.mssv}))},
   {name:"title",label:"Chức vụ",options:V.titles.map(x=>({value:x,label:x}))}],
  confirm:"Lưu bổ nhiệm"});
 if(!f)return;
 const member=candidates.find(m=>m.id===f.memberId);
 if(!member)throw Error("Danh sách thành viên đã thay đổi, vui lòng làm mới.");
 await saveAppointment({member,title:f.title});
}
async function edit(mssv){
 const a=V.appointments.find(a=>key(a.mssv)===key(mssv)),member=roster().find(x=>key(x.mssv)===key(mssv));
 if(!a||!member)return notify("Không tìm thấy thành viên này trong Danh sách học kỳ.");
 const options=[...new Set([...V.titles,a.title])];
 const f=await modal({heading:"Chỉnh sửa chức vụ · "+member.name,
  description:"Chỉ sửa chức vụ của học kỳ "+V.term+", không sửa tài khoản đăng nhập.",
  fields:[{name:"title",label:"Chức vụ",options:options.map(x=>({value:x,label:x})),value:a.title}],
  confirm:"Lưu thay đổi"});
 if(f&&f.title)await saveAppointment({member,title:f.title});
}
async function remove(mssv){
 const a=V.appointments.find(a=>key(a.mssv)===key(mssv));if(!a)return;
 const f=await modal({heading:"Gỡ bổ nhiệm học kỳ "+V.term,
  description:"Gỡ "+a.name+" khỏi BCN của "+V.term+"? Thao tác không xóa thành viên, không khóa tài khoản website. Nhật ký thay đổi sẽ được lưu.",
  fields:[{name:"confirmation",label:"Xác nhận",options:[
   {value:"no",label:"Giữ nguyên"},{value:"yes",label:"Tôi xác nhận gỡ bổ nhiệm"}]}],confirm:"Xác nhận"});
 if(f?.confirmation!=="yes")return;
 await request("remove",{semester:V.term,mssv:key(mssv),confirmRemove:true});
 await refresh();notify("Đã gỡ bổ nhiệm khỏi "+V.term+", vẫn giữ hồ sơ thành viên.");
 window.oscInvalidateMemberOffice?.();
}
async function titles(){
 const f=await modal({heading:"Chức vụ · "+V.term,
  description:"Quản lý các chức vụ như Chủ tịch, Phó Chủ tịch, Thư ký… Đây là chức danh hoạt động CLB, không phải quyền hệ thống.",
  fields:[{name:"titles",label:"Danh sách, ngăn cách bằng dấu ;",value:V.titles.join("; "),max:1200}],
  confirm:"Lưu danh sách"});
 if(!f)return;
 await request("titles-set",{semester:V.term,titles:f.titles.split(";").map(x=>x.trim()).filter(Boolean)});
 await refresh();notify("Đã cập nhật danh mục chức vụ của "+V.term+".");
}
async function history(mssv){
 const data=await request("history",{mssv:key(mssv)});
 const detail=data.history.length?data.history.map(x=>x.semester+": "+x.title).join(" | "):"Chưa có lịch sử";
 const counts=Object.entries(data.titleCounts||{}).map(([t,n])=>t+" ("+n+" kỳ)").join("; ");
 const f=await modal({heading:"Lịch sử Ban Chủ nhiệm · "+mssv,
  description:"Tổng số học kỳ: "+data.semesterCount+". "+detail+". "+counts,
  fields:[{name:"close",label:"Đóng cửa sổ",options:[{value:"ok",label:"Đã xem"}]}],
  confirm:"Đóng"});
}
document.addEventListener("click",ev=>{
 const b=ev.target.closest("button[data-board]");if(!b||!root()?.contains(b))return;
 withBusy(async()=>{
  const type=b.dataset.board;
  if(type==="refresh")await refresh();
  if(type==="appoint")await appoint();
  if(type==="edit")await edit(b.dataset.mssv);
  if(type==="remove")await remove(b.dataset.mssv);
  if(type==="titles")await titles();
  if(type==="history")await history(b.dataset.mssv);
 });
});
document.addEventListener("change",ev=>{
 if(ev.target?.id==="boardTerm"&&root()?.contains(ev.target)){
  V.term=ev.target.value;V.search="";withBusy(refresh);
 }
});
document.addEventListener("input",ev=>{
 if(ev.target?.id==="boardSearch"&&root()?.contains(ev.target)){
  V.search=ev.target.value;const start=ev.target.selectionStart;
  paint();const input=document.getElementById("boardSearch");
  if(input){input.focus();input.setSelectionRange(start,start)}
 }
});
window.renderBoardDirectors=function(){
 if(!root())return;
 V.term=typeof semester!=="undefined"?String(semester):"FA26";
 V.search="";V.notice="";
 root().textContent="Đang tải Danh sách thành viên và chức vụ học kỳ…";
 withBusy(refresh);
};
})();