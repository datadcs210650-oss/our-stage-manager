"use strict";

const crypto = require("crypto");
const { Resend } = require("resend");
const {
  admin,
  getDb,
  sendJson,
  readJsonBody,
  requireManager,
  handleError
} = require("../lib/firebase-admin");

const VERSION = 85;
const DEFAULT_SETTINGS = {
  duplicateWindowMinutes: 30,
  recipientCooldownMinutes: 5,
  maxPerRecipientPerDay: 5,
  bounceBlacklistThreshold: 2,
  maxRecipientsPerConfirm: 50,
  maxSystemPerDay: 90
};
const DEFAULT_TEMPLATES = [
  {
    id: "registration_approved",
    name: "Xác nhận đăng ký sự kiện",
    trigger: "registration_approved",
    subject: "Đăng ký {{event_name}} đã được duyệt",
    bodyText: "Xin chào {{name}},\n\nĐăng ký tham gia {{event_name}} của bạn đã được Admin duyệt thành công.\n\nThời gian: {{event_time}}\nĐịa điểm: {{event_location}}\nMSSV: {{mssv}}\n\nHẹn gặp bạn tại sự kiện!\n\nOUR STAGE CLUB",
    system: true
  },
  {
    id: "event_reminder",
    name: "Nhắc lịch trước sự kiện",
    trigger: "event_reminder",
    subject: "Nhắc lịch: {{event_name}}",
    bodyText: "Xin chào {{name}},\n\nĐây là email nhắc lịch cho sự kiện {{event_name}}.\n\nThời gian: {{event_time}}\nĐịa điểm: {{event_location}}\n\nVui lòng sắp xếp thời gian tham gia đúng giờ.\n\nOUR STAGE CLUB",
    system: true
  },
  {
    id: "fund_paid_approved",
    name: "Xác nhận đã đóng quỹ",
    trigger: "fund_paid_approved",
    subject: "OUR STAGE xác nhận đã ghi nhận đóng quỹ",
    bodyText: "Xin chào {{name}},\n\nOUR STAGE CLUB xác nhận trạng thái đóng quỹ của bạn đã được Admin duyệt và ghi nhận thành công.\n\nHọc kỳ: {{semester}}\nMSSV: {{mssv}}\nSố tiền: {{amount}}\n\nCảm ơn bạn.\n\nOUR STAGE CLUB",
    system: true
  }
];
const DEFAULT_RULES = [
  { id: "rule_registration_approved", name: "Duyệt đăng ký → xác nhận email", trigger: "registration_approved", enabled: true, templateId: "registration_approved", requireFinalConfirmation: true },
  { id: "rule_event_reminder", name: "Nhắc lịch trước sự kiện", trigger: "event_reminder", enabled: true, templateId: "event_reminder", reminderMinutesBefore: 1440, requireFinalConfirmation: true },
  { id: "rule_fund_paid", name: "Duyệt đóng quỹ → xác nhận email", trigger: "fund_paid_approved", enabled: true, templateId: "fund_paid_approved", requireFinalConfirmation: true }
];

