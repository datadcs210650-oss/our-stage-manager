"use strict";

const admin = require("firebase-admin");

const ROLE_ADMIN = "admin";
const ROLE_SUPERADMIN = "superadmin";
const ROLE_BCN = "bcn";
const VALID_ROLES = new Set([ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_BCN]);
const PERMISSION_KEYS = [
  "viewAttendance", "editAttendance",
  "viewMembers", "editMembers",
  "viewFinance", "editFinance",
  "viewEvents", "editEvents",
  "viewLookup", "editLookup"
];

function cleanPrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function serviceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const e = new Error("FIREBASE_SERVICE_ACCOUNT không phải JSON hợp lệ.");
      e.code = "osc/admin-env-invalid";
      throw e;
    }
    if (parsed.private_key) parsed.private_key = cleanPrivateKey(parsed.private_key);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      const e = new Error("FIREBASE_SERVICE_ACCOUNT thiếu project_id, client_email hoặc private_key.");
      e.code = "osc/admin-env-missing";
      throw e;
    }
    return parsed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    const e = new Error("Thiếu Firebase Admin Environment Variables trên Vercel.");
    e.code = "osc/admin-env-missing";
    throw e;
  }
  return { projectId, clientEmail, privateKey };
}

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = serviceAccountFromEnv();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || serviceAccount.projectId
  });
}

function getAuth() {
  getAdminApp();
  return admin.auth();
}

function getDb() {
  getAdminApp();
  return admin.firestore();
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function sendJson(res, status, payload) {
  setNoStore(res);
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function ensurePost(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ phương thức POST." });
    return false;
  }
  return true;
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (!req.body) return {};
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const e = new Error("Dữ liệu gửi lên không phải JSON hợp lệ.");
    e.code = "osc/bad-json";
    throw e;
  }
}

function bearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) {
    const e = new Error("Thiếu mã xác thực đăng nhập.");
    e.code = "osc/unauthenticated";
    throw e;
  }
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token, true);
  } catch {
    const e = new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    e.code = "osc/unauthenticated";
    throw e;
  }
  const db = getDb();
  const ref = db.collection("users").doc(decoded.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const e = new Error("Tài khoản chưa có hồ sơ quyền trong hệ thống.");
    e.code = "osc/no-profile";
    throw e;
  }
  const profile = snap.data() || {};
  if (profile.active !== true) {
    const e = new Error("Tài khoản đã bị khóa.");
    e.code = "osc/inactive";
    throw e;
  }
  const role = String(profile.role || "").toLowerCase();
  if (!VALID_ROLES.has(role)) {
    const e = new Error("Vai trò tài khoản không hợp lệ.");
    e.code = "osc/forbidden";
    throw e;
  }
  const effective = { ...profile, role };
  if (role === ROLE_BCN) {
    const tp = profile.temporaryPermissions && typeof profile.temporaryPermissions === "object" ? profile.temporaryPermissions : null;
    const expiresMs = tp?.expiresAt?.toMillis?.() || tp?.expiresAt?.toDate?.()?.getTime?.() || Number(tp?.expiresAt || 0) || 0;
    if (tp && expiresMs > Date.now() && tp.permissions && typeof tp.permissions === "object") {
      const merged = { ...(profile.permissions || {}) };
      for (const key of PERMISSION_KEYS) if (tp.permissions[key] === true) merged[key] = true;
      effective.permissions = normalizePermissions(merged, ROLE_BCN);
      effective.temporaryPermissionsActive = true;
      effective.temporaryPermissionsExpiresAt = expiresMs;
      effective.temporaryPermissionsLabel = String(tp.label || "").slice(0,120);
      effective.temporaryPermissionsEventId = String(tp.eventId || "").slice(0,180);
    }
  }
  return { decoded, profile: effective, ref };
}

async function requireManager(req) {
  const actor = await requireUser(req);
  if (![ROLE_ADMIN, ROLE_SUPERADMIN].includes(actor.profile.role)) {
    const e = new Error("Bạn không có quyền quản lý tài khoản BCN.");
    e.code = "osc/forbidden";
    throw e;
  }
  return actor;
}

function validateUid(uid) {
  const value = String(uid || "").trim();
  if (!value || value.length > 128) {
    const e = new Error("UID tài khoản không hợp lệ.");
    e.code = "osc/bad-request";
    throw e;
  }
  return value;
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    const e = new Error("Email không hợp lệ.");
    e.code = "osc/bad-email";
    throw e;
  }
  return value;
}

function normalizeDisplayName(name) {
  const value = String(name || "").trim().replace(/\s+/g, " ");
  if (!value || value.length > 100) {
    const e = new Error("Tên hiển thị phải từ 1 đến 100 ký tự.");
    e.code = "osc/bad-request";
    throw e;
  }
  return value;
}

