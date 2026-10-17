"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const DIAG=require("../lib/firebase-quota-diagnostics");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Google Cloud 403 errors map to separate, actionable causes, not generic IAM misdiagnosis",()=>{
 const cases=[
  ["This API method requires billing to be enabled", "BILLING_REQUIRED"],
  ["Billing account disabled for project", "BILLING_REQUIRED"],
  ["Cloud Monitoring API has not been used in project 42 before or it is disabled", "MONITORING_API_DISABLED"],
  ["Permission monitoring.timeSeries.list denied (or the resource may not exist).", "MONITORING_PERMISSION_DENIED"],
  ["Request had insufficient authentication scopes.", "AUTH_SCOPE_MISSING"],
  ["Permission serviceusage.services.use denied.", "SERVICE_USAGE_DENIED"],
  ["Unknown rejection", "GOOGLE_FORBIDDEN"]
 ];
 for(const [message,expected] of cases){
  const diagnosis=DIAG.classifyMonitoringFailure({httpStatus:403,message});
  assert.equal(diagnosis.code,expected,message);
  assert.ok(diagnosis.description.length>30);
  assert.doesNotMatch(diagnosis.description,/FIREBASE_PRIVATE_KEY|access_token|private_key/);
 }
 assert.equal(DIAG.classifyMonitoringFailure({httpStatus:403,googleReason:"BILLING_DISABLED"}).code,"BILLING_REQUIRED");
 assert.equal(DIAG.classifyMonitoringFailure({httpStatus:403,googleReason:"SERVICE_DISABLED"}).code,"MONITORING_API_DISABLED");
 assert.equal(DIAG.classifyMonitoringFailure({httpStatus:429}).code,"MONITORING_RATE_LIMIT");
 assert.equal(DIAG.classifyMonitoringFailure({httpStatus:404}).code,"PROJECT_NOT_FOUND");
});

function mockServer(onFetch,{roleAllowed=true}={}){
 const calls=[],response={};
 const fakeApp={options:{projectId:"clb-our",credential:{
  getAccessToken:async()=>({access_token:"super-secret-token"})
 }}};
 const fakeAdmin={
  getAdminApp:()=>fakeApp,
  requireManager:async()=>{if(!roleAllowed)throw Object.assign(new Error("Access denied"),{code:"osc/forbidden"})},
  sendJson:(res,status,obj)=>{res.status=status;res.payload=obj;return obj}
 };
 const sandbox={module:{exports:{}},URL,Date,Intl,process:{env:{}},
  console:{warn:(...x)=>calls.push(x)},
  fetch:async(url,options)=>onFetch(url,options,calls),
  require:id=>{
   if(id==="../lib/firebase-admin")return fakeAdmin;
   if(id==="../lib/firebase-quota-diagnostics")return DIAG;
   throw Error("Unexpected module "+id);
  }
 };
 vm.runInNewContext(read("api/firebase-quota.js"),sandbox);
 return{handler:sandbox.module.exports,response,calls};
}

test("HTTP 403 billing failure shows diagnosis, never leaks the Google error body or credential",async()=>{
 const g=mockServer(async(url,opts)=>{
  assert.ok(String(url).startsWith("https://monitoring.googleapis.com/v3/projects/clb-our/timeSeries"));
  assert.equal(opts.headers.Authorization,"Bearer super-secret-token");
  return{ok:false,status:403,json:async()=>({error:{
    message:"This API method requires billing to be enabled. SECRET_TO_NOT_EXPOSE",
    status:"PERMISSION_DENIED",details:[{reason:"BILLING_DISABLED"}]
  }})};
 });
 await g.handler({method:"POST"},g.response);
 assert.equal(g.response.status,200);
 assert.equal(g.response.payload.available,false);
 assert.equal(g.response.payload.errorCode,"BILLING_REQUIRED");
 assert.equal(g.response.payload.projectId,"clb-our");
 assert.equal(g.response.payload.httpStatus,403);
 assert.ok(!JSON.stringify(g.response.payload).includes("SECRET_TO_NOT_EXPOSE"));
 assert.ok(!JSON.stringify(g.response.payload).includes("super-secret-token"));
 assert.ok(g.calls.length>0);
});

test("correctly authorized Monitoring request still returns daily usage after diagnosis update",async()=>{
 const g=mockServer(async(url,opts)=>{
  const u=new URL(url);
  const metric=u.searchParams.get("filter")||"";
  const used=metric.includes("/read_ops_count")?40:metric.includes("/write_ops_count")?3:1;
  return{ok:true,status:200,json:async()=>({timeSeries:[{points:[{value:{int64Value:String(used)}}]}]})};
 });
 await g.handler({method:"POST"},g.response);
 assert.equal(g.response.status,200);
 assert.equal(g.response.payload.available,true);
 assert.equal(g.response.payload.quota.reads.used,40);
 assert.equal(g.response.payload.quota.writes.used,3);
 assert.equal(g.response.payload.quota.deletes.used,1);
 assert.equal(g.response.payload.quota.reads.limit,50000);
 assert.equal(g.response.payload.period.resetTimezone,"America/Los_Angeles");
});

test("Firebase quota endpoint stays Manager-only and requires authorized user",async()=>{
 const g=mockServer(async()=>{throw Error("Should not call Monitoring for BCN")},{roleAllowed:false});
 await g.handler({method:"POST"},g.response);
 assert.equal(g.response.status,403);
 assert.equal(g.response.payload.ok,false);
 assert.equal(g.calls.length,0);
});
test("monitoring UI exposes diagnostic and project, not credentials",()=>{
 const ui=read("v95-operations.js"),html=read("index.html"),server=read("api/firebase-quota.js");
 assert.match(ui,/Mã chẩn đoán/);
 assert.match(ui,/opQuota\.errorCode/);
 assert.match(ui,/esc95\(code\)/);
 assert.match(ui,/esc95\(project\)/);
 assert.match(html,/\/v95-operations\.js\?v=107/);
 assert.match(server,/classifyMonitoringFailure/);
 assert.match(server,/if\(pageToken\)/);
 assert.doesNotMatch(server,/error:e\.message/);
});
