"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../dashboard-activity-summary.js");
const src=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("full activity chart retains EVERY configured activity in original group order, including after #8",()=>{
 const groups=[
  {name:"Họp CLB",mode:"checkbox",items:Array.from({length:9},(_,i)=>({id:"a"+i,name:"Họp "+i}))},
  {name:"Hỗ trợ",mode:"number",items:Array.from({length:12},(_,i)=>({id:"n"+i,name:"Hỗ trợ "+i}))}
 ];
 const rows=core.rows({groups},[{semester:"FA26",scores:{a0:true,n11:5}}],"FA26");
 assert.equal(rows.length,21);
 assert.equal(rows[0].name,"Họp 0");
 assert.equal(rows[8].name,"Họp 8");
 assert.equal(rows[20].name,"Hỗ trợ 11");
 assert.equal(rows[20].joined,1);
 assert.equal(rows[20].percentage,100);
 assert.deepEqual(rows.map(x=>x.key).slice(8,11),["0:8","1:0","1:1"]);
});
test("rates use all roster members of requested semester, never other semesters",()=>{
 const groups=[{name:"CLB",items:[
  {id:"check",name:"Tick",mode:"checkbox"},
  {id:"number",name:"Nhập điểm",mode:"number"},
  {id:"empty",name:"Chưa tham gia",mode:"checkbox"}
 ]}];
 const roster=[
  {semester:"FA26",scores:{check:true,number:5}},
  {semester:"FA26",scores:{check:false,number:0}},
  {semester:"FA26",scores:{}},
  {semester:"SP26",scores:{check:true,number:5}}
 ];
 const rows=core.rows({groups},roster,"FA26");
 assert.deepEqual(rows.map(x=>({joined:x.joined,total:x.total,percent:x.percentage})),[
  {joined:1,total:3,percent:33},
  {joined:1,total:3,percent:33},
  {joined:0,total:3,percent:0}
 ]);
});
test("zero roster, missing groups and mid-semester activity changes are safe",()=>{
 assert.deepEqual(core.rows({groups:[]},[],"FA26"),[]);
 const cfg={groups:[{name:"Truyền thông",mode:"number",items:[{id:"one",name:"Tập"}]}]};
 assert.equal(core.rows(cfg,[],"FA26")[0].percentage,0);
 cfg.groups[0].items.push({id:"two",name:"Tập"});
 assert.equal(core.rows(cfg,[],"FA26").length,2);
 cfg.groups[0].items.splice(0,1);
 assert.deepEqual(core.rows(cfg,[],"FA26").map(x=>x.id),["two"]);
 const alternate={groups:[{name:"Casting",items:[{id:"three",name:"Khác"}]}]};
 assert.deepEqual(core.rows(alternate,[],"SP26").map(x=>x.id),["three"]);
});
test("group/date distinguish activities with duplicate names and calculation does not mutate source",()=>{
 const groups=[{name:"Ban diễn xuất",items:[{id:"d",name:"Họp",date:"16/10"}]},
  {name:"Ban truyền thông",items:[{id:"c",name:"Họp",date:"17/10"}]}];
 const roster=[{semester:"FA26",scores:{d:true}}],before=JSON.stringify({groups,roster});
 const rows=core.rows({groups},roster,"FA26");
 assert.equal(rows[0].group,"Ban diễn xuất");
 assert.equal(rows[1].group,"Ban truyền thông");
 assert.equal(rows[0].date,"16/10");
 assert.equal(rows[1].date,"17/10");
 assert.deepEqual(rows.map(x=>x.percentage),[100,0]);
 assert.equal(JSON.stringify({groups,roster}),before);
});
test("dashboard renders entire computed list, with scroll/expand controls and escaped names",()=>{
 const html=src("index.html"),css=src("dashboard-activity.css");
 assert.match(html,/renderDashboardActivityChart\(\);/);
 assert.match(html,/window\.OSCDashboardActivity\.rows\(sem\(\),members\(\),semester\)/);
 assert.match(html,/rows\.map\(a=>/);
 assert.doesNotMatch(html,/acts\.slice\(0,8\)/);
 assert.match(html,/aria-label="Tỷ lệ tham gia của toàn bộ hoạt động trong học kỳ"/);
 assert.match(html,/esc\(a\.name\)/);
 assert.match(html,/esc\(a\.group\)/);
 assert.match(html,/a\.joined\}\/\$\{a\.total/);
 assert.match(html,/id="dashboardActivityExpandBtn"/);
 assert.match(css,/#dashboard \.dashboard-activity-chart/);
 assert.match(css,/max-height:500px/);
 assert.match(css,/\.expanded/);
});
test("current semester data and changes refresh the dashboard without changing Firestore rules",()=>{
 const html=src("index.html");
 assert.match(html,/if\(\$\("#dashboard"\)&&!\$\("#dashboard"\)\.classList\.contains\("hidden"\)\)renderDashboardActivityChart\(\)/);
 assert.match(html,/function scheduleRealtimeRender\(reason=""/);
 assert.match(html,/if\(\$\("#dashboard"\)&&!\$\("#dashboard"\)\.classList\.contains\("hidden"\)\)renderDashboard\(\)/);
 assert.match(html,/function save\(\)\{\s*persistSafeLocalState\(\);\s*renderAll\(\);/);
 assert.match(html,/if\(tab==="dashboard"\)renderDashboard\(\)/);
});
