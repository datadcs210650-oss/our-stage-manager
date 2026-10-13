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
  root.innerHTML='<div class="rb-hero"><div><span class="rb-kicker">OUR STAGE / ROOM BOOKING</span><h2>Lịch phòng CLB</h2><p>Theo dõi phòng CLB theo từng tuần. Sau ngày sử dụng, lịch tự chuyển sang Lịch sử phòng.</p></div><div class="rb-hero-buttons">'+(manager()?'<button type="button" class="rb-button rb-outline" data-action="new">+ Đặt phòng theo ngày</button><button type="button" class="rb-button rb-primary" data-action="weekly">+ Lập lịch cả tuần</button>':'<span class="rb-view">Chế độ chỉ xem</span>')+'<button type="button" class="rb-button rb-outline" data-action="reload">↻ Làm mới</button></div></div><div class="rb-tabs"><button type="button" data-action="week" id="rbWeekTab">Lịch phòng theo tuần</button><button type="button" data-action="history" id="rbHistoryTab">Lịch sử phòng</button>'+(manager()?'<button type="button" data-action="slots" id="rbSlotsTab">Cài đặt slot</button>':'')+'</div><p id="rbNotice" class="rb-notice" aria-live="polite"></p><div id="rbContent"></div>';
  root.onclick=function(e){
    var button=e.target.closest("button[data-action]");if(!button||!root.contains(button))return;
    var act=button.dataset.action;
    if(act==="new")openForm(null);
    if(act==="weekly")openWeekly();
    if(act==="slots"&&manager())switchTab("slots");
    if(act==="slot-add")addSlotRow();
    if(act==="slot-sample")useSampleSlots();
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
      html+='<article class="rb-item"><span class="rb-hours">'+(x.slotSnapshot&&x.slotSnapshot.length?x.slotSnapshot.map(function(t){return t.start+'–'+t.end}).join(' · '):clock(Math.max(x.startAt,d))+' – '+clock(Math.min(x.endAt-1,d+DAY-1)+1))+'</span><strong>'+safe(x.roomName)+'</strong><span>'+safe(x.purpose)+'</span>'+(x.slotSnapshot&&x.slotSnapshot.length?'<span class="rb-slot-display">'+safe(x.slotSnapshot.map(function(t){return t.label}).join(' · '))+'</span>':'')+(manager()?'<button class="rb-edit" type="button" data-action="edit" data-id="'+safe(x.id)+'">Chỉnh sửa ↗</button>':'')+'</article>';
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

function slotLabel(x){return x.label+" ("+x.start+"–"+x.end+")"}
function sortedSelected(ids){
  const choices=new Set(ids||[]);
  return data.slots.filter(x=>choices.has(x.id));
}
function slotError(msg){var node=el("#rbSlotError");if(node)node.textContent=msg||""}
function slotRange(ids){
  const selected=sortedSelected(ids);
  if(!selected.length)throw Error("Hãy chọn ít nhất một slot.");
  if(selected.length!==new Set(ids||[]).size)throw Error("Có slot không còn tồn tại. Hãy tải lại danh sách slot.");
  return selected;
}
function renderSlots(){
  const root=el("#rbContent");if(!root||data.tab!=="slots"||!manager())return;
  let html='<div class="rb-slot-settings"><div class="rb-slot-intro"><div><span class="rb-kicker">THIẾT LẬP RIÊNG CHO ADMIN</span><h3>Danh sách slot sử dụng phòng</h3><p>Thiết lập giờ mỗi slot. Khi tạo booking, có thể chọn nhiều slot bất kỳ từ danh sách tìm kiếm. Chỉ những slot đã chọn mới được giữ phòng.</p></div><div class="rb-slot-top-actions"><button class="rb-button rb-outline" type="button" data-action="slot-sample">8 slot theo mẫu</button><button class="rb-button rb-outline" type="button" data-action="slot-add">+ Thêm slot</button></div></div>';
  html+='<div class="rb-slot-heading"><b>Tên slot</b><b>Giờ bắt đầu</b><b>Giờ kết thúc</b><span></span></div><div class="rb-slot-rows">';
  data.slots.forEach(function(x){
    html+='<div class="rb-slot-row" data-slot-id="'+safe(x.id)+'"><input type="text" data-slot-field="label" maxlength="60" value="'+safe(x.label)+'" aria-label="Tên slot" required><input type="time" data-slot-field="start" value="'+safe(x.start)+'" required aria-label="Bắt đầu"><input type="time" data-slot-field="end" value="'+safe(x.end)+'" required aria-label="Kết thúc"><button type="button" class="rb-button rb-danger" data-action="slot-delete" data-id="'+safe(x.id)+'">Xóa</button></div>';
  });
  html+='</div><p class="rb-form-error" id="rbSlotError" role="alert"></p><div class="rb-slot-footer"><span>Tối đa 48 slot, không chồng giờ. Lịch đã lưu giữ nguyên giờ slot tại thời điểm đặt. BCN chỉ được xem lịch.</span><button type="button" class="rb-button rb-primary" data-action="slot-save" id="rbSlotSave">Lưu danh sách slot</button></div></div>';
  root.innerHTML=html;
}
function syncDraftSlots(){
  data.slots=Array.from(document.querySelectorAll("#roomBookingRoot .rb-slot-row")).map(function(row){
    const value=k=>row.querySelector('[data-slot-field="'+k+'"]').value.trim();
    return {id:row.dataset.slotId,label:value("label"),start:value("start"),end:value("end")};
  });
}
function newSlotId(){
  const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);
  return "slot_"+Array.from(bytes).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function addSlotRow(){
  if(!manager())return;syncDraftSlots();
  if(data.slots.length>=48)return slotError("Chỉ được tạo tối đa 48 slot.");
  const end=data.slots.length?data.slots[data.slots.length-1].end:"07:00";
  if(end==="24:00"||end==="23:59")return slotError("Không còn thời gian trống để thêm slot.");
  const min=Number(end.slice(0,2))*60+Number(end.slice(3));
  const finish=Math.min(min+50,1439);
  const label=String(Math.floor(finish/60)).padStart(2,"0")+":"+String(finish%60).padStart(2,"0");
  data.slots.push({id:newSlotId(),label:"Slot "+(data.slots.length+1),start:end,end:label});
  renderSlots();
}
function removeSlotRow(id){
  if(!manager())return;syncDraftSlots();data.slots=data.slots.filter(x=>x.id!==id);renderSlots();
}
async function useSampleSlots(){
  if(!manager())return;
  syncDraftSlots();
  if(data.slots.length&&typeof oscConfirm==="function"&&!await oscConfirm("Thay danh sách slot đang nhập bằng 8 slot mẫu?\n\nLịch đã đặt sẽ không bị thay đổi."))return;
  const values=[["07:00","08:30"],["08:45","10:15"],["10:30","12:00"],["12:45","14:15"],
    ["14:30","16:00"],["16:15","17:45"],["18:00","19:30"],["19:45","21:15"]];
  data.slots=values.map((pair,i)=>({id:newSlotId(),label:"Slot "+(i+1),start:pair[0],end:pair[1]}));
  renderSlots();message("Đã nhập 8 slot mẫu. Nhấn Lưu danh sách slot để áp dụng.");
}
async function saveSlots(){
  if(!manager())return;syncDraftSlots();slotError("");
  const button=el("#rbSlotSave");if(button)button.disabled=true;
  try{
    const result=await request("room-slot-save",{slots:data.slots});
    data.slots=(result.slots||[]).slice();data.slotReady=true;
    renderSlots();message("Đã lưu danh sách slot");
  }catch(e){slotError(e.message||String(e))}
  finally{if(button&&button.isConnected)button.disabled=false}
}
function modalClose(){
  const m=el("#rbModal");if(m)m.remove();
  document.removeEventListener("keydown",modalKey,true);
  document.removeEventListener("pointerdown",slotOutside,true);
}
function modalKey(e){
  if(e.key==="Escape"){
    const list=el("#rbSlotDropdown");
    if(list&&!list.hidden){e.preventDefault();closeSlotDropdown();return}
    e.preventDefault();modalClose();
  }
}
function slotOutside(e){
  const wrap=el("#rbSlotWidget");
  if(wrap&&!wrap.contains(e.target))closeSlotDropdown();
}
function closeSlotDropdown(){
  const pop=el("#rbSlotDropdown"),toggle=el("#rbSlotToggle");
  if(pop)pop.hidden=true;
  if(toggle)toggle.setAttribute("aria-expanded","false");
}
function renderSlotSelection(form,ids){
  const selected=sortedSelected(ids);
  form.dataset.selectedSlots=JSON.stringify(selected.map(x=>x.id));
  const chipArea=form.querySelector("#rbSlotChips");
  const toggle=form.querySelector("#rbSlotToggle");
  const summary=form.querySelector("#rbSelectedSlots");
  if(!selected.length){
    chipArea.innerHTML='<span class="rb-placeholder">Chưa chọn slot</span>';
    toggle.querySelector(".rb-slot-toggle-count").textContent="Chọn slot";
    summary.textContent="Chọn một hoặc nhiều slot trong danh sách.";
  }else{
    chipArea.innerHTML=selected.map(x=>'<span class="rb-selected-chip">'+safe(x.label)+'<button type="button" data-remove-slot="'+safe(x.id)+'" aria-label="Bỏ '+safe(x.label)+'">×</button></span>').join("");
    toggle.querySelector(".rb-slot-toggle-count").textContent=selected.length+" slot đã chọn";
    summary.textContent="Giữ phòng: "+selected.map(x=>slotLabel(x)).join(" · ");
  }
  drawSlotOptions(form);
}
function drawSlotOptions(form){
  const list=form.querySelector("#rbSlotOptions");
  const search=form.querySelector("#rbSlotSearch");
  const term=(search.value||"").trim().toLocaleLowerCase("vi");
  const selected=new Set(JSON.parse(form.dataset.selectedSlots||"[]"));
  const visible=data.slots.filter(x=>slotLabel(x).toLocaleLowerCase("vi").includes(term));
  list.innerHTML=visible.map(x=>'<label class="rb-slot-option"><input type="checkbox" value="'+safe(x.id)+'" '+(selected.has(x.id)?"checked":"")+'><span>'+safe(slotLabel(x))+'</span></label>').join("")||'<div class="rb-slot-no-results">Không tìm thấy slot phù hợp.</div>';
}
function openSlotDropdown(form){
  const pop=form.querySelector("#rbSlotDropdown"),button=form.querySelector("#rbSlotToggle");
  pop.hidden=false;button.setAttribute("aria-expanded","true");
  const search=form.querySelector("#rbSlotSearch");
  search.value="";drawSlotOptions(form);search.focus();
}
function setupSlotWidget(form,initial){
  renderSlotSelection(form,initial);
  const pop=form.querySelector("#rbSlotDropdown"),toggle=form.querySelector("#rbSlotToggle");
  toggle.onclick=function(){if(pop.hidden)openSlotDropdown(form);else closeSlotDropdown()};
  form.querySelector("#rbSlotSearch").oninput=function(){drawSlotOptions(form)};
  form.querySelector("#rbSlotOptions").onchange=function(e){
    if(e.target.type!=="checkbox")return;
    const selected=new Set(JSON.parse(form.dataset.selectedSlots||"[]"));
    if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);
    renderSlotSelection(form,[...selected]);
  };
  form.querySelector("#rbSlotChips").onclick=function(e){
    const button=e.target.closest("[data-remove-slot]");if(!button)return;
    const old=JSON.parse(form.dataset.selectedSlots||"[]").filter(x=>x!==button.dataset.removeSlot);
    renderSlotSelection(form,old);
  };
  document.addEventListener("pointerdown",slotOutside,true);
}
function bookingEventDate(ev){
  const value=String(ev.eventDate||"");
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const sem=state.semesters?.[ev.semester];
  for(const group of sem?.groups||[])for(const activity of group.items||[]){
    if(activity.id!==ev.linkedActivityId)continue;
    const raw=String(activity.date||"");
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const d=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(d)return d[3]+"-"+pad(d[2])+"-"+pad(d[1]);
  }
  return "";
}
function eventMillis(value){
  if(!value)return 0;
  if(typeof value.toMillis==="function")return value.toMillis();
  if(typeof value.toDate==="function")return value.toDate().getTime();
  if(typeof value.seconds==="number")return value.seconds*1000;
  if(typeof value==="number")return value;
  return new Date(value).getTime()||0;
}
function bookableEvent(ev){
  if(!ev||ev.isOpen!==true||ev.semester!==semester)return false;
  if(eventMillis(ev.closeAt)>0&&eventMillis(ev.closeAt)<=Date.now())return false;
  const when=bookingEventDate(ev);
  if(when&&when<vnKey(Date.now()))return false;
  return true;
}
async function submitForm(booking,form,button){
  if(!manager()||button.disabled)return;
  const error=form.querySelector("#rbFormError");error.textContent="";button.disabled=true;
  try{
    const roomName=form.querySelector("#rbName").value.trim(),purpose=form.querySelector("#rbPurpose").value.trim();
    const date=form.querySelector("#rbDate").value,eventId=form.querySelector("#rbEvent").value;
    const selected=slotRange(JSON.parse(form.dataset.selectedSlots||"[]"));
    if(!roomName||!purpose)throw Error("Hãy nhập đủ tên phòng và mục đích sử dụng.");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Ngày sử dụng không hợp lệ.");
    await request(booking?"room-update":"room-create",{
      ...(booking?{bookingId:booking.id}:{}),
      semester:booking?booking.semester:semester,roomName,purpose,date,
      slotIds:selected.map(x=>x.id),eventId
    });
    modalClose();message(booking?"Đã cập nhật lịch phòng":"Đã thêm lịch phòng");
    const start=new Date(date+"T"+selected[0].start+":00+07:00").getTime();
    const end=new Date(date+"T00:00:00+07:00").getTime()+
      (selected[selected.length-1].end==="24:00"?1440:Number(selected[selected.length-1].end.slice(0,2))*60+Number(selected[selected.length-1].end.slice(3)))*60000;
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
  if(typeof oscConfirm==="function"&&!await oscConfirm('Hủy lịch phòng "'+booking.roomName+'"?\n\nLịch đã hủy sẽ không xuất hiện trong lịch sử.'))return;
  try{await request("room-cancel",{bookingId:booking.id});modalClose();message("Đã hủy lịch phòng");getWeek()}
  catch(e){form.querySelector("#rbFormError").textContent=e.message||String(e)}
}
async function openForm(booking){
  if(!manager())return message("Chỉ Admin hoặc Super Admin được thay đổi lịch phòng.");
  if(!data.slotReady)await loadSlots(true);
  if(!data.slotReady)return message("Không thể tải danh sách slot. Hãy thử lại.");
  if(!data.slots.length){switchTab("slots");return message("Hãy tạo slot trước khi nhập lịch phòng.")}
  modalClose();
  const now=Date.now();
  const date=booking&&booking.date?booking.date:vnKey(booking?booking.startAt:data.week>monday(now)?data.week+18*HOUR:now+HOUR);
  const events=(state.events||[]).filter(ev=>bookableEvent(ev));
  const options=events.map(ev=>'<option value="'+safe(ev.id)+'">'+safe(ev.title||"Sự kiện")+'</option>').join("");
  const initial=booking&&Array.isArray(booking.slotIds)?booking.slotIds.filter(id=>data.slots.some(x=>x.id===id)):[];
  const fallback=booking?data.slots.filter(x=>{
    const day=date+"T00:00:00+07:00",base=new Date(day).getTime();
    const from=base+(Number(x.start.slice(0,2))*60+Number(x.start.slice(3)))*60000;
    const finish=base+(Number(x.end.slice(0,2))*60+Number(x.end.slice(3)))*60000;
    return from>=booking.startAt&&finish<=booking.endAt;
  }).map(x=>x.id):[];
  const chosen=initial.length?initial:fallback;
  const priorNotice=booking&&!chosen.length?'<div class="rb-form-tip">Lịch trước đây chưa gắn slot hiện hành. Vui lòng chọn lại các slot để lưu thay đổi.</div>':"";
  const overlay=document.createElement("div");overlay.id="rbModal";overlay.className="rb-modal-shade";
  overlay.innerHTML='<div class="rb-modal" role="dialog" aria-modal="true" aria-labelledby="rbModalTitle"><div class="rb-modal-head"><div><span class="rb-kicker">ROOM BOOKING</span><h3 id="rbModalTitle">'+(booking?"Chỉnh sửa lịch phòng":"Thêm lịch sử dụng phòng")+'</h3></div><button type="button" class="rb-x" data-close aria-label="Đóng">×</button></div><form id="rbForm"><label>Tên phòng<input id="rbName" maxlength="100" required value="'+safe(booking?.roomName||"")+'" placeholder="Ví dụ: G405"></label><label>Mục đích sử dụng<input id="rbPurpose" maxlength="240" required value="'+safe(booking?.purpose||"")+'" placeholder="Ví dụ: Tập kịch, họp CLB"></label><label>Ngày sử dụng<input id="rbDate" type="date" required value="'+safe(date)+'"></label><div id="rbSlotWidget" class="rb-slot-widget"><label class="rb-field-label">Chọn các slot sử dụng</label><button type="button" class="rb-multi-toggle" id="rbSlotToggle" aria-haspopup="listbox" aria-expanded="false" aria-controls="rbSlotDropdown"><span class="rb-slot-toggle-count">Chọn slot</span><span aria-hidden="true">▾</span></button><div id="rbSlotChips" class="rb-slot-chips"></div><div id="rbSlotDropdown" class="rb-slot-dropdown" hidden><input type="search" id="rbSlotSearch" placeholder="Tìm slot…" aria-label="Tìm kiếm slot" autocomplete="off"><div id="rbSlotOptions" class="rb-slot-options" role="group" aria-label="Danh sách chọn slot"></div></div></div><div id="rbSelectedSlots" class="rb-slot-preview" aria-live="polite"></div>'+priorNotice+'<label>Gắn với sự kiện (không bắt buộc)<select id="rbEvent"><option value="">Không gắn sự kiện</option>'+options+'</select></label><div class="rb-form-tip">Có thể chọn nhiều slot không liền nhau. Mỗi slot được kiểm tra trùng giờ riêng theo mã phòng.</div><p class="rb-form-error" id="rbFormError" role="alert"></p><div class="rb-form-buttons">'+(booking?'<button type="button" class="rb-button rb-danger" id="rbCancel">Hủy lịch</button>':"")+'<button type="button" class="rb-button rb-outline" data-close>Đóng</button><button type="submit" class="rb-button rb-primary" id="rbSave">'+(booking?"Lưu thay đổi":"Thêm lịch phòng")+'</button></div></form></div>';
  overlay.addEventListener("click",e=>{if(e.target===overlay||e.target.closest("[data-close]"))modalClose()});
  document.body.appendChild(overlay);
  document.addEventListener("keydown",modalKey,true);
  const form=overlay.querySelector("#rbForm");
  setupSlotWidget(form,chosen);
  if(booking?.eventId&&events.some(ev=>ev.id===booking.eventId))form.querySelector("#rbEvent").value=booking.eventId;
  form.onsubmit=e=>{e.preventDefault();submitForm(booking,form,form.querySelector("#rbSave"))};
  if(booking)overlay.querySelector("#rbCancel").onclick=()=>cancelBooking(booking,form);
  form.querySelector("#rbName").focus();
}

async function openWeekly(){
  if(!manager())return message("Chỉ Admin/Super Admin được lập lịch phòng.");
  if(!data.slotReady)await loadSlots(true);
  if(!data.slotReady)return message("Không tải được danh sách slot. Vui lòng thử lại.");
  if(!data.slots.length){
    switchTab("slots");
    return message("Hãy tạo ít nhất một slot trong Cài đặt slot trước khi lập lịch tuần.");
  }
  if(typeof window.rbOpenWeekPlanner!=="function")
    return message("Chưa tải xong giao diện lập lịch tuần. Hãy tải lại trang.");
  window.rbOpenWeekPlanner({
    weekStart:data.week,
    semester:semester,
    slots:data.slots.slice(),
    events:(state.events||[]).filter(bookableEvent)
      .map(ev=>({id:String(ev.id||""),title:String(ev.title||"")})),
    request:request,
    onSaved:()=>{
      data.tab="week";
      paintTabs();
      renderWeek();
      getWeek();
    }
  });
}

function renderRoomBooking(){if(!data.week)data.week=monday(Date.now());data.day=vnKey(Date.now());if(data.tab==="slots"&&!manager())data.tab="week";shell();loadSlots(true);if(data.tab==="history"){renderHistory();getHistory(true)}else if(data.tab==="slots"){renderSlots()}else{renderWeek();getWeek()}}
window.renderRoomBooking=renderRoomBooking;
setInterval(function(){
  if(!currentFirebaseUser||el("#roomBooking")?.classList.contains("hidden"))return;
  var today=vnKey(Date.now());
  if(today!==data.day){data.day=today;data.week=monday(Date.now());data.loadedHistory=false;if(data.tab==="history")getHistory(true);else if(data.tab==="week")getWeek()}
},60000);
})();