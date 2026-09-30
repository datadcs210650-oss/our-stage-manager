"use strict";

const {
  admin,
  getAuth,
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

      await target.ref.set({
        displayName,
        email,
        role: nextRole,
        active,
        permissions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actor.decoded.uid
      }, { merge: true });
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
