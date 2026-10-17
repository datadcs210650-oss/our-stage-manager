"use strict";

const {getAdminApp,sendJson,requireManager}=require("../lib/firebase-admin");
const {classifyMonitoringFailure}=require("../lib/firebase-quota-diagnostics");

const LIMITS={reads:50000,writes:20000,deletes:20000};
const METRICS={
  reads:"firestore.googleapis.com/document/read_ops_count",
  writes:"firestore.googleapis.com/document/write_ops_count",
  deletes:"firestore.googleapis.com/document/delete_ops_count"
};

function partsAt(date,timeZone){
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const map={};for(const p of fmt.formatToParts(date))if(p.type!=="literal")map[p.type]=Number(p.value);
  return map
}
function zonedMidnightUtc(timeZone){
  const now=new Date(),p=partsAt(now,timeZone),target=Date.UTC(p.year,p.month-1,p.day,0,0,0);let guess=target;
  for(let i=0;i<3;i++){const g=partsAt(new Date(guess),timeZone),represented=Date.UTC(g.year,g.month-1,g.day,g.hour,g.minute,g.second);guess+=target-represented}
  return new Date(guess)
}
async function monitoringSum({token,projectId,metric,start,end}){
  let pageToken="",sum=0,pages=0;
  do{
    const u=new URL(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries`);
    u.searchParams.set("filter",`metric.type="${metric}"`);
    u.searchParams.set("interval.startTime",start.toISOString());
    u.searchParams.set("interval.endTime",end.toISOString());
    u.searchParams.set("view","FULL");u.searchParams.set("pageSize","1000");if(pageToken)u.searchParams.set("pageToken",pageToken);
    const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      const g=d?.error||{};
      const reasons=(Array.isArray(g.details)?g.details:[]).map(x=>String(x?.reason||"")).filter(Boolean);
      const e=new Error(String(g.message||`Cloud Monitoring lỗi ${r.status}`).slice(0,1000));
      e.status=r.status;
      e.googleReason=reasons.join(" ");
      e.googleStatus=String(g.status||"");
      e.metric=metric;
      throw e;
    }
    for(const ts of d.timeSeries||[])for(const pt of ts.points||[]){const v=pt?.value?.int64Value??pt?.value?.doubleValue??0;const n=Number(v);if(Number.isFinite(n))sum+=n}
    pageToken=String(d.nextPageToken||"");pages++;
  }while(pageToken&&pages<10);
  // Never present a truncated partial page as the full day's usage.
  if(pageToken){const e=new Error("Cloud Monitoring trả về quá nhiều trang dữ liệu.");e.status=503;throw e}
  return Math.max(0,Math.round(sum))
}
module.exports=async function handler(req,res){
  try{
    await requireManager(req);
    if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ GET/POST."})}
    const app=getAdminApp(),projectId=String(app.options.projectId||process.env.FIREBASE_PROJECT_ID||process.env.GCLOUD_PROJECT||"");
    if(!projectId)return sendJson(res,200,{ok:true,version:95,available:false,error:"Không xác định được Firebase project ID."});
    const access=await app.options.credential.getAccessToken(),token=access?.access_token;if(!token)return sendJson(res,200,{ok:true,version:95,available:false,error:"Không lấy được quyền đọc Cloud Monitoring."});
    const end=new Date(),start=zonedMidnightUtc("America/Los_Angeles");
    try{
      const [reads,writes,deletes]=await Promise.all(Object.entries(METRICS).map(async([key,metric])=>[key,await monitoringSum({token,projectId,metric,start,end})]));
      const used=Object.fromEntries([reads,writes,deletes]),rows={};
      for(const key of Object.keys(LIMITS)){const limit=LIMITS[key],value=Number(used[key]||0);rows[key]={used:value,limit,remaining:Math.max(0,limit-value),percent:Math.min(100,Math.round(value/limit*1000)/10)}}
      return sendJson(res,200,{ok:true,version:106,available:true,projectId,period:{start:start.toISOString(),end:end.toISOString(),resetTimezone:"America/Los_Angeles"},quota:rows,source:"Google Cloud Monitoring",note:"Số liệu Monitoring có thể trễ vài phút. Giới hạn hiển thị là mức miễn phí hằng ngày tham chiếu của Cloud Firestore Standard."});
    }catch(e){
      const diagnosis=classifyMonitoringFailure({httpStatus:e.status,message:e.message,googleReason:e.googleReason,googleStatus:e.googleStatus});
      // Only log a bounded Google error text on the server; never send it to the client.
      console.warn("firebase quota monitoring unavailable",JSON.stringify({
        projectId,metric:String(e.metric||""),httpStatus:Number(e.status||0),
        diagnosis:diagnosis.code,googleReason:String(e.googleReason||"").slice(0,100),
        googleMessage:String(e.message||"").slice(0,400)
      }));
      return sendJson(res,200,{ok:true,version:106,available:false,projectId,period:{start:start.toISOString(),end:end.toISOString(),resetTimezone:"America/Los_Angeles"},limits:LIMITS,
        error:diagnosis.description,errorCode:diagnosis.code,httpStatus:Number(e.status||0)});

    }
  }catch(e){
    const code=String(e?.code||"");const status=code==="osc/unauthenticated"?401:["osc/forbidden","osc/inactive","osc/no-profile"].includes(code)?403:500;
    return sendJson(res,status,{ok:false,error:code.startsWith("osc/")?String(e.message||"Yêu cầu không thành công."):"Máy chủ không thể hoàn tất yêu cầu.",code:code||"osc/server-error"});
  }
};