function normalizeRole(role) {
  const value = String(role || ROLE_BCN).trim().toLowerCase();
  if (![ROLE_ADMIN, ROLE_BCN].includes(value)) {
    const e = new Error("Vai trò chỉ có thể là Admin hoặc BCN.");
    e.code = "osc/bad-role";
    throw e;
  }
  return value;
}

function adminPermissions() {
  return {
    viewAttendance: true, editAttendance: true,
    viewMembers: true, editMembers: true,
    viewFinance: true, editFinance: true,
    viewEvents: true, editEvents: true,
    viewLookup: true, editLookup: false
  };
}

function normalizePermissions(input, role) {
  if (role === ROLE_ADMIN || role === ROLE_SUPERADMIN) return adminPermissions();
  const source = input && typeof input === "object" ? input : {};
  const p = {};
  for (const key of PERMISSION_KEYS) p[key] = source[key] === true;
  p.editAttendance = p.viewAttendance && p.editAttendance;
  p.editMembers = p.viewMembers && p.editMembers;
  p.editFinance = p.viewFinance && p.editFinance;
  p.editEvents = p.viewEvents && p.editEvents;
  p.editLookup = false;
  return p;
}

function ensureRoleCanBeAssigned(actorRole, nextRole) {
  if (actorRole === ROLE_ADMIN && nextRole !== ROLE_BCN) {
    const e = new Error("Admin chỉ được tạo/chỉnh tài khoản BCN.");
    e.code = "osc/forbidden";
    throw e;
  }
}

function ensureTargetManageable(actor, targetUid, targetProfile) {
  if (actor.decoded.uid === targetUid) {
    const e = new Error("Không thể dùng chức năng quản trị để sửa chính tài khoản đang đăng nhập.");
    e.code = "osc/self-target";
    throw e;
  }
  const targetRole = String(targetProfile.role || ROLE_BCN).toLowerCase();
  if (targetRole === ROLE_SUPERADMIN) {
    const e = new Error("Không thể thay đổi tài khoản Super Admin.");
    e.code = "osc/forbidden";
    throw e;
  }
  if (actor.profile.role === ROLE_ADMIN && targetRole !== ROLE_BCN) {
    const e = new Error("Admin chỉ được quản lý tài khoản BCN.");
    e.code = "osc/forbidden";
    throw e;
  }
  return targetRole;
}

async function getTargetProfile(uid) {
  const ref = getDb().collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const e = new Error("Không tìm thấy hồ sơ tài khoản trong Firestore.");
    e.code = "osc/target-not-found";
    throw e;
  }
  return { ref, snap, data: snap.data() || {} };
}

function isAuthCode(error, code) {
  return String(error && error.code || "") === code;
}

function statusForError(error) {
  const code = String(error && error.code || "");
  if (["osc/unauthenticated"].includes(code)) return 401;
  if (["osc/forbidden", "osc/inactive", "osc/no-profile", "osc/self-target"].includes(code)) return 403;
  if (["osc/target-not-found", "auth/user-not-found"].includes(code)) return 404;
  if (["osc/email-exists", "auth/email-already-exists", "osc/profile-exists"].includes(code)) return 409;
  if (["osc/bad-json", "osc/bad-request", "osc/bad-email", "osc/bad-role", "auth/invalid-email", "auth/invalid-password", "auth/invalid-display-name"].includes(code)) return 400;
  if (["osc/admin-env-missing", "osc/admin-env-invalid"].includes(code)) return 500;
  return 500;
}

function publicError(error) {
  const code = String(error && error.code || "");
  const known = code.startsWith("osc/") || code.startsWith("auth/");
  return {
    error: known ? String(error.message || "Yêu cầu không thành công.") : "Máy chủ không thể hoàn tất yêu cầu.",
    code: known ? code : "osc/server-error"
  };
}

function handleError(res, error) {
  console.error("OUR STAGE account API error", error && error.code, error && error.message);
  sendJson(res, statusForError(error), { ok: false, ...publicError(error) });
}

module.exports = {
  admin,
  ROLE_ADMIN,
  ROLE_SUPERADMIN,
  ROLE_BCN,
  PERMISSION_KEYS,
  getAdminApp,
  getAuth,
  getDb,
  sendJson,
  ensurePost,
  readJsonBody,
  requireUser,
  requireManager,
  validateUid,
  normalizeEmail,
  normalizeDisplayName,
  normalizeRole,
  normalizePermissions,
  adminPermissions,
  ensureRoleCanBeAssigned,
  ensureTargetManageable,
  getTargetProfile,
  isAuthCode,
  handleError
};
