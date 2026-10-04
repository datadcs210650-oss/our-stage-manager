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
function actorCanEditEvents(actor) {
  if (actorIsAdmin(actor)) return true;
  return actor.profile.role === "bcn" && actor.profile.permissions?.viewEvents === true && actor.profile.permissions?.editEvents === true;
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

function extractTicketToken(value) {
  const text = String(value || "").trim();
  const m = text.match(/^OSC-TICKET:([A-Za-z0-9_-]{20,120})$/i);
  return m ? m[1] : "";
}
async function findTicketByQr(db, eventId, qrToken) {
  const snap = await db.collection("ticketStudios").doc(eventId).collection("tickets").where("qrToken", "==", qrToken).limit(1).get();
  if (snap.empty) throw bad("QR vé không hợp lệ cho sự kiện này.", "osc/ticket-invalid");
  const doc = snap.docs[0], data = doc.data() || {};
  if (String(data.qrToken || "") !== qrToken) throw bad("QR vé không hợp lệ cho sự kiện này.", "osc/ticket-invalid");
  return { id: doc.id, ref: doc.ref, ...data };
}
async function writeTicketCheckin({ db, event, state, ticket, qrToken, checkedInBy, checkedInByName, scannerSource }) {
  if (ticket.status === "revoked") throw bad("Vé đã bị thu hồi. Vui lòng liên hệ Ban tổ chức.", "osc/ticket-revoked");
  if (ticket.status === "cancelled") throw bad("Vé đã bị hủy. Vui lòng liên hệ Ban tổ chức.", "osc/ticket-cancelled");
  const normalizedMssv = ticket.mssv ? mssvKey(ticket.mssv) : "";
  const member = normalizedMssv ? await findMember(db, event.semester, normalizedMssv) : null;
  const linked = member ? linkedActivity(state, event) : null;
  const canApply = !!(member && linked && linked.item?.locked !== true);
  const appliedValue = canApply ? activityValue(linked.group, linked.item) : null;
  const checkinId = `ticket_${ticket.id}`;
  const checkRef = db.collection("eventPortals").doc(event.id).collection("qrCheckins").doc(checkinId);
  const memberCheckRef = member ? db.collection("eventPortals").doc(event.id).collection("qrCheckins").doc(member.id) : null;
  const memberRef = member ? db.collection("members").doc(member.id) : null;
  let duplicate = false, duplicateData = null, previousActivityValue = null, previousActivityHadValue = false;

  await db.runTransaction(async tx => {
    const refs = [tx.get(checkRef), tx.get(ticket.ref)];
    if (memberCheckRef) refs.push(tx.get(memberCheckRef));
    if (memberRef) refs.push(tx.get(memberRef));
    const snaps = await Promise.all(refs);
    const checkSnap = snaps[0], ticketSnap = snaps[1];
    let offset = 2, memberCheckSnap = null, memberSnap = null;
    if (memberCheckRef) memberCheckSnap = snaps[offset++];
    if (memberRef) memberSnap = snaps[offset++];
    if (!ticketSnap.exists) throw bad("Vé không còn tồn tại.", "osc/ticket-invalid");
    const liveTicket = ticketSnap.data() || {};
    if (String(liveTicket.qrToken || "") !== qrToken) throw bad("QR vé đã được cấp lại và mã cũ không còn hiệu lực.", "osc/ticket-revoked");
    if (liveTicket.status === "revoked") throw bad("Vé đã bị thu hồi. Vui lòng liên hệ Ban tổ chức.", "osc/ticket-revoked");
    if (liveTicket.status === "cancelled") throw bad("Vé đã bị hủy. Vui lòng liên hệ Ban tổ chức.", "osc/ticket-cancelled");
    if (checkSnap.exists || liveTicket.status === "checked_in" || (memberCheckSnap && memberCheckSnap.exists)) {
      duplicate = true;
      duplicateData = checkSnap.exists ? (checkSnap.data() || {}) : memberCheckSnap?.exists ? (memberCheckSnap.data() || {}) : { checkinStatus:"approved", ticketCode:liveTicket.code || ticket.code || "" };
      return;
    }
    let memberData = member || null;
    if (memberRef) {
      if (!memberSnap?.exists) throw bad("Hồ sơ thành viên không còn tồn tại.", "osc/member-not-found");
      memberData = { id:memberSnap.id, ...(memberSnap.data() || {}) };
      if (canApply) {
        previousActivityHadValue = Object.prototype.hasOwnProperty.call(memberData.scores || {}, linked.item.id);
        previousActivityValue = previousActivityHadValue ? (memberData.scores || {})[linked.item.id] : null;
        tx.update(memberRef, {
          [`scores.${linked.item.id}`]: appliedValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: checkedInBy || "ticket_scanner"
        });
      }
    }
    tx.set(checkRef, {
      eventId:event.id, semester:event.semester, attendeeType:"ticket",
      memberId:member ? member.id : "", mssv:normalizedMssv,
      memberName:String(ticket.name || memberData?.name || "Khách có vé").slice(0,160),
      ticketId:ticket.id, ticketCode:String(ticket.code || "").slice(0,40),
      ticketType:String(ticket.ticketType || "").slice(0,80), seat:String(ticket.seat || "").slice(0,40),
      method:"ticket_qr", registrationStatus:"ticket", registrationSubmissionId:"",
      checkinStatus:"approved", checkedInAt:admin.firestore.FieldValue.serverTimestamp(),
      checkedInBy:checkedInBy || "public_scanner", checkedInByName:String(checkedInByName || "Link check-in").slice(0,160),
      scannerSource:scannerSource || "delegated_link", linkedActivityId:linked?.item?.id || "",
      activityApplied:canApply, activityAppliedValue:canApply ? appliedValue : null,
      previousActivityHadValue, previousActivityValue:previousActivityHadValue ? previousActivityValue : null
    }, { merge:false });
    tx.update(ticket.ref, {
      status:"checked_in", checkedInAt:admin.firestore.FieldValue.serverTimestamp(),
      checkedInBy:checkedInBy || "public_scanner", checkedInByName:String(checkedInByName || "Link check-in").slice(0,160),
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    });
  });
  return { duplicate, duplicateData, checkinId, member, canApply, appliedValue };
}
async function scanTicket({ db, event, state, qrToken, checkedInBy, checkedInByName, scannerSource }) {
  const ticket = await findTicketByQr(db, event.id, qrToken);
  const result = await writeTicketCheckin({ db, event, state, ticket, qrToken, checkedInBy, checkedInByName, scannerSource });
  return {
    ok:true, duplicate:result.duplicate, checkinId:result.checkinId, attendeeType:"ticket", registered:true,
    registrationStatus:"ticket", memberName:String(ticket.name || "Khách có vé").slice(0,160),
    mssv:String(ticket.mssv || "").slice(0,40), ticketCode:String(ticket.code || "").slice(0,40),
    ticketType:String(ticket.ticketType || "").slice(0,80), seat:String(ticket.seat || "").slice(0,40),
    activityApplied:result.canApply, activityAppliedValue:result.appliedValue,
    existingStatus:result.duplicateData?.checkinStatus || "approved"
  };
}

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
  const payload = {
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
  };

  // Atomic duplicate protection: simultaneous scans of the same QR resolve
  // to one check-in document. Firestore retries the second transaction and it
  // returns duplicate=true instead of creating a second row.
  const outcome = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) return { duplicate: true, data: snap.data() || {} };
    tx.set(ref, payload, { merge: false });
    return { duplicate: false, data: null };
  });

  if (!outcome.duplicate) {
    // A notification write must not turn an already-saved check-in into an API failure.
    try {
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
    } catch (error) {
      console.error("check-in notification failed", error);
    }
  }

  return { duplicate: outcome.duplicate, checkinId, data: outcome.data || null };
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
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  const [{ data: event }, state] = await Promise.all([loadEvent(db, eventId), loadState(db)]);
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  const rawPayload = String(body.payload || body.mssv || "").trim();
  const ticketToken = extractTicketToken(rawPayload);
  if (ticketToken) {
    return scanTicket({ db, event, state, qrToken:ticketToken, checkedInBy:actor.decoded.uid, checkedInByName:actor.profile.displayName || actor.decoded.email || "BCN", scannerSource:"internal_bcn" });
  }
  if (event.qrCheckinEnabled !== true) throw bad("QR check-in thành viên của sự kiện đang tắt. Máy quét vẫn nhận QR vé Ticket Studio.", "osc/member-qr-disabled");
  const mssv = normalizeMssv(body.mssv || rawPayload);
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
    attendeeType: d.attendeeType === "external" ? "external" : d.attendeeType === "ticket" ? "ticket" : "member",
    memberId: String(d.memberId || "").slice(0, 180),
    mssv: String(d.mssv || "").slice(0, 30),
    memberName: String(d.memberName || "").slice(0, 160),
    method: ["manual_mssv", "public_scanner", "school_qr", "ticket_qr"].includes(d.method) ? d.method : "school_qr",
    registrationStatus: d.registrationStatus === "registered" ? "registered" : d.registrationStatus === "ticket" ? "ticket" : "unregistered",
    checkinStatus: ["approved", "pending_admin", "rejected"].includes(d.checkinStatus) ? d.checkinStatus : "approved",
    checkedInAt: timestampMillis(d.checkedInAt),
    checkedInByName: String(d.checkedInByName || "").slice(0, 160),
    scannerSource: String(d.scannerSource || "").slice(0, 60),
    ticketId: String(d.ticketId || "").slice(0, 180),
    ticketCode: String(d.ticketCode || "").slice(0, 40),
    ticketType: String(d.ticketType || "").slice(0, 80),
    seat: String(d.seat || "").slice(0, 40),
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
async function ticketStudioReady(db, eventId) {
  const studio = await db.collection("ticketStudios").doc(eventId).get();
  if (!studio.exists) return false;
  const one = await db.collection("ticketStudios").doc(eventId).collection("tickets").limit(1).get();
  return !one.empty;
}

