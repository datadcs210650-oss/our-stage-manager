/* OSC V98 - Room Booking. Timezone: Asia/Ho_Chi_Minh. */
(function(){
"use strict";
var DAY=86400000, HOUR=3600000, TZ=7*HOUR;
var weekdays=["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"];
var data={week:0,rows:[],history:[],cursor:null,more:false,loadedHistory:false,tab:"week",day:"",busy:false,historyBusy:false};
function el(s){return document.querySelector(s)}
function safe(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function pad(n){return String(n).padStart(2,"0")}
function vnParts(ms){var parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms));function v(k){var x=parts.find(function(p){return p.type===k});return Number(x?x.value:0)}return {y:v("year"),m:v("month"),d:v("day"),h:v("hour"),min:v("minute")}}
function vnKey(ms){var d=vnParts(ms);return d.y+"-"+pad(d.m)+"-"+pad(d.d)}
function startDay(ms){var d=vnParts(ms);return Date.UTC(d.y,d.m-1,d.d)-TZ}
function monday(ms){var t=startDay(ms),day=new Date(t+TZ).getUTCDay();return t-((day+6)%7)*DAY}
function dayLabel(ms){return new Date(ms).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric"})}
function clock(ms){var t=vnParts(ms);return pad(t.h)+":"+pad(t.min)}
function inputDate(ms){var x=vnParts(ms);return x.y+"-"+pad(x.m)+"-"+pad(x.d)+"T"+pad(x.h)+":"+pad(x.min)}
function toISO(v){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))throw Error("Ngày giờ không hợp lệ.");var d=new Date(v+":00+07:00");if(!Number.isFinite(d.getTime())||inputDate(d.getTime())!==v)throw Error("Ngày giờ không hợp lệ.");return d.toISOString()}
function manager(){return typeof canEditClub==="function"&&canEditClub()}
function message(x){if(typeof toast==="function")toast(x);else if(typeof oscAlert==="function")oscAlert(x)}
async function request(action,body){
  if(!currentFirebaseUser)throw Error("Phiên đăng nhập đã hết hạn.");
  var token=await currentFirebaseUser.getIdToken();
  var c=new AbortController(),timeout=setTimeout(function(){c.abort()},25000);
  try{var response=await fetch("/api/operations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(Object.assign({action:action},body||{})),cache:"no-store",signal:c.signal});
    var result=await response.json().catch(function(){return {}});
    if(!response.ok)throw Error(result.error||"Không thể tải lịch phòng.");
    return result;
  }finally{clearTimeout(timeout)}
}
function notice(x){var n=el("#rbNotice");if(n)n.textContent=x||""}
function shell(){
  var root=el("#roomBookingRoot");if(!root)return;
  root.innerHTML='<div class="rb-hero"><div><span class="rb-kicker">OUR STAGE / ROOM BOOKING</span><h2>Lịch phòng CLB</h2><p>Theo dõi phòng CLB theo từng tuần. Sau ngày sử dụng, lịch tự chuyển sang Lịch sử phòng.</p></div><div class="rb-hero-buttons">'+(manager()?'<button type="button" class="rb-button rb-primary" data-action="new">+ Thêm lịch phòng</button>':'<span class="rb-view">Chế độ chỉ xem</span>')+'<button type="button" class="rb-button rb-outline" data-action="reload">↻ Làm mới</button></div></div><div class="rb-tabs"><button type="button" data-action="week" id="rbWeekTab">Lịch phòng theo tuần</button><button type="button" data-action="history" id="rbHistoryTab">Lịch sử phòng</button></div><p id="rbNotice" class="rb-notice" aria-live="polite"></p><div id="rbContent"></div>';
  root.onclick=function(e){
    var button=e.target.closest("button[data-action]");if(!button||!root.contains(button))return;
    var act=button.dataset.action;
    if(act==="new")openForm(null);
    if(act==="reload"){if(data.tab==="week")getWeek();else getHistory(true)}
    if(act==="week")switchTab("week");
    if(act==="history")switchTab("history");
    if(act==="prev"||act==="next"){var proposed=data.week+(act==="prev"?-7*DAY:7*DAY);if(proposed>=monday(Date.now())&&proposed<=monday(Date.now())+104*7*DAY){data.week=proposed;data.rows=[];renderWeek();getWeek()}}
    if(act==="today"){data.week=monday(Date.now());data.rows=[];renderWeek();getWeek()}
    if(act==="edit"){var booking=data.rows.find(function(r){return r.id===button.dataset.id});if(booking)openForm(booking)}
    if(act==="more")getHistory(false);
  };
  paintTabs()
}
function paintTabs(){var w=el("#rbWeekTab"),h=el("#rbHistoryTab");if(w)w.classList.toggle("active",data.tab==="week");if(h)h.classList.toggle("active",data.tab==="history")}
function switchTab(mode){data.tab=mode;paintTabs();if(mode==="week"){renderWeek();if(!data.rows.length)getWeek()}else{renderHistory();if(!data.loadedHistory)getHistory(true)}}
function renderWeek(){
  var target=el("#rbContent");if(!target||data.tab!=="week")return;
  var today=startDay(Date.now()),rows=data.rows.filter(function(r){return r.status==="active"&&startDay(r.endAt)>=today});
  var unique=new Set(rows.map(function(r){return String(r.roomName||"").toLocaleLowerCase("vi")})).size;
  var html='<div class="rb-week-header"><div><span class="rb-kicker">KẾ HOẠCH SỬ DỤNG PHÒNG</span><h3>'+dayLabel(data.week)+' – '+dayLabel(data.week+6*DAY)+'</h3><p>'+rows.length+' lượt sử dụng · '+unique+' phòng · GMT+7</p></div><div class="rb-pager"><button type="button" class="rb-button rb-outline" data-action="prev" '+(data.week<=monday(Date.now())?'disabled':'')+'>‹</button><button type="button" class="rb-button rb-outline" data-action="today">Tuần này</button><button type="button" class="rb-button rb-outline" data-action="next">›</button></div></div>';
  html+='<div class="rb-stats"><div><span>Số phòng trong tuần</span><strong>'+unique+'</strong></div><div><span>Lượt sử dụng</span><strong>'+rows.length+'</strong></div><div><span>Tuần đang xem</span><strong>'+pad(vnParts(data.week).d)+'/'+pad(vnParts(data.week).m)+'</strong></div></div><div class="rb-week-grid">';
  for(var i=0;i<7;i++){
    var d=data.week+i*DAY,past=d<today,schedule=rows.filter(function(r){return r.startAt<d+DAY&&r.endAt>d}).sort(function(a,b){return a.startAt-b.startAt});
    html+='<div class="rb-day '+(d===today?'rb-current ':'')+(past?'rb-expired':'')+'"><div class="rb-day-title"><span>'+weekdays[i]+'</span><b>'+pad(vnParts(d).d)+'/'+pad(vnParts(d).m)+'</b></div><div class="rb-day-content">';
    if(past)html+='<div class="rb-empty-day">Đã chuyển vào lịch sử</div>';
    else if(!schedule.length)html+='<div class="rb-empty-day">Chưa có lịch phòng</div>';
    else for(var j=0;j<schedule.length;j++){
      var x=schedule[j];
      html+='<article class="rb-item"><span class="rb-hours">'+clock(Math.max(x.startAt,d))+' – '+clock(Math.min(x.endAt,d+DAY))+'</span><strong>'+safe(x.roomName)+'</strong><span>'+safe(x.purpose)+'</span>'+(manager()?'<button class="rb-edit" type="button" data-action="edit" data-id="'+safe(x.id)+'">Chỉnh sửa ↗</button>':'')+'</article>';
    }
    html+='</div></div>';
  }
  target.innerHTML=html+'</div>';
}
function renderHistory(){
  var target=el("#rbContent");if(!target||data.tab!=="history")return;
  var html='<div class="rb-history-header"><div><span class="rb-kicker">LỊCH SỬ PHÒNG</span><h3>Phòng đã sử dụng</h3><p>Được phân loại tự động vào ngày kế tiếp, không cần chuyển thủ công.</p></div><span class="rb-history-counter">'+data.history.length+' lịch đã tải</span></div><div class="rb-history-list">';
  if(!data.history.length)html+='<div class="rb-blank">Chưa có lịch phòng trong lịch sử.</div>';
  for(var i=0;i<data.history.length;i++){
    var x=data.history[i];
    html+='<article class="rb-history-row"><div class="rb-history-when"><b>'+dayLabel(x.startAt)+'</b><span>'+clock(x.startAt)+' – '+clock(x.endAt)+'</span></div><div class="rb-history-about"><strong>'+safe(x.roomName)+'</strong><span>'+safe(x.purpose)+'</span><small>'+safe(x.semester)+(x.createdByName?' · '+safe(x.createdByName):'')+(vnKey(x.startAt)!==vnKey(x.endAt)?' · Kết thúc '+dayLabel(x.endAt):'')+'</small></div><span class="rb-past-pill">Đã qua ngày</span></article>';
  }
  html+='</div>';
  if(data.more)html+='<div class="rb-more"><button type="button" class="rb-button rb-outline" data-action="more">Tải thêm lịch sử</button></div>';
  target.innerHTML=html;
}
async function getWeek(){
  var selected=data.week,version=(data.weekVersion||0)+1;data.weekVersion=version;data.busy=true;notice("Đang tải lịch phòng…");
  try{var result=await request("room-board",{weekStart:new Date(selected).toISOString()});if(selected!==data.week||version!==data.weekVersion)return;data.rows=result.rows||[];data.day=vnKey(Date.now());renderWeek();notice("")}
  catch(e){if(version===data.weekVersion)notice(e.message||String(e))}finally{if(version===data.weekVersion)data.busy=false}
}
async function getHistory(reset){
  if(data.historyBusy)return;
  data.historyBusy=true;if(reset){data.history=[];data.cursor=null;data.more=false;data.loadedHistory=false}notice("Đang tải lịch sử…");
  try{var result=await request("room-history",data.cursor?{before:data.cursor}:{});
    var ids=new Set(data.history.map(function(x){return x.id}));
    (result.rows||[]).forEach(function(x){if(!ids.has(x.id)){ids.add(x.id);data.history.push(x)}});
    data.history.sort(function(a,b){return b.endAt-a.endAt});
    data.cursor=result.nextBefore;data.more=result.hasMore===true;data.loadedHistory=true;data.day=vnKey(Date.now());renderHistory();notice("")
  }catch(e){notice(e.message||String(e));renderHistory()}finally{data.historyBusy=false}
}
function modalClose(){var m=el("#rbModal");if(m)m.remove();document.removeEventListener("keydown",modalKey,true)}
function modalKey(e){if(e.key==="Escape"){e.preventDefault();modalClose()}}
async function submitForm(booking,form,button){
  if(!manager()||button.disabled)return;var error=form.querySelector("#rbFormError");error.textContent="";button.disabled=true;
  try{
    var roomName=form.querySelector("#rbName").value.trim(),purpose=form.querySelector("#rbPurpose").value.trim();
    var startAt=toISO(form.querySelector("#rbStart").value),endAt=toISO(form.querySelector("#rbEnd").value),eventId=form.querySelector("#rbEvent").value;
    if(!roomName||!purpose)throw Error("Hãy nhập đủ tên phòng và mục đích.");
    if(new Date(endAt)<=new Date(startAt))throw Error("Giờ kết thúc phải sau giờ bắt đầu.");
    if(new Date(endAt)-new Date(startAt)>DAY)throw Error("Thời gian sử dụng tối đa 24 giờ.");
    await request(booking?"room-update":"room-create",Object.assign(booking?{bookingId:booking.id}:{},{semester:booking?booking.semester:semester,roomName:roomName,purpose:purpose,startAt:startAt,endAt:endAt,eventId:eventId}));
    modalClose();message(booking?"Đã cập nhật lịch phòng":"Đã thêm lịch phòng");
    if(startDay(new Date(endAt).getTime())<startDay(Date.now())){data.tab="history";paintTabs();await getHistory(true)}
    else{data.tab="week";data.week=monday(new Date(startAt).getTime());paintTabs();await getWeek()}
  }catch(e){error.textContent=e.message||String(e)}finally{if(button.isConnected)button.disabled=false}
}
async function cancelBooking(booking,form){
  if(!booking||!manager())return;
  if(typeof oscConfirm==="function"&&!await oscConfirm('Hủy lịch phòng "'+booking.roomName+'"?\n\nLịch đã hủy sẽ không xuất hiện trong lịch sử sử dụng phòng.'))return;
  try{await request("room-cancel",{bookingId:booking.id});modalClose();message("Đã hủy lịch phòng");getWeek()}
  catch(e){form.querySelector("#rbFormError").textContent=e.message||String(e)}
}
function openForm(booking){
  if(!manager())return message("Chỉ Admin hoặc Super Admin được thay đổi lịch phòng.");
  modalClose();
  var next=Math.ceil((Date.now()+HOUR)/HOUR)*HOUR;
  var start=booking?booking.startAt:data.week>monday(Date.now())?data.week+18*HOUR:next,end=booking?booking.endAt:start+2*HOUR;
  var semesterKey=booking?booking.semester:semester;
  var options=(state.events||[]).filter(function(e){return e.semester===semesterKey}).map(function(e){return '<option value="'+safe(e.id)+'" '+(booking&&booking.eventId===e.id?'selected':'')+'>'+safe(e.title)+'</option>'}).join("");
  var overlay=document.createElement("div");overlay.id="rbModal";overlay.className="rb-modal-shade";
  overlay.innerHTML='<div class="rb-modal" role="dialog" aria-modal="true" aria-labelledby="rbModalTitle"><div class="rb-modal-head"><div><span class="rb-kicker">ROOM BOOKING</span><h3 id="rbModalTitle">'+(booking?'Chỉnh sửa lịch phòng':'Thêm lịch sử dụng phòng')+'</h3></div><button type="button" class="rb-x" data-close aria-label="Đóng">×</button></div><form id="rbForm"><label>Tên phòng<input id="rbName" maxlength="100" required placeholder="Ví dụ: G405" value="'+safe(booking?booking.roomName:'')+'"></label><label>Mục đích sử dụng<input id="rbPurpose" maxlength="240" required placeholder="Ví dụ: Tập kịch, họp CLB" value="'+safe(booking?booking.purpose:'')+'"></label><div class="rb-form-grid"><label>Bắt đầu<input id="rbStart" type="datetime-local" required value="'+inputDate(start)+'"></label><label>Kết thúc<input id="rbEnd" type="datetime-local" required value="'+inputDate(end)+'"></label></div><label>Gắn với sự kiện (không bắt buộc)<select id="rbEvent"><option value="">Không gắn sự kiện</option>'+options+'</select></label><div class="rb-form-tip">Tối đa 24 giờ/lượt. Lịch trùng phòng sẽ được hệ thống từ chối.</div><p class="rb-form-error" id="rbFormError" role="alert"></p><div class="rb-form-buttons">'+(booking?'<button type="button" class="rb-button rb-danger" id="rbCancel">Hủy lịch</button>':'')+'<button type="button" class="rb-button rb-outline" data-close>Đóng</button><button type="submit" class="rb-button rb-primary" id="rbSave">'+(booking?'Lưu thay đổi':'Thêm lịch phòng')+'</button></div></form></div>';
  overlay.addEventListener("click",function(e){if(e.target===overlay||e.target.closest("[data-close]"))modalClose()});
  document.body.appendChild(overlay);document.addEventListener("keydown",modalKey,true);
  var form=overlay.querySelector("form");
  form.onsubmit=function(e){e.preventDefault();submitForm(booking,form,form.querySelector("#rbSave"))};
  if(booking)overlay.querySelector("#rbCancel").onclick=function(){cancelBooking(booking,form)};
  overlay.querySelector("#rbName").focus();
}
function renderRoomBooking(){if(!data.week)data.week=monday(Date.now());data.day=vnKey(Date.now());shell();if(data.tab==="history"){renderHistory();getHistory(true)}else{renderWeek();getWeek()}}
window.renderRoomBooking=renderRoomBooking;
setInterval(function(){
  if(!currentFirebaseUser||el("#roomBooking")?.classList.contains("hidden"))return;
  var today=vnKey(Date.now());
  if(today!==data.day){data.day=today;data.week=monday(Date.now());data.loadedHistory=false;if(data.tab==="history")getHistory(true);else getWeek()}
},60000);
})();