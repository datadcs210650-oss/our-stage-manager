/* Our Stage V93 - Event option destinations (admin)
   Adds a destination to every radio option without changing legacy field rendering.
   Values:
   - default: follow the event's normal flow
   - seat: continue to Seat Studio after submit
   - submit: finish immediately; no seat session is created
*/
(()=>{
  "use strict";
  if(typeof normalizeEventField!=="function"||typeof renderEventFieldEditor!=="function")return;

  const normalizeDestination=value=>{
    const v=String(value||"default").trim().toLowerCase();
    return v==="seat"||v==="submit"?v:"default";
  };

  const normalizeDestinations=(field={},options=[])=>{
    const raw=(field.optionDestinations&&typeof field.optionDestinations==="object"&&!Array.isArray(field.optionDestinations))
      ?field.optionDestinations
      :((field.destinations&&typeof field.destinations==="object"&&!Array.isArray(field.destinations))?field.destinations:{});
    const fromObjects={};
    const rawOptions=Array.isArray(field.options)?field.options:(Array.isArray(field.choices)?field.choices:[]);
    rawOptions.forEach(item=>{
      if(!item||typeof item!=="object")return;
      const label=String(item.label??item.value??item.text??"").trim();
      if(label)fromObjects[label]=item.destination??item.target??item.next??"default";
    });
    const out={};
    (options||[]).forEach(option=>{
      const key=String(option||"");
      const destination=normalizeDestination(raw[key]??fromObjects[key]);
      if(destination!=="default")out[key]=destination;
    });
    return out;
  };

  const originalNormalizeEventField=normalizeEventField;
  normalizeEventField=function(field={}){
    const normalized=originalNormalizeEventField(field);
    normalized.optionDestinations=normalized.type==="radio"
      ?normalizeDestinations(field,normalized.options||[])
      :{};
    return normalized;
  };

  const originalUpdateEventBuilderField=updateEventBuilderField;
  updateEventBuilderField=function(index,key,value){
    originalUpdateEventBuilderField(index,key,value);
    const f=eventFieldByEditorIndex(index);
    if(!f)return;
    if(key==="options")f.optionDestinations=normalizeDestinations(f,f.options||[]);
  };

  function setDestination(index,option,value){
    const f=eventFieldByEditorIndex(index);
    if(!f||f.type!=="radio")return;
    const key=String(option||"");
    f.optionDestinations=normalizeDestinations(f,f.options||[]);
    const destination=normalizeDestination(value);
    if(destination==="default")delete f.optionDestinations[key];
    else f.optionDestinations[key]=destination;
  }

  function routingPanel(index,field){
    if(field.type!=="radio"||!(field.options||[]).length)return null;
    const panel=document.createElement("div");
    panel.className="event-option-routing-v93";
    panel.innerHTML=`
      <div class="event-option-routing-title">Đích đến theo từng lựa chọn</div>
      <div class="small-help event-option-routing-help">Chọn bước tiếp theo sau khi gửi. “Mặc định theo cổng” giữ luồng hiện tại; “Kết thúc form” sẽ không tạo phiên chọn ghế.</div>
      <div class="event-option-routing-list">
        ${(field.options||[]).map(option=>{
          const d=normalizeDestination(field.optionDestinations?.[option]);
          return `<label class="event-option-routing-row">
            <span>${esc(option)}</span>
            <select data-v93-route-index="${index}" data-v93-route-option="${esc(option)}">
              <option value="default" ${d==="default"?"selected":""}>Mặc định theo cổng</option>
              <option value="seat" ${d==="seat"?"selected":""}>Đi đến Chọn ghế</option>
              <option value="submit" ${d==="submit"?"selected":""}>Kết thúc form • Không chọn ghế</option>
            </select>
          </label>`;
        }).join("")}
      </div>`;
    return panel;
  }

  function mountRoutingPanels(){
    const root=document.getElementById("eventFieldEditor");
    if(!root||!Array.isArray(eventBuilderFields))return;

    eventBuilderFields.forEach((field,index)=>{
      if(field?.type!=="radio")return;
      const card=root.querySelector(`[data-event-field="${index}"]`);
      if(!card)return;
      const panel=routingPanel(index,field);
      if(panel)card.appendChild(panel);
    });

    root.querySelectorAll("[data-v93-route-index][data-v93-route-option]").forEach(select=>{
      select.addEventListener("change",()=>{
        setDestination(Number(select.dataset.v93RouteIndex),select.dataset.v93RouteOption,select.value);
      });
    });

    root.querySelectorAll('[data-event-key="options"]').forEach(input=>{
      input.addEventListener("change",()=>{
        const index=Number(input.dataset.eventIndex);
        const field=eventFieldByEditorIndex(index);
        if(field?.type!=="radio")return;
        field.optionDestinations=normalizeDestinations(field,field.options||[]);
        renderEventFieldEditor();
      });
    });
  }

  const originalRenderEventFieldEditor=renderEventFieldEditor;
  renderEventFieldEditor=function(){
    originalRenderEventFieldEditor();
    mountRoutingPanels();
  };

  const originalSaveEventBuilder=saveEventBuilder;
  saveEventBuilder=async function(){
    try{syncEventBuilderEditorFromDom()}catch{}
    const fields=Array.isArray(eventBuilderFields)?eventBuilderFields:[];
    const seating=typeof seatStudioRead==="function"?seatStudioRead():{enabled:false};
    if(!seating?.enabled&&fields.some(f=>f?.type==="radio"&&Object.values(f.optionDestinations||{}).includes("seat"))){
      alert("Có lựa chọn đang đặt đích đến là “Chọn ghế” nhưng sự kiện chưa bật sơ đồ ghế. Hãy bật chọn ghế hoặc đổi đích đến.");
      return;
    }
    return originalSaveEventBuilder();
  };

  const style=document.createElement("style");
  style.textContent=`
    .event-option-routing-v93{margin-top:11px;padding:12px;border:1px solid #eadfe2;border-radius:12px;background:#fffafa}
    .event-option-routing-title{font-size:12px;font-weight:900;color:#4f2734;margin-bottom:4px}
    .event-option-routing-help{margin-bottom:9px}
    .event-option-routing-list{display:grid;gap:8px}
    .event-option-routing-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,.72fr);gap:10px;align-items:center;padding:8px 10px;border:1px solid #efe4e7;border-radius:10px;background:#fff}
    .event-option-routing-row>span{font-size:11px;font-weight:750;overflow-wrap:anywhere}
    .event-option-routing-row select{width:100%;min-width:0}
    @media(max-width:760px){.event-option-routing-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();
