"use strict";
const crypto=require("node:crypto");
const {getDb,admin}=require("./firebase-admin");
const FOLDER="application/vnd.google-apps.folder";
const CONNECTION="driveHubSettings/main";
const OAUTH_STATES="driveHubOAuthStates";
const UPLOADS="driveHubUploadSessions";
const CALLBACK="https://ourstageclubmanager.vercel.app/api/operations?action=drive-callback";
const SCOPE="https://www.googleapis.com/auth/drive.file";
// Optional elevated consent to link an existing Editor-shared folder by URL.
// Never request this powerful permission unless Super Admin explicitly selects it.
const SHARED_SCOPE="https://www.googleapis.com/auth/drive";
const DEFAULT_CATEGORIES=[
{id:"plans",label:"Kế hoạch sự kiện"},{id:"content",label:"Content truyền thông"},
{id:"media",label:"Thiết kế & Media"},{id:"scripts",label:"Kịch bản & Tài liệu"},
{id:"reports",label:"Báo cáo & Recap"}];
const error=(msg,code="osc/bad-request")=>Object.assign(new Error(msg),{code});
const clean=(v,max=170)=>String(v??"").trim().replace(/\s+/g," ").slice(0,max);
function semester(input){const x=String(input||"").trim().toUpperCase();if(!/^(SP|SU|FA)\d{2}$/.test(x))throw error("Mã học kỳ không hợp lệ.");return x}
function safeId(v){const id=String(v||"").trim();if(!/^[a-zA-Z0-9_-]{4,180}$/.test(id))throw error("ID không hợp lệ.");return id}
function title(v){const s=clean(v,70);if(s.length<2||/[\\/<>"|?*\x00-\x1f]/.test(s))throw error("Tên danh mục không hợp lệ.");return s}
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
function key(){const k=Buffer.from(process.env.DRIVE_TOKEN_ENCRYPTION_KEY||"","base64");if(k.length!==32)throw error("Thiếu khóa mã hóa Drive trên Vercel.","osc/drive-unconfigured");return k}
function configHealth(){
 const clientId=!!String(process.env.DRIVE_OAUTH_CLIENT_ID||"").trim();
 const clientSecret=!!String(process.env.DRIVE_OAUTH_CLIENT_SECRET||"").trim();
 const encryptionKey=!!String(process.env.DRIVE_TOKEN_ENCRYPTION_KEY||"").trim();
 let encryptionKeyValid=false;
 try{encryptionKeyValid=key().length===32}catch{}
 return{clientId,clientSecret,encryptionKey,encryptionKeyValid};
}
function configured(){
 const h=configHealth();
 return h.clientId&&h.clientSecret&&h.encryptionKeyValid;
}
function encrypt(s){const iv=crypto.randomBytes(12),c=crypto.createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([c.update(s,"utf8"),c.final()]);return ["v1",iv.toString("base64url"),c.getAuthTag().toString("base64url"),data.toString("base64url")].join(".")}
function decrypt(s){try{const [v,iv,tag,data]=String(s).split(".");if(v!=="v1")throw Error();const d=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));d.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([d.update(Buffer.from(data,"base64url")),d.final()]).toString("utf8")}catch{throw error("Không giải mã được token Google. Kiểm tra DRIVE_TOKEN_ENCRYPTION_KEY.","osc/drive-credential")}}
function authorizeURL(nonce,mode="limited"){
 if(!configured())throw error("Chưa cấu hình Google Drive OAuth trên Vercel.","osc/drive-unconfigured");
 if(!["limited","shared"].includes(mode))throw error("Chế độ Google Drive không hợp lệ.");
 const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 const scope=(mode==="shared"?SHARED_SCOPE:SCOPE)+" https://www.googleapis.com/auth/userinfo.email";
 for(const [k,v] of Object.entries({client_id:process.env.DRIVE_OAUTH_CLIENT_ID,redirect_uri:CALLBACK,response_type:"code",scope,access_type:"offline",prompt:"consent",include_granted_scopes:"false",state:nonce}))u.searchParams.set(k,v);
 return u.toString();
}
async function tokenExchange(params){if(!configured())throw error("Google Drive chưa cấu hình.","osc/drive-unconfigured");const form=new URLSearchParams({client_id:process.env.DRIVE_OAUTH_CLIENT_ID,client_secret:process.env.DRIVE_OAUTH_CLIENT_SECRET,...params});const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),signal:AbortSignal.timeout(18000)});const j=await res.json().catch(()=>({}));if(!res.ok||!j.access_token)throw error("Google không xác thực được tài khoản; hãy kết nối lại.","osc/drive-oauth");return j}
async function connection(){const ref=getDb().doc(CONNECTION),snap=await ref.get();return{ref,data:snap.exists?snap.data():null}}
async function token(){const {data}=await connection();if(!data?.encryptedRefreshToken)throw error("Chưa kết nối tài khoản Google Drive.","osc/drive-not-connected");const j=await tokenExchange({refresh_token:decrypt(data.encryptedRefreshToken),grant_type:"refresh_token"});return{access:j.access_token,settings:data}}
async function drive(method,path,{query,body,headers,upload=false,wantResponse=false,access}={}){
 const bearer=access||(await token()).access;
 const url=new URL(path,(upload?"https://www.googleapis.com/upload/drive/v3/":"https://www.googleapis.com/drive/v3/"));
 if(query)for(const [k,v] of Object.entries(query))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 const res=await fetch(url,{method,headers:{Authorization:"Bearer "+bearer,...(body?{"Content-Type":"application/json; charset=UTF-8"}:{}),...headers},body:body?JSON.stringify(body):undefined,redirect:"error",signal:AbortSignal.timeout(24000)});
 if(!res.ok){
   const messages={
     401:"Google Drive đã hết quyền truy cập. Hãy kết nối Google lại.",
     403:"Google Drive từ chối quyền thao tác (403). Cần quyền Người chỉnh sửa (Editor) và quyền Drive được cấp cho ứng dụng.",
     404:"Google Drive không tìm thấy tài liệu hoặc ứng dụng chưa được cấp quyền truy cập (404). Kiểm tra liên kết, quyền chia sẻ và chế độ kết nối Drive.",
     429:"Google Drive đang giới hạn số yêu cầu. Vui lòng thử lại sau."
   };
   throw error(messages[res.status]||("Google Drive tạm thời không phản hồi ("+res.status+"). Vui lòng thử lại."),"osc/drive-provider-"+res.status);
 }
 return wantResponse?res:res.json().catch(()=>({}));
}
const escaped=x=>String(x).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
async function verifyFolder(id){
 const d=await drive("GET","files/"+encodeURIComponent(safeId(id)),{
   query:{fields:"id,name,mimeType,trashed,capabilities(canAddChildren)",supportsAllDrives:"true"}
 });
 if(d.mimeType!==FOLDER||d.trashed)throw error("Liên kết không trỏ đến thư mục Drive hợp lệ.","osc/drive-folder");
 if(d.capabilities?.canAddChildren!==true)throw error("Tài khoản Google đang kết nối chưa có quyền Người chỉnh sửa (Editor) đối với thư mục này.","osc/drive-folder-readonly");
 return d;
}
async function createFolderWithTransport(name,parent,transport){
 const parentId=parent?safeId(parent):"";
 const d=await transport("POST","files",{
   body:{name,mimeType:FOLDER,...(parentId?{parents:[parentId]}:{})},
   query:{fields:"id,name,mimeType,parents,webViewLink",supportsAllDrives:"true"}
 });
 if(!d.id)throw error("Không thể tạo thư mục Google Drive.","osc/drive-provider");
 // Read back the authoritative parent. Never report success when Google placed a
 // newly created folder outside the requested parent.
 if(parentId){
   const check=await transport("GET","files/"+encodeURIComponent(safeId(d.id)),{
     query:{fields:"id,name,mimeType,parents,trashed",supportsAllDrives:"true"}
   });
   if(check.trashed||check.mimeType!==FOLDER||!Array.isArray(check.parents)||!check.parents.includes(parentId))
     throw error("Drive tạo thư mục không đúng thư mục mẹ. Đã dừng và chưa xác nhận thành công; vui lòng kiểm tra Drive trước khi thử lại.","osc/drive-parent-mismatch");
   return check;
 }
 return d;
}
async function createFolder(name,parent){return createFolderWithTransport(name,parent,drive)}
async function ensureFolder(parent,name){
 const pid=safeId(parent);
 const q="'"+escaped(pid)+"' in parents and name = '"+escaped(name)+"' and mimeType = '"+FOLDER+"' and trashed = false";
 const j=await drive("GET","files",{query:{
   q,fields:"files(id,name,parents)",pageSize:100,supportsAllDrives:"true",includeItemsFromAllDrives:"true"
 }});
 const existing=(j.files||[]).find(f=>Array.isArray(f.parents)&&f.parents.includes(pid));
 return existing||createFolder(name,pid);
}
function folderIdFromURL(raw){
 let u;try{u=new URL(String(raw||"").trim())}catch{throw error("Link Drive không hợp lệ.")}
 if(u.protocol!=="https:"||u.hostname!=="drive.google.com")throw error("Link phải thuộc drive.google.com.");
 const m=u.pathname.match(/\/folders\/([A-Za-z0-9_-]{4,180})(?:\/|$)/);
 const id=m?.[1]||(u.pathname==="/open"?u.searchParams.get("id"):"");
 if(!id)throw error("Vui lòng nhập link thư mục Google Drive.");
 return safeId(id);
}
const folderLink=id=>"https://drive.google.com/drive/folders/"+encodeURIComponent(safeId(id));
function itemName(input){
 const value=clean(input,180);
 if(!value||value==="."||value===".."||/[\\/<>"|?*\x00-\x1f]/.test(value))
   throw error("Tên tệp hoặc thư mục không hợp lệ.","osc/bad-request");
 return value;
}
async function renameItemWithTransport(id,name,transport){
 return transport("PATCH","files/"+encodeURIComponent(safeId(id)),{
   query:{fields:"id,name,mimeType,parents,webViewLink,trashed",supportsAllDrives:"true"},
   body:{name:itemName(name)}
 });
}
async function renameItem(id,name){return renameItemWithTransport(id,name,drive)}
function uploadSpec(body){const name=clean(body.fileName,180),size=Number(body.size),mime=String(body.mimeType||"application/octet-stream");if(!name||/[\x00-\x1f\\/]/.test(name)||/\.(exe|dll|bat|cmd|msi|scr|ps1|vbs|js|html|htm|svg|sh|apk)$/i.test(name))throw error("Tên/định dạng tệp không được hỗ trợ.");if(!Number.isSafeInteger(size)||size<=0||size>500*1024*1024)throw error("Tệp phải từ 1 byte đến 500 MB.");if(!/^[a-z0-9.+_-]+\/[a-z0-9.+_-]+$/i.test(mime)||mime.length>130)throw error("MIME không hợp lệ.");return{name,size,mime}}
async function startUpload(folderId,spec){const res=await drive("POST","files",{upload:true,query:{uploadType:"resumable",fields:"id,name,mimeType,size,parents,webViewLink",supportsAllDrives:"true"},body:{name:spec.name,mimeType:spec.mime,parents:[folderId]},headers:{"X-Upload-Content-Length":String(spec.size),"X-Upload-Content-Type":spec.mime},wantResponse:true});const location=res.headers.get("location");if(!location||!location.startsWith("https://www.googleapis.com/"))throw error("Không tạo được phiên upload Google.","osc/drive-provider");return location}
async function files(folder){const q="'"+escaped(folder)+"' in parents and trashed = false",arr=[];let page="";do{const j=await drive("GET","files",{query:{q,fields:"nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",pageSize:100,supportsAllDrives:"true",includeItemsFromAllDrives:"true",...(page?{pageToken:page}:{})}});arr.push(...(j.files||[]));page=j.nextPageToken||""}while(page&&arr.length<300);return arr.slice(0,300)}
module.exports={crypto,getDb,admin,FOLDER,CONNECTION,OAUTH_STATES,UPLOADS,CALLBACK,SCOPE,SHARED_SCOPE,DEFAULT_CATEGORIES,error,clean,semester,safeId,title,hash,key,configHealth,configured,encrypt,decrypt,authorizeURL,tokenExchange,connection,token,drive,verifyFolder,createFolder,createFolderWithTransport,ensureFolder,folderIdFromURL,folderLink,itemName,renameItem,renameItemWithTransport,uploadSpec,startUpload,files};