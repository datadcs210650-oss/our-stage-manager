"use strict";

// Public endpoint for named CLOSED event landing pages.
// Never return form fields, registration data, submissions or private settings.
const {getDb,sendJson}=require("../lib/firebase-admin");
const EVENT_ID=/^[A-Za-z0-9_-]{1,180}$/;

function millis(v){
  try{return v?.toMillis?.()||v?.toDate?.()?.getTime?.()||Number(v||0)||0}
  catch{return 0}
}
function publicClosedState(event,now=Date.now()){
  if(!event||typeof event!=="object")return null;
  const end=millis(event.closeAt);
  if(event.isOpen===true&&(!end||end>now))return null;
  const title=String(event.title||"").replace(/[\x00-\x1F\x7F]/g," ").trim().slice(0,200);
  if(!title)return null;
  return {closed:true,reason:end&&now>=end?"expired":"closed",title};
}
function readEventId(req){
  const input=req.query?.event;
  if(typeof input!=="string"||!EVENT_ID.test(input))return null;
  return input;
}
module.exports=async function handler(req,res){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET."});
  }
  const eventId=readEventId(req);
  if(!eventId)return sendJson(res,400,{ok:false,error:"Liên kết sự kiện không hợp lệ."});
  try{
    const snap=await getDb().collection("eventPortals").doc(eventId).get();
    if(!snap.exists)return sendJson(res,404,{ok:false,error:"Không tìm thấy sự kiện."});
    const result=publicClosedState(snap.data());
    if(!result)return sendJson(res,404,{ok:false,error:"Không có thông tin sự kiện đã đóng."});
    return sendJson(res,200,{ok:true,...result});
  }catch(e){
    console.error("public closed event status unavailable",String(e?.code||"server-error"));
    return sendJson(res,503,{ok:false,error:"Không thể tải trạng thái sự kiện."});
  }
};
