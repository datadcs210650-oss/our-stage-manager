module.exports = (req, res) => {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || "";
  const config = {
    apiKey,
    authDomain: "clb-our.firebaseapp.com",
    projectId: "clb-our",
    storageBucket: "clb-our.firebasestorage.app",
    messagingSenderId: "390807081243",
    appId: "1:390807081243:web:7e8f45f2783c01bf0403be"
  };

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).send(
    "window.__FIREBASE_CONFIG__=" + JSON.stringify(config) + ";"
  );
};
