"use strict";

const {
  admin,
  getAuth,
  getDb,
  sendJson,
  ensurePost,
  readJsonBody,
  requireManager,
  normalizeEmail,
  normalizeDisplayName,
  normalizeRole,
  normalizePermissions,
  ensureRoleCanBeAssigned,
  handleError
} = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (!ensurePost(req, res)) return;
  let createdUid = "";
  let createdFresh = false;
  let linkedExisting = false;
  let profileRef = null;
  try {
    const actor = await requireManager(req);
    const body = readJsonBody(req);
    const displayName = normalizeDisplayName(body.displayName);
    const email = normalizeEmail(body.email);
    const role = normalizeRole(body.role);
    ensureRoleCanBeAssigned(actor.profile.role, role);

    const password = String(body.password || "");
    if (password.length < 8 || password.length > 128) {
      const e = new Error("Mật khẩu phải từ 8 đến 128 ký tự.");
      e.code = "osc/bad-request";
      throw e;
    }
    const permissions = normalizePermissions(body.permissions, role);
    const auth = getAuth();
    const db = getDb();

    let userRecord = null;
    try {
      userRecord = await auth.getUserByEmail(email);
      linkedExisting = true;
    } catch (error) {
      if (!error || error.code !== "auth/user-not-found") throw error;
    }

    if (!userRecord) {
      userRecord = await auth.createUser({
        email,
        password,
        displayName,
        disabled: false
      });
      createdFresh = true;
    }

    createdUid = userRecord.uid;
    profileRef = db.collection("users").doc(createdUid);
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) {
      const e = new Error("Email này đã có hồ sơ tài khoản trong hệ thống.");
      e.code = "osc/profile-exists";
      throw e;
    }

    await profileRef.set({
      displayName,
      email,
      role,
      active: true,
      permissions,
      linkedExistingAuth: linkedExisting,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actor.decoded.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actor.decoded.uid
    }, { merge: false });

    try {
      await auth.updateUser(createdUid, { displayName, disabled: false });
    } catch (error) {
      try { await profileRef.delete(); } catch (rollbackError) { console.error("profile rollback failed", rollbackError); }
      throw error;
    }

    sendJson(res, 200, {
      ok: true,
      uid: createdUid,
      email,
      role,
      linkedExisting
    });
  } catch (error) {
    if (createdFresh && createdUid) {
      try { await getAuth().deleteUser(createdUid); } catch (rollbackError) { console.error("create auth rollback failed", rollbackError); }
    }
    handleError(res, error);
  }
};
