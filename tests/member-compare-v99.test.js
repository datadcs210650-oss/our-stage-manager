"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const C=require("../member-compare-core.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("MSSV extraction keeps only the designated column; ignores names and emails",()=>{
 const r=C.parseRows([["Họ tên","MSSV","Email"],["Person A","de210001","secret@example.com"],["Person B","DE210002","other@example.com"],["Duplicate","de210001","foo@example.com"]]);
 assert.deepEqual(r.codes,["DE210001","DE210002"]);assert.equal(r.duplicates,1);
 assert.equal(JSON.stringify(r).includes("Person A"),false);
 assert.equal(JSON.stringify(r).includes("secret@example.com"),false);
});
test("validates source, handles diacritics, case, duplicates and leading zeros",()=>{
 assert.deepEqual(C.parseRows([["Mã số sinh viên"],["00042"],["de0001"]]).codes,["00042","DE0001"]);
 assert.deepEqual(C.parseRows([["A0004"],["A0005"]]).codes,["A0004","A0005"]);
 assert.throws(()=>C.parseRows([["Họ tên","Email"],["Somebody","x@example.com"]]),/tiêu đề MSSV/);
 assert.throws(()=>C.parseRows([["MSSV"],["=HYPERLINK()"]]),/MSSV hợp lệ/);
 assert.throws(()=>C.parseRows(Array.from({length:C.MAX_ROWS+1},()=>["DE210001"])),/10000/);
});
test("matches only IDs in selected term roster, preserves uploaded order, exports no other fields",()=>{
 const r=C.compare(["ABC005","ABC001","ABC001","ABC002"],["abc002","ABC005","ZZZ012"]);
 assert.deepEqual(r.matched,["ABC005","ABC002"]);assert.equal(r.missing,1);
 const ui=read("member-compare.js");
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|\.setItem\s*\(|localStorage|sessionStorage|indexedDB|FormData/);
 assert.match(ui,/members\(\)\.map\(member=>member\.mssv\)/);
 assert.match(ui,/matchedSemester!==currentSemester\(\)/);
 assert.match(ui,/XLSX\.utils\.aoa_to_sheet\(\[\["MSSV"\]/);
 assert.match(ui,/window\.addEventListener\("pagehide",clear\)/);
});
test("scheduled permissions moved to accounts, server-side auth unchanged",()=>{
 const html=read("index.html"),ops=read("v95-operations.js"),api=read("api/operations.js");
 assert.match(html,/<section class="osc-temp-access"/);
 assert.match(html,/id="v95TempList"/);
 assert.match(html,/window\.v95RefreshTemporaryPermissions\?\.\(false\)/);
 assert.match(ops,/window\.v95RefreshTemporaryPermissions=v95RefreshTemporaryPermissions/);
 assert.match(ops,/if\(!canEditClub\(\)\)return;/);
 assert.doesNotMatch(ops,/Temporary Permissions<\/h3>/);
 assert.match(api,/ensureTargetManageable\(actor,uid,target\.data\)/);
 assert.match(api,/expires\.getTime\(\)>max/);
});
test("top-right account button uses textContent, not raw injected HTML",()=>{
 const html=read("index.html");
 assert.match(html,/function updateAdminIdentityChip\(\)/);
 assert.match(html,/chip\.textContent=\(label\|\|roleLabel\)/);
 assert.match(html,/updateAdminIdentityChip\(\)/);
 assert.match(html,/id="memberCompareOpenBtn"/);
 assert.match(html,/id="memberComparePanel"/);
});
