"use strict";

const {
  admin,
  ROLE_ADMIN,
  ROLE_SUPERADMIN,
  ROLE_BCN,
  getDb,
  sendJson,
  ensurePost,
  requireUser,
  normalizePermissions,
  handleError
} = require("../lib/firebase-admin");

function samePermissions(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

module.exports = async function handler(req, res) {
  if (!ensurePost(req, res)) return;
  try {
    const actor = await requireUser(req);
    if (![ROLE_ADMIN, ROLE_SUPERADMIN].includes(actor.profile.role)) {
      sendJson(res, 200, { ok: true, skipped: true, migrated: 0 });
      return;
    }

    const db = getDb();
    const snap = await db.collection("users").get();
    let batch = db.batch();
    let pending = 0;
    let migrated = 0;

    async function flush() {
      if (!pending) return;
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const role = [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_BCN].includes(String(data.role || "").toLowerCase())
        ? String(data.role).toLowerCase()
        : ROLE_BCN;
      const permissions = normalizePermissions(data.permissions, role);
      const patch = {};
      if (role !== data.role) patch.role = role;
      if (!samePermissions(data.permissions, permissions)) patch.permissions = permissions;
      if (Object.keys(patch).length) {
        patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        patch.updatedBy = actor.decoded.uid;
        batch.set(doc.ref, patch, { merge: true });
        pending++;
        migrated++;
        if (pending >= 400) await flush();
      }
    }
    await flush();
    sendJson(res, 200, { ok: true, migrated });
  } catch (error) {
    handleError(res, error);
  }
};