function bad(message, code = "osc/bad-request") { const e = new Error(message); e.code = code; return e; }
function normalizeEmail(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v || v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw bad("Email người nhận không hợp lệ.", "osc/bad-email");
  return v;
}
function cleanText(value, max = 5000) { return String(value ?? "").replace(/\u0000/g, "").slice(0, max); }
function cleanId(value, label = "Mã") {
  const v = String(value || "").trim();
  if (!v || v.length > 180 || v.includes("/")) throw bad(`${label} không hợp lệ.`);
  return v;
}
function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function tsMillis(v) { return v?.toMillis?.() || (v instanceof Date ? v.getTime() : Number(v || 0)); }
function nowTs() { return admin.firestore.FieldValue.serverTimestamp(); }
function dateKey(ms = Date.now()) {
  const d = new Date(ms + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function configured() { return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL); }
function resendClient() {
  if (!process.env.RESEND_API_KEY) throw bad("Thiếu RESEND_API_KEY trên Vercel.", "osc/resend-not-configured");
  return new Resend(process.env.RESEND_API_KEY);
}
function fromAddress() {
  const email = String(process.env.RESEND_FROM_EMAIL || "").trim();
  if (!email) throw bad("Thiếu RESEND_FROM_EMAIL trên Vercel.", "osc/resend-not-configured");
  const name = String(process.env.RESEND_FROM_NAME || "OUR STAGE CLUB").trim().slice(0, 80);
  return name ? `${name} <${email}>` : email;
}
function escHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function interpolate(text, vars) {
  return String(text || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => cleanText(vars?.[key] ?? "", 1000));
}
function sanitizeVariables(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = {};
  for (const [key, value] of Object.entries(source).slice(0, 40)) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) continue;
    out[key] = cleanText(value, 1000);
  }
  return out;
}
function bodyToHtml(text, vars) {
  const rendered = interpolate(text, vars);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;color:#222b33;line-height:1.65"><div style="padding:18px 0;border-bottom:1px solid #e7e7e7"><b style="letter-spacing:.16em;color:#6f1d37">OUR STAGE CLUB</b></div><div style="padding:22px 0;font-size:15px">${escHtml(rendered).replace(/\n/g, "<br>")}</div><div style="padding:16px 0;border-top:1px solid #e7e7e7;color:#7c8790;font-size:12px">Email được gửi từ hệ thống quản trị OUR STAGE CLUB.</div></div>`;
}
function serializeDoc(doc) {
  const d = doc.data() || {};
  const out = { id: doc.id, ...d };
  for (const [k, v] of Object.entries(out)) if (v?.toDate) out[k] = v.toDate().toISOString();
  return out;
}
async function ensureDefaults(db) {
  const batch = db.batch(); let changed = false;
  for (const t of DEFAULT_TEMPLATES) {
    const ref = db.collection("emailTemplates").doc(t.id); const s = await ref.get();
    if (!s.exists) { batch.set(ref, { ...t, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }); changed = true; }
  }
  for (const r of DEFAULT_RULES) {
    const ref = db.collection("emailRules").doc(r.id); const s = await ref.get();
    if (!s.exists) { batch.set(ref, { ...r, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }); changed = true; }
  }
  const settingsRef = db.collection("emailSettings").doc("main"); const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) { batch.set(settingsRef, { ...DEFAULT_SETTINGS, updatedAt: admin.firestore.FieldValue.serverTimestamp() }); changed = true; }
  if (changed) await batch.commit();
}
async function getSettings(db) {
  const s = await db.collection("emailSettings").doc("main").get();
  return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) };
}
async function loadTemplate(db, id) {
  const s = await db.collection("emailTemplates").doc(cleanId(id, "Mẫu email")).get();
  if (!s.exists) throw bad("Không tìm thấy mẫu email.", "osc/email-template-not-found");
  return { id: s.id, ...s.data() };
}
async function saveTemplate(db, actor, body) {
  const id = cleanId(body.id || `tpl_${crypto.randomUUID()}`, "Mẫu email");
  const name = cleanText(body.name, 120).trim(), trigger = cleanText(body.trigger, 80).trim() || "custom";
  const subject = cleanText(body.subject, 300).trim(), bodyText = cleanText(body.bodyText, 12000).trim();
  if (!name || !subject || !bodyText) throw bad("Tên mẫu, tiêu đề và nội dung không được để trống.");
  const ref = db.collection("emailTemplates").doc(id); const old = await ref.get();
  const system = old.exists ? old.data()?.system === true : false;
  await ref.set({ name, trigger, subject, bodyText, system, updatedAt: nowTs(), updatedBy: actor.decoded.uid, ...(old.exists ? {} : { createdAt: nowTs(), createdBy: actor.decoded.uid }) }, { merge: true });
  return id;
}
async function saveRule(db, actor, body) {
  const id = cleanId(body.id || `rule_${crypto.randomUUID()}`, "Rule");
  const allowed = new Set(["registration_approved", "event_reminder", "fund_paid_approved", "custom"]);
  const trigger = allowed.has(String(body.trigger)) ? String(body.trigger) : "custom";
  const reminder = Math.max(5, Math.min(43200, Number(body.reminderMinutesBefore || 1440)));
  await db.collection("emailRules").doc(id).set({
    name: cleanText(body.name, 140).trim() || "Email rule",
    trigger,
    templateId: cleanId(body.templateId, "Mẫu email"),
    enabled: body.enabled !== false,
    reminderMinutesBefore: reminder,
    requireFinalConfirmation: true,
    updatedAt: nowTs(), updatedBy: actor.decoded.uid,
    createdAt: nowTs(), createdBy: actor.decoded.uid
  }, { merge: true });
  return id;
}
function clampSettings(input) {
  return {
    duplicateWindowMinutes: Math.max(1, Math.min(1440, Number(input.duplicateWindowMinutes || 30))),
    recipientCooldownMinutes: Math.max(1, Math.min(240, Number(input.recipientCooldownMinutes || 5))),
    maxPerRecipientPerDay: Math.max(1, Math.min(25, Number(input.maxPerRecipientPerDay || 5))),
    bounceBlacklistThreshold: Math.max(1, Math.min(10, Number(input.bounceBlacklistThreshold || 2))),
    maxRecipientsPerConfirm: Math.max(1, Math.min(100, Number(input.maxRecipientsPerConfirm || 50))),
    maxSystemPerDay: Math.max(1, Math.min(100, Number(input.maxSystemPerDay || 90)))
  };
}
async function repairStaleSending(db) {
  const s = await db.collection("emailQueue").where("status", "==", "sending").limit(50).get();
  const cutoff = Date.now() - 5 * 60000, batch = db.batch(), staleIds = [];
  for (const d of s.docs) {
    const ms = tsMillis(d.data()?.updatedAt);
    if (ms && ms < cutoff) {
      batch.update(d.ref, { status: "failed", error: "Lượt gửi trước bị gián đoạn. Có thể dùng Gửi lại.", updatedAt: nowTs() });
      staleIds.push(d.id);
    }
  }
  if (staleIds.length) {
    await batch.commit();
    // If the function crashed after reserving quota but before Resend accepted the
    // request, release the stale reservation so the daily cap is not leaked.
    await Promise.all(staleIds.map(id => releaseGlobalSlot(db, id).catch(() => {})));
  }
}
async function listAll(db) {
  await ensureDefaults(db);
  await repairStaleSending(db);
  const todayKey = dateKey();
  const [t, r, q, b, s, g] = await Promise.all([
    db.collection("emailTemplates").limit(100).get(),
    db.collection("emailRules").limit(100).get(),
    db.collection("emailQueue").orderBy("createdAt", "desc").limit(200).get(),
    db.collection("emailBlacklist").limit(200).get(),
    db.collection("emailSettings").doc("main").get(),
    db.collection("emailGlobalState").doc(todayKey).get()
  ]);
  return {
    configured: configured(),
    webhookConfigured: !!process.env.RESEND_WEBHOOK_SECRET,
    from: process.env.RESEND_FROM_EMAIL || "",
    version: VERSION,
    templates: t.docs.map(serializeDoc),
    rules: r.docs.map(serializeDoc),
    queue: q.docs.map(serializeDoc),
    blacklist: b.docs.map(serializeDoc),
    settings: { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) },
    usage: { dayKey: todayKey, processedToday: g.exists ? Number(g.data()?.count || 0) : 0 }
  };
}
async function createQueueItems(db, actor, body) {
  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  const settings = await getSettings(db);
  if (!rawRecipients.length) throw bad("Chưa chọn người nhận email.");
  const baseVars = sanitizeVariables(body.variables);
  const normalized = []; const seen = new Set();
  for (const raw of rawRecipients) {
    const email = normalizeEmail(raw?.email);
    if (seen.has(email)) continue;
    seen.add(email);
    const name = cleanText(raw?.name, 140).trim();
    const vars = { ...baseVars, ...sanitizeVariables(raw?.variables), name: cleanText(raw?.variables?.name || name || baseVars.name || "bạn", 140) };
    normalized.push({ email, name, vars });
  }
  if (!normalized.length) throw bad("Chưa có email người nhận hợp lệ.");
  if (normalized.length > Number(settings.maxRecipientsPerConfirm || 50)) throw bad(`Mỗi lần xác nhận tối đa ${settings.maxRecipientsPerConfirm} người nhận để tránh gửi ồ ạt.`);
  const tpl = await loadTemplate(db, body.templateId);
  const trigger = cleanText(body.trigger || tpl.trigger || "custom", 80);
  const contextKey = cleanText(body.contextKey || `${trigger}:${Date.now()}`, 220);
  let scheduledAt = null;
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt); if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now() + 30000) throw bad("Thời gian lên lịch phải sau hiện tại ít nhất 30 giây.");
    if (d.getTime() > Date.now() + 30 * 24 * 3600 * 1000) throw bad("Resend chỉ cho phép lên lịch tối đa 30 ngày trước thời điểm gửi.", "osc/schedule-too-far");
    scheduledAt = admin.firestore.Timestamp.fromDate(d);
  }
  const ids = [], batch = db.batch();
  for (const raw of normalized) {
    const id = `mail_${crypto.randomUUID()}`;
    const subject = interpolate(body.subjectOverride || tpl.subject, raw.vars).slice(0, 300);
    const bodyText = interpolate(body.bodyOverride || tpl.bodyText, raw.vars).slice(0, 12000);
    batch.set(db.collection("emailQueue").doc(id), {
      trigger, templateId: tpl.id, templateName: tpl.name || tpl.id, recipientEmail: raw.email, recipientName: raw.name,
      subject, bodyText, variables: raw.vars, contextKey, contextType: cleanText(body.contextType, 80), contextId: cleanText(body.contextId, 180), contextSubId: cleanText(body.contextSubId, 180),
      status: "draft", scheduledAt, createdAt: nowTs(), createdBy: actor.decoded.uid, createdByName: cleanText(actor.profile.displayName || actor.decoded.email, 120), updatedAt: nowTs(), attempts: 0, test: body.test === true
    });
    ids.push(id);
  }
  await batch.commit();
  return ids;
}
async function preflightRecipient(db, item, settings) {
  const email = normalizeEmail(item.recipientEmail); const emailHash = hash(email);
  const bl = await db.collection("emailBlacklist").doc(emailHash).get();
  if (bl.exists && bl.data()?.active === true) throw bad("Email này đang nằm trong blacklist do lỗi giao nhận hoặc complaint.", "osc/email-blacklisted");
  const stateRef = db.collection("emailRecipientState").doc(emailHash); const stateSnap = await stateRef.get(); const state = stateSnap.exists ? stateSnap.data() : {};
  const now = Date.now(), last = tsMillis(state.lastSentAt), scheduledMs = tsMillis(item.scheduledAt), cooldownMs = Number(settings.recipientCooldownMinutes || 5) * 60000;
  if (scheduledMs && scheduledMs > now + 30000) {
    if (last && scheduledMs - last < cooldownMs) throw bad(`Email này có lịch gửi quá gần email trước. Cần cách ít nhất ${settings.recipientCooldownMinutes} phút.`, "osc/email-cooldown");
    const related = await db.collection("emailQueue").where("recipientEmail", "==", email).limit(100).get();
    const sameDay = [], targetDay = dateKey(scheduledMs);
    for (const d of related.docs) {
      if (d.id === item.id) continue;
      const x = d.data() || {}; if (x.status !== "scheduled") continue;
      const t = tsMillis(x.scheduledAt); if (!t) continue;
      if (dateKey(t) === targetDay) sameDay.push(t);
      if (Math.abs(t - scheduledMs) < cooldownMs) throw bad(`Email này đã có lịch gửi khác trong khoảng ${settings.recipientCooldownMinutes} phút.`, "osc/email-cooldown");
    }
    const sentToday = state.dayKey === targetDay ? Number(state.dayCount || 0) : 0;
    if (sentToday + sameDay.length >= Number(settings.maxPerRecipientPerDay || 5)) throw bad(`Email này đã đạt giới hạn ${settings.maxPerRecipientPerDay} thư trong ngày được lên lịch.`, "osc/email-recipient-limit");
  } else {
    if (last && now - last < cooldownMs) throw bad(`Email này vừa nhận thư. Hãy chờ ít nhất ${settings.recipientCooldownMinutes} phút để tránh gửi dồn.`, "osc/email-cooldown");
    if (state.dayKey === dateKey(now) && Number(state.dayCount || 0) >= Number(settings.maxPerRecipientPerDay || 5)) throw bad(`Email này đã đạt giới hạn ${settings.maxPerRecipientPerDay} thư/ngày trong hệ thống.`, "osc/email-recipient-limit");
  }
  const dedupeRaw = `${email}|${item.trigger || ""}|${item.contextKey || ""}|${item.templateId || ""}`;
  const dedupeRef = db.collection("emailDedupe").doc(hash(dedupeRaw)); const dedupeSnap = await dedupeRef.get();
  if (dedupeSnap.exists) {
    const ms = tsMillis(dedupeSnap.data()?.sentAt);
    if (ms && now - ms < Number(settings.duplicateWindowMinutes || 30) * 60000) throw bad(`Email trùng đã được xử lý trong ${settings.duplicateWindowMinutes} phút gần đây.`, "osc/email-duplicate");
  }
  return { email, emailHash, stateRef, dedupeRef };
}
async function reserveGlobalSlot(db, queueId, settings, targetMs = Date.now()) {
  // Reserve against the actual delivery day. For scheduled emails this prevents
  // Admins from scheduling more than the system daily cap for a future date.
  const key = dateKey(targetMs), globalRef = db.collection("emailGlobalState").doc(key), reservationRef = db.collection("emailGlobalReservations").doc(queueId);
  await db.runTransaction(async tx => {
    const [globalSnap, reservationSnap] = await Promise.all([tx.get(globalRef), tx.get(reservationRef)]);
    if (reservationSnap.exists) return;
    const count = globalSnap.exists ? Number(globalSnap.data()?.count || 0) : 0;
    const limit = Number(settings.maxSystemPerDay || 90);
    if (count >= limit) throw bad(`Hệ thống đã đạt giới hạn ${limit} email/ngày. Hãy để email trong hàng đợi và gửi vào ngày tiếp theo.`, "osc/email-global-limit");
    tx.set(globalRef, { dayKey: key, count: count + 1, updatedAt: nowTs() }, { merge: true });
    tx.set(reservationRef, { dayKey: key, queueId, createdAt: nowTs() }, { merge: false });
  });
  return { key, reservationRef };
}
async function releaseGlobalSlot(db, queueId) {
  const reservationRef = db.collection("emailGlobalReservations").doc(queueId);
  await db.runTransaction(async tx => {
    const reservationSnap = await tx.get(reservationRef);
    if (!reservationSnap.exists) return;
    const key = String(reservationSnap.data()?.dayKey || "");
    if (key) {
      const globalRef = db.collection("emailGlobalState").doc(key), globalSnap = await tx.get(globalRef);
      if (globalSnap.exists) tx.set(globalRef, { count: Math.max(0, Number(globalSnap.data()?.count || 0) - 1), updatedAt: nowTs() }, { merge: true });
    }
    tx.delete(reservationRef);
  });
}

