/* Our Stage V95 — Public conditional form logic + destination bridge */
(()=>{
"use strict";
if(typeof seatApi!=="function"||typeof beginSeatSelection!=="function")return;

let pendingDestination="";

function destination(field,value){
  const map=field?.optionDestinations&&typeof field.optionDestinations==="object"?field.optionDestinations:{};
  const v=String(map?.[String(value??"")]||"").trim().toLowerCase();
  if(v==="seat"||v==="submit")return v;
  if(v.startsWith("section:")&&v.slice(8))return "section:"+v.slice(8);
  return "";
}
function fieldValue(field,index){
  const form=document.getElementById("eventForm");if(!form)return "";
  const key=typeof publicDomKey==="function"?publicDomKey(index):("ef_"+index);
  if(field?.type==="radio")return form.querySelector(`input[name="${key}"]:checked`)?.value||"";
  if(field?.type==="checkboxes")return [...form.querySelectorAll(`input[name="${key}"]:checked`)].map(x=>x.value);
  return form.querySelector(`[data-field-index="${index}"]`)?.value??"";
}
function activeIndices(){
  const fields=typeof publicNormalizeEventFields==="function"?publicNormalizeEventFields(eventConfig||{}):[],sectionIndex=new Map(),fieldIndex=new Map();
  fields.forEach((f,i)=>{if(f?.id)fieldIndex.set(String(f.id),i);if(f?.type==="section"&&f?.id)sectionIndex.set(String(f.id),i)});
  let active=fields.map(()=>true);
  for(let pass=0;pass<Math.max(2,fields.length+1);pass++){
    const next=fields.map(()=>true);
    fields.forEach((f,i)=>{
      const r=f?.visibilityRule&&typeof f.visibilityRule==="object"?f.visibilityRule:{},source=String(r.sourceFieldId||"").trim(),expected=String(r.equals??"").trim();
      if(!source||!expected)return;const si=fieldIndex.get(source);
      if(!Number.isInteger(si)||active[si]===false||String(fieldValue(fields[si],si)??"")!==expected)next[i]=false;
    });
    for(let i=0;i<fields.length;i++){
      if(active[i]===false||next[i]===false)continue;const f=fields[i];if(!["radio","select"].includes(String(f?.type||"")))continue;
      const d=destination(f,fieldValue(f,i));if(!d.startsWith("section:"))continue;
      const target=sectionIndex.get(d.slice(8));if(Number.isInteger(target)&&target>i+1)for(let j=i+1;j<target;j++)next[j]=false;
    }
    if(next.every((v,i)=>v===active[i])){active=next;break}
    active=next;
  }
  return{fields,active};
}
function applyFormLogic(){
  const mount=document.getElementById("eventFieldsMount");if(!mount)return;
  const {fields,active}=activeIndices();
  fields.forEach((f,i)=>{
    const card=mount.querySelector(`[data-field-card="${i}"]`)||mount.children[i];if(!card)return;
    const on=active[i]!==false;card.classList.toggle("event-logic-hidden",!on);card.setAttribute("aria-hidden",on?"false":"true");
    card.querySelectorAll("input,textarea,select,button").forEach(el=>{
      if(!on){el.dataset.v95LogicDisabled=el.disabled?"1":"0";el.disabled=true}
      else if(el.dataset.v95LogicDisabled!==undefined){if(el.dataset.v95LogicDisabled!=="1")el.disabled=false;delete el.dataset.v95LogicDisabled}
    });
  });
}
window.eventFormFieldActive=function(field,index){const x=activeIndices();return x.active[Number(index)]!==false};
window.applyEventFormLogic=applyFormLogic;

if(typeof renderFields==="function"){
  const baseRender=renderFields;
  renderFields=function(...args){const out=baseRender.apply(this,args);queueMicrotask(applyFormLogic);return out};
}
const form=document.getElementById("eventForm");
form?.addEventListener("change",()=>queueMicrotask(applyFormLogic));
form?.addEventListener("input",e=>{if(e.target?.matches?.("select,input[type=radio]"))queueMicrotask(applyFormLogic)});

const originalSeatApi=seatApi;
seatApi=async function(body,timeoutMs=18000){
  const data=await originalSeatApi(body,timeoutMs);
  if(String(body?.action||"")==="public-create-submission")pendingDestination=String(data?.nextDestination||"").toLowerCase();
  return data;
};
const originalBeginSeatSelection=beginSeatSelection;
beginSeatSelection=async function(session){
  const d=pendingDestination;pendingDestination="";
  if(d==="submit"){
    try{clearSeatSession()}catch{}
    eventSeatSelecting=false;showSubmissionSuccess();return;
  }
  return originalBeginSeatSelection(session);
};

const style=document.createElement("style");
style.textContent=".event-logic-hidden{display:none!important}";
document.head.appendChild(style);
queueMicrotask(applyFormLogic);
})();