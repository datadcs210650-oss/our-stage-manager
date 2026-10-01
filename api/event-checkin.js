"use strict";

const {
  admin,
  getDb,
  sendJson,
  readJsonBody,
  requireUser,
  requireManager,
  handleError
} = require("../lib/firebase-admin");
const crypto = require("crypto");

function bad(message, code = "osc/bad-request") {
  const e = new Error(message); e.code = code; return e;
}
function normalizeMssv(value) {
  const v = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (v.length < 4 || v.length > 30) throw bad("MSSV không hợp lệ.");
  return v;
}
function normalizeId(value, label = "Mã") {
  const v = String(value || "").trim();
  if (!v || v.length > 180 || v.includes("/")) throw bad(`${label} không hợp lệ.`);
  return v;
}
function normalizeToken(value) {
  const v = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{24,160}$/.test(v)) throw bad("Link check-in không hợp lệ.", "osc/scanner-invalid");
  return v;
}
function mssvKey(value) { return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ""); }
function actorIsAdmin(actor) { return ["admin", "superadmin"].includes(actor.profile.role); }
function actorCanEditAttendance(actor) {
  if (actorIsAdmin(actor)) return true;
  return actor.profile.role === "bcn" && actor.profile.permissions?.viewAttendance === true && actor.profile.permissions?.editAttendance === true;
}
function actorCanViewEventCheckins(actor) {
  if (actorIsAdmin(actor)) return true;
  return actor.profile.role === "bcn" && actor.profile.permissions?.viewAttendance === true;
}
async function loadState(db) {
  const snap = await db.collection("clubState").doc("main").get();
  return snap.exists ? (snap.data()?.state || {}) : {};
}
function semesterLocked(state, semester) { return state?.semesters?.[semester]?.locked === true; }
function linkedActivity(state, event) {
  if (!event?.linkedActivityId) return null;
  const sem = state?.semesters?.[event.semester];
  for (const group of sem?.groups || []) {
    for (const item of group?.items || []) {
      if (String(item?.id || "") === String(event.linkedActivityId)) return { group, item };
    }
  }
  return null;
}
function activityMode(group, item) { return item?.mode || group?.mode || "number"; }
function activityValue(group, item) { return activityMode(group, item) === "checkbox" ? true : Number(item?.points || 0); }
async function loadEvent(db, eventId) {
  const ref = db.collection("eventPortals").doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw bad("Sự kiện không tồn tại.", "osc/event-not-found");
  return { ref, data: { id: eventId, ...(snap.data() || {}) } };
}
async function findMember(db, semester, mssv) {
  // Fast path for the normal stored representation; fallback preserves compatibility
  // with older rows whose MSSV may have different case/formatting.
  const exact = await db.collection("members").where("mssv", "==", mssv).get();
  for (const doc of exact.docs) {
    const d = doc.data() || {};
    if (d.semester === semester && mssvKey(d.mssv) === mssv) return { id: doc.id, ...d };
  }
  const snap = await db.collection("members").where("semester", "==", semester).get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (mssvKey(d.mssv) === mssv) return { id: doc.id, ...d };
  }
  return null;
}
function eventMssvField(event) {
  const fields = Array.isArray(event?.fields) ? event.fields : [];
  return fields.find(f => f?.systemKey === "mssv")
    || fields.find(f => f?.type === "mssv")
    || fields.find(f => /^(mssv|mã số sinh viên|ma so sinh vien|student id)$/i.test(String(f?.label || "").trim()))
    || null;
}
async function findRegistration(db, event, mssv) {
  const field = eventMssvField(event);
  if (!field) return null;
  const snap = await db.collection("eventPortals").doc(event.id).collection("submissions").get();
  let best = null, bestMs = -1;
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (mssvKey(d.answers?.[field.id]) !== mssv) continue;
    const ms = d.createdAt?.toMillis?.() || 0;
    if (!best || ms >= bestMs) { best = { id: doc.id, ...d }; bestMs = ms; }
  }
  return best;
}
async function ensureQrNotRevoked(db, semester, mssv) {
  const snap = await db.collection("memberQrCards").doc(mssv).get();
  if (snap.exists && snap.data()?.active === false) throw bad("Mã QR của MSSV này đã bị Admin vô hiệu hóa.", "osc/qr-revoked");
}
function checkinIdFor(member, mssv) { return member ? member.id : `external_${mssv}`; }

