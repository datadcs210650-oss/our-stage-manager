"use strict";

const { getAdminApp, sendJson } = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "Chỉ hỗ trợ phương thức GET." });
    return;
  }
  try {
    const app = getAdminApp();
    sendJson(res, 200, {
      ok: true,
      service: "our-stage-account-api",
      projectId: app.options.projectId || null
    });
  } catch (error) {
    console.error("health", error && error.code, error && error.message);
    sendJson(res, 500, {
      ok: false,
      error: error && error.message ? error.message : "Firebase Admin chưa được cấu hình.",
      code: error && error.code ? error.code : "osc/server-error"
    });
  }
};