async function adminCreateLink(req, body) {
  const actor = await requireManager(req);
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  const [{ data:event }, state] = await Promise.all([loadEvent(db,eventId), loadState(db)]);
  const ticketReady = await ticketStudioReady(db, eventId);
  if (event.qrCheckinEnabled !== true && !ticketReady) throw bad("Hãy bật QR check-in hoặc tạo vé Ticket Studio trước.");
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

async function adminSetLinkActive(req, body) {
  const actor = await requireManager(req);
  const db = getDb(), token = normalizeToken(body.token), active = body.active === true;
  const ref = db.collection("eventScannerLinks").doc(token), snap = await ref.get();
  if (!snap.exists) throw bad("Link check-in không tồn tại.", "osc/scanner-invalid");
  const link = snap.data() || {};
  const [{ data:event }, state] = await Promise.all([loadEvent(db, normalizeId(link.eventId, "Sự kiện")), loadState(db)]);
  if (active) {
    const ticketReady = await ticketStudioReady(db, event.id);
    if (event.qrCheckinEnabled !== true && !ticketReady) throw bad("QR check-in thành viên đang tắt và sự kiện chưa có vé Ticket Studio.");
  }
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");

  // Keep at most one delegated scanner link active per event. This is independent
  // from event.isOpen: closing registration must not stop check-in.
  if (active) {
    const all = await db.collection("eventScannerLinks").where("eventId", "==", event.id).get();
    const batch = db.batch();
    for (const d of all.docs) {
      if (d.id !== token && d.data()?.active === true) {
        batch.set(d.ref, {
          active:false,
          disabledAt:admin.firestore.FieldValue.serverTimestamp(),
          disabledBy:actor.decoded.uid
        }, { merge:true });
      }
    }
    batch.set(ref, {
      active:true,
      reactivatedAt:admin.firestore.FieldValue.serverTimestamp(),
      reactivatedBy:actor.decoded.uid
    }, { merge:true });
    await batch.commit();
  } else {
    await ref.set({
      active:false,
      disabledAt:admin.firestore.FieldValue.serverTimestamp(),
      disabledBy:actor.decoded.uid
    }, { merge:true });
  }
  return { ok:true, token, active };
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


async function commitBatchOps(db, ops, size = 350) {
  for (let i = 0; i < ops.length; i += size) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + size)) {
      if (op.type === "set") batch.set(op.ref, op.data, { merge: false });
      else if (op.type === "delete") batch.delete(op.ref);
    }
    await batch.commit();
  }
}