async function writeApprovedCheckin({ db, event, state, member, registration, mssv, method, checkedInBy, checkedInByName }) {
  const linked = member ? linkedActivity(state, event) : null;
  const canApply = !!(member && linked && linked.item?.locked !== true);
  const appliedValue = canApply ? activityValue(linked.group, linked.item) : null;
  const checkinId = checkinIdFor(member, mssv);
  const checkRef = db.collection("eventPortals").doc(event.id).collection("qrCheckins").doc(checkinId);
  const memberRef = member ? db.collection("members").doc(member.id) : null;
  let duplicate = false, duplicateData = null, previousActivityValue = null, previousActivityHadValue = false;

  await db.runTransaction(async tx => {
    const checkSnap = await tx.get(checkRef);
    if (checkSnap.exists) { duplicate = true; duplicateData = checkSnap.data() || {}; return; }
    let memberData = member || null;
    if (memberRef) {
      const mSnap = await tx.get(memberRef);
      if (!mSnap.exists) throw bad("Hồ sơ thành viên không còn tồn tại.", "osc/member-not-found");
      memberData = { id: mSnap.id, ...(mSnap.data() || {}) };
      if (mssvKey(memberData.mssv) !== mssv || memberData.semester !== event.semester) throw bad("MSSV không khớp hồ sơ thành viên.");
      if (canApply) {
        previousActivityHadValue = Object.prototype.hasOwnProperty.call(memberData.scores || {}, linked.item.id);
        previousActivityValue = previousActivityHadValue ? (memberData.scores || {})[linked.item.id] : null;
        tx.update(memberRef, {
          [`scores.${linked.item.id}`]: appliedValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: checkedInBy || "public_scanner"
        });
      }
    }
    tx.set(checkRef, {
      eventId: event.id,
      semester: event.semester,
      attendeeType: member ? "member" : "external",
      memberId: member ? member.id : "",
      mssv,
      memberName: String(memberData?.name || registration?.submitterLabel || (member ? "Thành viên" : "Sinh viên ngoài CLB")).slice(0, 160),
      method,
      registrationStatus: registration ? "registered" : "unregistered",
      registrationSubmissionId: registration?.id || "",
      checkinStatus: "approved",
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      checkedInBy: checkedInBy || "public_scanner",
      checkedInByName: String(checkedInByName || "Link check-in").slice(0, 160),
      scannerSource: method === "public_scanner" ? "delegated_link" : "internal",
      linkedActivityId: linked?.item?.id || "",
      activityApplied: canApply,
      activityAppliedValue: canApply ? appliedValue : null,
      previousActivityHadValue,
      previousActivityValue: previousActivityHadValue ? previousActivityValue : null
    }, { merge: false });
  });

  return { duplicate, duplicateData, checkinId, linked, canApply, appliedValue };
}

async function writePendingCheckin({ db, event, member, registration, mssv, method, checkedInBy = "public_scanner", checkedInByName = "Link check-in", scannerSource = "delegated_link" }) {
  const checkinId = checkinIdFor(member, mssv);
  const ref = db.collection("eventPortals").doc(event.id).collection("qrCheckins").doc(checkinId);
  const snap = await ref.get();
  if (snap.exists) return { duplicate: true, checkinId, data: snap.data() || {} };
  await ref.set({
    eventId: event.id,
    semester: event.semester,
    attendeeType: "member",
    memberId: member.id,
    mssv,
    memberName: String(member.name || "Thành viên").slice(0, 160),
    method,
    registrationStatus: registration ? "registered" : "unregistered",
    registrationSubmissionId: registration?.id || "",
    checkinStatus: "pending_admin",
    checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
    checkedInBy,
    checkedInByName: String(checkedInByName || "Link check-in").slice(0, 160),
    scannerSource,
    linkedActivityId: String(event.linkedActivityId || ""),
    activityApplied: false,
    activityAppliedValue: null,
    previousActivityHadValue: false,
    previousActivityValue: null
  }, { merge: false });
  await db.collection("systemNotifications").add({
    title: "Check-in chờ xác nhận",
    message: `${mssv} là thành viên CLB nhưng chưa đăng ký sự kiện ${String(event.title || "").slice(0, 140)}.`,
    type: "approval",
    targetRoles: ["admin", "superadmin"],
    targetUid: "",
    linkTab: "events",
    semester: event.semester,
    readBy: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: "public_scanner"
  });
  return { duplicate: false, checkinId };
}

