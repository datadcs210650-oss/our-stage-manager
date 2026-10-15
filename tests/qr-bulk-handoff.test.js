"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const C=require("../qr-bulk-core.js");
const source=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
test("single MSSV column and headered spreadsheets preserve only MSSV values",()=>{
 assert.deepEqual(C.parseRows([["MSSV"],["DE210001"],["DE210002"]]).codes,["DE210001","DE210002"]);
 assert.deepEqual(C.parseRows([["Mã số sinh viên","Họ tên"],["SE0009","User A"],["SE0100","User B"]]).codes,["SE0009","SE0100"]);
 assert.deepEqual(C.parseRows([["de210001"],["de210002"]]).codes,["DE210001","DE210002"]);
 assert.deepEqual(C.parseRows([["00042"]]).codes,["00042"]);
});
test("batch imports deduplicate safely and never manufacture QR for invalid rows",()=>{
 const result=C.parseRows([["mssv"],[" DE210001 "],["de210001"],["<script>"],["DE210002"],[""]]);
 assert.deepEqual(result.codes,["DE210001","DE210002"]);
 assert.equal(result.duplicates,1);
 assert.equal(result.invalid,1);
 assert.ok(C.MAX_CODES<=500);
 assert.throws(()=>C.parseRows([["Name","Phone"],["A","123"]]),/tiêu đề MSSV/);
 assert.throws(()=>C.parseRows([["MSSV"],["malicious/../id"]]),/MSSV hợp lệ/);
 const oversized=[["MSSV"]];
 for(let i=0;i<=C.MAX_CODES;i++)oversized.push(["DE"+String(i).padStart(6,"0")]);
 assert.throws(()=>C.parseRows(oversized),/Tối đa/);
});
test("ZIP contains PNG filenames named solely by MSSV and validated byte content",async()=>{
 const pngA=new Uint8Array([137,80,78,71,1,2,3,4]);
 const pngB=new Uint8Array([137,80,78,71,5,6,7,8,9]);
 const blob=C.zipPngs([{mssv:"DE210001",png:pngA},{mssv:"DE210002",png:pngB}]);
 assert.equal(blob.type,"application/zip");
 const data=new Uint8Array(await blob.arrayBuffer());
 const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const decoder=new TextDecoder();
 let offset=0;
 for(const [code,png] of [["DE210001",pngA],["DE210002",pngB]]){
  assert.equal(dv.getUint32(offset,true),0x04034b50);
  assert.equal(dv.getUint32(offset+14,true),C.crc32(png));
  assert.equal(dv.getUint32(offset+18,true),png.length);
  const nameLength=dv.getUint16(offset+26,true);
  const name=decoder.decode(data.subarray(offset+30,offset+30+nameLength));
  assert.equal(name,code+".png");
  const body=data.subarray(offset+30+nameLength,offset+30+nameLength+png.length);
  assert.deepEqual(body,png);
  offset+=30+nameLength+png.length;
 }
 assert.equal(dv.getUint32(offset,true),0x02014b50);
 assert.equal(dv.getUint32(data.length-22,true),0x06054b50);
 assert.equal(dv.getUint16(data.length-22+10,true),2);
 assert.throws(()=>C.zipPngs([{mssv:"DE210001",png:pngA},{mssv:"DE210001",png:pngB}]),/trùng MSSV/);
});
test("user UI encodes only MSSV, does not upload spreadsheet to server",()=>{
 const ui=source("qr-bulk-ui.js");
 assert.match(ui,/text:mssv/);
 assert.match(ui,/C\.zipPngs\(all\)/);
 assert.match(ui,/link\.download="OSC_QR_MSSV_/);
 assert.doesNotMatch(ui,/fetch\(|FormData\(|\/api\//);
 assert.match(ui,/await downloadAll\(\)/);
});
test("handoff invitation is absent from Drive and hidden in My Account until matching pending UID",()=>{
 const html=source("index.html"),drive=source("drive-hub-v2.js"),handoff=source("account-handoff.js");
 assert.match(html,/id="checkHandoffInviteBtn" hidden/);
 assert.match(html,/window\.refreshHandoffInvitation\(\)/);
 assert.doesNotMatch(drive,/data-v2="handoff-check"|async function handoffCheck/);
 assert.match(handoff,/state\.pending\?\.toUid===uid/);
 assert.match(handoff,/Number\(state\.pending\.expiresMs\)>Date\.now\(\)/);
 assert.match(handoff,/btn\.hidden=true/);
 assert.match(handoff,/btn\.hidden=false/);
});
test("QR nav title updates without altering original card issue/revoke API",()=>{
 const html=source("index.html");
 assert.match(html,/<button data-tab="memberQr" class="admin-nav">Mã QR<\/button>/);
 assert.match(html,/id="bulkQrFile"/);
 assert.match(html,/id="bulkQrDownload"/);
 const old=source("api/member-qr.js");
 assert.match(old,/admin-set-card-active/);
 assert.match(old,/admin-set-open/);
});
