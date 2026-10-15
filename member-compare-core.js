(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.OSCMemberCompareCore=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const MAX_ROWS=10000,MAX_BYTES=8*1024*1024;
 const HEADER_NAMES=new Set(["mssv","masosinhvien","masv","studentid","studentcode","studentnumber"]);
 const VALID=/^[A-Z0-9_-]{4,30}$/;
 function clean(value){
   const text=String(value===null||value===undefined?"":value).trim().toUpperCase();
   return VALID.test(text)?text:null;
 }
 function header(value){
   return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
     .replace(/đ/g,"d").toLowerCase().replace(/[^a-z0-9]/g,"");
 }
 function parseRows(matrix){
   if(!Array.isArray(matrix)||matrix.length===0||matrix.length>MAX_ROWS)
     throw Error("File phải chứa từ 1 đến "+MAX_ROWS+" dòng.");
   let headerRow=-1,column=-1,firstNonempty=-1;
   for(let i=0;i<Math.min(matrix.length,8);i++){
     const row=matrix[i];
     if(!Array.isArray(row))continue;
     if(firstNonempty===-1&&row.some(v=>String(v??"").trim()))firstNonempty=i;
     const j=row.findIndex(v=>HEADER_NAMES.has(header(v)));
     if(j>=0){headerRow=i;column=j;break;}
   }
   if(column<0){
     if(firstNonempty<0)throw Error("File không có MSSV.");
     if(matrix[firstNonempty].filter(v=>String(v??"").trim()).length!==1)
       throw Error("File nhiều cột phải có tiêu đề MSSV hoặc Mã số sinh viên.");
     column=matrix[firstNonempty].findIndex(v=>String(v??"").trim());
     headerRow=firstNonempty-1;
   }
   const seen=new Set(),codes=[];
   let invalid=0,duplicates=0,empty=0,readRows=0;
   for(let i=headerRow+1;i<matrix.length;i++){
     const row=Array.isArray(matrix[i])?matrix[i]:[];
     const raw=row[column];readRows++;
     if(!String(raw??"").trim()){empty++;continue;}
     const code=clean(raw);
     if(!code){invalid++;continue;}
     if(seen.has(code)){duplicates++;continue;}
     seen.add(code);codes.push(code);
   }
   if(codes.length===0)throw Error("Không tìm thấy MSSV hợp lệ.");
   return{codes,readRows,invalid,duplicates,empty};
 }
 function compare(codes,roster){
   const set=new Set();
   for(const item of roster||[]){const code=clean(item);if(code)set.add(code)}
   const matched=[],used=new Set();let missing=0;
   for(const item of codes||[]){
     const code=clean(item);if(!code||used.has(code))continue;
     used.add(code);
     if(set.has(code))matched.push(code);else missing++;
   }
   return{matched,missing,rosterCount:set.size,validCount:used.size};
 }
 return{MAX_ROWS,MAX_BYTES,clean,parseRows,compare};
});
