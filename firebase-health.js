module.exports = (req, res) => {
  const key = process.env.FIREBASE_WEB_API_KEY || "";
  const keyFormatValid = /^AIza[0-9A-Za-z_-]{20,}$/.test(key);

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(keyFormatValid ? 200 : 503).json({
    ok: keyFormatValid,
    projectId: "clb-our",
    environmentVariable: "FIREBASE_WEB_API_KEY",
    configured: Boolean(key),
    keyFormatValid
  });
};
