"use strict";

const {
  getAuth,
  sendJson,
  ensurePost,
  readJsonBody,
  requireManager,
  validateUid,
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
    // Preserve historical BCN positions and MSSV when a term ends.
    // To remove active access, use account-update with active:false instead.
    if (target.data.mssv || target.data.positionSemester) {
      const err = new Error("Tài khoản đã có lịch sử nhiệm kỳ. Hãy khóa tài khoản để giữ MSSV và chức vụ các kỳ trước.");
      err.code = "osc/forbidden";
      throw err;
    }
    const termHistory = await target.ref.collection("oscPositionHistory").limit(1).get();
    if (!termHistory.empty) {
      const err = new Error("Không thể xóa tài khoản còn lịch sử BCN. Hãy khóa tài khoản.");
      err.code = "osc/forbidden";
      throw err;
    }

    const auth = getAuth();
    let authUser = null;
    try {
      authUser = await auth.getUser(uid);
    } catch (error) {
      if (!error || error.code !== "auth/user-not-found") throw error;
    }

    if (!authUser) {
      await target.ref.delete();
      sendJson(res, 200, {
        ok: true,
        uid,
        warning: "Đã xóa hồ sơ quyền. Firebase Authentication không còn tài khoản có UID này."
      });
      return;
    }

    const wasDisabled = authUser.disabled === true;
    await auth.updateUser(uid, { disabled: true });

    try {
      await target.ref.delete();
    } catch (error) {
      try { await auth.updateUser(uid, { disabled: wasDisabled }); } catch (rollbackError) { console.error("delete lock rollback failed", rollbackError); }
      throw error;
    }

    try {
      await auth.deleteUser(uid);
    } catch (error) {
      try {
        await target.ref.set(target.data, { merge: false });
        await auth.updateUser(uid, { disabled: wasDisabled });
      } catch (rollbackError) {
        console.error("account-delete rollback failed", rollbackError && rollbackError.code, rollbackError && rollbackError.message);
      }
      throw error;
    }

    sendJson(res, 200, { ok: true, uid });
  } catch (error) {
    handleError(res, error);
  }
};