async function resolveCandidate(db, event, mssv) {
  const [member, registration] = await Promise.all([
    findMember(db, event.semester, mssv),
    findRegistration(db, event, mssv)
  ]);
  return { member, registration };
}

async function adminScan(req, body) {
  const actor = await requireUser(req);
  if (!actorCanEditAttendance(actor)) throw bad("Tài khoản chưa có quyền chỉnh sửa Điểm danh / điểm.", "osc/forbidden");
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện"), mssv = normalizeMssv(body.mssv);
  const [{ data: event }, state] = await Promise.all([loadEvent(db, eventId), loadState(db)]);
  if (event.qrCheckinEnabled !== true) throw bad("QR check-in của sự kiện đang tắt.");
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  await ensureQrNotRevoked(db, event.semester, mssv);
  const { member, registration } = await resolveCandidate(db, event, mssv);
  const audience = event.qrCheckinAudience === "public" ? "public" : "members";
  if (!member && audience !== "public") throw bad("MSSV không thuộc danh sách thành viên CLB của học kỳ này.", "osc/not-member");
  if (member && !registration) {
    // Only Admin/Super Admin may override the registration requirement immediately.
    if (actorIsAdmin(actor)) {
      const existingRef = db.collection("eventPortals").doc(event.id).collection("qrCheckins").doc(checkinIdFor(member, mssv));
      const existingSnap = await existingRef.get();
      const existingStatus = existingSnap.exists ? String(existingSnap.data()?.checkinStatus || "approved") : "";
      if (body.decision !== "approve") {
        if (existingSnap.exists && existingStatus !== "pending_admin") {
          return { ok:true, duplicate:true, existingStatus, attendeeType:"member", registered:false, memberName:String(member.name || "Thành viên").slice(0,160), mssv };
        }
        return { ok: true, needsConfirmation: true, mssv, memberName: String(member.name || "Thành viên").slice(0, 160), registered: false, existingStatus };
      }
      if (existingSnap.exists && existingStatus === "pending_admin") {
        const decided = await decide(req, { eventId:event.id, checkinId:existingSnap.id, approve:true });
        return { ok:true, duplicate:false, attendeeType:"member", registered:false, memberName:String(member.name || "Thành viên").slice(0,160), mssv, activityApplied:decided.activityApplied===true, activityAppliedValue:decided.activityAppliedValue, existingStatus:"approved" };
      }
    } else {
      const pending = await writePendingCheckin({
        db, event, member, registration, mssv,
        method: body.method === "manual_mssv" ? "manual_mssv" : "school_qr",
        checkedInBy: actor.decoded.uid,
        checkedInByName: actor.profile.displayName || actor.decoded.email || "BCN",
        scannerSource: "internal_bcn"
      });
      const existingStatus = pending.data?.checkinStatus || "pending_admin";
      return {
        ok: true, duplicate: pending.duplicate,
        pendingAdmin: !pending.duplicate || existingStatus === "pending_admin",
        existingStatus,
        attendeeType: "member", registered: false,
        memberName: String(member.name || "Thành viên").slice(0, 160), mssv
      };
    }
  }
  const result = await writeApprovedCheckin({
    db, event, state, member, registration, mssv,
    method: body.method === "manual_mssv" ? "manual_mssv" : "school_qr",
    checkedInBy: actor.decoded.uid,
    checkedInByName: actor.profile.displayName || actor.decoded.email || "BCN"
  });
  return {
    ok: true,
    duplicate: result.duplicate,
    checkinId: result.checkinId,
    attendeeType: member ? "member" : "external",
    registered: !!registration,
    memberName: member ? String(member.name || "Thành viên").slice(0, 160) : "Sinh viên ngoài CLB",
    mssv,
    activityApplied: result.canApply,
    activityAppliedValue: result.appliedValue,
    activityLocked: !!(member && linkedActivity(state, event)?.item?.locked === true),
    existingStatus: result.duplicateData?.checkinStatus || ""
  };
}


