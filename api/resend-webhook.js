"use strict";

const { Resend } = require("resend");
const { admin, getDb, sendJson } = require("../lib/firebase-admin");
const crypto = require("crypto");

const VERSION = 85;
function hash(v) { return crypto.createHash("sha256").update(String(v)).digest("hex"); }
function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }
async function rawBody(req) {
  // IMPORTANT: do not access req.body before signature verification.
  // Vercel exposes req.body through a parsing helper/getter; Resend requires
  // the exact raw bytes that arrived on the wire. Reading the Node request
  // stream first preserves those bytes for Svix/Standard Webhooks verification.
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
async function findQueue(db, emailId) {
  if (!emailId) return [];
  const s = await db.collection("emailQueue").where("resendId", "==", emailId).limit(5).get();
  return s.docs;
}
module.exports = async function handler(req, res) {
  if (req.method === "GET") return sendJson(res, 200, { ok: true, service: "our-stage-resend-webhook", version: VERSION, configured: !!process.env.RESEND_WEBHOOK_SECRET });
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ POST." });
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return sendJson(res, 503, { ok: false, error: "Thiếu RESEND_WEBHOOK_SECRET." });
    const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verify_only");
    const payload = await rawBody(req);
    const event = resend.webhooks.verify({
      payload,
      headers: { id: req.headers["svix-id"], timestamp: req.headers["svix-timestamp"], signature: req.headers["svix-signature"] },
      webhookSecret: secret
    });
    const db = getDb();
    const eventId = String(req.headers["svix-id"] || event?.id || crypto.randomUUID());
    const eventRef = db.collection("emailWebhookEvents").doc(eventId);
    if ((await eventRef.get()).exists) return sendJson(res, 200, { ok: true, duplicate: true });
    const type = String(event?.type || ""), data = event?.data || {}, emailId = String(data.email_id || ""), recipient = normalizeEmail(Array.isArray(data.to) ? data.to[0] : data.to);
    if (!type) return sendJson(res, 200, { ok: true, ignored: true });
    const statusMap = {
      "email.scheduled": "scheduled", "email.sent": "sent", "email.delivered": "delivered",
      "email.delivery_delayed": "delayed", "email.bounced": "bounced", "email.complained": "complained",
      "email.failed": "failed", "email.suppressed": "suppressed"
    };
    const status = statusMap[type] || "";
    const incomingMs = Date.parse(String(event?.created_at || "")) || 0;
    const queueDocs = await findQueue(db, emailId);
    const batch = db.batch();
    batch.create(eventRef, {
      type,
      emailId,
      recipientHash: recipient ? hash(recipient) : "",
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      providerCreatedAt: String(event?.created_at || "").slice(0, 80),
      data: { subject: String(data.subject || "").slice(0, 300) }
    }, { merge: false });
    for (const doc of queueDocs) {
      const current = doc.data() || {}, currentMs = current.lastProviderEventAt?.toMillis?.() || 0;
      const newer = !currentMs || !incomingMs || incomingMs >= currentMs;
      const patch = { webhookType: type, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (newer && status && current.status !== "canceled") patch.status = status;
      if (newer && incomingMs) patch.lastProviderEventAt = admin.firestore.Timestamp.fromMillis(incomingMs);
      if (newer && status === "delivered") patch.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
      if (newer && ["bounced", "complained", "failed", "suppressed"].includes(status)) patch.error = String(data?.bounce?.message || data?.error?.message || type).slice(0, 1000);
      batch.update(doc.ref, patch);
    }
    if (recipient && ["email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(type)) {
      const id = hash(recipient), ref = db.collection("emailBlacklist").doc(id), snap = await ref.get(); const old = snap.exists ? snap.data() : {};
      const thresholdSnap = await db.collection("emailSettings").doc("main").get(); const threshold = Number(thresholdSnap.data()?.bounceBlacklistThreshold || 2);
      const bounceCount = Number(old.bounceCount || 0) + (type === "email.bounced" ? 1 : 0);
      const failureCount = Number(old.failureCount || 0) + (type === "email.failed" ? 1 : 0);
      const complained = type === "email.complained" || old.complained === true;
      const suppressed = type === "email.suppressed" || old.suppressed === true;
      const active = complained || suppressed || bounceCount >= threshold || failureCount >= threshold;
      batch.set(ref, {
        email: recipient, active, bounceCount, failureCount, complained, suppressed, reason: type,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: old.createdAt || admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    try {
      await batch.commit();
    } catch (commitError) {
      // Concurrent delivery of the same Svix event: batch.create keeps all
      // side effects atomic, so the losing request can safely acknowledge it.
      if (commitError?.code === 6 || String(commitError?.code || "").toLowerCase() === "already-exists") {
        return sendJson(res, 200, { ok: true, duplicate: true });
      }
      throw commitError;
    }
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("Resend webhook error", e?.message || e);
    return sendJson(res, 400, { ok: false, error: "Webhook không hợp lệ." });
  }
};
