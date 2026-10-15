(function(){
"use strict";
// Bulk QR generation is entirely client-side; no MSSV file is uploaded.
const C=window.OSCBulkQrCore;
const $=id=>document.getElementById(id);
const S={codes:[],pending:false,working:false,invalid:0,duplicates:0,rows:0};
const MAX=8*1024*1024;
function message(s,error=false){
 const el=$("bulkQrMessage");if(!el)return;
 el.textContent=s;el.dataset.error=error?"true":"false";
}
function render(){
 const p=$("bulkQrPreview");if(!p)return;
 const okay=S.codes.length;
 p.textContent=okay?
  okay+" MSSV hợp lệ"+(S.duplicates?", "+S.duplicates+" trùng đã bỏ qua":"")+
   (S.invalid?", "+S.invalid+" không hợp lệ":"")+
   ". Ví dụ: "+S.codes.slice(0,8).join(", ")+(okay>8?"…":""):
  "Chưa chọn danh sách.";
 const btn=$("bulkQrDownload");if(btn)btn.disabled=!okay||S.working;
}
async function importFile(file){
 S.codes=[];S.invalid=0;S.duplicates=0;S.rows=0;render();
 if(!file)return;
 if(!C||typeof XLSX==="undefined")throw Error("Thư viện đọc file chưa tải được. Vui lòng tải lại trang.");
 if(file.size>Math.min(C.MAX_BYTES,MAX))throw Error("File vượt 8 MB. Hãy chia danh sách thành nhiều đợt.");
 const extension=(file.name.split(".").pop()||"").toLowerCase();
 if(!["xlsx","xls","csv","txt"].includes(extension))throw Error("Chỉ nhận .xlsx, .xls, .csv và .txt.");
 let rows;
 if(extension==="txt"){
  const text=(await file.text()).replace(/^\uFEFF/,"");
  rows=text.split(/\r?\n/).map(x=>[x.trim()]);
 }else{
  const b=await file.arrayBuffer();
  let wb;
  try{wb=XLSX.read(b,{type:"array",cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false})}
  catch{throw Error("Không mở được file Excel/CSV. Hãy kiểm tra lại định dạng.")}
  if(!wb?.SheetNames?.length)throw Error("File không có trang dữ liệu.");
  const sheet=wb.Sheets[wb.SheetNames[0]];
  if(sheet["!ref"]){
   const range=XLSX.utils.decode_range(sheet["!ref"]);
   if(range.e.r-range.s.r+1>C.MAX_ROWS||range.e.c-range.s.c+1>32)
    throw Error("File vượt 2.000 dòng hoặc 32 cột. Hãy chia nhỏ file.");
  }
  rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:"",blankrows:false});
 }
 const result=C.parseRows(rows);
 S.codes=result.codes;S.invalid=result.invalid;S.duplicates=result.duplicates;S.rows=result.readRows;
 render();
 message("Đã đọc "+S.rows+" dòng, tạo được "+S.codes.length+" mã QR. Tệp không được gửi lên máy chủ.");
 if(S.invalid||S.duplicates){
  message("Có "+S.invalid+" MSSV sai định dạng và "+S.duplicates+
    " MSSV trùng, chỉ mã hợp lệ sẽ được tải. Xem trước rồi nhấn “Tải ZIP ảnh QR”.",true);
 }else await downloadAll(); // Normal valid files automatically create and download as requested.
}
function pngFromCanvas(canvas){
 return new Promise((resolve,reject)=>{
  try{canvas.toBlob(async blob=>{
   if(!blob){reject(Error("Trình duyệt không thể tạo ảnh PNG."));return}
   try{resolve(new Uint8Array(await blob.arrayBuffer()))}catch(err){reject(err)}
  },"image/png")}catch(err){reject(err)}
 });
}
async function qrPng(mssv,host){
 if(typeof QRCode!=="function")throw Error("Thư viện QR chưa tải được. Vui lòng tải lại trang.");
 host.replaceChildren();
 new QRCode(host,{
  text:mssv,width:384,height:384,colorDark:"#000000",colorLight:"#ffffff",
  correctLevel:QRCode.CorrectLevel?.M??0
 });
 const canvas=host.querySelector("canvas");
 if(!canvas)throw Error("Không tạo được QR cho "+mssv+".");
 return pngFromCanvas(canvas);
}
async function downloadAll(){
 if(S.working||!S.codes.length)return;
 if(typeof canEditClub==="function"&&!canEditClub()){
  message("Chỉ Chủ tịch/Admin được sử dụng công cụ tạo QR hàng loạt.",true);return;
 }
 S.working=true;render();
 const host=document.createElement("div");
 host.style.cssText="position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none";
 document.body.appendChild(host);
 let url=null;
 try{
  const all=[],total=S.codes.length;
  for(let i=0;i<total;i++){
   const mssv=S.codes[i];
   const png=await qrPng(mssv,host);
   all.push({mssv,png});
   if(i%5===0||i===total-1){
    message("Đang tạo mã QR "+(i+1)+"/"+total+"…");
    // Keep controls and progress responsive even with several hundred PNGs.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
  const zip=C.zipPngs(all);
  url=URL.createObjectURL(zip);
  const link=document.createElement("a");
  link.href=url;link.download="OSC_QR_MSSV_"+new Date().toISOString().slice(0,10)+".zip";
  document.body.appendChild(link);link.click();link.remove();
  message("Hoàn tất: "+total+" mã QR PNG đã đóng gói trong ZIP. Nội dung mỗi QR chỉ là MSSV.");
 }catch(err){
  message("Không tạo được toàn bộ mã QR: "+(err.message||String(err))+". Không tải file ZIP chưa hoàn chỉnh.",true);
 }finally{
  host.remove();S.working=false;render();
  if(url)setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
}
document.addEventListener("change",ev=>{
 if(ev.target?.id!=="bulkQrFile")return;
 const file=ev.target.files?.[0];ev.target.value="";
 importFile(file).catch(err=>{S.codes=[];render();message(err.message||String(err),true)});
});
document.addEventListener("click",ev=>{
 const btn=ev.target.closest("#bulkQrDownload");
 if(btn)downloadAll();
});
document.addEventListener("click",ev=>{
 if(ev.target.closest("#bulkQrSample")){
  if(typeof XLSX==="undefined"){message("Chưa tải được thư viện Excel.",true);return;}
  const ws=XLSX.utils.aoa_to_sheet([["MSSV"],["DE210001"],["DE210002"]]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"DANH SACH MSSV");
  XLSX.writeFile(wb,"Mau_Tao_QR_Hang_Loat.xlsx");
 }
});
window.resetBulkQrPreview=()=>{S.codes=[];S.invalid=0;S.duplicates=0;S.rows=0;message("");render()};
render();
})();