async function sendQueueItem(db, actor, id, { retry = false } = {}) {
  id = cleanId(id, "Email queue"); const ref = db.collection("emailQueue").doc(id);
  let item;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) throw bad("Không tìm thấy email trong hàng đợi.", "osc/email-not-found");
    item = { id, ...snap.data() };
    const allowed = retry ? ["failed", "bounced", "suppressed", "draft"] : ["draft"];
    if (!allowed.includes(item.status)) throw bad("Email này không ở trạng thái có thể gửi.", "osc/email-status");
    tx.update(ref, { status: "sending", updatedAt: nowTs(), lastActionBy: actor.decoded.uid, attempts: Number(item.attempts || 0) + 1 });
  });
  const settings = await getSettings(db); let pf;
  try { pf = await preflightRecipient(db, item, settings); }
  catch (e) { await ref.update({ status: item.status || "draft", error: e.message, updatedAt: nowTs() }); throw e; }
  const scheduledMs = tsMillis(item.scheduledAt);
  try { await reserveGlobalSlot(db, id, settings, scheduledMs || Date.now()); }
  catch (e) { await ref.update({ status: item.status || "draft", error: e.message, updatedAt: nowTs() }); throw e; }
  try {
    const resend = resendClient(); const scheduledIso = scheduledMs ? new Date(scheduledMs).toISOString() : undefined;
    const options = { idempotencyKey: `${id}/attempt-${Number(item.attempts || 0) + 1}`, signal: AbortSignal.timeout(15000) };
    const payload = {
      from: fromAddress(), to: [pf.email], subject: cleanText(item.subject, 300), html: bodyToHtml(item.bodyText, item.variables || {}),
      tags: [{ name: "category", value: String(item.trigger || "custom").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) }, { name: "queue_id", value: id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) }]
    };
    if (scheduledIso) payload.scheduledAt = scheduledIso;
    const { data, error } = await resend.emails.send(payload, options);
    if (error) throw Object.assign(new Error(error.message || "Resend từ chối yêu cầu gửi email."), { code: "osc/resend-error", detail: error });
    const status = scheduledIso ? "scheduled" : "sent";
    const now = Date.now();
    const stateSnap = await pf.stateRef.get(); const old = stateSnap.exists ? stateSnap.data() : {}; const today = dateKey(now); const dayCount = old.dayKey === today ? Number(old.dayCount || 0) + 1 : 1;
    const batch = db.batch();
    batch.update(ref, { status, resendId: data?.id || "", error: "", sentAt: scheduledIso ? null : nowTs(), scheduledAt: scheduledIso ? admin.firestore.Timestamp.fromDate(new Date(scheduledIso)) : null, updatedAt: nowTs() });
    if (scheduledIso) batch.set(pf.stateRef, { emailHash: pf.emailHash, lastScheduledAt: nowTs(), lastScheduledFor: admin.firestore.Timestamp.fromDate(new Date(scheduledIso)), lastScheduledQueueId: id, updatedAt: nowTs() }, { merge: true });
    else batch.set(pf.stateRef, { emailHash: pf.emailHash, dayKey: today, dayCount, lastSentAt: nowTs(), lastQueueId: id, updatedAt: nowTs() }, { merge: true });
    batch.set(pf.dedupeRef, { sentAt: nowTs(), queueId: id, recipientHash: pf.emailHash, trigger: item.trigger || "", contextKey: item.contextKey || "" }, { merge: true });
    await batch.commit();
    return { id, resendId: data?.id || "", status };
  } catch (e) {
    await releaseGlobalSlot(db, id).catch(() => {});
    await ref.update({ status: "failed", error: cleanText(e.message || e, 1000), updatedAt: nowTs() }).catch(() => {});
    throw e;
  }
}
async function cancelQueueItem(db, actor, id) {
  id = cleanId(id, "Email queue"); const ref = db.collection("emailQueue").doc(id); const snap = await ref.get(); if (!snap.exists) throw bad("Không tìm thấy email.");
  const item = snap.data() || {};
  if (item.status !== "scheduled") throw bad("Chỉ có thể hủy email đang được lên lịch.", "osc/email-status");
  if (item.resendId) {
    const { error } = await resendClient().emails.cancel(item.resendId);
    if (error) throw Object.assign(new Error(error.message || "Không hủy được lịch gửi trên Resend."), { code: "osc/resend-error" });
  }
  const email = normalizeEmail(item.recipientEmail), emailHash = hash(email);
  const dedupeRef = db.collection("emailDedupe").doc(hash(`${email}|${item.trigger || ""}|${item.contextKey || ""}|${item.templateId || ""}`));
  const stateRef = db.collection("emailRecipientState").doc(emailHash);
  await db.runTransaction(async tx => {
    const [dedupeSnap, stateSnap] = await Promise.all([tx.get(dedupeRef), tx.get(stateRef)]);
    if (dedupeSnap.exists && dedupeSnap.data()?.queueId === id) tx.delete(dedupeRef);
    if (stateSnap.exists) {
      const st = stateSnap.data() || {};
      if (st.lastQueueId === id) tx.set(stateRef, { dayCount: Math.max(0, Number(st.dayCount || 0) - 1), lastSentAt: admin.firestore.FieldValue.delete(), lastQueueId: admin.firestore.FieldValue.delete(), updatedAt: nowTs() }, { merge: true });
      if (st.lastScheduledQueueId === id) tx.set(stateRef, { lastScheduledAt: admin.firestore.FieldValue.delete(), lastScheduledFor: admin.firestore.FieldValue.delete(), lastScheduledQueueId: admin.firestore.FieldValue.delete(), updatedAt: nowTs() }, { merge: true });
    }
  });
  await releaseGlobalSlot(db, id).catch(() => {});
  await ref.update({ status: "canceled", canceledAt: nowTs(), canceledBy: actor.decoded.uid, updatedAt: nowTs() });
}
async function blacklistAction(db, actor, body) {
  const email = normalizeEmail(body.email), id = hash(email), ref = db.collection("emailBlacklist").doc(id);
  if (body.active === false) await ref.set({ email, active: false, manual: true, updatedAt: nowTs(), updatedBy: actor.decoded.uid }, { merge: true });
  else await ref.set({ email, active: true, manual: true, reason: cleanText(body.reason || "Admin blacklist", 300), updatedAt: nowTs(), updatedBy: actor.decoded.uid, createdAt: nowTs() }, { merge: true });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return sendJson(res, 200, { ok: true, service: "our-stage-email-center", version: VERSION, configured: configured(), webhookConfigured: !!process.env.RESEND_WEBHOOK_SECRET, from: process.env.RESEND_FROM_EMAIL || "" });
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ GET/POST." });
    const actor = await requireManager(req), db = getDb(), body = readJsonBody(req), action = String(body.action || "list");
    if (action === "list") return sendJson(res, 200, { ok: true, ...(await listAll(db)) });
    if (action === "save_template") return sendJson(res, 200, { ok: true, id: await saveTemplate(db, actor, body.template || {}) });
    if (action === "delete_template") { const id = cleanId(body.id, "Mẫu email"); const s = await db.collection("emailTemplates").doc(id).get(); if (s.exists && s.data()?.system === true) throw bad("Không thể xóa mẫu hệ thống; hãy chỉnh sửa nội dung thay vì xóa."); await db.collection("emailTemplates").doc(id).delete(); return sendJson(res, 200, { ok: true }); }
    if (action === "save_rule") return sendJson(res, 200, { ok: true, id: await saveRule(db, actor, body.rule || {}) });
    if (action === "delete_rule") { await db.collection("emailRules").doc(cleanId(body.id, "Rule")).delete(); return sendJson(res, 200, { ok: true }); }
    if (action === "save_settings") { const v = clampSettings(body.settings || {}); await db.collection("emailSettings").doc("main").set({ ...v, updatedAt: nowTs(), updatedBy: actor.decoded.uid }, { merge: true }); return sendJson(res, 200, { ok: true, settings: v }); }
    if (action === "create_drafts") return sendJson(res, 200, { ok: true, ids: await createQueueItems(db, actor, body) });
    if (action === "send") return sendJson(res, 200, { ok: true, result: await sendQueueItem(db, actor, body.id) });
    if (action === "retry") return sendJson(res, 200, { ok: true, result: await sendQueueItem(db, actor, body.id, { retry: true }) });
    if (action === "cancel") { await cancelQueueItem(db, actor, body.id); return sendJson(res, 200, { ok: true }); }
    if (action === "blacklist") { await blacklistAction(db, actor, body); return sendJson(res, 200, { ok: true }); }
    throw bad("Thao tác Email Center không hợp lệ.");
  } catch (e) { handleError(res, e); }
};
