(()=>{
"use strict";
let seatState={enabled:false,title:"Chọn ghế",stageLabel:"SÂN KHẤU",canvasHeight:640,sections:[]};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const uid=()=>("sec_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)).replace(/[^A-Za-z0-9_-]/g,"");
function rows(v){const a=Array.isArray(v)?v:String(v||"").split(",");return a.map(x=>String(x).trim()).filter(Boolean).slice(0,40)}
function normalize(config){
  const c=config&&typeof config==="object"?config:{};
  return{
    enabled:c.enabled===true,title:String(c.title||"Chọn ghế").slice(0,100),stageLabel:String(c.stageLabel||"SÂN KHẤU").slice(0,80),
    canvasHeight:Math.round(clamp(c.canvasHeight||640,360,1200)),
    sections:(Array.isArray(c.sections)?c.sections:[]).slice(0,30).map((s,i)=>({
      id:String(s.id||uid()).replace(/[^A-Za-z0-9_-]/g,"_").slice(0,48)||uid(),
      name:String(s.name||("Khu "+(i+1))).slice(0,60),x:clamp(s.x,0,92),y:clamp(s.y,0,92),w:clamp(s.w||32,12,90),
      rows:(rows(s.rows).length?rows(s.rows):["A"]),seatsPerRow:Math.round(clamp(s.seatsPerRow||10,1,60)),
      startNumber:Math.round(clamp(s.startNumber||1,1,999)),reverse:s.reverse===true
    }))
  }
}
function defaultSection(i=0){return{id:uid(),name:"Khu "+String.fromCharCode(65+i),x:8+(i%3)*30,y:22+Math.floor(i/3)*30,w:26,rows:[String.fromCharCode(65+i*3),String.fromCharCode(66+i*3),String.fromCharCode(67+i*3)],seatsPerRow:10,startNumber:1,reverse:false}}
function totalSeats(){return seatState.sections.reduce((n,s)=>n+s.rows.length*s.seatsPerRow,0)}
function stageHtml(){return `<div class="seat-stage-label">${esc(seatState.stageLabel||"SÂN KHẤU")}</div>`}
function seatCells(sec){
  const rowsHtml=sec.rows.map(r=>{
    const nums=Array.from({length:sec.seatsPerRow},(_,i)=>sec.startNumber+(sec.reverse?(sec.seatsPerRow-1-i):i));
    return `<div class="seat-mini-row"><span class="seat-row-label">${esc(r)}</span><div class="seat-mini-grid" style="--seat-cols:${Math.min(sec.seatsPerRow,60)}">${nums.map(n=>`<span title="${esc(r)}${n}">${n}</span>`).join("")}</div></div>`
  }).join("");
  return rowsHtml
}
function previewHtml(){
  return `<div id="seatStudioCanvas" class="seat-studio-canvas" style="height:${seatState.canvasHeight}px">${stageHtml()}${seatState.sections.map((sec,i)=>`<div class="seat-section-block" data-seat-section="${i}" style="left:${sec.x}%;top:${sec.y}%;width:${sec.w}%"><div class="seat-section-drag" data-seat-drag="${i}"><b>${esc(sec.name)}</b><span>${sec.rows.length*sec.seatsPerRow} ghế</span></div><div class="seat-section-preview">${seatCells(sec)}</div></div>`).join("")}</div>`
}
function sectionEditor(sec,i){
  return `<div class="seat-section-editor" data-seat-editor="${i}">
    <div class="seat-editor-head"><b>${esc(sec.name)}</b><div><button type="button" class="secondary" onclick="seatStudioMoveSection(${i},-1)" ${i===0?"disabled":""}>↑</button><button type="button" class="secondary" onclick="seatStudioMoveSection(${i},1)" ${i===seatState.sections.length-1?"disabled":""}>↓</button><button type="button" class="danger" onclick="seatStudioRemoveSection(${i})">Xóa</button></div></div>
    <div class="seat-editor-grid">
      <label>Tên khu<input value="${esc(sec.name)}" maxlength="60" onchange="seatStudioUpdate(${i},'name',this.value)"></label>
      <label>Hàng ghế<input value="${esc(sec.rows.join(","))}" maxlength="240" placeholder="A,B,C,D" onchange="seatStudioUpdate(${i},'rows',this.value)"></label>
      <label>Ghế mỗi hàng<input type="number" min="1" max="60" value="${sec.seatsPerRow}" onchange="seatStudioUpdate(${i},'seatsPerRow',this.value)"></label>
      <label>Số bắt đầu<input type="number" min="1" max="999" value="${sec.startNumber}" onchange="seatStudioUpdate(${i},'startNumber',this.value)"></label>
      <label>Vị trí X (%)<input type="number" min="0" max="92" step="0.5" value="${sec.x}" onchange="seatStudioUpdate(${i},'x',this.value)"></label>
      <label>Vị trí Y (%)<input type="number" min="0" max="92" step="0.5" value="${sec.y}" onchange="seatStudioUpdate(${i},'y',this.value)"></label>
      <label>Độ rộng khu (%)<input type="number" min="12" max="90" step="0.5" value="${sec.w}" onchange="seatStudioUpdate(${i},'w',this.value)"></label>
      <label>Thứ tự số<select onchange="seatStudioUpdate(${i},'reverse',this.value)"><option value="0" ${!sec.reverse?"selected":""}>Tăng dần →</option><option value="1" ${sec.reverse?"selected":""}>Giảm dần ←</option></select></label>
    </div>
  </div>`
}
function render(){
  const root=$("#eventSeatStudio");if(!root)return;
  root.innerHTML=`<div class="seat-studio-card">
    <div class="seat-studio-head"><div><h4>Sơ đồ ghế</h4><p>Khách gửi form xong sẽ chuyển sang bước chọn ghế. Khi hai người chọn cùng một ghế, giao dịch Firestore sẽ giữ ghế cho người xác nhận thành công trước.</p></div><label class="seat-toggle"><input type="checkbox" ${seatState.enabled?"checked":""} onchange="seatStudioSetEnabled(this.checked)"> Bật chọn ghế</label></div>
    <div class="${seatState.enabled?"":"hidden"}" id="seatStudioEnabledBody">
      <div class="seat-global-grid">
        <label>Tiêu đề bước chọn ghế<input id="seatStudioTitle" maxlength="100" value="${esc(seatState.title)}" onchange="seatStudioGlobal('title',this.value)"></label>
        <label>Nhãn sân khấu<input id="seatStudioStage" maxlength="80" value="${esc(seatState.stageLabel)}" onchange="seatStudioGlobal('stageLabel',this.value)"></label>
        <label>Chiều cao sơ đồ<input id="seatStudioHeight" type="number" min="360" max="1200" step="20" value="${seatState.canvasHeight}" onchange="seatStudioGlobal('canvasHeight',this.value)"></label>
        <div class="seat-total"><b>${totalSeats()}</b><span>Tổng số ghế</span></div>
      </div>
      <div class="seat-studio-toolbar"><button class="secondary" type="button" onclick="seatStudioAddSection()">+ Thêm khu ghế</button><span>Kéo thanh tiêu đề của từng khu trên sơ đồ để căn vị trí nhanh.</span></div>
      ${previewHtml()}
      <div class="seat-section-editors">${seatState.sections.map(sectionEditor).join("")||'<div class="empty">Chưa có khu ghế. Bấm “+ Thêm khu ghế”.</div>'}</div>
      <div class="seat-security-note"><b>An toàn dữ liệu:</b> sơ đồ chỉ công khai mã ghế và trạng thái đã có người chọn. Tên/MSSV của người giữ ghế không được gửi ra cổng public. Xác nhận ghế chạy bằng transaction phía server.</div>
    </div>
  </div>`;
  bindDrag()
}
function bindDrag(){
  const canvas=$("#seatStudioCanvas");if(!canvas)return;
  canvas.querySelectorAll("[data-seat-drag]").forEach(handle=>{
    handle.addEventListener("pointerdown",e=>{
      if(e.button!==undefined&&e.button!==0)return;
      const i=Number(handle.dataset.seatDrag),sec=seatState.sections[i],block=handle.closest(".seat-section-block");if(!sec||!block)return;
      e.preventDefault();handle.setPointerCapture?.(e.pointerId);
      const rect=canvas.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,ox=sec.x,oy=sec.y;
      const move=ev=>{sec.x=clamp(ox+(ev.clientX-startX)/rect.width*100,0,100-sec.w);sec.y=clamp(oy+(ev.clientY-startY)/rect.height*100,8,92);block.style.left=sec.x+"%";block.style.top=sec.y+"%"};
      const up=()=>{handle.removeEventListener("pointermove",move);handle.removeEventListener("pointerup",up);handle.removeEventListener("pointercancel",up);render()};
      handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",up);handle.addEventListener("pointercancel",up)
    })
  })
}
function mount(config){seatState=normalize(config);render()}
function read(){return normalize(seatState)}
function setEnabled(v){seatState.enabled=v===true;if(seatState.enabled&&!seatState.sections.length)seatState.sections=[defaultSection(0)];render()}
function globalUpdate(k,v){if(k==="canvasHeight")seatState[k]=Math.round(clamp(v,360,1200));else seatState[k]=String(v||"").slice(0,k==="title"?100:80);render()}
function addSection(){if(seatState.sections.length>=30)return alert("Tối đa 30 khu ghế.");seatState.sections.push(defaultSection(seatState.sections.length));render()}
function removeSection(i){if(!seatState.sections[i])return;if(!confirm("Xóa khu ghế này khỏi sơ đồ?"))return;seatState.sections.splice(i,1);render()}
function moveSection(i,d){const j=i+Number(d);if(i<0||j<0||i>=seatState.sections.length||j>=seatState.sections.length)return;[seatState.sections[i],seatState.sections[j]]=[seatState.sections[j],seatState.sections[i]];render()}
function update(i,k,v){const sec=seatState.sections[i];if(!sec)return;if(k==="rows")sec.rows=rows(v).length?rows(v):["A"];else if(k==="reverse")sec.reverse=String(v)==="1";else if(["x","y","w"].includes(k))sec[k]=clamp(v,k==="w"?12:0,k==="w"?90:92);else if(k==="seatsPerRow")sec[k]=Math.round(clamp(v,1,60));else if(k==="startNumber")sec[k]=Math.round(clamp(v,1,999));else if(k==="name")sec.name=String(v||"").slice(0,60);render()}
window.seatStudioMount=mount;window.seatStudioRead=read;window.seatStudioSetEnabled=setEnabled;window.seatStudioGlobal=globalUpdate;window.seatStudioAddSection=addSection;window.seatStudioRemoveSection=removeSection;window.seatStudioMoveSection=moveSection;window.seatStudioUpdate=update;
})();
