"use strict";

const {
  admin,
  getDb,
  sendJson,
  readJsonBody,
  requireManager,
  handleError
} = require("../lib/firebase-admin");

function bad(message, code = "osc/bad-request") {
  const e = new Error(message); e.code = code; return e;
}
function normalizeMssv(value) {
  const v = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (v.length < 4 || v.length > 30) throw bad("MSSV không hợp lệ.");
  return v;
}
function normalizeSemester(value) {
  const v = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!v || v.length > 20) throw bad("Học kỳ không hợp lệ.");
  return v;
}
function normalizeCardId(value) {
  const v = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (v.length < 4 || v.length > 30) throw bad("Mã QR thành viên không hợp lệ.");
  return v;
}
function mssvKey(value) { return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ""); }

async function loadState(db) {
  const snap = await db.collection("clubState").doc("main").get();
  return snap.exists ? (snap.data()?.state || {}) : {};
}
function semData(state, semester) { return state?.semesters?.[semester] || null; }
function semesterLocked(state, semester) { return semData(state, semester)?.locked === true; }

async function findMember(db, semester, mssv) {
  const exact = await db.collection("members").where("mssv", "==", mssv).get();
  for (const doc of exact.docs) {
    const data = doc.data() || {};
    if (data.semester === semester && mssvKey(data.mssv) === mssv) return { id: doc.id, ...data };
  }
  const snap = await db.collection("members").where("semester", "==", semester).get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (mssvKey(data.mssv) === mssv) return { id: doc.id, ...data };
  }
  return null;
}

async function publicConfig(body) {
  const db = getDb(), semester = normalizeSemester(body.semester);
  const [portalSnap, state] = await Promise.all([
    db.collection("memberQrPortals").doc(semester).get(),
    loadState(db)
  ]);
  const portal = portalSnap.exists ? (portalSnap.data() || {}) : {};
  const sem = semData(state, semester);
  return {
    ok: true,
    service: "member-qr",
    semester,
    semesterName: String(sem?.name || semester).slice(0, 100),
    open: portal.open === true && !semesterLocked(state, semester),
    locked: semesterLocked(state, semester)
  };
}

async function issue(body) {
  const db = getDb(), semester = normalizeSemester(body.semester), mssv = normalizeMssv(body.mssv);
  const [portalSnap, state, member] = await Promise.all([
    db.collection("memberQrPortals").doc(semester).get(),
    loadState(db),
    findMember(db, semester, mssv)
  ]);
  const portal = portalSnap.exists ? (portalSnap.data() || {}) : {};
  if (portal.open !== true) throw bad("Cổng cấp QR thành viên hiện chưa mở.", "osc/portal-closed");
  if (semesterLocked(state, semester)) throw bad("Học kỳ đang bị khóa nên chưa thể cấp QR.", "osc/semester-locked");
  if (!member) throw bad("Không tìm thấy MSSV trong danh sách thành viên của học kỳ này.", "osc/member-not-found");

  const cardRef = db.collection("memberQrCards").doc(mssv);
  const cardSnap = await cardRef.get();
  if (cardSnap.exists && cardSnap.data()?.active === false) throw bad("Mã QR của MSSV này đang bị Admin vô hiệu hóa.", "osc/qr-revoked");

  const now = admin.firestore.FieldValue.serverTimestamp();
  if (!cardSnap.exists) {
    await cardRef.set({
      issuedSemester: semester,
      memberId: member.id,
      mssv,
      active: true,
      createdAt: now,
      lastIssuedAt: now,
      updatedAt: now,
      source: "member_portal"
    }, { merge: false });
  } else {
    await cardRef.set({ memberId: member.id, mssv, issuedSemester: semester, lastIssuedAt: now, updatedAt: now }, { merge: true });
  }
  return { ok: true, semester, mssv, qrText: mssv };
}

async function adminState(req, body) {
  await requireManager(req);
  const db = getDb(), semester = normalizeSemester(body.semester);
  const [portalSnap, state, cardsSnap, membersSnap] = await Promise.all([
    db.collection("memberQrPortals").doc(semester).get(),
    loadState(db),
    db.collection("memberQrCards").get(),
    db.collection("members").where("semester", "==", semester).get()
  ]);
  const portal = portalSnap.exists ? (portalSnap.data() || {}) : {};
  const memberKeys = new Set(membersSnap.docs.map(d => mssvKey(d.data()?.mssv)).filter(Boolean));
  const cards = cardsSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }))
    .filter(c => c.issuedSemester === semester || memberKeys.has(mssvKey(c.mssv)))
    .map(c => ({
      id: String(c.id || "").slice(0, 40),
      mssv: String(c.mssv || c.id || "").slice(0, 30),
      active: c.active !== false,
      issuedSemester: String(c.issuedSemester || "").slice(0, 20)
    }))
    .sort((a,b) => a.mssv.localeCompare(b.mssv));
  return {
    ok: true,
    semester,
    semesterName: String(semData(state, semester)?.name || semester).slice(0,100),
    locked: semesterLocked(state, semester),
    open: portal.open === true && !semesterLocked(state, semester),
    portalOpenRaw: portal.open === true,
    cards
  };
}

async function adminSetOpen(req, body) {
  const actor = await requireManager(req);
  const db = getDb(), semester = normalizeSemester(body.semester), open = body.open === true;
  const state = await loadState(db);
  if (open && semesterLocked(state, semester)) throw bad("Học kỳ đang khóa. Hãy mở khóa học kỳ trước.", "osc/semester-locked");
  await db.collection("memberQrPortals").doc(semester).set({
    semester,
    open,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actor.decoded.uid,
    updatedByName: String(actor.profile.displayName || actor.decoded.email || "Admin").slice(0,120)
  }, { merge: true });
  return { ok: true, semester, open };
}

async function adminSetCardActive(req, body) {
  const actor = await requireManager(req);
  const db = getDb(), cardId = normalizeCardId(body.cardId), active = body.active === true;
  const ref = db.collection("memberQrCards").doc(cardId), snap = await ref.get();
  if (!snap.exists) throw bad("MSSV này chưa từng được cấp QR.", "osc/card-not-found");
  await ref.set({
    active,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actor.decoded.uid,
    updatedByName: String(actor.profile.displayName || actor.decoded.email || "Admin").slice(0,120)
  }, { merge: true });
  return { ok: true, cardId, active };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return sendJson(res, 200, { ok:true, service:"member-qr", version:77 });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ GET/POST." });
    }
    const body = readJsonBody(req), action = String(body.action || "issue");
    let result;
    if (action === "health") result = { ok: true, service: "member-qr", version: 77 };
    else if (action === "config") result = await publicConfig(body);
    else if (action === "issue") result = await issue(body);
    else if (action === "admin-state") result = await adminState(req, body);
    else if (action === "admin-set-open") result = await adminSetOpen(req, body);
    else if (action === "admin-set-card-active") result = await adminSetCardActive(req, body);
    else throw bad("Thao tác QR thành viên không hợp lệ.");
    return sendJson(res, 200, result);
  } catch (error) {
    const code = String(error?.code || "");
    const clientCodes = new Set(["osc/bad-request","osc/portal-closed","osc/semester-locked","osc/member-not-found","osc/qr-revoked","osc/card-not-found"]);
    if (clientCodes.has(code)) {
      const status = code === "osc/member-not-found" || code === "osc/card-not-found" ? 404 : code === "osc/semester-locked" ? 409 : 400;
      return sendJson(res, status, { ok:false, error:error.message, code });
    }
    return handleError(res, error);
  }
};