function timestampMillis(value) {
  try {
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
function publicCheckinRow(doc) {
  const d = doc.data ? (doc.data() || {}) : (doc || {});
  return {
    id: String(doc.id || d.id || "").slice(0, 180),
    eventId: String(d.eventId || "").slice(0, 180),
    semester: String(d.semester || "").slice(0, 20),
    attendeeType: d.attendeeType === "external" ? "external" : "member",
    memberId: String(d.memberId || "").slice(0, 180),
    mssv: String(d.mssv || "").slice(0, 30),
    memberName: String(d.memberName || "").slice(0, 160),
    method: ["manual_mssv", "public_scanner", "school_qr"].includes(d.method) ? d.method : "school_qr",
    registrationStatus: d.registrationStatus === "registered" ? "registered" : "unregistered",
    checkinStatus: ["approved", "pending_admin", "rejected"].includes(d.checkinStatus) ? d.checkinStatus : "approved",
    checkedInAt: timestampMillis(d.checkedInAt),
    checkedInByName: String(d.checkedInByName || "").slice(0, 160),
    scannerSource: String(d.scannerSource || "").slice(0, 60),
    activityApplied: d.activityApplied === true,
    activityAppliedValue: d.activityAppliedValue === true ? true : (d.activityAppliedValue === null || d.activityAppliedValue === undefined || d.activityAppliedValue === "" ? null : (Number.isFinite(Number(d.activityAppliedValue)) ? Number(d.activityAppliedValue) : null))
  };
}
async function adminListCheckins(req, body) {
  const actor = await requireUser(req);
  if (!actorCanViewEventCheckins(actor)) throw bad("Tài khoản chưa có quyền xem kết quả check-in.", "osc/forbidden");
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  await loadEvent(db, eventId);
  const snap = await db.collection("eventPortals").doc(eventId).collection("qrCheckins").get();
  const rows = snap.docs.map(publicCheckinRow).sort((a,b) => b.checkedInAt - a.checkedInAt);
  return { ok:true, eventId, rows };
}
async function adminSummary(req, body) {
  const actor = await requireUser(req);
  if (!actorCanViewEventCheckins(actor)) throw bad("Tài khoản chưa có quyền xem kết quả check-in.", "osc/forbidden");
  const db = getDb();
  const semester = String(body.semester || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!semester || semester.length > 20) throw bad("Học kỳ không hợp lệ.");
  let snap;
  try {
    snap = await db.collectionGroup("qrCheckins").where("semester", "==", semester).get();
  } catch (error) {
    // Fallback avoids making the Admin UI depend on a collection-group index.
    const events = await db.collection("eventPortals").where("semester", "==", semester).get();
    const docs = [];
    for (const ev of events.docs) {
      const s = await ev.ref.collection("qrCheckins").get();
      docs.push(...s.docs);
    }
    snap = { docs };
  }
  const map = new Map();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const eventId = String(d.eventId || doc.ref?.parent?.parent?.id || "");
    if (!eventId) continue;
    const x = map.get(eventId) || { eventId, total:0, approved:0, pending:0, rejected:0, external:0 };
    x.total++;
    if (d.checkinStatus === "pending_admin") x.pending++;
    else if (d.checkinStatus === "rejected") x.rejected++;
    else x.approved++;
    if (d.attendeeType === "external") x.external++;
    map.set(eventId, x);
  }
  return { ok:true, semester, rows:[...map.values()] };
}


function scannerToken() {
  return crypto.randomBytes(30).toString("base64url");
}
async function adminLinks(req, body) {
  await requireManager(req);
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  await loadEvent(db, eventId);
  const snap = await db.collection("eventScannerLinks").where("eventId", "==", eventId).get();
  const rows = snap.docs.map(d => ({ id:d.id, ...(d.data() || {}) }))
    .sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .map(x => ({ id:x.id, active:x.active === true, semester:String(x.semester || "").slice(0,20) }));
  return { ok:true, rows };
}
async function adminCreateLink(req, body) {
  const actor = await requireManager(req);
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  const [{ data:event }, state] = await Promise.all([loadEvent(db,eventId), loadState(db)]);
  if (event.qrCheckinEnabled !== true) throw bad("Hãy bật QR check-in cho sự kiện trước.");
  if (event.isOpen === false) throw bad("Sự kiện đang đóng nên chưa thể tạo link check-in.", "osc/event-closed");
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  if (body.replaceOld === true) {
    const old = await db.collection("eventScannerLinks").where("eventId", "==", eventId).get();
    const batch = db.batch(); let changed = 0;
    for (const d of old.docs) if (d.data()?.active === true) {
      batch.set(d.ref, { active:false, revokedAt:admin.firestore.FieldValue.serverTimestamp(), revokedBy:actor.decoded.uid }, { merge:true }); changed++;
    }
    if (changed) await batch.commit();
  }
  const token = scannerToken();
  await db.collection("eventScannerLinks").doc(token).set({
    eventId, semester:event.semester, active:true,
    createdAt:admin.firestore.FieldValue.serverTimestamp(),
    createdBy:actor.decoded.uid,
    createdByName:String(actor.profile.displayName || actor.decoded.email || "Admin").slice(0,120)
  }, { merge:false });
  return { ok:true, token };
}
async function adminRevokeLink(req, body) {
  const actor = await requireManager(req);
  const db = getDb(), token = normalizeToken(body.token);
  const ref = db.collection("eventScannerLinks").doc(token), snap = await ref.get();
  if (!snap.exists) throw bad("Link check-in không tồn tại.", "osc/scanner-invalid");
  await ref.set({ active:false, revokedAt:admin.firestore.FieldValue.serverTimestamp(), revokedBy:actor.decoded.uid }, { merge:true });
  return { ok:true, token, active:false };
}

async function adminDeleteEventLinks(req, body) {
  await requireManager(req);
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  const snap = await db.collection("eventScannerLinks").where("eventId", "==", eventId).get();
  if (snap.empty) return { ok:true, deleted:0 };
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) { batch.delete(d.ref); deleted++; }
    await batch.commit();
  }
  return { ok:true, deleted };
}

