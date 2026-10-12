/* OSC V98 - Room Booking. Timezone: Asia/Ho_Chi_Minh. */
(function(){
"use strict";
var DAY=86400000, HOUR=3600000, TZ=7*HOUR;
var weekdays=["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"];
var data={week:0,rows:[],history:[],cursor:null,more:false,loadedHistory:false,tab:"week",day:"",busy:false,historyBusy:false,slots:[],slotReady:false,slotBusy:false};
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
  root.innerHTML='<div class="rb-hero"><div><span class="rb-kicker">OUR STAGE / ROOM BOOKING</span><h2>Lịch phòng CLB</h2><p>Theo dõi phòng CLB theo từng tuần. Sau ngày sử dụng, lịch tự chuyển sang Lịch sử phòng.</p></div><div class="rb-hero-buttons">'+(manager()?'<button type="button" class="rb-button rb-primary" data-action="new">+ Thêm lịch phòng</button>':'<span class="rb-view">Chế độ chỉ xem</span>')+'<button type="button" class="rb-button rb-outline" data-action="reload">↻ Làm mới</button></div></div><div class="rb-tabs"><button type="button" data-action="week" id="rbWeekTab">Lịch phòng theo tuần</button><button type="button" data-action="history" id="rbHistoryTab">Lịch sử phòng</button>'+(manager()?'<button type="button" data-action="slots" id="rbSlotsTab">Cài đặt slot</button>':'')+'</div><p id="rbNotice" class="rb-notice" aria-live="polite"></p><div id="rbContent"></div>';
  root.onclick=function(e){
    var button=e.target.closest("button[data-action]");if(!button||!root.contains(button))return;
    var act=button.dataset.action;
    if(act==="new")openForm(null);
    if(act==="slots"&&manager())switchTab("slots");
    if(act==="slot-add")addSlotRow();
    if(act==="slot-delete")removeSlotRow(button.dataset.id);
    if(act==="slot-save")saveSlots();
    if(act==="reload"){if(data.tab==="week")getWeek();else if(data.tab==="history")getHistory(true);else loadSlots(true)}
    if(act==="week")switchTab("week");
    if(act==="history")switchTab("history");
    if(act==="prev"||act==="next"){var proposed=data.week+(act==="prev"?-7*DAY:7*DAY);if(proposed>=monday(Date.now())&&proposed<=monday(Date.now())+104*7*DAY){data.week=proposed;data.rows=[];renderWeek();getWeek()}}
    if(act==="today"){data.week=monday(Date.now());data.rows=[];renderWeek();getWeek()}
    if(act==="edit"){var booking=data.rows.find(function(r){return r.id===button.dataset.id});if(booking)openForm(booking)}
    if(act==="more")getHistory(false);
  };
  paintTabs()
}
function paintTabs(){var w=el("#rbWeekTab"),h=el("#rbHistoryTab"),t=el("#rbSlotsTab");if(w)w.classList.toggle("active",data.tab==="week");if(h)h.classList.toggle("active",data.tab==="history");if(t)t.classList.toggle("active",data.tab==="slots")}
function switchTab(mode){if(mode==="slots"&&!manager())return;data.tab=mode;paintTabs();if(mode==="week"){renderWeek();if(!data.rows.length)getWeek()}else if(mode==="history"){renderHistory();if(!data.loadedHistory)getHistory(true)}else{renderSlots();loadSlots(true)}}
function renderWeek(){
  var target=el("#rbContent");if(!target||data.tab!=="week")return;
  var today=startDay(Date.now()),rows=data.rows.filter(function(r){return r.status==="active"&&startDay(r.endAt-1)>=today});
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
      html+='<article class="rb-item"><span class="rb-hours">'+clock(Math.max(x.startAt,d))+' – '+clock(Math.min(x.endAt-1,d+DAY-1)+1)+'</span><strong>'+safe(x.roomName)+'</strong><span>'+safe(x.purpose)+'</span>'+(x.slotSnapshot&&x.slotSnapshot.length?'<span class="rb-slot-display">'+safe(x.slotSnapshot.map(function(t){return t.label}).join(' · '))+'</span>':'')+(manager()?'<button class="rb-edit" type="button" data-action="edit" data-id="'+safe(x.id)+'">Chỉnh sửa ↗</button>':'')+'</article>';
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
/* The catalog is a shared, admin-managed schedule template; BCN may read but never mutate it. */
async function loadSlots(force){
  if(data.slotBusy)return;
  if(data.slotReady&&!force)return;
  data.slotBusy=true;
  try{
    var result=await request("room-slot-list");
    data.slots=(result.slots||[]).slice().sort(function(a,b){return a.start.localeCompare(b.start)});
    data.slotReady=true;
    if(data.tab==="slots")renderSlots();
  }catch(e){data.slotReady=false;notice("Không tải được cấu hình slot: "+(e.message||String(e)))}
  finally{data.slotBusy=false}
}
function slotRange(first,last){
  var start=data.slots.findIndex(function(x){return x.id===first});
  var end=data.slots.findIndex(function(x){return x.id===last});
  if(start<0||end<start)throw Error("Chọn slot bắt đầu và slot kết thúc hợp lệ.");
  var selected=data.slots.slice(start,end+1);
  for(var i=1;i<selected.length;i++)if(selected[i-1].end!==selected[i].start)throw Error("Các slot được chọn phải nối tiếp nhau, không có khoảng trống.");
  return selected;
}
function slotLabel(x){return x.label+" ("+x.start+"–"+x.end+")"}
function slotError(msg){var node=el("#rbSlotError");if(node)node.textContent=msg||""}
function renderSlots(){
  var root=el("#rbContent");if(!root||data.tab!=="slots"||!manager())return;
  var html='<div class="rb-slot-settings"><div class="rb-slot-intro"><div><span class="rb-kicker">THIẾT LẬP RIÊNG CHO ADMIN</span><h3>Danh sách slot sử dụng phòng</h3><p>Cài giờ từng slot một lần. Khi nhập lịch, Admin chọn một slot hoặc nhiều slot liền giờ; hệ thống tự xác định thời gian bắt đầu và kết thúc.</p></div><button class="rb-button rb-outline" type="button" data-action="slot-add">+ Thêm slot</button></div>';
  html+='<div class="rb-slot-heading"><b>Tên slot</b><b>Giờ bắt đầu</b><b>Giờ kết thúc</b><span></span></div><div class="rb-slot-rows">';
  data.slots.forEach(function(slot){
    html+='<div class="rb-slot-row" data-slot-id="'+safe(slot.id)+'"><input type="text" data-slot-field="label" maxlength="60" value="'+safe(slot.label)+'" aria-label="Tên slot" required><input type="time" data-slot-field="start" value="'+safe(slot.start)+'" required aria-label="Giờ bắt đầu"><input type="time" data-slot-field="end" value="'+safe(slot.end)+'" required aria-label="Giờ kết thúc"><button type="button" class="rb-button rb-danger" data-action="slot-delete" data-id="'+safe(slot.id)+'">Xóa</button></div>';
  });
  html+='</div><p class="rb-form-error" id="rbSlotError" role="alert"></p><div class="rb-slot-footer"><span>Giới hạn 48 slot · Không trùng giờ · Mốc giờ 24 tiếng (GMT+7). Lịch cũ không đổi khi sửa danh sách slot.</span><button type="button" class="rb-button rb-primary" data-action="slot-save" id="rbSlotSave">Lưu danh sách slot</button></div></div>';
  root.innerHTML=html;
}
function syncDraftSlots(){
  var rows=Array.from(document.querySelectorAll("#roomBookingRoot .rb-slot-row"));
  data.slots=rows.map(function(row){
    var get=function(name){return row.querySelector('[data-slot-field="'+name+'"]').value.trim()};
    return{id:row.dataset.slotId,label:get("label"),start:get("start"),end:get("end")};
  });
}
function newSlotId(){
  var bytes=new Uint8Array(8);crypto.getRandomValues(bytes);
  return "slot_"+Array.from(bytes).map(function(x){return x.toString(16).padStart(2,"0")}).join("");
}
function addSlotRow(){
  if(!manager())return;
  syncDraftSlots();
  if(data.slots.length>=48){slotError("Chỉ được tạo tối đa 48 slot.");return}
  var end=data.slots.length?data.slots[data.slots.length-1].end:"07:00";
  if(end==="24:00"||end==="23:59"){slotError("Không còn thời gian trống để thêm slot ở cuối ngày.");return}
  var start=end;
  var n=Number(start.slice(0,2))*60+Number(start.slice(3));
  var stop=Math.min(n+50,1439);
  var endStr=String(Math.floor(stop/60)).padStart(2,"0")+":"+String(stop%60).padStart(2,"0");
  if(start==="24:00"||Number(start.slice(0,2))*60+Number(start.slice(3))>=1440){slotError("Đã hết khung giờ trong ngày. Hãy chỉnh sửa một slot cũ.");return}
  data.slots.push({id:newSlotId(),label:"Slot "+(data.slots.length+1),start:start,end:endStr});
  renderSlots();
  var last=el("#rbContent .rb-slot-row:last-child [data-slot-field=label]");if(last)last.focus();
}
function removeSlotRow(id){
  if(!manager())return;syncDraftSlots();
  data.slots=data.slots.filter(function(x){return x.id!==id});
  renderSlots();
}
async function saveSlots(){
  if(!manager())return;
  syncDraftSlots();slotError("");
  var submit=el("#rbSlotSave");if(submit)submit.disabled=true;
  try{
    var result=await request("room-slot-save",{slots:data.slots});
    data.slots=(result.slots||[]).slice();data.slotReady=true;
    renderSlots();message("Đã lưu danh sách slot cho Room Booking");
  }catch(e){slotError(e.message||String(e))}
  finally{if(submit&&submit.isConnected)submit.disabled=false}
}
function modalClose(){
  var m=el("#rbModal");if(m)m.remove();
  document.removeEventListener("keydown",modalKey,true);
}
function modalKey(e){if(e.key==="Escape"){e.preventDefault();modalClose()}}
function previewSlots(form){
  var note=form.querySelector("#rbSelectedSlots");if(!note)return;
  try{
    var chosen=slotRange(form.querySelector("#rbFirstSlot").value,form.querySelector("#rbLastSlot").value);
    note.textContent=chosen.length+" slot · "+chosen[0].start+" – "+chosen[chosen.length-1].end+" (GMT+7)";
    note.classList.remove("rb-preview-error");
  }catch(e){note.textContent=e.message||String(e);note.classList.add("rb-preview-error")}
}
async function submitForm(booking,form,button){
  if(!manager()||button.disabled)return;
  var error=form.querySelector("#rbFormError");error.textContent="";button.disabled=true;
  try{
    var roomName=form.querySelector("#rbName").value.trim(),purpose=form.querySelector("#rbPurpose").value.trim();
    var date=form.querySelector("#rbDate").value,eventId=form.querySelector("#rbEvent").value;
    var selected=slotRange(form.querySelector("#rbFirstSlot").value,form.querySelector("#rbLastSlot").value);
    if(!roomName||!purpose)throw Error("Hãy nhập đủ tên phòng và mục đích sử dụng.");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Hãy chọn ngày sử dụng hợp lệ.");
    await request(booking?"room-update":"room-create",Object.assign(booking?{bookingId:booking.id}:{},{
      semester:booking?booking.semester:semester,roomName:roomName,purpose:purpose,
      date:date,slotIds:selected.map(function(x){return x.id}),eventId:eventId
    }));
    modalClose();message(booking?"Đã cập nhật lịch phòng":"Đã thêm lịch phòng");
    var start=new Date(date+"T"+selected[0].start+":00+07:00").getTime();
    var last=selected[selected.length-1].end;
    var end=new Date(date+"T00:00:00+07:00").getTime()+
      (last==="24:00"?1440:Number(last.slice(0,2))*60+Number(last.slice(3)))*60000;
    if(startDay(end)<startDay(Date.now())){
      data.tab="history";paintTabs();data.loadedHistory=false;await getHistory(true);
    }else{
      data.tab="week";data.week=monday(start);paintTabs();await getWeek();
    }
  }catch(e){error.textContent=e.message||String(e)}
  finally{if(button.isConnected)button.disabled=false}
}
async function cancelBooking(booking,form){
  if(!booking||!manager())return;
  if(typeof oscConfirm==="function"&&!await oscConfirm('Hủy lịch phòng "'+booking.roomName+'"?\n\nLịch đã hủy sẽ không xuất hiện trong lịch sử sử dụng phòng.'))return;
  try{await request("room-cancel",{bookingId:booking.id});modalClose();message("Đã hủy lịch phòng");getWeek()}
  catch(e){form.querySelector("#rbFormError").textContent=e.message||String(e)}
}
async function openForm(booking){
  if(!manager())return message("Chỉ Admin hoặc Super Admin được thay đổi lịch phòng.");
  if(!data.slotReady)await loadSlots(true);
  if(!data.slotReady)return message("Không tải được danh sách slot. Hãy thử lại.");
  if(!data.slots.length){switchTab("slots");return message("Hãy cài đặt ít nhất một slot trước khi thêm lịch phòng.")}
  modalClose();
  var start=booking?booking.startAt:data.week>monday(Date.now())?data.week+18*HOUR:Date.now()+HOUR;
  var date=booking&&booking.date?booking.date:vnKey(start);
  var semesterKey=booking?booking.semester:semester;
  var events=(state.events||[]).filter(function(e){return e.semester===semesterKey});
  var options=events.map(function(e){return '<option value="'+safe(e.id)+'" '+(booking&&booking.eventId===e.id?'selected':'')+'>'+safe(e.title)+'</option>'}).join("");
  var present=data.slots,previous=booking&&Array.isArray(booking.slotIds)?booking.slotIds:[];
  var selected=previous.filter(function(id){return present.some(function(x){return x.id===id})});
  var first=selected.length===previous.length&&selected.length?selected[0]:present[0].id;
  var last=selected.length===previous.length&&selected.length?selected[selected.length-1]:present[0].id;
  // Existing free-time bookings or bookings with removed slots can still be edited after selecting fresh slots.
  var moved=booking&&selected.length&&selected.length===previous.length&&(
    present.find(function(x){return x.id===first}).start!==inputDate(booking.startAt).slice(11)||
    present.find(function(x){return x.id===last}).end!==inputDate(booking.endAt).slice(11));
  var priorWarning=booking&&(!selected.length||selected.length!==previous.length||moved)?
    '<div class="rb-form-tip">Lịch này được tạo trước khi có danh sách slot (hoặc slot cũ đã đổi). Hãy chọn lại slot hiện tại trước khi lưu.</div>':"";
  var slotOptions=present.map(function(x){return '<option value="'+safe(x.id)+'">'+safe(slotLabel(x))+'</option>'}).join("");
  var overlay=document.createElement("div");overlay.id="rbModal";overlay.className="rb-modal-shade";
  overlay.innerHTML='<div class="rb-modal" role="dialog" aria-modal="true" aria-labelledby="rbModalTitle"><div class="rb-modal-head"><div><span class="rb-kicker">ROOM BOOKING</span><h3 id="rbModalTitle">'+(booking?'Chỉnh sửa lịch phòng':'Thêm lịch sử dụng phòng')+'</h3></div><button type="button" class="rb-x" data-close aria-label="Đóng">×</button></div><form id="rbForm"><label>Tên phòng<input id="rbName" maxlength="100" required placeholder="Ví dụ: G405" value="'+safe(booking?booking.roomName:"")+'"></label><label>Mục đích sử dụng<input id="rbPurpose" maxlength="240" required placeholder="Ví dụ: Tập kịch, họp CLB" value="'+safe(booking?booking.purpose:"")+'"></label><label>Ngày sử dụng<input id="rbDate" type="date" required value="'+safe(date)+'"></label><div class="rb-form-grid"><label>Từ slot<select id="rbFirstSlot">'+slotOptions+'</select></label><label>Đến hết slot<select id="rbLastSlot">'+slotOptions+'</select></label></div><div class="rb-slot-preview" id="rbSelectedSlots" aria-live="polite"></div>'+priorWarning+'<label>Gắn với sự kiện (không bắt buộc)<select id="rbEvent"><option value="">Không gắn sự kiện</option>'+options+'</select></label><div class="rb-form-tip">Có thể nhập nhiều phòng trong một ngày. Một phòng có thể dùng nhiều lần nhưng tuyệt đối không được trùng giờ.</div><p class="rb-form-error" id="rbFormError" role="alert"></p><div class="rb-form-buttons">'+(booking?'<button type="button" class="rb-button rb-danger" id="rbCancel">Hủy lịch</button>':"")+'<button type="button" class="rb-button rb-outline" data-close>Đóng</button><button type="submit" class="rb-button rb-primary" id="rbSave">'+(booking?"Lưu thay đổi":"Thêm lịch phòng")+'</button></div></form></div>';
  overlay.addEventListener("click",function(e){if(e.target===overlay||e.target.closest("[data-close]"))modalClose()});
  document.body.appendChild(overlay);document.addEventListener("keydown",modalKey,true);
  var form=overlay.querySelector("form"),fslot=form.querySelector("#rbFirstSlot"),lslot=form.querySelector("#rbLastSlot");
  fslot.value=first;lslot.value=last;
  fslot.onchange=function(){previewSlots(form)};lslot.onchange=function(){previewSlots(form)};
  previewSlots(form);
  form.onsubmit=function(e){e.preventDefault();submitForm(booking,form,form.querySelector("#rbSave"))};
  if(booking)overlay.querySelector("#rbCancel").onclick=function(){cancelBooking(booking,form)};
  overlay.querySelector("#rbName").focus();
}
function renderRoomBooking(){if(!data.week)data.week=monday(Date.now());data.day=vnKey(Date.now());if(data.tab==="slots"&&!manager())data.tab="week";shell();loadSlots(true);if(data.tab==="history"){renderHistory();getHistory(true)}else if(data.tab==="slots"){renderSlots()}else{renderWeek();getWeek()}}
window.renderRoomBooking=renderRoomBooking;
setInterval(function(){
  if(!currentFirebaseUser||el("#roomBooking")?.classList.contains("hidden"))return;
  var today=vnKey(Date.now());
  if(today!==data.day){data.day=today;data.week=monday(Date.now());data.loadedHistory=false;if(data.tab==="history")getHistory(true);else if(data.tab==="week")getWeek()}
},60000);
})();