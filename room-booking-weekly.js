/* OSC room booking — seven-day bulk planner, v101.
   Only opens from the authenticated manager interface; all writes are checked by the API. */
(function(){
"use strict";
const DAY=86400000,TZ=7*3600000;
const WEEKDAYS=["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"];
const LIMIT_PER_DAY=20;
let dialog=null,config=null,rowSequence=0,busy=false;

function by(q,root=document){return root.querySelector(q)}
function safe(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateISO(ms){return new Date(ms+TZ).toISOString().slice(0,10)}
function weekMonday(ms){
  const local=new Date(ms+TZ).getUTCDay();
  return ms-((local+6)%7)*DAY;
}
function dateToWeek(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))throw Error("Vui lòng chọn ngày hợp lệ.");
  const ms=Date.parse(value+"T00:00:00+07:00");
  if(!Number.isFinite(ms)||dateISO(ms)!==value)throw Error("Ngày không hợp lệ.");
  return weekMonday(ms);
}
function weekBounds(){
  const today=dateISO(Date.now());
  const dayStart=Date.parse(today+"T00:00:00+07:00");
  const min=weekMonday(dayStart);
  return {min,max:min+104*7*DAY};
}
function dateLabel(ms){return new Date(ms).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit"})}
function manager(){return typeof canEditClub==="function"&&canEditClub()===true}
function selected(row){
  try{const ids=JSON.parse(row.dataset.selectedSlots||"[]");return Array.isArray(ids)?ids:[]}
  catch{return []}
}
function selectedSlots(row){
  const ids=new Set(selected(row));
  return config.slots.filter(s=>ids.has(s.id));
}
function setWarning(value){const n=by("#rbWeekError",dialog);if(n)n.textContent=value||""}
function detail(id){return config.slots.find(x=>x.id===id)}
function total(){
  const entries=dialog?dialog.querySelectorAll(".rb-week-entry").length:0;
  const used=dialog?[...dialog.querySelectorAll(".rb-week-day")].filter(d=>d.querySelector(".rb-week-entry")).length:0;
  const summary=by("#rbWeekSummary",dialog);
  if(summary)summary.textContent=entries+" lượt phòng / "+used+" ngày có lịch · "+(7-used)+" ngày để trống";
}
function htmlSlotOptions(row){
  const list=by(".rb-week-slot-list",row),search=by(".rb-week-slot-search",row);
  const needle=(search.value||"").trim().toLocaleLowerCase("vi"),ids=new Set(selected(row));
  const found=config.slots.filter(x=>(x.label+" "+x.start+" "+x.end).toLocaleLowerCase("vi").includes(needle));
  list.innerHTML=found.map(s=>'<label class="rb-week-slot-choice"><input type="checkbox" value="'+safe(s.id)+'" '+(ids.has(s.id)?"checked":"")+'><span>'+safe(s.label)+' ('+safe(s.start)+'–'+safe(s.end)+')</span></label>').join("")
    ||'<span class="rb-week-no-slots">Không tìm thấy slot</span>';
}
function updateSelectedUI(row){
  const slots=selectedSlots(row),area=by(".rb-week-picked",row);
  const label=by(".rb-week-slot-button strong",row);
  label.textContent=slots.length?slots.length+" slot đã chọn":"Chọn slot…";
  area.innerHTML=slots.map(s=>'<span class="rb-week-chip">'+safe(s.label)+'<button type="button" class="rb-week-chip-remove" data-remove-slot="'+safe(s.id)+'" aria-label="Bỏ '+safe(s.label)+'">×</button></span>').join("");
  const hours=by(".rb-week-slot-hours",row);
  hours.textContent=slots.length?slots.map(s=>s.start+"–"+s.end).join(" · "):"Chưa có khung giờ";
  htmlSlotOptions(row);
}
function closeAllSlots(except){
  if(!dialog)return;
  dialog.querySelectorAll(".rb-week-slot-popover").forEach(pop=>{
    if(pop!==except)pop.hidden=true;
  });
  dialog.querySelectorAll(".rb-week-slot-button").forEach(btn=>btn.setAttribute("aria-expanded",String(btn.nextElementSibling===except&&!except.hidden)));
}
function optionEvents(){
  return '<option value="">Không gắn sự kiện</option>'+config.events.map(ev=>
    '<option value="'+safe(ev.id)+'">'+safe(ev.title||"Sự kiện")+'</option>').join("");
}
function addRow(day){
  if(!manager()||busy)return;
  const rows=by(".rb-week-entries",day),date=day.dataset.date;
  if(rows.children.length>=LIMIT_PER_DAY){setWarning("Mỗi ngày tối đa "+LIMIT_PER_DAY+" lượt phòng.");return}
  rowSequence++;
  const row=document.createElement("article");
  row.className="rb-week-entry";
  row.dataset.date=date;
  row.dataset.entryId=String(rowSequence);
  row.dataset.selectedSlots="[]";
  row.innerHTML='<div class="rb-week-entry-head"><span>Lượt phòng '+(rows.children.length+1)+'</span><button type="button" class="rb-week-remove" data-week-remove aria-label="Bỏ lượt phòng">× Bỏ</button></div>'+
    '<div class="rb-week-entry-fields"><label>Phòng<input type="text" class="rb-week-room" maxlength="100" placeholder="Ví dụ: G405" autocomplete="off" required></label>'+
    '<label>Mục đích sử dụng<input type="text" class="rb-week-purpose" maxlength="240" placeholder="Sinh hoạt, tập kịch…" required></label></div>'+
    '<div class="rb-week-entry-fields rb-week-entry-secondary"><div class="rb-week-slot-field"><span class="rb-week-input-label">Slot sử dụng</span>'+
    '<button type="button" class="rb-week-slot-button" aria-expanded="false"><strong>Chọn slot…</strong><span>▾</span></button>'+
    '<div class="rb-week-slot-popover" hidden><input class="rb-week-slot-search" type="search" placeholder="Tìm slot…" aria-label="Tìm slot trong tuần" autocomplete="off"><div class="rb-week-slot-list"></div></div>'+
    '<div class="rb-week-picked"></div><small class="rb-week-slot-hours">Chưa có khung giờ</small></div>'+
    '<label>Sự kiện (không bắt buộc)<select class="rb-week-event">'+optionEvents()+'</select></label></div>';
  rows.append(row);
  updateSelectedUI(row);
  updateDay(day);
  by(".rb-week-room",row).focus();
}
function updateDay(day){
  const rows=[...day.querySelectorAll(".rb-week-entry")];
  rows.forEach((row,i)=>{by(".rb-week-entry-head span",row).textContent="Lượt phòng "+(i+1)});
  by(".rb-week-day-count",day).textContent=rows.length?rows.length+" lượt":"Không có lịch";
  by(".rb-week-day-empty",day).hidden=rows.length>0;
  by("[data-week-add]",day).disabled=rows.length>=LIMIT_PER_DAY||busy;
  total();
}

function snapshotDraft(){
  if(!dialog||!config)return;
  const rows=[...dialog.querySelectorAll(".rb-week-entry")].map(row=>({
    date:row.dataset.date,
    roomName:by(".rb-week-room",row).value,
    purpose:by(".rb-week-purpose",row).value,
    slotIds:selected(row),
    eventId:by(".rb-week-event",row).value
  }));
  if(rows.length)config.drafts.set(config.weekStart,rows);
  else config.drafts.delete(config.weekStart);
}
function syncWeekPicker(){
  if(!dialog||!config)return;
  const start=config.weekStart,bounds=weekBounds();
  const input=by("#rbWeekChoose",dialog);
  if(input){
    input.value=dateISO(start);
    input.min=dateISO(bounds.min);
    input.max=dateISO(bounds.max+6*DAY);
  }
  by("#rbWeekCurrent",dialog).textContent="Thứ Hai "+dateLabel(start)+" – Chủ Nhật "+dateLabel(start+6*DAY);
  by("#rbWeekPrevious",dialog).disabled=busy||start<=bounds.min;
  by("#rbWeekNext",dialog).disabled=busy||start>=bounds.max;
}
function restoreDraft(){
  const saved=config.drafts.get(config.weekStart)||[];
  for(const entry of saved){
    const day=[...dialog.querySelectorAll(".rb-week-day")].find(d=>d.dataset.date===entry.date);
    if(!day)continue;
    addRow(day);
    const row=by(".rb-week-entry:last-child",by(".rb-week-entries",day));
    if(!row)continue;
    by(".rb-week-room",row).value=entry.roomName;
    by(".rb-week-purpose",row).value=entry.purpose;
    row.dataset.selectedSlots=JSON.stringify(entry.slotIds||[]);
    by(".rb-week-event",row).value=entry.eventId||"";
    updateSelectedUI(row);
  }
  total();
}
function changeWeek(next){
  if(busy||!dialog||!config||!manager())return;
  const bounds=weekBounds();
  if(!Number.isFinite(next)||next<bounds.min||next>bounds.max||weekMonday(next)!==next){
    setWarning("Vui lòng chọn tuần từ hiện tại đến tối đa 2 năm tới.");
    syncWeekPicker();
    return;
  }
  if(next===config.weekStart){syncWeekPicker();return}
  snapshotDraft();
  config.weekStart=next;
  const scroll=by(".rb-week-scroll",dialog);
  scroll.innerHTML=buildDays();
  scroll.scrollTop=0;
  syncWeekPicker();
  restoreDraft();
  setWarning("");
  by("#rbWeekChoose",dialog).focus();
}

function releaseDialog(){
  if(!dialog)return;
  const node=dialog;dialog=null;config=null;
  document.removeEventListener("keydown",keyHandler,true);
  document.removeEventListener("pointerdown",outsideHandler,true);
  node.remove();
}
function keyHandler(e){
  if(e.key!=="Escape"||!dialog)return;
  // The separate OSC confirmation dialog owns Escape while it is open.
  if(document.querySelector(".osc-dialog-backdrop"))return;
  const pop=[...dialog.querySelectorAll(".rb-week-slot-popover")].find(p=>!p.hidden);
  if(pop){e.preventDefault();pop.hidden=true;return}
  if(!busy){e.preventDefault();releaseDialog()}
}
function outsideHandler(e){
  if(!dialog)return;
  if(!e.target.closest(".rb-week-slot-field"))closeAllSlots(null);
}
function collectEntries(){
  const result=[],seen=new Map();
  for(const row of dialog.querySelectorAll(".rb-week-entry")){
    const date=row.dataset.date;
    const roomName=by(".rb-week-room",row).value.trim();
    const purpose=by(".rb-week-purpose",row).value.trim();
    const slotIds=selectedSlots(row).map(x=>x.id);
    const eventId=by(".rb-week-event",row).value;
    const day=dialog.querySelector('.rb-week-day[data-date="'+date+'"]');
    const dayName=by(".rb-week-day-label",day).textContent;
    const suffix=" tại "+dayName+" (dòng "+(Number([...row.parentElement.children].indexOf(row))+1)+")";
    if(!roomName||!purpose)throw new Error("Vui lòng điền phòng và mục đích"+suffix+".");
    if(!slotIds.length)throw new Error("Chưa chọn slot"+suffix+".");
    const key=roomName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase()+"|"+date;
    const active=seen.get(key)||new Set();
    for(const id of slotIds){
      if(active.has(id))throw new Error("Phòng "+roomName+" có slot trùng vào "+dayName+".");
      active.add(id);
    }
    seen.set(key,active);
    result.push({date,roomName,purpose,slotIds,eventId});
  }
  if(!result.length)throw new Error("Bạn chưa thêm phòng cho ngày nào. Hãy chọn ít nhất một ngày có lịch.");
  if(result.length>140)throw new Error("Tối đa 140 lượt phòng trong một tuần.");
  return result;
}
async function saveWeek(){
  if(busy||!manager())return;
  setWarning("");
  let entries;
  try{entries=collectEntries()}catch(e){setWarning(e.message);return}
  const days=new Set(entries.map(x=>x.date)).size;
  if(typeof oscConfirm==="function"){
    const ok=await oscConfirm("Lưu "+entries.length+" lượt phòng cho "+days+" ngày?\n\n"+(7-days)+" ngày để trống sẽ được bỏ qua. Nếu có lịch trùng giờ, cả lần lưu sẽ bị hủy.");
    if(!ok||!dialog)return;
  }
  busy=true;const save=by("#rbWeekSubmit",dialog);
  save.disabled=true;save.textContent="Đang kiểm tra và lưu…";
  dialog.querySelectorAll("[data-week-add], [data-week-remove]").forEach(b=>b.disabled=true);
  try{
    const result=await config.request("room-week-create",{
      weekStart:new Date(config.weekStart).toISOString(),
      semester:config.semester,entries
    });
    const count=Number(result.created||entries.length);
    const callback=config.onSaved,savedWeek=config.weekStart;
    releaseDialog();
    if(typeof toast==="function")toast("Đã lưu "+count+" lượt phòng vào lịch tuần.");
    if(typeof callback==="function")callback(savedWeek);
  }catch(e){
    setWarning((e?.message||"Lưu thất bại.")+" Không có lịch mới nào được thêm; vui lòng kiểm tra và thử lại.");
  }finally{
    busy=false;
    if(dialog){
      const btn=by("#rbWeekSubmit",dialog);
      btn.disabled=false;btn.textContent="Lưu lịch cả tuần";
      dialog.querySelectorAll("[data-week-add], [data-week-remove]").forEach(b=>b.disabled=false);
    }
  }
}
function buildDays(){
  let html="";
  for(let i=0;i<7;i++){
    const time=config.weekStart+i*DAY,date=dateISO(time);
    html+='<section class="rb-week-day" data-date="'+safe(date)+'">'+
      '<div class="rb-week-day-header"><div><span class="rb-week-day-label">'+WEEKDAYS[i]+' · '+dateLabel(time)+'</span><span class="rb-week-day-count">Không có lịch</span></div>'+
      '<button type="button" class="rb-button rb-outline" data-week-add>+ Thêm phòng</button></div>'+
      '<div class="rb-week-entries"></div><p class="rb-week-day-empty">Không có lịch phòng ngày này — có thể để trống.</p></section>';
  }
  return html;
}
function mount(root){
  const overlay=document.createElement("div");
  overlay.className="rb-week-overlay";overlay.id="rbWeekModal";
  overlay.innerHTML='<section class="rb-week-panel" role="dialog" aria-modal="true" aria-labelledby="rbWeekTitle">'+
    '<header class="rb-week-panel-header"><div><span class="rb-kicker">OUR STAGE / ROOM BOOKING</span><h2 id="rbWeekTitle">Lập lịch phòng theo tuần</h2>'+
    '<p>Chọn tuần cần đặt lịch, sau đó thêm phòng cho những ngày có sử dụng. Ngày không có phòng có thể để trống.</p></div>'+
    '<button type="button" class="rb-week-close" aria-label="Đóng lịch tuần">×</button></header>'+
    '<div class="rb-week-chooser"><div class="rb-week-choose-intro"><label for="rbWeekChoose">Chọn tuần cần đặt</label><span id="rbWeekCurrent" aria-live="polite"></span><small>Chọn một ngày bất kỳ, hệ thống tự lấy đủ thứ Hai–Chủ Nhật. Bản nháp chỉ lưu tạm khi chuyển tuần, chưa ghi lên hệ thống.</small></div><div class="rb-week-chooser-controls"><button type="button" id="rbWeekPrevious" class="rb-button rb-outline" aria-label="Chọn tuần trước">‹</button><input type="date" id="rbWeekChoose" aria-label="Chọn ngày thuộc tuần muốn đặt"><button type="button" id="rbWeekNext" class="rb-button rb-outline" aria-label="Chọn tuần sau">›</button></div></div>'+
    '<div class="rb-week-scroll">'+buildDays()+'</div>'+
    '<footer class="rb-week-footer"><div><p id="rbWeekSummary" aria-live="polite"></p><p class="rb-week-error" id="rbWeekError" role="alert"></p>'+
    '<small>Chỉ Admin/Super Admin được lưu. Các slot và sự kiện được kiểm tra lại tại máy chủ trước khi ghi.</small></div>'+
    '<div class="rb-week-footer-actions"><button type="button" class="rb-button rb-outline" data-week-close>Đóng</button>'+
    '<button type="button" class="rb-button rb-primary" id="rbWeekSubmit">Lưu lịch cả tuần</button></div></footer></section>';
  document.body.append(overlay);
  dialog=overlay;busy=false;
  overlay.addEventListener("click",e=>{
    if(e.target===overlay&&!busy)releaseDialog();
    if(e.target.closest(".rb-week-close, [data-week-close]")&&!busy)releaseDialog();
    const add=e.target.closest("[data-week-add]");
    if(add){const day=add.closest(".rb-week-day");if(day)addRow(day)}
    const remove=e.target.closest("[data-week-remove]");
    if(remove&&!busy){const day=remove.closest(".rb-week-day");remove.closest(".rb-week-entry").remove();updateDay(day)}
    const toggle=e.target.closest(".rb-week-slot-button");
    if(toggle){
      const field=toggle.closest(".rb-week-slot-field"),pop=by(".rb-week-slot-popover",field);
      const opening=pop.hidden;closeAllSlots(null);
      pop.hidden=!opening;toggle.setAttribute("aria-expanded",String(opening));
      if(opening){const search=by(".rb-week-slot-search",field);search.value="";htmlSlotOptions(field.closest(".rb-week-entry"));search.focus()}
    }
    const chip=e.target.closest("[data-remove-slot]");
    if(chip){
      const row=chip.closest(".rb-week-entry");
      row.dataset.selectedSlots=JSON.stringify(selected(row).filter(id=>id!==chip.dataset.removeSlot));
      updateSelectedUI(row);
    }
    if(e.target.id==="rbWeekPrevious")changeWeek(config.weekStart-7*DAY);
    if(e.target.id==="rbWeekNext")changeWeek(config.weekStart+7*DAY);
    if(e.target.id==="rbWeekSubmit")saveWeek();
  });
  overlay.addEventListener("input",e=>{
    if(e.target.classList.contains("rb-week-slot-search"))htmlSlotOptions(e.target.closest(".rb-week-entry"));
  });
  overlay.addEventListener("change",e=>{
    if(e.target.id==="rbWeekChoose"){
      try{changeWeek(dateToWeek(e.target.value))}
      catch(error){setWarning(error.message||"Ngày không hợp lệ.");syncWeekPicker()}
      return;
    }
    if(!e.target.matches(".rb-week-slot-list input[type=checkbox]"))return;
    const row=e.target.closest(".rb-week-entry"),ids=new Set(selected(row));
    if(e.target.checked)ids.add(e.target.value);else ids.delete(e.target.value);
    row.dataset.selectedSlots=JSON.stringify([...ids]);updateSelectedUI(row);
  });
  document.addEventListener("keydown",keyHandler,true);
  document.addEventListener("pointerdown",outsideHandler,true);
  total();
  syncWeekPicker();
  by(".rb-week-close",overlay).focus();
}
window.rbOpenWeekPlanner=function(settings){
  if(!manager()){if(typeof toast==="function")toast("Chỉ Admin/Super Admin được lập lịch phòng.");return}
  if(dialog)return;
  if(!settings||!Number.isFinite(settings.weekStart)||!Array.isArray(settings.slots)||!settings.slots.length||
     typeof settings.request!=="function"||typeof settings.semester!=="string")return;
  const start=settings.weekStart,weekday=new Date(start+TZ).getUTCDay();
  if((weekday+6)%7!==0)return;
  config={
    weekStart:start,slots:settings.slots.slice().sort((a,b)=>a.start.localeCompare(b.start)),
    events:Array.isArray(settings.events)?settings.events.slice():[],
    request:settings.request,semester:settings.semester,onSaved:settings.onSaved,drafts:new Map()
  };
  mount();
};
})();
