V81 DEPLOY — EVENT DELETE FIX

If your current deployed version is V80:
1. Upload/overwrite index.html
2. Upload/overwrite api/event-checkin.js
3. Upload/overwrite package.json
4. Publish firestore_rules_v81.rules in Firebase Console > Firestore Database > Rules
5. Let Vercel redeploy
6. Hard refresh the admin site
7. Test deleting an event that contains at least one QR check-in and one form submission

Expected:
- Event disappears from Cổng sự kiện.
- Event, submissions and QR check-ins appear in Thùng rác.
- Delegated external scanner links stop working.
- Restore from Trash works for the supported individual records.

Do not upload Firebase service-account JSON/private key to GitHub.