async function publicConfig(body) {
  const db = getDb(), token = normalizeToken(body.token);
  const linkSnap = await db.collection("eventScannerLinks").doc(token).get();
  if (!linkSnap.exists || linkSnap.data()?.active !== true) throw bad("Link check-in đã hết hiệu lực.", "osc/scanner-invalid");
  const link = linkSnap.data() || {};
  const [{ data: event }, state] = await Promise.all([loadEvent(db, normalizeId(link.eventId, "Sự kiện")), loadState(db)]);
  if (event.qrCheckinEnabled !== true) throw bad("QR check-in của sự kiện đang tắt.", "osc/scanner-invalid");
  if (event.isOpen === false) throw bad("Sự kiện đã đóng. Link check-in tạm ngưng hiệu lực.", "osc/event-closed");
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  return {
    ok: true,
    service: "event-checkin",
    eventId: event.id,
    title: String(event.title || "Check-in sự kiện").slice(0, 200),
    semester: String(event.semester || "").slice(0, 20),
    audience: event.qrCheckinAudience === "public" ? "public" : "members"
  };
}

async function publicScan(body) {
  const db = getDb(), token = normalizeToken(body.token), mssv = normalizeMssv(body.mssv);
  const linkSnap = await db.collection("eventScannerLinks").doc(token).get();
  if (!linkSnap.exists || linkSnap.data()?.active !== true) throw bad("Link check-in đã hết hiệu lực.", "osc/scanner-invalid");
  const link = linkSnap.data() || {};
  const [{ data: event }, state] = await Promise.all([loadEvent(db, normalizeId(link.eventId, "Sự kiện")), loadState(db)]);
  if (event.qrCheckinEnabled !== true) throw bad("QR check-in của sự kiện đang tắt.", "osc/scanner-invalid");
  if (event.isOpen === false) throw bad("Sự kiện đã đóng. Link check-in tạm ngưng hiệu lực.", "osc/event-closed");
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  await ensureQrNotRevoked(db, event.semester, mssv);
  const { member, registration } = await resolveCandidate(db, event, mssv);
  const audience = event.qrCheckinAudience === "public" ? "public" : "members";
  if (!member && audience !== "public") throw bad("MSSV không thuộc danh sách thành viên được phép check-in.", "osc/not-member");

  if (member && !registration) {
    const pending = await writePendingCheckin({ db, event, member, registration, mssv, method: "public_scanner" });
    const status = pending.data?.checkinStatus || "pending_admin";
    return {
      ok: true,
      duplicate: pending.duplicate,
      status,
      pendingAdmin: !pending.duplicate || status === "pending_admin",
      mssv
    };
  }

  const result = await writeApprovedCheckin({
    db, event, state, member, registration, mssv,
    method: "public_scanner",
    checkedInBy: "public_scanner",
    checkedInByName: "Link check-in"
  });
  // Privacy minimization for delegated scanners: do not reveal whether the MSSV
  // belongs to the club or whether it had an event registration.
  return {
    ok: true,
    duplicate: result.duplicate,
    status: result.duplicateData?.checkinStatus || "approved",
    pendingAdmin: false,
    mssv
  };
}

