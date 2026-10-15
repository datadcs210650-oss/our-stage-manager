"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const load=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");

test("President handoff starts hidden and is only shown for active superadmin",()=>{
 const html=load("index.html");
 assert.match(html,/<button class="secondary hidden" id="accountHandoffBtn" hidden disabled aria-hidden="true">/);
 assert.match(html,/const handoffAllowed=role\(\)==="superadmin"&&currentProfile\?\.active===true;/);
 assert.match(html,/toggle\("#accountHandoffBtn",handoffAllowed\);/);
 assert.match(html,/if\(role\(\)!=="superadmin"\|\|currentProfile\?\.active!==true\)return;/);
 const js=load("account-handoff.js");
 assert.match(js,/if\(currentProfile\?\.role!=="superadmin"\|\|currentProfile\?\.active!==true\)return;/);
});

test("Server independently gates handoff and requires recent sign-in",()=>{
 const leadership=load("lib/leadership-handler.js");
 assert.match(leadership,/async function handoffStart\(a,body\)\{\s*guardChair\(a\);recent\(a\);/);
 assert.match(leadership,/v\.toUid!==a\.decoded\.uid/);
 assert.match(leadership,/fromSnap\.data\(\)\?\.role!=="superadmin"/);
 assert.match(leadership,/revokeRefreshTokens/);
});

test("Drive layout is responsive without changing Drive permissions",()=>{
 const css=load("drive-hub.css");
 assert.match(css,/OSC V98 \| Drive workspace refinement/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.dh-file-row/);
 const handler=load("lib/drive-personal-handler.js");
 assert.match(handler,/requireChair\(actor\)/);
 assert.match(handler,/P\.scopedFolder\(actor,body/);
});