function stableEventDeleteVersion(event) {
  const ts = event?.updatedAt?.toMillis?.() || event?.createdAt?.toMillis?.();
  return String(ts || "current");
}

async function adminDeleteEvent(req, body) {
  const actor = await requireUser(req);
  if (!actorCanEditEvents(actor)) throw bad("Tài khoản chưa có quyền chỉnh sửa Cổng sự kiện.", "osc/forbidden");
  const db = getDb(), eventId = normalizeId(body.eventId, "Sự kiện");
  const [{ ref:eventRef, data:event }, state] = await Promise.all([loadEvent(db, eventId), loadState(db)]);
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa nên không thể xóa sự kiện.", "osc/semester-locked");

  const [subSnap, qrSnap, linkSnap] = await Promise.all([
    eventRef.collection("submissions").get(),
    eventRef.collection("qrCheckins").get(),
    db.collection("eventScannerLinks").where("eventId", "==", eventId).get()
  ]);

  const deletedAt = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(deletedAt.toMillis() + 30 * 86400000);
  const version = stableEventDeleteVersion(event);
  const actorName = String(actor.profile.displayName || actor.decoded.email || "Quản trị viên").slice(0, 120);
  const base = { semester:event.semester, deletedBy:actor.decoded.uid, deletedByName:actorName, deletedAt, expiresAt };
  const trash = db.collection("trashBin");
  const backupOps = [];
  backupOps.push({ type:"set", ref:trash.doc(`event_${eventId}_${version}`), data:{
    type:"event", sourceId:eventId, data:event, meta:{ label:String(event.title || "Sự kiện").slice(0,200), semester:event.semester }, ...base
  }});
  for (const d of subSnap.docs) {
    const row = d.data() || {};
    backupOps.push({ type:"set", ref:trash.doc(`eventSubmission_${eventId}_${d.id}_${version}`), data:{
      type:"eventSubmission", sourceId:d.id, data:row, meta:{ eventId, label:String(row.submitterLabel || "Phản hồi").slice(0,200), semester:event.semester }, ...base
    }});
  }
  for (const d of qrSnap.docs) {
    const row = d.data() || {};
    backupOps.push({ type:"set", ref:trash.doc(`eventQrCheckin_${eventId}_${d.id}_${version}`), data:{
      type:"eventQrCheckin", sourceId:d.id, data:row, meta:{ eventId, label:`${String(row.memberName || "Check-in").slice(0,140)} • ${String(row.mssv || "").slice(0,30)}`, semester:event.semester }, ...base
    }});
  }

  // Backup everything first. If this phase fails, no live event data is deleted.
  await commitBatchOps(db, backupOps);

  // Delete children / delegated scanner links in bounded batches, then delete the parent last.
  const deleteOps = [
    ...subSnap.docs.map(d => ({ type:"delete", ref:d.ref })),
    ...qrSnap.docs.map(d => ({ type:"delete", ref:d.ref })),
    ...linkSnap.docs.map(d => ({ type:"delete", ref:d.ref }))
  ];
  await commitBatchOps(db, deleteOps);
  await eventRef.delete();

  return { ok:true, deleted:true, eventId, submissions:subSnap.size, checkins:qrSnap.size, scannerLinks:linkSnap.size };
}