async function decide(req, body) {
  const actor = await requireUser(req);
  if (!actorIsAdmin(actor)) throw bad("Chỉ Admin/Super Admin được duyệt check-in chưa đăng ký.", "osc/forbidden");
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện"), checkinId = normalizeId(body.checkinId, "Check-in");
  const approve = body.approve === true;
  const [{ data: event }, state] = await Promise.all([loadEvent(db, eventId), loadState(db)]);
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  const ref = db.collection("eventPortals").doc(eventId).collection("qrCheckins").doc(checkinId);
  const snap = await ref.get(); if (!snap.exists) throw bad("Không tìm thấy lượt check-in.", "osc/checkin-not-found");
  const row = snap.data() || {};
  if (row.checkinStatus !== "pending_admin") return { ok: true, status: row.checkinStatus || "approved", unchanged: true };
  if (!approve) {
    await ref.set({ checkinStatus: "rejected", decidedAt: admin.firestore.FieldValue.serverTimestamp(), decidedBy: actor.decoded.uid, decidedByName: actor.profile.displayName || actor.decoded.email || "Admin" }, { merge: true });
    return { ok: true, status: "rejected" };
  }
  const member = await findMember(db, event.semester, normalizeMssv(row.mssv));
  if (!member) throw bad("Thành viên không còn tồn tại trong học kỳ.", "osc/member-not-found");
  const linked = linkedActivity(state, event), canApply = !!(linked && linked.item?.locked !== true), appliedValue = canApply ? activityValue(linked.group, linked.item) : null;
  const memberRef = db.collection("members").doc(member.id);
  await db.runTransaction(async tx => {
    const [cSnap, mSnap] = await Promise.all([tx.get(ref), tx.get(memberRef)]);
    if (!cSnap.exists || cSnap.data()?.checkinStatus !== "pending_admin") return;
    const md = mSnap.data() || {};
    let previousActivityHadValue = false, previousActivityValue = null;
    if (canApply) {
      previousActivityHadValue = Object.prototype.hasOwnProperty.call(md.scores || {}, linked.item.id);
      previousActivityValue = previousActivityHadValue ? (md.scores || {})[linked.item.id] : null;
      tx.update(memberRef, { [`scores.${linked.item.id}`]: appliedValue, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.decoded.uid });
    }
    tx.update(ref, {
      checkinStatus: "approved",
      decidedAt: admin.firestore.FieldValue.serverTimestamp(),
      decidedBy: actor.decoded.uid,
      decidedByName: actor.profile.displayName || actor.decoded.email || "Admin",
      linkedActivityId: linked?.item?.id || "",
      activityApplied: canApply,
      activityAppliedValue: canApply ? appliedValue : null,
      previousActivityHadValue,
      previousActivityValue: previousActivityHadValue ? previousActivityValue : null
    });
  });
  return { ok: true, status: "approved", activityApplied: canApply, activityAppliedValue: appliedValue };
}

