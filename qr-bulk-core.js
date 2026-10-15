(function(root,factory){
 "use strict";
 const core=factory();
 if(typeof module==="object"&&module.exports)module.exports=core;
 if(root)root.OSCBulkQrCore=core;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const MAX_CODES=500,MAX_ROWS=2000,MAX_BYTES=8*1024*1024;
 const valid=/^[A-Z0-9_-]{3,50}$/;
 const encoder=new TextEncoder();
 function codeOf(value){
  const s=String(value===null||value===undefined?"":value).trim().toUpperCase();
  return valid.test(s)?s:null;
 }
 function headerOf(value){
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/[^a-z0-9]/g,"");
 }
 function parseRows(input){
  if(!Array.isArray(input)||!input.length)throw Error("File không chứa dữ liệu MSSV.");
  if(input.length>MAX_ROWS)throw Error("File quá dài. Tối đa "+MAX_ROWS+" dòng cho mỗi lần xử lý.");
  const rows=input.filter(row=>Array.isArray(row)&&row.some(v=>String(v??"").trim()));
  if(!rows.length)throw Error("File không chứa MSSV.");
  const first=rows[0];
  const cols=first.map(headerOf);
  let index=cols.findIndex(v=>["mssv","masosinhvien","studentid","studentcode"].includes(v));
  let skipHeader=index>=0;
  if(index<0){
   if(first.length!==1)throw Error("File nhiều cột phải có tiêu đề MSSV hoặc Mã số sinh viên.");
   index=0;
  }
  const seen=new Set(),codes=[];let invalid=0,duplicates=0,empty=0;
  for(let i=skipHeader?1:0;i<rows.length;i++){
   const cell=rows[i][index];
   const raw=String(cell===null||cell===undefined?"":cell).trim();
   if(!raw){empty++;continue;}
   const code=codeOf(raw);
   if(!code){invalid++;continue;}
   if(seen.has(code)){duplicates++;continue;}
   seen.add(code);codes.push(code);
   if(codes.length>MAX_CODES)throw Error("Tối đa "+MAX_CODES+" MSSV duy nhất/lần. Hãy chia file thành nhiều đợt.");
  }
  if(!codes.length)throw Error("Không có MSSV hợp lệ. Vui lòng kiểm tra dữ liệu trong file.");
  return{codes,duplicates,invalid,empty,readRows:rows.length-(skipHeader?1:0)};
 }
 const TABLE=new Uint32Array(256);
 for(let n=0;n<256;n++){
  let c=n;
  for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
  TABLE[n]=c>>>0;
 }
 function crc32(bytes){
  let crc=0xffffffff;
  for(let i=0;i<bytes.length;i++)crc=TABLE[(crc^bytes[i])&255]^(crc>>>8);
  return(crc^0xffffffff)>>>0;
 }
 function u16(d,o,v){d.setUint16(o,v,true)}
 function u32(d,o,v){d.setUint32(o,v>>>0,true)}
 function zipPngs(files){
  if(!Array.isArray(files)||files.length<1||files.length>MAX_CODES)throw Error("Số lượng ảnh QR không hợp lệ.");
  const parts=[],directory=[];let offset=0;const used=new Set();
  for(const f of files){
   const code=codeOf(f?.mssv);
   if(!code||used.has(code)||!(f.png instanceof Uint8Array)||!f.png.length)
    throw Error("Có tệp QR không hợp lệ hoặc trùng MSSV.");
   used.add(code);
   const name=encoder.encode(code+".png"),data=f.png,crc=crc32(data);
   const local=new Uint8Array(30+name.length),h=new DataView(local.buffer);
   u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0x0800);u16(h,8,0);
   u16(h,10,0);u16(h,12,0);u32(h,14,crc);u32(h,18,data.length);u32(h,22,data.length);
   u16(h,26,name.length);u16(h,28,0);local.set(name,30);
   parts.push(local,data);
   const cent=new Uint8Array(46+name.length),v=new DataView(cent.buffer);
   u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0800);
   u16(v,10,0);u16(v,12,0);u16(v,14,0);
   u32(v,16,crc);u32(v,20,data.length);u32(v,24,data.length);
   u16(v,28,name.length);u16(v,30,0);u16(v,32,0);u16(v,34,0);
   u16(v,36,0);u32(v,38,0);u32(v,42,offset);cent.set(name,46);
   directory.push(cent);offset+=local.length+data.length;
   if(offset>=0xffffffff)throw Error("Tổng kích thước QR vượt giới hạn ZIP.");
  }
  const dirLength=directory.reduce((sum,item)=>sum+item.length,0);
  const end=new Uint8Array(22),dv=new DataView(end.buffer);
  u32(dv,0,0x06054b50);u16(dv,4,0);u16(dv,6,0);
  u16(dv,8,files.length);u16(dv,10,files.length);u32(dv,12,dirLength);
  u32(dv,16,offset);u16(dv,20,0);
  return new Blob([...parts,...directory,end],{type:"application/zip"});
 }
 return{MAX_CODES,MAX_ROWS,MAX_BYTES,codeOf,parseRows,zipPngs,crc32};
});
