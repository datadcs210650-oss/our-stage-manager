/* Our Stage V95 — Advanced Event Form Logic
   - Per-option destination: next / seat / submit / section
   - Conditional visibility for questions
   - Backward compatible with V93 optionDestinations
*/
(()=>{
"use strict";
if(typeof normalizeEventField!=="function"||typeof renderEventFieldEditor!=="function")return;

const clean=v=>String(v??"").trim();
const isChoice=f=>["radio","select"].includes(String(f?.type||""));
const sectionFields=()=>Array.isArray(eventBuilderFields)?eventBuilderFields.filter(f=>f?.type==="section"&&f.id):[];
const choiceFields=()=>Array.isArray(eventBuilderFields)?eventBuilderFields.filter(f=>isChoice(f)&&f.id):[];

function normalizeDestination(value){
  const v=clean(value).toLowerCase();
  if(v==="seat"||v==="submit")return v;
  if(v.startsWith("section:")&&v.slice(8))return "section:"+v.slice(8);
  return "default";
}
function normalizeDestinations(field={},options=[]){
  const raw=(field.optionDestinations&&typeof field.optionDestinations==="object"&&!Array.isArray(field.optionDestinations))
    ?field.optionDestinations
    :((field.destinations&&typeof field.destinations==="object"&&!Array.isArray(field.destinations))?field.destinations:{});
  const fromObjects={};
  const rawOptions=Array.isArray(field.options)?field.options:(Array.isArray(field.choices)?field.choices:[]);
  rawOptions.forEach(item=>{if(!item||typeof item!=="object")return;const label=clean(item.label??item.value??item.text);if(label)fromObjects[label]=item.destination??item.target??item.next??"default"});
  const out={};
  for(const option of options||[]){const key=String(option||"");const d=normalizeDestination(raw[key]??fromObjects[key]);if(d!=="default")out[key]=d}
  return out;
}
function normalizeVisibility(field={}){
  const raw=field.visibilityRule&&typeof field.visibilityRule==="object"?field.visibilityRule:{};
  const sourceFieldId=clean(raw.sourceFieldId||raw.fieldId||raw.source);
  const equals=clean(raw.equals??raw.value);
  return sourceFieldId&&equals?{sourceFieldId,equals}:{sourceFieldId:"",equals:""};
}
const originalNormalizeEventField=normalizeEventField;
normalizeEventField=function(field={}){
  const normalized=originalNormalizeEventField(field);
  normalized.optionDestinations=isChoice(normalized)?normalizeDestinations(field,normalized.options||[]):{};
  normalized.visibilityRule=normalizeVisibility(field);
  return normalized;
};

const originalUpdateEventBuilderField=updateEventBuilderField;
updateEventBuilderField=function(index,key,value){
  originalUpdateEventBuilderField(index,key,value);
  const f=eventFieldByEditorIndex(index);if(!f)return;
  if(key==="options"&&isChoice(f))f.optionDestinations=normalizeDestinations(f,f.options||[]);
};

function setDestination(index,option,value){
  const f=eventFieldByEditorIndex(index);if(!f||!isChoice(f))return;
  const key=String(option||"");f.optionDestinations=normalizeDestinations(f,f.options||[]);
  const d=normalizeDestination(value);if(d==="default")delete f.optionDestinations[key];else f.optionDestinations[key]=d;
}
function destinationOptions(selected){
  const sections=sectionFields();
  return `<option value="default" ${selected==="default"?"selected":""}>Tiếp tục bình thường</option>
    <option value="seat" ${selected==="seat"?"selected":""}>Đi đến Chọn ghế</option>
    <option value="submit" ${selected==="submit"?"selected":""}>Kết thúc & gửi form</option>
    ${sections.map(s=>{const v="section:"+s.id;return `<option value="${esc(v)}" ${selected===v?"selected":""}>Chuyển đến phần: ${esc(s.label||"Phần")}</option>`}).join("")}`;
}
function routingPanel(index,field){
  if(!isChoice(field)||!(field.options||[]).length)return null;
  const panel=document.createElement("div");panel.className="event-option-routing-v95";
  panel.innerHTML=`<div class="event-option-routing-title">Đích đến / Section Branching</div>
  <div class="small-help">Mỗi lựa chọn có thể tiếp tục bình thường, chuyển tới một Phần, kết thúc form hoặc mở bước chọn ghế.</div>
  <div class="event-option-routing-list">${(field.options||[]).map(option=>{const d=normalizeDestination(field.optionDestinations?.[option]);return `<label class="event-option-routing-row"><span>${esc(option)}</span><select data-v95-route-index="${index}" data-v95-route-option="${esc(option)}">${destinationOptions(d)}</select></label>`}).join("")}</div>`;
  return panel;
}
function visibilityPanel(index,field){
  if(field.type==="section")return null;
  const sources=choiceFields().filter(x=>x.id!==field.id);
  if(!sources.length)return null;
  const rule=normalizeVisibility(field),source=sources.find(x=>x.id===rule.sourceFieldId);
  const panel=document.createElement("div");panel.className="event-visibility-v95";
  panel.innerHTML=`<div class="event-option-routing-title">Điều kiện hiển thị</div>
    <div class="small-help">Dùng khi chỉ muốn hiện câu hỏi này sau một lựa chọn cụ thể. Để “Luôn hiển thị” nếu không cần điều kiện.</div>
    <div class="event-visibility-grid">
      <label>Nguồn điều kiện<select data-v95-vis-source="${index}"><option value="">Luôn hiển thị</option>${sources.map(s=>`<option value="${esc(s.id)}" ${rule.sourceFieldId===s.id?"selected":""}>${esc(s.label||"Câu hỏi")}</option>`).join("")}</select></label>
      <label>Hiện khi chọn<select data-v95-vis-value="${index}" ${source?"":"disabled"}><option value="">-- Chọn đáp án --</option>${(source?.options||[]).map(o=>`<option value="${esc(o)}" ${rule.equals===o?"selected":""}>${esc(o)}</option>`).join("")}</select></label>
    </div>`;
  return panel;
}
function mountPanels(){
  const root=document.getElementById("eventFieldEditor");if(!root||!Array.isArray(eventBuilderFields))return;
  eventBuilderFields.forEach((field,index)=>{
    const card=root.querySelector(`[data-event-field="${index}"]`);if(!card)return;
    const rp=routingPanel(index,field);if(rp)card.appendChild(rp);
    const vp=visibilityPanel(index,field);if(vp)card.appendChild(vp);
  });
  root.querySelectorAll("[data-v95-route-index][data-v95-route-option]").forEach(sel=>sel.addEventListener("change",()=>setDestination(Number(sel.dataset.v95RouteIndex),sel.dataset.v95RouteOption,sel.value)));
  root.querySelectorAll("[data-v95-vis-source]").forEach(sel=>sel.addEventListener("change",()=>{
    const i=Number(sel.dataset.v95VisSource),f=eventFieldByEditorIndex(i);if(!f)return;
    f.visibilityRule={sourceFieldId:sel.value,equals:""};renderEventFieldEditor();
  }));
  root.querySelectorAll("[data-v95-vis-value]").forEach(sel=>sel.addEventListener("change",()=>{
    const i=Number(sel.dataset.v95VisValue),f=eventFieldByEditorIndex(i);if(!f)return;
    const source=root.querySelector(`[data-v95-vis-source="${i}"]`)?.value||"";
    f.visibilityRule=source&&sel.value?{sourceFieldId:source,equals:sel.value}:{sourceFieldId:"",equals:""};
  }));
  root.querySelectorAll('[data-event-key="options"]').forEach(input=>input.addEventListener("change",()=>{const i=Number(input.dataset.eventIndex),f=eventFieldByEditorIndex(i);if(isChoice(f)){f.optionDestinations=normalizeDestinations(f,f.options||[]);renderEventFieldEditor()}}));
}
const originalRenderEventFieldEditor=renderEventFieldEditor;
renderEventFieldEditor=function(){originalRenderEventFieldEditor();mountPanels()};

const originalSaveEventBuilder=saveEventBuilder;
saveEventBuilder=async function(){
  try{syncEventBuilderEditorFromDom()}catch{}
  const fields=Array.isArray(eventBuilderFields)?eventBuilderFields:[];
  const seating=typeof seatStudioRead==="function"?seatStudioRead():{enabled:false};
  if(!seating?.enabled&&fields.some(f=>isChoice(f)&&Object.values(f.optionDestinations||{}).includes("seat"))){
    alert("Có lựa chọn dẫn tới “Chọn ghế” nhưng sự kiện chưa bật sơ đồ ghế.");return;
  }
  const sectionIds=new Set(fields.filter(f=>f.type==="section").map(f=>f.id));
  for(const f of fields){
    for(const d of Object.values(f.optionDestinations||{})){if(String(d).startsWith("section:")&&!sectionIds.has(String(d).slice(8))){alert("Có nhánh đang trỏ tới một Phần đã bị xóa. Hãy chọn lại đích đến.");return}}
    const r=normalizeVisibility(f);if(r.sourceFieldId&&!fields.some(x=>x.id===r.sourceFieldId&&isChoice(x))){alert("Có điều kiện hiển thị đang trỏ tới câu hỏi không còn tồn tại.");return}
  }
  return originalSaveEventBuilder();
};

const style=document.createElement("style");
style.textContent=`
.event-option-routing-v95,.event-visibility-v95{margin-top:11px;padding:12px;border:1px solid #eadfe2;border-radius:12px;background:#fffafa}
.event-visibility-v95{background:#fbfcff;border-color:#e1e5ee}
.event-option-routing-title{font-size:12px;font-weight:900;color:#4f2734;margin-bottom:4px}
.event-option-routing-list{display:grid;gap:8px;margin-top:9px}
.event-option-routing-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,.8fr);gap:10px;align-items:center;padding:8px 10px;border:1px solid #efe4e7;border-radius:10px;background:#fff}
.event-option-routing-row>span{font-size:11px;font-weight:750;overflow-wrap:anywhere}
.event-option-routing-row select,.event-visibility-grid select{width:100%;min-width:0}
.event-visibility-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:9px}
@media(max-width:760px){.event-option-routing-row,.event-visibility-grid{grid-template-columns:1fr}}
`;
document.head.appendChild(style);
})();