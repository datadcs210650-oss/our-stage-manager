"use strict";
/**
 * Permanent removal of an OSC website account (NOT club membership).
 * Disables sign-in first and deletes Firebase Auth identity before removing
 * the OSC access profile. Safe to retry after partial cleanup.
 */
const { createHash } = require("node:crypto");
const {
  admin, getAuth, getDb, sendJson, ensurePost, readJsonBody,
  requireManager, validateUid, normalizeEmail, ensureTargetManageable,
  getTargetProfile, handleError
} = require("../lib/firebase-admin");

function refusal(message, code="osc/forbidden") {
  const e=new Error(message); e.code=code; return e;
}
async function deleteMatchingDocs(db,collection,uid) {
  // Target only session/identity data for this Firebase UID, never member roster or Board records.
  let count=0;
  for(let round=0;round<25;round++){
    const snap=await db.collection(collection).where("uid","==",uid).limit(100).get();
    if(snap.empty)return count;
    const batch=db.batch();
    for(const doc of snap.docs){batch.delete(doc.ref);count++}
    await batch.commit();
    if(snap.size<100)return count;
  }
  throw refusal("Có quá nhiều phiên xác thực cần dọn dẹp. Vui lòng thử lại sau.","osc/cleanup-incomplete");
}
async function deleteAccount({ actor,uid,confirmationEmail,auth=getAuth(),db=getDb(),targetOverride=null }) {
  const target=targetOverride||await getTargetProfile(uid);
  ensureTargetManageable(actor,uid,target.data);
  const targetEmail=normalizeEmail(target.data.email);
  if(normalizeEmail(confirmationEmail)!==targetEmail)
    throw refusal("Email xác nhận không trùng tài khoản cần xóa.","osc/email-confirmation");
  const authenticatedAt=Number(actor.decoded.auth_time);
  if(!Number.isFinite(authenticatedAt)||Date.now()/1000-authenticatedAt>600||authenticatedAt>Date.now()/1000+60)
    throw refusal("Hãy đăng xuất và đăng nhập lại trước khi xóa vĩnh viễn tài khoản.","osc/recent-login-required");

  let authUser=null;
  try{authUser=await auth.getUser(uid)}
  catch(e){if(e?.code!=="auth/user-not-found")throw e}
  if(authUser&&normalizeEmail(authUser.email)!==targetEmail)
    throw refusal("Email trong Firebase Authentication không khớp hồ sơ OSC. Đã hủy để tránh xóa nhầm.","osc/account-email-mismatch");

  // Important: an account with a previous BCN position still can be deleted.
  // History of club members / Board appointments is stored separately and untouched.
  if(authUser){
    if(authUser.disabled!==true)await auth.updateUser(uid,{disabled:true});
    // Firebase Admin verifyIdToken(..., true) rejects revoked tokens.
    await auth.revokeRefreshTokens(uid);
  }
  // Deny OSC access even when Firebase Auth delete or cleanup encounters a problem.
  await target.ref.set({
    active:false,deletionPending:true,updatedBy:actor.decoded.uid,
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  // Delete the full identity (password + Google provider link) before any
  // successful response. A new account can then use the same email with a new UID.
  if(authUser){
    try{await auth.deleteUser(uid)}
    catch(e){if(e?.code!=="auth/user-not-found")throw e}
  }

  try{
    // No archived login profile or per-user Google OAuth credential remains accessible.
    await db.collection("driveHubUserTokens").doc(uid).delete();

    // Free historical identity reservations from the obsolete account-based office system.
    // Never remove an MSSV reservation belonging to a different active UID.
    const marker=String(target.data.mssv||"").trim().toUpperCase();
    if(marker&&/^[A-Z0-9-]{5,25}$/.test(marker)){
      const ref=db.collection("oscMssvOwners").doc(marker),snap=await ref.get();
      if(snap.exists&&snap.data()?.uid===uid)await ref.delete();
    }
    await deleteMatchingDocs(db,"oscMssvOwners",uid);
    await deleteMatchingDocs(db,"driveHubOAuthStates",uid);
    await deleteMatchingDocs(db,"driveHubUploadSessions",uid);

    const handoff=db.doc("oscLeadershipHandoff/current");
    const h=await handoff.get();
    if(h.exists&&h.data()?.status==="pending"&&[h.data().fromUid,h.data().toUid].includes(uid))
      await handoff.update({status:"cancelled",cancelledReason:"account-deleted",
        updatedAt:admin.firestore.FieldValue.serverTimestamp()});

    // Preserve only a minimal non-login audit trail. No raw email or OAuth secret.
    const emailHash=createHash("sha256").update(targetEmail).digest("hex");
    await db.collection("oscSecurityAudit").add({
      action:"website-account-deleted",targetUid:uid,emailHash,
      by:actor.decoded.uid,at:admin.firestore.FieldValue.serverTimestamp(),
      firebaseAuthDeleted:true
    });

    // Clean former account-owned subcollections (legacy position history etc.).
    // Do NOT touch 'members', 'oscBoardAppointments', events, financials or Drive files.
    const subcollections=await target.ref.listCollections();
    for(const collection of subcollections)await db.recursiveDelete(collection);
    await target.ref.delete();
  }catch(error){
    console.error("account-delete cleanup incomplete",String(error?.code||"unknown"),uid);
    throw refusal("Đã thu hồi và xóa tài khoản Firebase Authentication, nhưng chưa dọn xong hồ sơ phụ trong Firestore. Tài khoản hiện đã bị chặn. Vui lòng thử Xóa lại để hoàn tất.", "osc/cleanup-incomplete");
  }
  return {ok:true,uid,authDeleted:true,profileDeleted:true,canRecreateSameEmail:true};
}
module.exports=async function handler(req,res){
  if(!ensurePost(req,res))return;
  try{
    const actor=await requireManager(req);
    const body=readJsonBody(req),uid=validateUid(body.uid);
    const data=await deleteAccount({
      actor,uid,confirmationEmail:body.confirmationEmail
    });
    return sendJson(res,200,data);
  }catch(error){
    if(error?.code==="osc/email-confirmation"||error?.code==="osc/recent-login-required")
      return sendJson(res,403,{ok:false,error:error.message,code:error.code});
    if(error?.code==="osc/account-email-mismatch")
      return sendJson(res,409,{ok:false,error:error.message,code:error.code});
    if(error?.code==="osc/cleanup-incomplete")
      return sendJson(res,503,{ok:false,error:error.message,code:error.code});
    return handleError(res,error);
  }
};
module.exports.deleteAccount=deleteAccount;
