"use strict";
const {getAuth,getDb,sendJson}=require("./firebase-admin");
const {isExpired,lockExpiredAccount}=require("./account-expiry");
// Called from the browser at expiry. A Firebase token identifies ONLY its own UID.
// This endpoint cannot disable other accounts or act before the expiry instant.
module.exports=async function expire(req,res){
  if(req.method!=="POST")return sendJson(res,405,{ok:false,error:"Chỉ hỗ trợ POST."});
  const authHeader=String(req.headers?.authorization||req.headers?.Authorization||"");
  const match=authHeader.match(/^Bearer\s+(.+)$/i);
  if(!match)return sendJson(res,401,{ok:false,error:"Chưa xác thực."});
  let decoded;
  try{decoded=await getAuth().verifyIdToken(match[1],true)}
  catch{return sendJson(res,401,{ok:false,error:"Phiên đăng nhập không hợp lệ."})}
  const uid=decoded.uid,ref=getDb().collection("users").doc(uid),doc=await ref.get();
  if(!doc.exists||!isExpired(doc.data()))return sendJson(res,403,{ok:false,error:"Tài khoản chưa hết hạn hoặc không phải BCN."});
  try{
    await lockExpiredAccount(uid);
    return sendJson(res,200,{ok:true,locked:true,reason:"expired"});
  }catch(error){
    console.warn("expired BCN account lock retry needed",String(error?.code||"server-error"));
    return sendJson(res,503,{ok:false,error:"Đã hết thời hạn truy cập. Máy chủ chưa hoàn tất khóa Firebase Authentication; vui lòng thử lại."});
  }
};
