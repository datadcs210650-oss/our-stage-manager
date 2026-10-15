(function(){
"use strict";
// Term/position management lives in Accounts, not Google Drive.
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const chair=()=>typeof currentProfile!=="undefined"&&currentProfile?.role==="superadmin";
const manager=()=>typeof currentProfile!=="undefined"&&["superadmin","admin"].includes(currentProfile?.role);
const getTerm=()=>typeof semester!=="undefined"?String(semester):"FA26";
const state={open:false,busy:false,term:"FA26",accounts:[],titles:[],filter:"",message:"",history:null};
async function api(action,data={}){
 if(!currentFirebaseUser)throw Error("Bạn cần đăng nhập OSC.");
 const token=await currentFirebaseUser.getIdToken();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const r=await fetch("/api/operations",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
   body:JSON.stringify({action:"leadership-"+action,...data}),signal:controller.signal,cache:"no-store"});
  const v=await r.json().catch(()=>({}));
  if(!r.ok){const err=new Error(v.error||"Máy chủ chưa xử lý được yêu cầu.");err.code=v.code||"";throw err}
  return v;
 }finally{clearTimeout(timer)}
}
function notice(msg){
 state.message=String(msg||"");
 const n=$("#oscTermNotice");if(n)n.textContent=state.message;
}
async function guarded(fn){
 if(state.busy)return;
 state.busy=true;
 try{await fn()}catch(e){notice(e.message||String(e))}
 finally{state.busy=false}
}
function memberCanEdit(a){return chair()||a.role==="bcn"}
function titleOf(a){
 if(a.role==="superadmin")return"Chủ tịch";
 return a.positionSemester===state.term?a.positionTitle||"Chưa bổ nhiệm":"Chưa bổ nhiệm học kỳ này";
}
function termOptions(){
 const from=typeof window!=="undefined"&&typeof semester!=="undefined"?semester:"FA26";
 const options=[from,state.term];
 if(typeof window.oscAvailableTerms==="function")options.push(...window.oscAvailableTerms());
 return [...new Set(options.filter(s=>/^(SP|SU|FA)\d{2}$/.test(s)))].sort((a,b)=>{
  const n=x=>Number(x.slice(2))*3+({SP:0,SU:1,FA:2}[x.slice(0,2)]||0);
  return n(b)-n(a);
 });
}
function view(){
 const root=$("#accountTermRoot");
 if(!root||!state.open)return;
 const q=state.filter.trim().toLocaleLowerCase("vi");
 const rows=state.accounts.filter(a=>!q||[a.displayName,a.email,a.mssv,a.positionTitle]
  .some(v=>String(v||"").toLocaleLowerCase("vi").includes(q)));
 const titled=state.accounts.filter(a=>a.positionSemester===state.term&&a.positionTitle);
 root.innerHTML='<section class="osc-term-panel">'+
  '<header class="osc-term-head"><div><div class="osc-term-overline">OUR STAGE • BAN CHỦ NHIỆM</div>'+
  '<h2>Chức vụ & lịch sử nhiệm kỳ</h2><p>Chọn học kỳ, bổ nhiệm theo MSSV, xem lịch sử. Quyền tài khoản và chức vụ là hai thông tin riêng.</p></div>'+
  '<button type="button" class="secondary" data-term="reload">Làm mới</button></header>'+
  '<div class="osc-term-how"><div><b>1</b><span>Chọn học kỳ</span></div>'+
  '<div><b>2</b><span>Chọn tài khoản và nhập MSSV</span></div>'+
  '<div><b>3</b><span>Chọn chức vụ, nhấn Lưu</span></div></div>'+
  '<div class="osc-term-tools"><label>Học kỳ <select id="oscTermSemester">'+
  termOptions().map(x=>'<option value="'+esc(x)+'" '+(x===state.term?"selected":"")+'>'+esc(x)+'</option>').join("")+
  '</select></label><label>Tìm tài khoản <input id="oscTermFilter" value="'+esc(state.filter)+'" placeholder="Tên, MSSV, chức vụ…"></label>'+
  '<div class="osc-term-actions"><button type="button" data-term="titles">Danh sách chức vụ</button>'+
  (chair()?'<button type="button" data-term="handoff">Bàn giao Chủ tịch</button>':'')+
  '<button type="button" data-term="handoff-check">Kiểm tra bàn giao</button></div></div>'+
  '<div class="osc-term-summary"><div><small>Tài khoản quản trị</small><strong>'+state.accounts.length+'</strong></div>'+
  '<div><small>Đã có chức vụ kỳ '+esc(state.term)+'</small><strong>'+titled.length+'</strong></div>'+
  '<div><small>Chức vụ tùy chỉnh</small><strong>'+state.titles.length+'</strong></div></div>'+
  '<p id="oscTermNotice" class="osc-term-notice" role="status">'+esc(state.message)+'</p>'+
  '<div class="osc-term-list">'+rows.map(a=>'<article class="osc-term-person">'+
   '<div class="osc-term-avatar" aria-hidden="true">'+esc((a.displayName||"?").trim().slice(0,1).toLocaleUpperCase("vi"))+'</div>'+
   '<div class="osc-term-person-main"><strong>'+esc(a.displayName||a.email)+'</strong><small>'+esc(a.mssv||"Chưa có MSSV")+
   ' · '+esc(a.role==="superadmin"?"Chủ tịch":a.role==="admin"?"Admin":"BCN")+(a.active?"":" · Đã khóa")+
   '</small><span class="osc-term-position">'+esc(titleOf(a))+'</span></div>'+
   '<div class="osc-term-person-buttons"><button type="button" data-term="history" data-id="'+esc(a.uid)+'">Lịch sử</button>'+
   (memberCanEdit(a)&&a.active?'<button class="primary" type="button" data-term="assign" data-id="'+esc(a.uid)+'">'+
    (a.positionSemester===state.term?"Chỉnh chức vụ":"Bổ nhiệm")+'</button>':"")+
   '</div></article>').join("")+'</div>'+
   (!rows.length?'<div class="osc-term-empty">Không tìm thấy tài khoản phù hợp.</div>':"")+
   '<div class="osc-term-help">MSSV liên kết chức vụ với Hồ sơ thành viên cùng mã số trong học kỳ đó. Khi chuyển kỳ, dữ liệu cũ vẫn giữ nguyên, không tự bổ nhiệm cho kỳ mới.</div>'+
  '</section>';
}
function modal({heading,description="",fields=[],submit="Lưu",danger=false}){
 return new Promise(resolve=>{
  const layer=document.createElement("div");
  layer.className="osc-term-backdrop";
  layer.innerHTML='<form class="osc-term-modal" role="dialog" aria-modal="true">'+
   '<div class="osc-term-modal-title"><h3>'+esc(heading)+'</h3>'+
   '<button type="button" data-term-close aria-label="Đóng">×</button></div>'+
   '<p>'+esc(description)+'</p>'+fields.map(f=>
    '<label>'+esc(f.label)+(f.type==="select"?
     '<select name="'+esc(f.name)+'">'+(f.options||[]).map(o=>
      '<option value="'+esc(o.value)+'" '+(o.value===f.value?"selected":"")+'>'+esc(o.label)+'</option>').join("")+'</select>':
     f.type==="textarea"?'<textarea name="'+esc(f.name)+'" rows="6">'+esc(f.value||"")+'</textarea>':
     '<input name="'+esc(f.name)+'" type="'+(f.type==="email"?"email":"text")+'" maxlength="'+(f.max||80)+
     '" value="'+esc(f.value||"")+'" '+(f.required===false?"":"required")+'/>')+'</label>').join("")+
   '<div class="osc-term-modal-actions"><button type="button" data-term-close>Hủy</button>'+
   '<button type="submit" class="'+(danger?"osc-term-danger":"primary")+'">'+esc(submit)+'</button></div></form>';
  const cancel=()=>finish(null);
  const keyboard=ev=>{if(ev.key==="Escape"){ev.preventDefault();cancel()}};
  const finish=data=>{document.removeEventListener("keydown",keyboard,true);layer.remove();resolve(data)};
  layer.addEventListener("click",ev=>{if(ev.target===layer||ev.target.closest("[data-term-close]"))cancel()});
  layer.querySelector("form").addEventListener("submit",ev=>{
   ev.preventDefault();const d=Object.fromEntries(new FormData(ev.target).entries());finish(d)
  });
  document.body.appendChild(layer);
  document.addEventListener("keydown",keyboard,true);
  layer.querySelector("input,select,textarea,button")?.focus();
 });
}
async function reload(){
 if(!manager())return;
 const [a,b]=await Promise.all([api("list"),api("titles-get",{semester:state.term})]);
 state.accounts=a.accounts||[];state.titles=b.titles||[];view();
}
async function assign(uid){
 const a=state.accounts.find(x=>x.uid===uid);
 if(!a||!memberCanEdit(a))return notice("Không đủ quyền bổ nhiệm tài khoản này.");
 const values=[...state.titles,...(a.positionTitle?[a.positionTitle]:[])];
 const unique=[...new Set(values)].filter(Boolean);
 const result=await modal({
  heading:"Bổ nhiệm • "+(a.displayName||a.email),
  description:"Chức vụ được lưu riêng cho "+state.term+". MSSV phải trùng mã trong Hồ sơ thành viên.",
  fields:[
   {name:"mssv",label:"Mã số sinh viên (MSSV)",value:a.mssv||"",max:25},
   {name:"positionTitle",label:"Chức vụ",type:"select",value:a.positionSemester===state.term?a.positionTitle:"",
    options:[{value:"",label:"Chọn chức vụ…"},...unique.map(t=>({value:t,label:t}))]},
  ],submit:"Lưu chức vụ"
 });
 if(!result)return;
 if(!result.positionTitle)return notice("Hãy chọn chức vụ. Nếu chưa có, nhấn Danh sách chức vụ để thêm.");
 async function save(confirmed){return api("assign",{uid,semester:state.term,mssv:result.mssv,
  positionTitle:result.positionTitle,confirmHistoryChange:confirmed})}
 try{await save(false)}catch(err){
  if(err.code!=="osc/position-confirm")throw err;
  const ok=await modal({heading:"Xác nhận sửa lịch sử học kỳ",
   description:"Chức vụ kỳ "+state.term+" đã được lưu trước đó. Sửa đổi này được ghi nhật ký. Bạn có muốn tiếp tục?",
   fields:[{name:"decision",label:"Lựa chọn",type:"select",value:"cancel",options:[
    {value:"cancel",label:"Hủy, giữ dữ liệu cũ"},{value:"yes",label:"Tôi xác nhận sửa"}]}],submit:"Tiếp tục"});
  if(ok?.decision!=="yes")return;await save(true)
 }
 await reload();notice("Đã lưu chức vụ "+state.term+" cho "+(a.displayName||a.email)+". Hồ sơ thành viên sẽ tự hiển thị khi mở.");
 if(typeof window.oscInvalidateMemberOffice==="function")window.oscInvalidateMemberOffice();
}
async function titles(){
 const result=await modal({heading:"Danh mục chức vụ • "+state.term,
  description:"Mỗi dòng là một chức vụ. Không thay đổi quyền đăng nhập. Ví dụ: Phó Chủ tịch, Thư ký, Trưởng ban…",
  fields:[{name:"titles",label:"Chức vụ (mỗi dòng một tên)",type:"textarea",value:state.titles.join("\n")}],
  submit:"Lưu danh mục"});
 if(!result)return;
 const names=result.titles.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 await api("titles-set",{semester:state.term,titles:names});
 await reload();notice("Danh sách chức vụ kỳ "+state.term+" đã được cập nhật.");
}
async function history(uid){
 const a=state.accounts.find(x=>x.uid===uid);if(!a)return;
 const data=await api("history",{uid});
 const counts=Object.entries(data.titleCounts||{}).map(([k,n])=>k+" • "+n+" kỳ").join("\n")||"Chưa có chức vụ.";
 await modal({heading:"Lịch sử nhiệm kỳ • "+(a.displayName||a.email),
  description:"MSSV: "+(data.mssv||"Chưa có")+"\nĐã giữ chức vụ "+data.semesterCount+" học kỳ.\n\n"+
  (data.semesters||[]).map(x=>x.semester+" — "+x.positionTitle).join("\n")+
  "\n\nThống kê: "+counts,
  fields:[{name:"action",type:"select",label:"Xem lịch sử",options:[{value:"ok",label:"Đóng cửa sổ"}]}],
  submit:"Đóng"});
}
async function handoff(){
 if(!chair())return notice("Chỉ Chủ tịch mới có quyền bàn giao.");
 const candidates=state.accounts.filter(a=>a.active&&a.role!=="superadmin");
 if(!candidates.length)return notice("Không có tài khoản đủ điều kiện nhận quyền.");
 const form=await modal({heading:"Bàn giao quyền Chủ tịch",
  description:"Không chuyển file Google Drive. Người nhận phải xác minh email và đăng nhập lại gần đây để xác nhận.",
  fields:[
   {name:"uid",label:"Người kế nhiệm",type:"select",options:candidates.map(a=>({value:a.uid,label:a.displayName+" · "+a.email}))},
   {name:"previousRole",label:"Quyền của bạn sau bàn giao",type:"select",
    options:[{value:"admin",label:"Admin"},{value:"bcn",label:"BCN"}]},
   {name:"confirm",label:"Xác nhận tạo đề nghị",type:"select",options:[
    {value:"no",label:"Chưa tạo đề nghị"},{value:"yes",label:"Tôi hiểu và xác nhận"}]}
  ],submit:"Tiếp tục"});
 if(form?.confirm!=="yes")return;
 await api("handoff-start",{uid:form.uid,semester:state.term,previousRole:form.previousRole});
 notice("Đã tạo đề nghị bàn giao. Người kế nhiệm cần xác nhận trong 30 phút.");
}
async function checkHandoff(){
 const response=await api("handoff-status");
 const p=response.pending;
 if(!p)return notice("Không có đề nghị nào đang chờ.");
 if(!currentFirebaseUser||currentFirebaseUser.uid!==p.toUid)
  return notice("Đã gửi đề nghị cho người kế nhiệm. Đang chờ họ xác nhận.");
 const ok=await modal({heading:"Bạn được đề nghị nhận quyền Chủ tịch",
  description:"Học kỳ "+p.semester+". Xác nhận sẽ thay đổi quyền quản trị OSC và yêu cầu bạn đăng nhập lại.",
  fields:[{name:"decision",label:"Xác nhận tiếp nhận",type:"select",options:[
   {value:"no",label:"Chưa nhận quyền"},{value:"yes",label:"Tôi đồng ý nhận quyền Chủ tịch"}]}],
  submit:"Tiếp tục"});
 if(ok?.decision!=="yes")return;
 const v=await api("handoff-accept");
 notice(v.requiresRelogin?"Đã bàn giao. Vui lòng đăng xuất và đăng nhập lại.":"Đã xử lý.");
}
function show(open){
 state.open=!!open;
 const panel=$("#accountTermRoot"),table=$("#accounts .accounts-table"),
 btn=$("#leadershipMgmtBtn");
 if(panel)panel.classList.toggle("hidden",!state.open);
 if(table)table.classList.toggle("hidden",state.open);
 if(btn)btn.textContent=state.open?"← Danh sách tài khoản":"Chức vụ & nhiệm kỳ";
 if(state.open){state.term=getTerm();reload().catch(e=>notice(e.message));}
 else if(typeof renderAccounts==="function")renderAccounts();
}
document.addEventListener("click",ev=>{
 const b=ev.target.closest("[data-term]");if(!b||!$("#accountTermRoot")?.contains(b))return;
 guarded(async()=>{
  const action=b.dataset.term;
  if(action==="reload")await reload();
  else if(action==="assign")await assign(b.dataset.id);
  else if(action==="titles")await titles();
  else if(action==="history")await history(b.dataset.id);
  else if(action==="handoff")await handoff();
  else if(action==="handoff-check")await checkHandoff();
 });
});
document.addEventListener("change",ev=>{
 if(ev.target?.id==="oscTermSemester"){state.term=ev.target.value;guarded(reload)}
});
document.addEventListener("input",ev=>{
 if(ev.target?.id==="oscTermFilter"){
  const start=ev.target.selectionStart;
  state.filter=ev.target.value;
  view();const input=$("#oscTermFilter");input?.focus();input?.setSelectionRange(start,start);
 }
});
window.openAccountTerms=()=>show(!state.open);
window.renderAccountTerms=()=>{
 if(state.open){state.term=getTerm();guarded(reload)}
};
})();