async function undo(req, body) {
  const actor = await requireUser(req);
  if (!actorCanEditAttendance(actor)) throw bad("Tài khoản chưa có quyền chỉnh sửa Điểm danh / điểm.", "osc/forbidden");
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện"), checkinId = normalizeId(body.checkinId, "Check-in");
  const [{ data: event }, state] = await Promise.all([loadEvent(db, eventId), loadState(db)]);
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  const ref = db.collection("eventPortals").doc(eventId).collection("qrCheckins").doc(checkinId);
  const snap = await ref.get(); if (!snap.exists) return { ok: true, deleted: false };
  const row = snap.data() || {};
  const memberRef = row.memberId ? db.collection("members").doc(row.memberId) : null;
  await db.runTransaction(async tx => {
    const cSnap = await tx.get(ref); if (!cSnap.exists) return;
    const c = cSnap.data() || {};
    if (memberRef && c.activityApplied === true && c.linkedActivityId) {
      const mSnap = await tx.get(memberRef);
      if (mSnap.exists) {
        const md = mSnap.data() || {}, current = (md.scores || {})[c.linkedActivityId];
        if (current === c.activityAppliedValue) {
          const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.decoded.uid };
          patch[`scores.${c.linkedActivityId}`] = c.previousActivityHadValue ? c.previousActivityValue : admin.firestore.FieldValue.delete();
          tx.update(memberRef, patch);
        }
      }
    }
    tx.delete(ref);
  });
  return { ok: true, deleted: true };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return sendJson(res, 200, { ok:true, service:"event-checkin", version:80 });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ GET/POST." });
    }
    const body = readJsonBody(req), action = String(body.action || "");
    let result;
    if (action === "health") result = { ok:true, service:"event-checkin", version:80 };
    else if (action === "public-config") result = await publicConfig(body);
    else if (action === "public-scan") result = await publicScan(body);
    else if (action === "admin-scan") result = await adminScan(req, body);
    else if (action === "admin-list-checkins") result = await adminListCheckins(req, body);
    else if (action === "admin-summary") result = await adminSummary(req, body);
    else if (action === "admin-links") result = await adminLinks(req, body);
    else if (action === "admin-create-link") result = await adminCreateLink(req, body);
    else if (action === "admin-revoke-link") result = await adminRevokeLink(req, body);
    else if (action === "admin-delete-event-links") result = await adminDeleteEventLinks(req, body);
    else if (action === "decision") result = await decide(req, body);
    else if (action === "undo") result = await undo(req, body);
    else throw bad("Thao tác check-in không hợp lệ.");
    return sendJson(res, 200, result);
  } catch (error) {
    const code = String(error?.code || "");
    const clientCodes = new Set(["osc/bad-request", "osc/not-member", "osc/qr-revoked", "osc/semester-locked", "osc/scanner-invalid", "osc/event-not-found", "osc/member-not-found", "osc/checkin-not-found", "osc/event-closed"]);
    if (clientCodes.has(code)) {
      const status = code === "osc/scanner-invalid" || code === "osc/event-not-found" ? 404 : code === "osc/semester-locked" || code === "osc/event-closed" ? 409 : 400;
      return sendJson(res, status, { ok: false, error: error.message, code });
    }
    return handleError(res, error);
  }
};
