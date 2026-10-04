V79 QUICK DEPLOY
1. Upload/replace index.html at the GitHub repository root.
2. Keep the existing V78 api/, lib/, vercel.json and firestore_rules_v78.rules.
3. Wait for Vercel deployment to finish.
4. Hard refresh: Command + Shift + R (Mac) / Ctrl + Shift + R (Windows).
5. Open Cổng sự kiện -> Quét / duyệt QR.
6. The modal should open immediately, then the result list will load from /api/event-checkin.

If the modal opens but the result list shows an API error, check /api/event-checkin separately; that is a backend deployment issue, not this UI runtime bug.
