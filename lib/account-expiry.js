"use strict";
const {admin,getDb,getAuth}=require("./firebase-admin");
const MAX_YEARS=10;
function expirationMs(value){
  if(value==null||value==="")return 0;
  if(typeof value?.toMillis==="function")return Number(value.toMillis())||0;
  if(typeof value?.toDate==="function")return Number(value.toDate()?.getTime())||0;
  if(value instanceof Date)return value.getTime();
  if(typeof value==="string"){
    const parsed=Date.parse(value);
    return Number.isFinite(parsed)?parsed:0;
  }
  const ms=Number(value);
  return Number.isFinite(ms)?ms:0;
}
function parseExpiryInput(value,role,now=Date.now()){
  if(role!=="bcn"){
    if(value!==undefined&&value!==null&&value!=="")throw Object.assign(new Error("Chỉ tài khoản BCN được đặt thời hạn đăng nhập."),{code:"osc/bad-request"});
    return null;
  }
  if(value===undefined)return undefined;
  if(value===null||value==="")return null;
  if(typeof value!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value))
    throw Object.assign(new Error("Thời hạn tài khoản phải là ngày giờ ISO UTC hợp lệ."),{code:"osc/bad-request"});
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)||ms<=now||ms>now+MAX_YEARS*366*86400000)
    throw Object.assign(new Error("Thời hạn BCN phải ở tương lai và không quá 10 năm."),{code:"osc/bad-request"});
  return admin.firestore.Timestamp.fromMillis(ms);
}
function isExpired(profile,now=Date.now()){
  return String(profile?.role||"").toLowerCase()==="bcn"&&expirationMs(profile?.accountExpiresAt)>0&&expirationMs(profile.accountExpiresAt)<=now;
}
async function lockExpiredAccount(uid){
  const db=getDb(),ref=db.collection("users").doc(uid);
  let expired=false;
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),profile=snap.data();
    if(!snap.exists||!isExpired(profile))return;
    expired=true;
    if(profile.active!==false){
      tx.update(ref,{active:false,accountLockedReason:"expired",accountLockedAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    }
  });
  if(!expired)return false;
  // Firestore lock is applied first. Retrying after a partial Firebase Auth failure is safe.
  await getAuth().updateUser(uid,{disabled:true});
  await getAuth().revokeRefreshTokens(uid);
  return true;
}
module.exports={expirationMs,parseExpiryInput,isExpired,lockExpiredAccount};
