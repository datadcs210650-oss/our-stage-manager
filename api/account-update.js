"use strict";
const D=require("../lib/osc-drive");
const L=require("../lib/leadership-handler");

const {
  admin,
  getAuth,
  getDb,
  sendJson,
  ensurePost,
  readJsonBody,
  requireManager,
  validateUid,
  normalizeEmail,
  normalizeDisplayName,
  normalizeRole,
  normalizePermissions,
  ensureRoleCanBeAssigned,
  ensureTargetManageable,
  getTargetProfile,
  handleError
} = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (!ensurePost(req, res)) return;
  try {
    const actor = await requireManager(req);
    const body = readJsonBody(req);
    const uid = validateUid(body.uid);
    const target = await getTargetProfile(uid);
    ensureTargetManageable(actor, uid, target.data);

    const displayName = normalizeDisplayName(body.displayName);
    const email = normalizeEmail(body.email);
    const nextRole = normalizeRole(body.role);
    ensureRoleCanBeAssigned(actor.profile.role, nextRole);
    const active = body.active === true;
    const permissions = normalizePermissions(body.permissions, nextRole);
    const memberId=body.mssv?L.mssv(body.mssv):String(target.data.mssv||"");
    const term=body.semester?D.semester(body.semester):String(target.data.positionSemester||"");
    const positionTitle=body.positionTitle?L.title(body.positionTitle):String(target.data.positionTitle||"");
    if(/^chủ tịch$/i.test(positionTitle))throw D.error("Chức vụ Chủ tịch phải được cấp thông qua quy trình bàn giao quyền.","osc/forbidden");

    const auth = getAuth();
    const beforeAuth = await auth.getUser(uid);
    const oldEmail = String(beforeAuth.email || target.data.email || "").trim().toLowerCase();

    if (email !== oldEmail) {
      try {
        const existing = await auth.getUserByEmail(email);
        if (existing.uid !== uid) {
          const e = new Error("Email này đã được sử dụng bởi một tài khoản khác.");
          e.code = "osc/email-exists";
          throw e;
        }
      } catch (error) {
        if (error && error.code !== "auth/user-not-found") throw error;
      }
    }

    const authPatch = { email, displayName, disabled: !active };
    let authChanged = false;
    try {
      await auth.updateUser(uid, authPatch);
      authChanged = true;

      const db=getDb(),identity=memberId?db.collection("oscMssvOwners").doc(memberId):null;
      await db.runTransaction(async tx=>{
        const current=await tx.get(target.ref);
        if(!current.exists)throw D.error("Tài khoản không còn tồn tại.","osc/target-not-found");
        const priorId=String(current.data()?.mssv||"");
        const oldRef=priorId&&priorId!==memberId?db.collection("oscMssvOwners").doc(priorId):null;
        const [reserved,oldClaim]=await Promise.all([
          identity?tx.get(identity):null,oldRef?tx.get(oldRef):null
        ]);
        if(reserved?.exists&&reserved.data()?.uid!==uid)throw D.error("MSSV đã thuộc tài khoản khác.","osc/mssv-exists");
        tx.set(target.ref,{
          displayName,email,role:nextRole,active,permissions,
          ...(memberId?{mssv:memberId}:{}),
          ...(term&&positionTitle?{positionTitle,positionSemester:term}:{}),
          updatedAt:admin.firestore.FieldValue.serverTimestamp(),
          updatedBy:actor.decoded.uid
        },{merge:true});
        if(identity)tx.set(identity,{uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
        if(oldRef&&oldClaim?.data()?.uid===uid)tx.delete(oldRef);
        if(term&&positionTitle)tx.set(target.ref.collection("oscPositionHistory").doc(term),{
          semester:term,mssv:memberId,positionTitle,systemRoleAtTerm:nextRole,
          updatedBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()
        },{merge:true});
      });

    } catch (error) {
      if (authChanged) {
        try {
          const rollback = { disabled: beforeAuth.disabled === true };
          if (beforeAuth.email) rollback.email = beforeAuth.email;
          rollback.displayName = beforeAuth.displayName || null;
          await auth.updateUser(uid, rollback);
        } catch (rollbackError) {
          console.error("account-update rollback failed", rollbackError && rollbackError.code, rollbackError && rollbackError.message);
        }
      }
      throw error;
    }

    let warning = "";
    if (!active) {
      try {
        await auth.revokeRefreshTokens(uid);
      } catch (error) {
        warning = "Tài khoản đã được khóa nhưng chưa thu hồi được toàn bộ phiên đăng nhập cũ ngay lập tức.";
        console.warn("revokeRefreshTokens", error && error.code, error && error.message);
      }
    }

    sendJson(res, 200, {
      ok: true,
      uid,
      email,
      role: nextRole,
      active,
      emailChanged: email !== oldEmail,
      warning: warning || undefined
    });
  } catch (error) {
    handleError(res, error);
  }
};