async function publicConfig(body) {
  const db = getDb(), token = normalizeToken(body.token);
  const linkSnap = await db.collection("eventScannerLinks").doc(token).get();
  if (!linkSnap.exists || linkSnap.data()?.active !== true) throw bad("Link check-in đã hết hiệu lực.", "osc/scanner-invalid");
  const link = linkSnap.data() || {};
  const [{ data: event }, state] = await Promise.all([loadEvent(db, normalizeId(link.eventId, "Sự kiện")), loadState(db)]);
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  const ticketQrEnabled = await ticketStudioReady(db, event.id);
  const memberQrEnabled = event.qrCheckinEnabled === true;
  if (!memberQrEnabled && !ticketQrEnabled) throw bad("Sự kiện hiện không có kênh QR check-in đang hoạt động.", "osc/scanner-invalid");
  return {
    ok: true,
    service: "event-checkin",
    eventId: event.id,
    title: String(event.title || "Check-in sự kiện").slice(0, 200),
    semester: String(event.semester || "").slice(0, 20),
    audience: event.qrCheckinAudience === "public" ? "public" : "members",
    memberQrEnabled,
    ticketQrEnabled
  };
}

async function publicScan(body) {
  const db = getDb(), token = normalizeToken(body.token);
  const linkSnap = await db.collection("eventScannerLinks").doc(token).get();
  if (!linkSnap.exists || linkSnap.data()?.active !== true) throw bad("Link check-in đã hết hiệu lực.", "osc/scanner-invalid");
  const link = linkSnap.data() || {};
  const [{ data: event }, state] = await Promise.all([loadEvent(db, normalizeId(link.eventId, "Sự kiện")), loadState(db)]);
  if (semesterLocked(state, event.semester)) throw bad("Học kỳ đang bị khóa.", "osc/semester-locked");
  const rawPayload = String(body.payload || body.mssv || "").trim();
  const ticketToken = extractTicketToken(rawPayload);
  if (ticketToken) {
    const result = await scanTicket({ db, event, state, qrToken:ticketToken, checkedInBy:"public_scanner", checkedInByName:"Link check-in", scannerSource:"delegated_link" });
    return { ok:true, duplicate:result.duplicate, status:result.existingStatus || "approved", pendingAdmin:false, attendeeType:"ticket", ticketCode:result.ticketCode };
  }
  if (event.qrCheckinEnabled !== true) throw bad("QR check-in thành viên đang tắt. Link này hiện chỉ nhận QR vé Ticket Studio.", "osc/member-qr-disabled");
  const mssv = normalizeMssv(body.mssv || rawPayload);
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
  const ticketRef = row.ticketId ? db.collection("ticketStudios").doc(eventId).collection("tickets").doc(row.ticketId) : null;
  await db.runTransaction(async tx => {
    const reads = [tx.get(ref)];
    if (memberRef) reads.push(tx.get(memberRef));
    if (ticketRef) reads.push(tx.get(ticketRef));
    const snaps = await Promise.all(reads);
    const cSnap = snaps[0]; if (!cSnap.exists) return;
    const c = cSnap.data() || {};
    let i = 1, mSnap = null, tSnap = null;
    if (memberRef) mSnap = snaps[i++];
    if (ticketRef) tSnap = snaps[i++];
    if (memberRef && mSnap?.exists && c.activityApplied === true && c.linkedActivityId) {
      const md = mSnap.data() || {}, current = (md.scores || {})[c.linkedActivityId];
      if (current === c.activityAppliedValue) {
        const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.decoded.uid };
        patch[`scores.${c.linkedActivityId}`] = c.previousActivityHadValue ? c.previousActivityValue : admin.firestore.FieldValue.delete();
        tx.update(memberRef, patch);
      }
    }
    if (ticketRef && tSnap?.exists && tSnap.data()?.status === "checked_in") {
      tx.update(ticketRef, { status:"issued", checkedInAt:admin.firestore.FieldValue.delete(), checkedInBy:admin.firestore.FieldValue.delete(), checkedInByName:admin.firestore.FieldValue.delete(), updatedAt:admin.firestore.FieldValue.serverTimestamp() });
    }
    tx.delete(ref);
  });
  return { ok: true, deleted: true };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return sendJson(res, 200, { ok:true, service:"event-checkin", version:88 });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ GET/POST." });
    }
    const body = readJsonBody(req), action = String(body.action || "");
    let result;
    if (action === "health") result = { ok:true, service:"event-checkin", version:88 };
    else if (action === "public-config") result = await publicConfig(body);
    else if (action === "public-scan") result = await publicScan(body);
    else if (action === "admin-scan") result = await adminScan(req, body);
    else if (action === "admin-list-checkins") result = await adminListCheckins(req, body);
    else if (action === "admin-summary") result = await adminSummary(req, body);
    else if (action === "admin-links") result = await adminLinks(req, body);
    else if (action === "admin-create-link") result = await adminCreateLink(req, body);
    else if (action === "admin-revoke-link") result = await adminRevokeLink(req, body);
    else if (action === "admin-set-link-active") result = await adminSetLinkActive(req, body);
    else if (action === "admin-delete-event-links") result = await adminDeleteEventLinks(req, body);
    else if (action === "admin-delete-event") result = await adminDeleteEvent(req, body);
    else if (action === "decision") result = await decide(req, body);
    else if (action === "undo") result = await undo(req, body);
    else throw bad("Thao tác check-in không hợp lệ.");
    return sendJson(res, 200, result);
  } catch (error) {
    const code = String(error?.code || "");
    const clientCodes = new Set(["osc/bad-request", "osc/not-member", "osc/qr-revoked", "osc/semester-locked", "osc/scanner-invalid", "osc/event-not-found", "osc/member-not-found", "osc/checkin-not-found", "osc/ticket-invalid", "osc/ticket-revoked", "osc/ticket-cancelled", "osc/member-qr-disabled"]);
    if (clientCodes.has(code)) {
      const status = code === "osc/scanner-invalid" || code === "osc/event-not-found" || code === "osc/ticket-invalid" ? 404 : ["osc/semester-locked","osc/ticket-revoked","osc/ticket-cancelled","osc/member-qr-disabled"].includes(code) ? 409 : 400;
      return sendJson(res, status, { ok: false, error: error.message, code });
    }
    return handleError(res, error);
  }
};
