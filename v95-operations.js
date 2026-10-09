/* OUR STAGE V95 — Operations Center + Live Event Control */
(()=>{
"use strict";

const q=s=>document.querySelector(s);
const esc95=v=>typeof esc==="function"?esc(v):String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let opRooms=[],opVotes=[],opTemp=[],opQuota=null,opLoading=false;
let controlTimer=null,controlEventId="",controlData=null;

async function api(path,body={},timeout=20000){
  if(!currentFirebaseUser)throw new Error("Bạn chưa đăng nhập.");
  const token=await currentFirebaseUser.getIdToken(),c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body),cache:"no-store",signal:c.signal});
    const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||`API lỗi ${r.status}`);e.code=d.code||"";throw e}return d
  }finally{clearTimeout(t)}
}
function fmt(ms){if(!ms)return"—";try{return new Date(ms).toLocaleString("vi-VN")}catch{return"—"}}
function dtLocal(ms){if(!ms)return"";const d=new Date(ms),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function selectedEventOptions(){
  return (state?.events||[]).filter(e=>e.semester===semester).map(e=>`<option value="${esc95(e.id)}">${esc95(e.title||"Sự kiện")}</option>`).join("");
}
function operationsShell(){
  const canManage=typeof canEditClub==="function"&&canEditClub(),canRoom=canManage||(typeof canEditModule==="function"&&canEditModule("events"));
  return `<div class="v95-hero"><div><div class="eyebrow">OPERATIONS CENTER • V95</div><h2>Điều hành nâng cao</h2><p>Đặt phòng, bỏ phiếu ẩn danh, quyền tạm thời và theo dõi quota Firebase trong một nơi.</p></div><button class="secondary" onclick="v95RefreshOperations()">↻ Làm mới</button></div>
  <div class="v95-grid">
    <section class="v95-card v95-span-2"><div class="v95-card-head"><div><h3>Room Booking Board</h3><p>Chặn trùng phòng theo thời gian ngay tại server.</p></div></div>
      ${canRoom?`<div class="v95-room-form">
        <label>Phòng<input id="v95RoomName" maxlength="100" placeholder="VD: G405"></label>
        <label>Mục đích<input id="v95RoomPurpose" maxlength="240" placeholder="Tập kịch / họp BCN"></label>
        <label>Bắt đầu<input id="v95RoomStart" type="datetime-local"></label>
        <label>Kết thúc<input id="v95RoomEnd" type="datetime-local"></label>
        <label>Sự kiện liên quan<select id="v95RoomEvent"><option value="">Không gắn sự kiện</option>${selectedEventOptions()}</select></label>
        <button class="primary" onclick="v95CreateRoom()">Đặt phòng</button>
      </div>`:""}
      <div id="v95RoomList" class="v95-list"></div>
    </section>
    <section class="v95-card v95-span-2"><div class="v95-card-head"><div><h3>Voting System • Ẩn danh</h3><p>Mỗi tài khoản chỉ bỏ được một phiếu; ballot chỉ lưu hash ẩn danh.</p></div>${canManage?'<button class="primary" onclick="v95OpenVoteCreate()">+ Tạo bình chọn</button>':""}</div><div id="v95VoteList" class="v95-list"></div></section>
    ${canManage?`<section class="v95-card"><div class="v95-card-head"><div><h3>Temporary Permissions</h3><p>Cấp quyền BCN tự hết hạn theo giờ kết thúc sự kiện.</p></div><button class="primary" onclick="v95OpenTempGrant()">+ Cấp quyền</button></div><div id="v95TempList" class="v95-list compact"></div></section>
    <section class="v95-card"><div class="v95-card-head"><div><h3>Firebase Quota hôm nay</h3><p>Đọc số liệu qua Google Cloud Monitoring.</p></div><button class="secondary" onclick="v95LoadQuota()">↻</button></div><div id="v95Quota"></div></section>`:""}
  </div>`;
}
async function renderV95Operations(){
  const root=q("#v95OperationsRoot");if(!root)return;
  root.innerHTML=operationsShell();
  await v95RefreshOperations(false);
}
window.renderV95Operations=renderV95Operations;

async function v95RefreshOperations(show=true){
  if(opLoading)return;opLoading=true;
  try{
    const calls=[api("/api/operations",{action:"rooms-list",semester}),api("/api/operations",{action:"votes-list",semester})];
    if(canEditClub())calls.push(api("/api/operations",{action:"temp-list"}));
    const r=await Promise.all(calls);opRooms=r[0].rows||[];opVotes=r[1].rows||[];if(canEditClub())opTemp=r[2].rows||[];
    renderRooms();renderVotes();if(canEditClub()){renderTemp();await v95LoadQuota(false)}
    if(show&&typeof toast==="function")toast("Đã cập nhật Điều hành nâng cao");
  }catch(e){console.error("v95 operations",e);if(show)alert("Không tải được Điều hành nâng cao: "+(e.message||e))}
  finally{opLoading=false}
}
window.v95RefreshOperations=v95RefreshOperations;

function renderRooms(){
  const root=q("#v95RoomList");if(!root)return;
  const rows=opRooms.filter(x=>x.endAt>Date.now()-12*60*60*1000);
  root.innerHTML=rows.length?rows.map(x=>`<div class="v95-list-row"><div><b>${esc95(x.roomName)}</b><span>${esc95(x.purpose)}</span><small>${fmt(x.startAt)} → ${fmt(x.endAt)}${x.createdByName?" • "+esc95(x.createdByName):""}</small></div>${(canEditClub()||canEditModule("events"))?`<button class="danger" onclick="v95CancelRoom('${esc95(x.id)}')">Hủy</button>`:""}</div>`).join(""):'<div class="empty">Chưa có lịch phòng sắp tới.</div>';
}
async function v95CreateRoom(){
  try{
    const roomName=q("#v95RoomName")?.value.trim(),purpose=q("#v95RoomPurpose")?.value.trim(),startAt=q("#v95RoomStart")?.value,endAt=q("#v95RoomEnd")?.value,eventId=q("#v95RoomEvent")?.value||"";
    if(!roomName||!purpose||!startAt||!endAt)return alert("Hãy nhập đầy đủ phòng, mục đích và thời gian.");
    await api("/api/operations",{action:"room-create",semester,roomName,purpose,startAt:new Date(startAt).toISOString(),endAt:new Date(endAt).toISOString(),eventId});
    toast("Đã đặt phòng");await v95RefreshOperations(false);
  }catch(e){alert("Không đặt được phòng: "+(e.message||e))}
}
window.v95CreateRoom=v95CreateRoom;
async function v95CancelRoom(id){if(!confirm("Hủy lịch đặt phòng này?"))return;try{await api("/api/operations",{action:"room-cancel",bookingId:id});toast("Đã hủy lịch phòng");await v95RefreshOperations(false)}catch(e){alert(e.message||e)}}
window.v95CancelRoom=v95CancelRoom;

function renderVotes(){
  const root=q("#v95VoteList");if(!root)return;
  root.innerHTML=opVotes.length?opVotes.map(p=>`<div class="v95-poll"><div class="v95-poll-head"><div><b>${esc95(p.title)}</b><small>${p.open?"Đang mở":"Đã đóng"} • đóng ${fmt(p.closesAt)}</small></div>${canEditClub()&&p.open?`<button class="danger" onclick="v95CloseVote('${p.id}')">Đóng</button>`:""}</div>${p.description?`<p>${esc95(p.description)}</p>`:""}
    ${p.resultsVisible?pollResults(p):p.hasVoted?'<div class="v95-voted">✓ Bạn đã bỏ phiếu. Kết quả được ẩn cho đến khi đóng bình chọn.</div>':`<div class="v95-vote-options">${p.options.map((o,i)=>`<label><input type="radio" name="vote_${p.id}" value="${i}"> ${esc95(o)}</label>`).join("")}</div><button class="primary" onclick="v95CastVote('${p.id}')">Bỏ phiếu</button>`}</div>`).join(""):'<div class="empty">Chưa có bình chọn trong học kỳ.</div>';
}
function pollResults(p){
  const total=Math.max(1,Number(p.totalVotes||0));return `<div class="v95-results">${p.options.map((o,i)=>{const n=Number(p.counts?.[i]||0),pct=Math.round(n/total*100);return `<div><span>${esc95(o)} <b>${n}</b></span><div class="v95-bar"><i style="width:${pct}%"></i></div></div>`}).join("")}</div><small>Tổng ${Number(p.totalVotes||0)} phiếu ẩn danh</small>`;
}
async function v95CastVote(id){const pick=q(`input[name="vote_${CSS.escape(id)}"]:checked`);if(!pick)return alert("Hãy chọn một phương án.");try{await api("/api/operations",{action:"vote-cast",pollId:id,optionIndex:Number(pick.value)});toast("Đã ghi nhận phiếu ẩn danh");await v95RefreshOperations(false)}catch(e){alert(e.message||e)}}
window.v95CastVote=v95CastVote;
async function v95CloseVote(id){if(!confirm("Đóng bình chọn? Sau khi đóng sẽ hiển thị kết quả."))return;try{await api("/api/operations",{action:"vote-close",pollId:id});await v95RefreshOperations(false)}catch(e){alert(e.message||e)}}
window.v95CloseVote=v95CloseVote;
function v95OpenVoteCreate(){
  const defaultClose=dtLocal(Date.now()+24*60*60*1000);
  q("#modalWrap").innerHTML=`<div class="overlay"><div class="modal" style="width:min(720px,100%)"><div class="modal-head"><div><h2>Tạo bình chọn ẩn danh</h2><div class="small-help">Không lưu UID/email trong ballot.</div></div><button onclick="closeModal()">×</button></div><div class="form-grid">
    <label>Tiêu đề<input id="v95VoteTitle" maxlength="180"></label><label>Đóng lúc<input id="v95VoteClose" type="datetime-local" value="${defaultClose}"></label>
    <label class="full">Mô tả<textarea id="v95VoteDesc" rows="3"></textarea></label><label class="full">Các lựa chọn<textarea id="v95VoteOptions" rows="5" placeholder="Mỗi dòng một lựa chọn"></textarea></label>
  </div><div class="modal-actions"><button class="ghost" onclick="closeModal()">Hủy</button><button class="primary" onclick="v95CreateVote()">Tạo bình chọn</button></div></div></div>`;q("#modalWrap").classList.remove("hidden");if(typeof syncModalBodyState==="function")syncModalBodyState();
}
window.v95OpenVoteCreate=v95OpenVoteCreate;
async function v95CreateVote(){try{const title=q("#v95VoteTitle")?.value.trim(),description=q("#v95VoteDesc")?.value.trim(),closesAt=q("#v95VoteClose")?.value,options=(q("#v95VoteOptions")?.value||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);await api("/api/operations",{action:"vote-create",semester,title,description,closesAt:new Date(closesAt).toISOString(),options});closeModal();toast("Đã tạo bình chọn");await v95RefreshOperations(false)}catch(e){alert(e.message||e)}}
window.v95CreateVote=v95CreateVote;

function renderTemp(){
  const root=q("#v95TempList");if(!root)return;
  const active=opTemp.filter(x=>x.temporaryPermissions?.active);
  root.innerHTML=active.length?active.map(x=>`<div class="v95-list-row"><div><b>${esc95(x.displayName||x.email)}</b><span>${esc95(x.temporaryPermissions.label||"Quyền tạm thời")}</span><small>Hết hạn ${fmt(x.temporaryPermissions.expiresAt)}</small></div><button class="danger" onclick="v95ClearTemp('${x.uid}')">Thu hồi</button></div>`).join(""):'<div class="empty">Không có quyền tạm thời đang hoạt động.</div>';
}
function permissionChecks(){
  const rows=[["Attendance","Điểm danh"],["Members","Thành viên"],["Finance","Thu chi"],["Events","Cổng sự kiện"]];
  return rows.map(([k,l])=>`<div class="v95-perm-row"><b>${l}</b><label><input type="checkbox" data-v95-perm="view${k}"> Xem</label><label><input type="checkbox" data-v95-perm="edit${k}" onchange="if(this.checked)this.closest('.v95-perm-row').querySelector('[data-v95-perm=view${k}]').checked=true"> Sửa</label></div>`).join("")+`<div class="v95-perm-row"><b>Tra cứu</b><label><input type="checkbox" data-v95-perm="viewLookup"> Xem</label></div>`;
}
function v95OpenTempGrant(){
  const users=opTemp.filter(x=>x.active&&x.role==="bcn"),events=(state.events||[]).filter(e=>e.semester===semester);
  q("#modalWrap").innerHTML=`<div class="overlay"><div class="modal" style="width:min(760px,100%)"><div class="modal-head"><div><h2>Cấp quyền tạm thời</h2><div class="small-help">Quyền tự vô hiệu khi hết hạn; không cần cron.</div></div><button onclick="closeModal()">×</button></div><div class="form-grid">
    <label>BCN<select id="v95TempUser">${users.map(x=>`<option value="${x.uid}">${esc95(x.displayName||x.email)}</option>`).join("")}</select></label>
    <label>Sự kiện<select id="v95TempEvent" onchange="v95TempEventChanged()"><option value="">Không gắn sự kiện</option>${events.map(e=>`<option value="${e.id}">${esc95(e.title)}</option>`).join("")}</select></label>
    <label>Hết hạn<input id="v95TempExpires" type="datetime-local"></label><label>Nhãn quyền<input id="v95TempLabel" value="Hỗ trợ sự kiện" maxlength="120"></label>
  </div><div class="v95-permissions">${permissionChecks()}</div><div class="modal-actions"><button class="ghost" onclick="closeModal()">Hủy</button><button class="primary" onclick="v95SaveTemp()">Cấp quyền</button></div></div></div>`;
  q("#modalWrap").classList.remove("hidden");if(typeof syncModalBodyState==="function")syncModalBodyState();
}
window.v95OpenTempGrant=v95OpenTempGrant;
function v95TempEventChanged(){const id=q("#v95TempEvent")?.value,e=(state.events||[]).find(x=>x.id===id);if(e?.closeAt){const ms=e.closeAt?.toMillis?.()||e.closeAt?.toDate?.()?.getTime?.()||new Date(e.closeAt).getTime();if(ms>Date.now())q("#v95TempExpires").value=dtLocal(ms)}}
window.v95TempEventChanged=v95TempEventChanged;
async function v95SaveTemp(){try{const permissions={};document.querySelectorAll("[data-v95-perm]").forEach(x=>permissions[x.dataset.v95Perm]=x.checked);const uid=q("#v95TempUser")?.value,eventId=q("#v95TempEvent")?.value||"",label=q("#v95TempLabel")?.value||"",value=q("#v95TempExpires")?.value;if(!value)return alert("Hãy chọn thời gian hết hạn.");await api("/api/operations",{action:"temp-set",uid,eventId,label,expiresAt:new Date(value).toISOString(),permissions});closeModal();toast("Đã cấp quyền tạm thời");await v95RefreshOperations(false)}catch(e){alert(e.message||e)}}
window.v95SaveTemp=v95SaveTemp;
async function v95ClearTemp(uid){if(!confirm("Thu hồi quyền tạm thời ngay?"))return;try{await api("/api/operations",{action:"temp-clear",uid});toast("Đã thu hồi quyền");await v95RefreshOperations(false)}catch(e){alert(e.message||e)}}
window.v95ClearTemp=v95ClearTemp;

async function v95LoadQuota(show=true){
  const root=q("#v95Quota");if(!root||!canEditClub())return;if(show)root.innerHTML='<div class="small-help">Đang tải số liệu Cloud Monitoring…</div>';
  try{opQuota=await api("/api/firebase-quota",{});renderQuota()}catch(e){root.innerHTML=`<div class="v95-warning">${esc95(e.message||e)}</div>`}
}
window.v95LoadQuota=v95LoadQuota;
function renderQuota(){
  const root=q("#v95Quota");if(!root||!opQuota)return;
  if(!opQuota.available){root.innerHTML=`<div class="v95-warning"><b>Chưa đọc được quota tự động</b><span>${esc95(opQuota.error||"Cloud Monitoring chưa khả dụng.")}</span><small>Giới hạn tham chiếu: Reads 50.000 • Writes 20.000 • Deletes 20.000/ngày.</small></div>`;return}
  const labels={reads:"Reads",writes:"Writes",deletes:"Deletes"};
  root.innerHTML=`<div class="v95-quota-grid">${Object.entries(opQuota.quota||{}).map(([k,x])=>`<div><span>${labels[k]||k}</span><b>${Number(x.remaining||0).toLocaleString("vi-VN")} còn lại</b><small>${Number(x.used||0).toLocaleString("vi-VN")} / ${Number(x.limit||0).toLocaleString("vi-VN")} đã dùng</small><div class="v95-bar"><i style="width:${Number(x.percent||0)}%"></i></div></div>`).join("")}</div><div class="small-help" style="margin-top:9px">Cloud Monitoring có thể trễ vài phút • reset theo Pacific Time.</div>`;
}

/* ===== Live Event Control ===== */
async function openV95EventControl(eventId){
  controlEventId=eventId;clearInterval(controlTimer);controlTimer=null;
  q("#modalWrap").innerHTML=`<div class="overlay"><div class="modal v95-control-modal"><div class="modal-head"><div><h2>Live Event Control</h2><div id="v95ControlSubtitle" class="small-help">Đang tải sơ đồ & check-in…</div></div><button onclick="v95CloseControl()">×</button></div><div id="v95ControlBody"><div class="empty">Đang tải…</div></div></div></div>`;
  q("#modalWrap").classList.remove("hidden");if(typeof syncModalBodyState==="function")syncModalBodyState();
  await refreshControl();
  controlTimer=setInterval(()=>{if(!document.querySelector(".v95-control-modal")){clearInterval(controlTimer);controlTimer=null;return}refreshControl(true).catch(()=>{})},5000);
}
window.openV95EventControl=openV95EventControl;
function v95CloseControl(){clearInterval(controlTimer);controlTimer=null;controlEventId="";controlData=null;if(typeof closeModal==="function")closeModal();else q("#modalWrap").classList.add("hidden")}
window.v95CloseControl=v95CloseControl;
async function refreshControl(silent=false){
  if(!controlEventId)return;
  try{const d=await api("/api/event-control",{action:"admin-live",eventId:controlEventId},25000);if(controlEventId!==d.event.id)return;controlData=d;renderControl()}catch(e){if(!silent){const body=q("#v95ControlBody");if(body)body.innerHTML=`<div class="v95-warning">${esc95(e.message||e)}</div>`}}
}
window.v95RefreshControl=()=>refreshControl(false);
function audienceName(v){return({public:"Công khai",vip:"VIP",bcn:"BCN",guest:"Khách mời",artist:"Nghệ sĩ",sponsor:"Nhà tài trợ",media:"Media"})[v]||"Dành riêng"}
function timelineSvg(rows){
  const data=(rows||[]).slice(-80);if(!data.length)return'<div class="empty">Chưa có lượt check-in.</div>';
  const w=760,h=180,p=28,max=Math.max(1,...data.map(x=>x.count)),step=data.length>1?(w-p*2)/(data.length-1):0;
  const pts=data.map((x,i)=>`${p+i*step},${h-p-(x.count/max)*(h-p*2)}`).join(" ");
  return `<svg class="v95-timeline-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Biểu đồ check-in theo phút"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"></line><polyline points="${pts}"></polyline>${data.map((x,i)=>{const cx=p+i*step,cy=h-p-(x.count/max)*(h-p*2);return `<circle cx="${cx}" cy="${cy}" r="3"><title>${new Date(x.minute).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}: ${x.count} lượt</title></circle>`}).join("")}</svg><div class="small-help">Mỗi điểm = số lượt check-in trong một phút • tự làm mới 5 giây/lần.</div>`;
}
function renderControl(){
  const d=controlData;if(!d)return;const body=q("#v95ControlBody"),sub=q("#v95ControlSubtitle");if(!body)return;if(sub)sub.textContent=`${d.event.title} • ${d.event.semester}`;
  const c=d.counts||{},cap=d.event.capacity>0?`${d.event.capacityUsed}/${d.event.capacity}`:"Không giới hạn";
  body.innerHTML=`<div class="v95-live-stats"><div><b>${c.soldTotal||0}</b><span>Đã cấp / bán</span></div><div><b>${c.checked_in||0}</b><span>Đã check-in</span></div><div><b>${c.not_arrived||0}</b><span>Đã chọn • chưa đến</span></div><div><b>${c.free||0}</b><span>Ghế trống public</span></div><div><b>${c.reserved||0}</b><span>Ghế dành riêng</span></div><div><b>${cap}</b><span>Capacity</span></div></div>
  <div class="v95-control-grid"><section><div class="v95-card-head"><div><h3>Live Occupancy Map</h3><p>Hiển thị cả ghế chọn từ form và ghế đã phát hành trong Ticket Studio.</p></div><button class="secondary" onclick="v95RefreshControl()">↻</button></div><div class="v95-legend"><span class="free">Trống</span><span class="reserved">Dành riêng</span><span class="sold">Đã bán/cấp vé</span><span class="not_arrived">Đã chọn • chưa đến</span><span class="checked_in">Đã check-in</span></div>${controlMap(d)}</section><section><h3>Check-in Timeline</h3>${timelineSvg(d.timeline||[])}</section></div>
  <div id="v95AssignPanel" class="v95-assign-panel hidden"></div>`;
}
function controlMap(d){
  const seats=Array.isArray(d.seats)?d.seats:[],cfg=d.seating||{};
  return `<div class="v95-occ-map">${(cfg.sections||[]).map(sec=>{const sectionSeats=seats.filter(s=>s.sectionId===sec.id),rows=[...new Set(sectionSeats.map(s=>s.row))];return `<div class="v95-occ-section"><div><b>${esc95(sec.name)}</b><small>${audienceName(sec.audience)}</small></div>${rows.map(row=>`<div class="v95-occ-row"><span>${esc95(row)}</span><div>${sectionSeats.filter(s=>s.row===row).map(s=>`<button class="${s.status}" title="${esc95(s.label)} • ${s.status}" ${d.canAssign&&s.status==="reserved"?`onclick="v95ShowAssign('${s.id}','${esc95(s.label)}')"`:""}>${esc95(s.number)}</button>`).join("")}</div></div>`).join("")}</div>`}).join("")}</div>`;
}
function v95ShowAssign(seatId,label){
  if(!controlData?.canAssign)return;const panel=q("#v95AssignPanel");if(!panel)return;
  const list=(controlData.submissions||[]).filter(x=>!x.seatId);
  panel.classList.remove("hidden");panel.innerHTML=`<div><b>Cấp ghế ${esc95(label)}</b><span>Chọn người đăng ký để Admin cấp ghế dành riêng.</span></div><select id="v95AssignSubmission"><option value="">-- Chọn người --</option>${list.map(x=>`<option value="${x.id}">${esc95(x.label)}${x.mssv?" • "+esc95(x.mssv):""}</option>`).join("")}</select><button class="primary" onclick="v95AssignSeat('${seatId}')">Cấp ghế</button><button class="ghost" onclick="this.parentElement.classList.add('hidden')">Hủy</button>`;
}
window.v95ShowAssign=v95ShowAssign;
async function v95AssignSeat(seatId){const submissionId=q("#v95AssignSubmission")?.value;if(!submissionId)return alert("Hãy chọn người đăng ký.");try{await api("/api/event-seating",{action:"admin-assign-seat",eventId:controlEventId,submissionId,seatId});toast("Đã cấp ghế dành riêng");await refreshControl()}catch(e){alert("Không cấp được ghế: "+(e.message||e))}}
window.v95AssignSeat=v95AssignSeat;

const style=document.createElement("style");
style.textContent=`
.v95-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.v95-hero h2{margin:4px 0}.v95-hero p,.v95-card p{margin:4px 0;color:#68727b;font-size:12px}
.v95-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.v95-card{border:1px solid #e7e1e3;border-radius:16px;background:#fff;padding:16px}.v95-span-2{grid-column:span 2}.v95-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}.v95-card h3{margin:0}
.v95-room-form{display:grid;grid-template-columns:repeat(5,minmax(0,1fr)) auto;gap:8px;align-items:end;margin-bottom:12px}.v95-room-form label{font-size:11px;font-weight:800}.v95-room-form input,.v95-room-form select{width:100%}
.v95-list{display:grid;gap:8px}.v95-list-row,.v95-poll{border:1px solid #eee7e9;border-radius:12px;padding:10px 12px;background:#fff}.v95-list-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.v95-list-row>div{display:grid;gap:2px}.v95-list-row span,.v95-list-row small,.v95-poll small{font-size:11px;color:#6f777e}
.v95-poll-head{display:flex;justify-content:space-between;gap:10px}.v95-poll-head>div{display:grid}.v95-vote-options{display:grid;gap:6px;margin:10px 0}.v95-voted{margin:10px 0;padding:10px;border-radius:10px;background:#eef8f3;color:#176444}
.v95-results{display:grid;gap:8px;margin:10px 0}.v95-results>div>span{display:flex;justify-content:space-between;font-size:11px}.v95-bar{height:7px;border-radius:999px;background:#eee;overflow:hidden;margin-top:4px}.v95-bar i{display:block;height:100%;background:currentColor;border-radius:inherit}
.v95-permissions{display:grid;gap:7px;margin-top:12px}.v95-perm-row{display:grid;grid-template-columns:1fr auto auto;gap:14px;padding:9px 10px;border:1px solid #eee;border-radius:10px}.v95-perm-row label{font-size:11px}
.v95-warning{display:grid;gap:5px;padding:12px;border:1px solid #f0d4d9;background:#fff7f8;border-radius:12px;color:#812c43}.v95-warning span,.v95-warning small{font-size:11px}
.v95-quota-grid{display:grid;gap:12px}.v95-quota-grid>div{display:grid;gap:3px}.v95-quota-grid span,.v95-quota-grid small{font-size:11px;color:#68727b}.v95-quota-grid b{font-size:15px}
.v95-control-modal{width:min(1180px,calc(100vw - 24px));max-height:92vh;overflow:auto}.v95-live-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin-bottom:14px}.v95-live-stats>div{border:1px solid #ece5e7;border-radius:12px;padding:11px;display:grid}.v95-live-stats b{font-size:22px}.v95-live-stats span{font-size:10px;color:#68727b}
.v95-control-grid{display:grid;grid-template-columns:1.35fr .8fr;gap:14px}.v95-control-grid>section{border:1px solid #ece5e7;border-radius:14px;padding:13px}.v95-control-grid h3{margin:0 0 10px}
.v95-legend{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}.v95-legend span{font-size:10px;padding:4px 7px;border-radius:999px;border:1px solid #ddd}.v95-legend .free{background:#fff}.v95-legend .reserved{background:#f4e8ec}.v95-legend .sold{background:#eef2fb}.v95-legend .not_arrived{background:#fff4d8}.v95-legend .checked_in{background:#e8f7ef}
.v95-occ-map{display:grid;gap:12px;overflow:auto;max-height:520px}.v95-occ-section{border:1px solid #eee;border-radius:11px;padding:9px}.v95-occ-section>div:first-child{display:flex;justify-content:space-between}.v95-occ-section small{font-size:9px}.v95-occ-row{display:grid;grid-template-columns:28px 1fr;gap:6px;align-items:center;margin-top:5px}.v95-occ-row>span{font-size:10px;font-weight:900}.v95-occ-row>div{display:flex;gap:3px;flex-wrap:wrap}.v95-occ-row button{width:26px;height:26px;padding:0;border-radius:6px;font-size:9px;box-shadow:none}.v95-occ-row button.free{background:#fff;color:#333;border:1px solid #ddd}.v95-occ-row button.reserved{background:#f4e8ec;color:#773046;border:1px dashed #bd6a85}.v95-occ-row button.sold{background:#eef2fb;color:#294b86}.v95-occ-row button.not_arrived{background:#fff4d8;color:#785f1e}.v95-occ-row button.checked_in{background:#e8f7ef;color:#176444}
.v95-timeline-svg{width:100%;height:auto;background:#fbfbfc;border-radius:10px}.v95-timeline-svg line{stroke:#cfd3d6;stroke-width:1}.v95-timeline-svg polyline{fill:none;stroke:currentColor;stroke-width:2}.v95-timeline-svg circle{fill:currentColor}
.v95-assign-panel{display:grid;grid-template-columns:1fr minmax(220px,1fr) auto auto;gap:8px;align-items:end;border:1px solid #e5d5da;background:#fff9fb;border-radius:12px;padding:12px;margin-top:12px}.v95-assign-panel>div{display:grid}.v95-assign-panel span{font-size:10px;color:#6f777e}
@media(max-width:900px){.v95-grid,.v95-control-grid{grid-template-columns:1fr}.v95-span-2{grid-column:auto}.v95-room-form{grid-template-columns:1fr 1fr}.v95-live-stats{grid-template-columns:repeat(2,1fr)}.v95-assign-panel{grid-template-columns:1fr}.v95-control-modal{width:calc(100vw - 14px)}}
`;
document.head.appendChild(style);
})();