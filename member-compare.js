(function(){
"use strict";
const q=s=>document.querySelector(s);
const C=window.OSCMemberCompareCore;
if(!C)return;
let matched=[],matchedSemester="",matchedUid="",busy=false,generation=0;
function currentSemester(){return typeof semester==="string"?semester:""}
function allowed(){return typeof canViewModule==="function"&&canViewModule("members")&&!!currentFirebaseUser}
function clear(){
 generation++;
 matched=[];matchedSemester="";matchedUid="";busy=false;
 const file=q("#memberCompareFile");if(file)file.value="";
 const panel=q("#memberComparePanel");if(panel)panel.hidden=true;
 const output=q("#memberCompareStatus");if(output)output.textContent="Không có dữ liệu đối chiếu nào được lưu.";
 const preview=q("#memberComparePreview");if(preview)preview.textContent="";
 const download=q("#memberCompareDownload");if(download)download.disabled=true;
}
function open(){
 if(!allowed())return;
 clear();
 const panel=q("#memberComparePanel");if(!panel)return;
 panel.hidden=false;
 q("#memberCompareTerm").textContent=currentSemester();
 q("#memberCompareFile")?.focus();
}
async function inspect(file){
 if(!file||busy||!allowed())return;
 matched=[];matchedSemester="";matchedUid="";
 q("#memberCompareDownload").disabled=true;
 q("#memberComparePreview").textContent="";
 const status=q("#memberCompareStatus"),input=q("#memberCompareFile");
 if(input)input.value="";
 if(Number(file.size)<=0||Number(file.size)>C.MAX_BYTES){
  status.textContent="File phải có dữ liệu và không vượt quá 8 MB.";return;
 }
 busy=true;const sequence=++generation;
 status.textContent="Đang đối chiếu trong trình duyệt…";
 const startedSemester=currentSemester(),startedUid=currentFirebaseUser?.uid;
 try{
  if(typeof readSpreadsheetSecure!=="function"||!window.XLSX)
    throw Error("Bộ đọc Excel chưa sẵn sàng. Vui lòng tải lại trang.");
  const {ws}=await readSpreadsheetSecure(file,{allowCsv:true});
  const table=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:"",blankrows:false});
  const parsed=C.parseRows(table);
  if(sequence!==generation)return;
  if(!allowed()||startedSemester!==currentSemester()||startedUid!==currentFirebaseUser?.uid){
   clear();return;
  }
  // Only official-roster MSSV values are compared. Names and other fields from
  // the uploaded worksheet are discarded; no requests or persistence are used.
  const snapshot=members().map(member=>member.mssv);
  const result=C.compare(parsed.codes,snapshot);
  matched=result.matched;
  matchedSemester=startedSemester;matchedUid=startedUid;
  const segments=[
   "Học kỳ "+startedSemester,
   "MSSV hợp lệ: "+result.validCount,
   "Trùng: "+matched.length,
   "Không trùng: "+result.missing,
   "Dòng trùng lặp: "+parsed.duplicates,
   "Dòng không hợp lệ: "+parsed.invalid
  ];
  status.textContent=segments.join(" · ")+". Kết quả chỉ tạm ở trang này.";
  const box=q("#memberComparePreview");
  if(box)box.textContent=matched.length?
   "MSSV trùng (xem trước tối đa 15): "+matched.slice(0,15).join(" · "):
   "Không tìm thấy MSSV trùng trong danh sách thành viên học kỳ này.";
  q("#memberCompareDownload").disabled=matched.length===0;
 }catch(e){
  if(sequence===generation){
   matched=[];matchedSemester="";matchedUid="";
   status.textContent="Không thể đối chiếu: "+String(e.message||e);
  }
 }finally{if(sequence===generation){busy=false;if(input)input.value=""}}
}
function download(){
 if(!allowed()||!matched.length||matchedSemester!==currentSemester()||
    matchedUid!==currentFirebaseUser?.uid)return;
 if(!window.XLSX)return;
 const sheet=XLSX.utils.aoa_to_sheet([["MSSV"],...matched.map(code=>[code])]);
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,sheet,"MSSV trung");
 XLSX.writeFile(workbook,"OSC_MSSV_Trung_"+matchedSemester+".xlsx");
}
q("#memberCompareOpenBtn")?.addEventListener("click",open);
q("#memberCompareClose")?.addEventListener("click",clear);
q("#memberCompareFile")?.addEventListener("change",event=>{
 const file=event.currentTarget.files?.[0];
 if(file)void inspect(file);
});
q("#memberCompareDownload")?.addEventListener("click",download);
window.addEventListener("pagehide",clear);
window.OSCMemberCompare={clear};
})();
