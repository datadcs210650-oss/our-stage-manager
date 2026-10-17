"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");

test("local stylesheet and script assets referenced by public HTML remain available",()=>{
 const pages=fs.readdirSync(root).filter(x=>x.endsWith(".html"));
 assert.ok(pages.includes("index.html"));
 assert.ok(pages.includes("su-kien.html"));
 let count=0;
 for(const page of pages){
  const html=fs.readFileSync(path.join(root,page),"utf8");
  // Only literal static JS/CSS URL references; ignore CDN and generated/runtime URLs.
  const references=[...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)];
  for(const match of references){
   const url=match[1].split("?")[0].split("#")[0];
   if(!/^(?:\/)?[A-Za-z0-9_./-]+\.(?:js|css)$/i.test(url))continue;
   const pathName=url.replace(/^\//,"");
   assert.ok(!pathName.includes(".."),"No relative traversal in asset path");
   assert.ok(fs.existsSync(path.join(root,pathName)),page+" references missing "+url);
   count++;
  }
 }
 assert.ok(count>20,"Asset integrity coverage should include most website scripts/styles");
});
test("retired account-term files are not loaded; active system and rules are preserved",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.doesNotMatch(html,/account-terms\.(?:js|css)/);
 assert.ok(!fs.existsSync(path.join(root,"account-terms.js")));
 assert.ok(!fs.existsSync(path.join(root,"account-terms.css")));
 assert.ok(fs.existsSync(path.join(root,"firestore_rules_v95.rules")));
 assert.ok(fs.existsSync(path.join(root,"firestore_rules_v96.rules")));
 const entries=fs.readdirSync(path.join(root,"api")).filter(x=>x.endsWith(".js"));
 assert.equal(entries.length,8,"Unused quota Function is removed; other APIs are preserved");
});
