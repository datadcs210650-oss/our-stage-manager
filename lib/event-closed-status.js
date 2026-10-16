"use strict";

// Keep this as a library module, not api/*.js: Vercel Hobby bundles one
// function per API entrypoint. Only public closed-event metadata is returned.
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
async function publicClosedStatus(req,res,{getDb,sendJson}){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET."});
  }
  const id=req.query?.event;
  if(typeof id!=="string"||!EVENT_ID.test(id)){
    return sendJson(res,400,{ok:false,error:"Liên kết sự kiện không hợp lệ."});
  }
  try{
    const snap=await getDb().collection("eventPortals").doc(id).get();
    if(!snap.exists)return sendJson(res,404,{ok:false,error:"Không tìm thấy sự kiện."});
    const result=publicClosedState(snap.data());
    if(!result)return sendJson(res,404,{ok:false,error:"Không có thông tin sự kiện đã đóng."});
    return sendJson(res,200,{ok:true,...result});
  }catch(e){
    console.error("public closed event status unavailable",String(e?.code||"server-error"));
    return sendJson(res,503,{ok:false,error:"Không thể tải trạng thái sự kiện."});
  }
}
module.exports={publicClosedStatus,publicClosedState};
