"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const ROOT=path.join(__dirname,"..");
const read=f=>fs.readFileSync(path.join(ROOT,f),"utf8");

test("advanced operations menu and quota API are removed; security and event tools preserved",()=>{
 const html=read("index.html"),util=read("v95-operations.js");
 assert.doesNotMatch(html,/data-tab="operations"|id="operations"|v95OperationsRoot|renderV95Operations|operations:\{label:"Điều hành nâng cao"/);
 assert.match(html,/if\(tab==="operations"\)return false/);
 assert.doesNotMatch(util,/firebase-quota|renderQuota|renderV95Operations|v95LoadQuota|v95Quota/);
 for(const key of ["v95RefreshTemporaryPermissions","v95OpenTempGrant","v95SaveTemp","openV95EventControl"])
   assert.ok(util.includes(key),key+" must remain operational");
 assert.ok(!fs.existsSync(path.join(ROOT,"api/firebase-quota.js")));
 assert.ok(!fs.existsSync(path.join(ROOT,"lib/firebase-quota-diagnostics.js")));
 assert.equal(fs.readdirSync(path.join(ROOT,"api")).filter(x=>x.endsWith(".js")).length,8);
});
test("member profile shows term-by-term Board titles with blank cells when no appointment exists",()=>{
 const html=read("index.html");
 const memberModule=read("member-office-profile.js");
 assert.match(html,/<th>Học kỳ<\/th><th>Chức vụ<\/th>/);
 assert.match(html,/data-osc-office-term="\$\{esc\(h\.semesterKey\)\}"/);
 assert.match(html,/<span>Chức vụ<\/span><b><\/b>/);
 assert.doesNotMatch(html,/<span>Chức vụ<\/span><b>\$\{esc\(m\.data\?\.position/);
 assert.match(memberModule,/window\.OSCMemberOffice=\{getForMember,refresh:updateOffice\}/);
 assert.match(memberModule,/titleEl\.textContent=value\.title\|\|""/);
 assert.match(memberModule,/byTerm\.get\(x\.getAttribute\("data-osc-office-term"\)\)\|\|""/);
 assert.doesNotMatch(memberModule,/Chưa bổ nhiệm vào Ban Chủ nhiệm/);
});
test("profile roles come from secured Board member roster, not login accounts",()=>{
 const code=read("lib/board-handler.js");
 const start=code.indexOf("async function profile(actor,b){"),end=code.indexOf("async function history(actor,b){",start);
 assert.ok(start>0&&end>start);
 const fn=code.slice(start,end);
 for(const marker of ["requireReader(actor)","memberDocId(b.memberId)","collection(\"members\").doc(memberId).get()",
   "roster.data()?.semester!==sem","normalizedMssv(roster.data()?.mssv)!==id",
   "collection(\"oscBoardAppointments\")"])
   assert.ok(fn.includes(marker),marker+" is required for secure member/term association");
 assert.doesNotMatch(fn,/collection\("users"\)|getAuth\(/);
 const office=read("member-office-profile.js");
 assert.match(office,/action:"board-profile"/);
 assert.match(office,/currentFirebaseUser\.getIdToken\(\)/);
 assert.match(office,/currentFirebaseUser\?\.uid!==uid/);
 assert.match(office,/cache\.clear\(\)/);
});
test("PDF has independent office checkbox, and never shows legacy raw position when office unchecked",()=>{
 const html=read("index.html");
 assert.match(html,/id="pdfOffice" checked/);
 assert.match(html,/office:!!\$\("#pdfOffice"\)\?\.checked/);
 assert.match(html,/async function exportMemberProfilePDF/);
 assert.match(html,/if\(choices\.office\)\{\s*try\{/);
 assert.match(html,/OSCMemberOffice\.getForMember\(m\)/);
 assert.match(html,/if\(choices\.office\)\{\s*const titleByTerm=new Map/);
 assert.match(html,/Chức vụ qua các học kỳ/);
 assert.match(html,/body=\[\["Học kỳ","Chức vụ"\]/);
 assert.match(html,/titleByTerm\.get\(term\)\|\|""/);
 assert.doesNotMatch(html,/\["Chức vụ",m\.data\?\.position/);
 assert.match(html,/id="pdfHistory" checked/);
});
test("member office module renders blanks for unassigned terms, caches securely and handles missing profiles",async()=>{
 let active={id:"member-1",semester:"FA26",mssv:"DE210001"};
 const title={textContent:"previous"};
 const cell={
  querySelector:s=>s==="span"?{textContent:"Chức vụ"}:s==="b"?title:null
 };
 const rows=["FA26","SP27"].map(term=>{
  const x={textContent:"stale",getAttribute:()=>term};
  return x;
 });
 const card={
  querySelectorAll:selector=>selector===".member-profile-cell"?[cell]:selector==="[data-osc-office-term]"?rows:[],
  contains:element=>element===title||rows.includes(element)
 };
 let calls=0;
 const ctx={
  window:{renderInfo:()=>{}},
  document:{querySelector:s=>s==="#memberInfoCard"?card:s==="#info"?{classList:{contains:()=>false}}:null},
  currentFirebaseUser:{uid:"test-admin",getIdToken:async()=>"auth-token"},
  selectedInfoId:"member-1",
  findMember:id=>id===active.id?active:null,
  fetch:async(path,opts)=>{
   calls++;
   assert.equal(path,"/api/operations");
   assert.equal(opts.headers.Authorization,"Bearer auth-token");
   assert.equal(JSON.parse(opts.body).action,"board-profile");
   return{ok:true,json:async()=>({title:"",history:[
      {semester:"SP27",mssv:"DE210001",title:"Thư ký"},
      {semester:"FA26",mssv:"OTHER",title:"Không hợp lệ"}
    ]})};
  },
  AbortController,setTimeout,clearTimeout,Date,Map,Error,console
 };
 vm.runInNewContext(read("member-office-profile.js"),ctx);
 await ctx.window.OSCMemberOffice.refresh();
 assert.equal(title.textContent,"","No appointment in FA26 must stay truly blank");
 assert.equal(rows[0].textContent,"");
 assert.equal(rows[1].textContent,"Thư ký");
 const one=await ctx.window.OSCMemberOffice.getForMember(active);
 assert.equal(one.title,"");
 assert.equal(one.history.length,1);
 await ctx.window.OSCMemberOffice.getForMember(active);
 assert.equal(calls,1,"Caching should avoid extra Firebase reads");
 ctx.window.oscInvalidateMemberOffice();
 await ctx.window.OSCMemberOffice.getForMember(active);
 assert.ok(calls>=2,"Board update invalidates profile cache");
});
