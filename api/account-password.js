"use strict";

const {
  getAuth,
  getDb,
  admin,
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
    // Password reset is account takeover-capable. Require fresh authentication.
    const authenticatedAt = Number(actor.decoded.auth_time || 0);
    if (!Number.isFinite(authenticatedAt) || Date.now()/1000-authenticatedAt > 600) {
      const err = new Error("Vui lòng đăng xuất và đăng nhập lại trước khi đặt lại mật khẩu cho thành viên.");
      err.code = "osc/forbidden";
      throw err;
    }
    const body = readJsonBody(req);
    const uid = validateUid(body.uid);
    const target = await getTargetProfile(uid);
    ensureTargetManageable(actor, uid, target.data);

    const password = String(body.password || "");
    if (password.length < 8 || password.length > 128) {
      const e = new Error("Mật khẩu mới phải từ 8 đến 128 ký tự.");
      e.code = "osc/bad-request";
      throw e;
    }

    const auth = getAuth();
    await auth.updateUser(uid, { password });
    await auth.revokeRefreshTokens(uid);
    // Audit only identities, never password values.
    await getDb().collection("oscSecurityAudit").add({
      action:"account-password-reset",targetUid:uid,by:actor.decoded.uid,
      at:admin.firestore.FieldValue.serverTimestamp()
    }).catch(e=>console.error("OSC security audit write failed",String(e.code||"unknown")));
    sendJson(res, 200, { ok: true, uid });
  } catch (error) {
    handleError(res, error);
  }
};
