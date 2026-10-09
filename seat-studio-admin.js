(()=>{
"use strict";
let seatState={
  enabled:false,
  title:"Chọn ghế",
  stageLabel:"SÂN KHẤU",
  canvasHeight:640,
  stage:{x:20,y:3,w:60,h:7},
  sections:[]
};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const uid=()=>("sec_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)).replace(/[^A-Za-z0-9_-]/g,"");

function rowLabels(v){
  const a=Array.isArray(v)?v:String(v||"").split(/[\n,;]+/);
  return a.map(x=>String(typeof x==="object"?(x.label??x.row??""):x).trim()).filter(Boolean).slice(0,60);
}
function parseRowPlan(v,defaultSeats=10){
  const raw=Array.isArray(v)?v:String(v||"").split(/[\n,;]+/);
  const out=[];
  for(const item of raw){
    if(item&&typeof item==="object"){
      const label=String(item.label??item.row??"").trim().slice(0,12);
      if(!label)continue;
      out.push({label,seats:Math.round(clamp(item.seats??item.count??defaultSeats,1,80))});
      continue;
    }
    const text=String(item||"").trim();
    if(!text)continue;
    const m=text.match(/^(.{1,12}?)(?:\s*[:=xX]\s*(\d{1,3}))?$/);
    if(!m)continue;
    out.push({label:m[1].trim().slice(0,12),seats:Math.round(clamp(m[2]||defaultSeats,1,80))});
  }
  const seen=new Set();
  return out.filter(x=>{const k=x.label.toUpperCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,60);
}
const SEAT_AUDIENCES=new Set(["public","vip","bcn","guest","artist","sponsor","media"]);
function normalizeAudience(v){const x=String(v||"public").toLowerCase();return SEAT_AUDIENCES.has(x)?x:"public"}
function parseLockedSeats(v){
  const raw=Array.isArray(v)?v:String(v||"").split(/[\n,;\s]+/);
  const out=new Set();
  for(const partRaw of raw){
    const part=String(partRaw||"").trim().toUpperCase();if(!part)continue;
    const range=part.match(/^([A-ZÀ-Ỹ0-9_-]{1,12}?)(\d{1,4})-\1?(\d{1,4})$/i);
    if(range){const row=range[1],a=Number(range[2]),b=Number(range[3]),lo=Math.min(a,b),hi=Math.max(a,b);for(let n=lo;n<=hi&&n-lo<200;n++)out.add(row+n);continue}
    const one=part.match(/^(.{1,12}?)(\d{1,4})$/);if(one)out.add(one[1]+Number(one[2]));
  }
  return [...out].slice(0,1200);
}
function normalizeStage(stage={}){
  return{
    x:clamp(stage.x??20,0,95),
    y:clamp(stage.y??3,0,90),
    w:clamp(stage.w??60,10,100),
    h:clamp(stage.h??7,3,30)
  };
}
function normalizeSection(s={},i=0){
  const seatsPerRow=Math.round(clamp(s.seatsPerRow||10,1,80));
  let rowSpecs=parseRowPlan(s.rowSpecs||[],seatsPerRow);
  if(!rowSpecs.length){
    const labels=rowLabels(s.rows);
    rowSpecs=(labels.length?labels:["A"]).map(label=>({label,seats:seatsPerRow}));
  }
  return{
    id:String(s.id||uid()).replace(/[^A-Za-z0-9_-]/g,"_").slice(0,48)||uid(),
    name:String(s.name||("Khu "+(i+1))).slice(0,60),
    x:clamp(s.x,0,94),
    y:clamp(s.y,0,94),
    w:clamp(s.w||32,12,94),
    rowSpecs,
    rows:rowSpecs.map(x=>x.label),
    seatsPerRow,
    startNumber:Math.round(clamp(s.startNumber||1,1,999)),
    reverse:s.reverse===true,
    audience:normalizeAudience(s.audience||s.reservedFor),
    lockedSeats:parseLockedSeats(s.lockedSeats||s.lockedSeatsText||[])
  };
}
function normalize(config){
  const c=config&&typeof config==="object"?config:{};
  const stage=normalizeStage(c.stage||{x:c.stageX,y:c.stageY,w:c.stageW,h:c.stageH});
  return{
    enabled:c.enabled===true,
    title:String(c.title||"Chọn ghế").slice(0,100),
    stageLabel:String(c.stageLabel||"SÂN KHẤU").slice(0,80),
    canvasHeight:Math.round(clamp(c.canvasHeight||640,360,1400)),
    stage,
    sections:(Array.isArray(c.sections)?c.sections:[]).slice(0,30).map(normalizeSection)
  };
}
function defaultSection(i=0){
  const start=String.fromCharCode(65+(i*3)%26);
  const labels=[0,1,2].map(n=>String.fromCharCode(Math.min(90,start.charCodeAt(0)+n)));
  return normalizeSection({
    id:uid(),name:"Khu "+String.fromCharCode(65+i),
    x:7+(i%3)*31,y:18+Math.floor(i/3)*30,w:28,
    rowSpecs:labels.map(label=>({label,seats:10})),seatsPerRow:10,startNumber:1,reverse:false,audience:"public",lockedSeats:[]
  },i);
}
function totalSeats(){
  return seatState.sections.reduce((n,s)=>n+s.rowSpecs.reduce((a,r)=>a+r.seats,0),0);
}
function rowPlanText(sec){return sec.rowSpecs.map(r=>r.label+":"+r.seats).join(", ")}
function audienceLabel(v){return ({public:"Công khai",vip:"VIP",bcn:"BCN",guest:"Khách mời",artist:"Nghệ sĩ",sponsor:"Nhà tài trợ",media:"Media"})[v]||"Công khai"}
function stageHtml(){
  const st=seatState.stage||normalizeStage();
  return `<div class="seat-stage-label seat-stage-draggable" data-seat-stage-drag style="left:${st.x}%;top:${st.y}%;width:${st.w}%;height:${st.h}%"><span>${esc(seatState.stageLabel||"SÂN KHẤU")}</span><small>Kéo để căn sân khấu</small></div>`;
}
function seatCells(sec){
  const locked=new Set(sec.lockedSeats||[]);
  return sec.rowSpecs.map(spec=>{
    const nums=Array.from({length:spec.seats},(_,i)=>sec.startNumber+(sec.reverse?(spec.seats-1-i):i));
    return `<div class="seat-mini-row"><span class="seat-row-label">${esc(spec.label)}</span><div class="seat-mini-grid" style="--seat-cols:${Math.min(spec.seats,80)}">${nums.map(n=>{const label=String(spec.label).toUpperCase()+n,isLocked=locked.has(label)||sec.audience!=="public";return `<span class="${isLocked?"seat-mini-reserved":""}" title="${esc(spec.label)}${n}${isLocked?" • "+audienceLabel(sec.audience):""}">${n}</span>`}).join("")}</div></div>`
  }).join("");
}
function previewHtml(){
  return `<div id="seatStudioCanvas" class="seat-studio-canvas" style="height:${seatState.canvasHeight}px">${stageHtml()}${seatState.sections.map((sec,i)=>`<div class="seat-section-block" data-seat-section="${i}" style="left:${sec.x}%;top:${sec.y}%;width:${sec.w}%"><div class="seat-section-drag" data-seat-drag="${i}"><b>${esc(sec.name)}</b><span>${sec.rowSpecs.reduce((n,r)=>n+r.seats,0)} ghế • ${esc(audienceLabel(sec.audience))}</span></div><div class="seat-section-preview">${seatCells(sec)}</div></div>`).join("")}</div>`;
}
function sectionEditor(sec,i){
  return `<div class="seat-section-editor" data-seat-editor="${i}">
    <div class="seat-editor-head"><div><b>${esc(sec.name)}</b><small>${sec.rowSpecs.length} hàng • ${sec.rowSpecs.reduce((n,r)=>n+r.seats,0)} ghế</small></div><div><button type="button" class="secondary" onclick="seatStudioCloneSection(${i})">Nhân bản</button><button type="button" class="secondary" onclick="seatStudioMoveSection(${i},-1)" ${i===0?"disabled":""}>↑</button><button type="button" class="secondary" onclick="seatStudioMoveSection(${i},1)" ${i===seatState.sections.length-1?"disabled":""}>↓</button><button type="button" class="danger" onclick="seatStudioRemoveSection(${i})">Xóa</button></div></div>
    <div class="seat-editor-grid">
      <label>Tên khu<input value="${esc(sec.name)}" maxlength="60" onchange="seatStudioUpdate(${i},'name',this.value)"></label>
      <label class="seat-row-plan-label">Hàng & số ghế<textarea rows="2" maxlength="900" placeholder="A:30, B:30, C:28" onchange="seatStudioUpdate(${i},'rowPlan',this.value)">${esc(rowPlanText(sec))}</textarea><small>Ví dụ A:30, B:28, C:24. Nếu chỉ ghi A,B,C sẽ dùng số ghế mặc định.</small></label>
      <label>Ghế mặc định/hàng<input type="number" min="1" max="80" value="${sec.seatsPerRow}" onchange="seatStudioUpdate(${i},'seatsPerRow',this.value)"></label>
      <label>Số bắt đầu<input type="number" min="1" max="999" value="${sec.startNumber}" onchange="seatStudioUpdate(${i},'startNumber',this.value)"></label>
      <label>Vị trí X (%)<input type="number" min="0" max="94" step="0.5" value="${sec.x}" onchange="seatStudioUpdate(${i},'x',this.value)"></label>
      <label>Vị trí Y (%)<input type="number" min="0" max="94" step="0.5" value="${sec.y}" onchange="seatStudioUpdate(${i},'y',this.value)"></label>
      <label>Độ rộng khu (%)<input type="number" min="12" max="94" step="0.5" value="${sec.w}" onchange="seatStudioUpdate(${i},'w',this.value)"></label>
      <label>Thứ tự số<select onchange="seatStudioUpdate(${i},'reverse',this.value)"><option value="0" ${!sec.reverse?"selected":""}>Tăng dần →</option><option value="1" ${sec.reverse?"selected":""}>Giảm dần ←</option></select></label>
      <label>Khu dành riêng<select onchange="seatStudioUpdate(${i},'audience',this.value)">
        <option value="public" ${sec.audience==="public"?"selected":""}>Công khai</option>
        <option value="vip" ${sec.audience==="vip"?"selected":""}>VIP</option>
        <option value="bcn" ${sec.audience==="bcn"?"selected":""}>BCN</option>
        <option value="guest" ${sec.audience==="guest"?"selected":""}>Khách mời</option>
        <option value="artist" ${sec.audience==="artist"?"selected":""}>Nghệ sĩ</option>
        <option value="sponsor" ${sec.audience==="sponsor"?"selected":""}>Nhà tài trợ</option>
        <option value="media" ${sec.audience==="media"?"selected":""}>Media</option>
      </select><small>Khu khác “Công khai” chỉ Admin/BTC được cấp ghế.</small></label>
      <label class="seat-row-plan-label">VIP Seat Lock / Ghế khóa<input maxlength="1200" value="${esc((sec.lockedSeats||[]).join(", "))}" placeholder="A1, A2, B1-B4" onchange="seatStudioUpdate(${i},'lockedSeats',this.value)"><small>Khóa từng ghế khỏi cổng public, ví dụ A1, A2, B1-B4.</small></label>
    </div>
  </div>`;
}
function render(){
  const root=$("#eventSeatStudio");if(!root)return;
  const st=seatState.stage||normalizeStage();
  root.innerHTML=`<div class="seat-studio-card">
    <div class="seat-studio-head"><div><h4>Sơ đồ ghế</h4><p>Khách gửi form xong sẽ chuyển sang bước chọn ghế. Có thể tạo nhiều khu, kéo thả vị trí và đặt số ghế khác nhau cho từng hàng để mô phỏng sơ đồ nhà hát / hội trường.</p></div><label class="seat-toggle"><input type="checkbox" ${seatState.enabled?"checked":""} onchange="seatStudioSetEnabled(this.checked)"> Bật chọn ghế</label></div>
    <div class="${seatState.enabled?"":"hidden"}" id="seatStudioEnabledBody">
      <div class="seat-global-grid">
        <label>Tiêu đề bước chọn ghế<input id="seatStudioTitle" maxlength="100" value="${esc(seatState.title)}" onchange="seatStudioGlobal('title',this.value)"></label>
        <label>Nhãn sân khấu<input id="seatStudioStage" maxlength="80" value="${esc(seatState.stageLabel)}" onchange="seatStudioGlobal('stageLabel',this.value)"></label>
        <label>Chiều cao sơ đồ<input id="seatStudioHeight" type="number" min="360" max="1400" step="20" value="${seatState.canvasHeight}" onchange="seatStudioGlobal('canvasHeight',this.value)"></label>
        <div class="seat-total"><b>${totalSeats()}</b><span>Tổng số ghế</span></div>
      </div>
      <div class="seat-stage-editor">
        <b>Sân khấu</b>
        <label>X<input type="number" min="0" max="95" step="0.5" value="${st.x}" onchange="seatStudioStageUpdate('x',this.value)"></label>
        <label>Y<input type="number" min="0" max="90" step="0.5" value="${st.y}" onchange="seatStudioStageUpdate('y',this.value)"></label>
        <label>Rộng<input type="number" min="10" max="100" step="0.5" value="${st.w}" onchange="seatStudioStageUpdate('w',this.value)"></label>
        <label>Cao<input type="number" min="3" max="30" step="0.5" value="${st.h}" onchange="seatStudioStageUpdate('h',this.value)"></label>
      </div>
      <div class="seat-studio-toolbar"><button class="secondary" type="button" onclick="seatStudioAddSection()">+ Thêm khu ghế</button><span>Kéo tiêu đề khu hoặc sân khấu trên canvas để căn nhanh. Hàng có thể không đều nhau, ví dụ A:30, B:28, C:24.</span></div>
      ${previewHtml()}
      <div class="seat-section-editors">${seatState.sections.map(sectionEditor).join("")||'<div class="empty">Chưa có khu ghế. Bấm “+ Thêm khu ghế”.</div>'}</div>
      <div class="seat-security-note"><b>An toàn dữ liệu:</b> cổng public chỉ nhận mã ghế và trạng thái đã có người chọn, không nhận tên/MSSV của người giữ ghế. Khi hai người xác nhận cùng ghế, transaction phía server đảm bảo chỉ người commit thành công trước được giữ ghế.</div>
    </div>
  </div>`;
  bindDrag();
}
function bindDrag(){
  const canvas=$("#seatStudioCanvas");if(!canvas)return;
  const bind=(handle,kind,index)=>{
    handle.addEventListener("pointerdown",e=>{
      if(e.button!==undefined&&e.button!==0)return;
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      e.preventDefault();handle.setPointerCapture?.(e.pointerId);
      const startX=e.clientX,startY=e.clientY;
      const target=kind==="stage"?seatState.stage:seatState.sections[index];
      const block=kind==="stage"?handle:handle.closest(".seat-section-block");
      if(!target||!block)return;
      const ox=target.x,oy=target.y,w=target.w||20,h=target.h||6;
      const move=ev=>{
        target.x=clamp(ox+(ev.clientX-startX)/rect.width*100,0,100-w);
        target.y=clamp(oy+(ev.clientY-startY)/rect.height*100,0,kind==="stage"?100-h:94);
        block.style.left=target.x+"%";block.style.top=target.y+"%";
      };
      const up=()=>{handle.removeEventListener("pointermove",move);handle.removeEventListener("pointerup",up);handle.removeEventListener("pointercancel",up);render()};
      handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",up);handle.addEventListener("pointercancel",up);
    });
  };
  const stage=canvas.querySelector("[data-seat-stage-drag]");if(stage)bind(stage,"stage",-1);
  canvas.querySelectorAll("[data-seat-drag]").forEach(handle=>bind(handle,"section",Number(handle.dataset.seatDrag)));
}
function mount(config){seatState=normalize(config);render()}
function read(){return normalize(seatState)}
function setEnabled(v){seatState.enabled=v===true;if(seatState.enabled&&!seatState.sections.length)seatState.sections=[defaultSection(0)];render()}
function globalUpdate(k,v){if(k==="canvasHeight")seatState[k]=Math.round(clamp(v,360,1400));else seatState[k]=String(v||"").slice(0,k==="title"?100:80);render()}
function stageUpdate(k,v){if(!["x","y","w","h"].includes(k))return;const st=seatState.stage||normalizeStage();st[k]=clamp(v,k==="w"?10:k==="h"?3:0,k==="x"?95:k==="y"?90:k==="w"?100:30);if(st.x+st.w>100)st.x=Math.max(0,100-st.w);if(st.y+st.h>100)st.y=Math.max(0,100-st.h);seatState.stage=st;render()}
function addSection(){if(seatState.sections.length>=30)return alert("Tối đa 30 khu ghế.");seatState.sections.push(defaultSection(seatState.sections.length));render()}
function cloneSection(i){const src=seatState.sections[i];if(!src)return;if(seatState.sections.length>=30)return alert("Tối đa 30 khu ghế.");const copy=normalizeSection({...src,id:uid(),name:(src.name+" bản sao").slice(0,60),x:clamp(src.x+3,0,94),y:clamp(src.y+3,0,94)},seatState.sections.length);seatState.sections.splice(i+1,0,copy);render()}
function removeSection(i){if(!seatState.sections[i])return;if(!confirm("Xóa khu ghế này khỏi sơ đồ?"))return;seatState.sections.splice(i,1);render()}
function moveSection(i,d){const j=i+Number(d);if(i<0||j<0||i>=seatState.sections.length||j>=seatState.sections.length)return;[seatState.sections[i],seatState.sections[j]]=[seatState.sections[j],seatState.sections[i]];render()}
function update(i,k,v){
  const sec=seatState.sections[i];if(!sec)return;
  if(k==="rowPlan"){
    const specs=parseRowPlan(v,sec.seatsPerRow);
    sec.rowSpecs=specs.length?specs:[{label:"A",seats:sec.seatsPerRow}];sec.rows=sec.rowSpecs.map(x=>x.label);
  }else if(k==="reverse")sec.reverse=String(v)==="1";
  else if(["x","y","w"].includes(k))sec[k]=clamp(v,k==="w"?12:0,k==="w"?94:94);
  else if(k==="seatsPerRow"){
    const old=sec.seatsPerRow;sec.seatsPerRow=Math.round(clamp(v,1,80));
    sec.rowSpecs=sec.rowSpecs.map(r=>({label:r.label,seats:r.seats===old?sec.seatsPerRow:r.seats}));
  }else if(k==="startNumber")sec[k]=Math.round(clamp(v,1,999));
  else if(k==="name")sec.name=String(v||"").slice(0,60);
  else if(k==="audience")sec.audience=normalizeAudience(v);
  else if(k==="lockedSeats")sec.lockedSeats=parseLockedSeats(v);
  render();
}
window.seatStudioMount=mount;
window.seatStudioRead=read;
window.seatStudioSetEnabled=setEnabled;
window.seatStudioGlobal=globalUpdate;
window.seatStudioStageUpdate=stageUpdate;
window.seatStudioAddSection=addSection;
window.seatStudioCloneSection=cloneSection;
window.seatStudioRemoveSection=removeSection;
window.seatStudioMoveSection=moveSection;
window.seatStudioUpdate=update;
})();