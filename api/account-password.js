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

    const password = String(body.password || "");
    if (password.length < 8 || password.length > 128) {
      const e = new Error("Mật khẩu mới phải từ 8 đến 128 ký tự.");
      e.code = "osc/bad-request";
      throw e;
    }

    const auth = getAuth();
    await auth.updateUser(uid, { password });
    await auth.revokeRefreshTokens(uid);

    sendJson(res, 200, { ok: true, uid });
  } catch (error) {
    handleError(res, error);
  }
};
