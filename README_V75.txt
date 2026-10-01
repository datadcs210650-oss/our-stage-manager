OUR STAGE CLUB MANAGER V75 — EVENT QR CHECK-IN

NEW
- Each event can independently enable/disable student QR check-in.
- Staff opens Cổng sự kiện -> Quét QR check-in.
- Camera scans the school's QR and extracts MSSV.
- Camera frames, photos, videos and the raw QR payload are NEVER persisted by the application.
- Only a matched member MSSV + event-specific check-in metadata is stored.
- One member = one check-in per event (document keyed by member UID).
- If the event is linked to an activity, a successful check-in also marks that activity/score unless the activity column is locked.
- Duplicate scans do not add another check-in or score.
- Check-ins can be undone and exported to Excel.
- Manual MSSV input is kept only as a camera-failure fallback.
- Camera stops when modal closes, user logs out, or the tab becomes hidden.

IMPORTANT DEPLOYMENT
1. Upload the V75 website files.
2. Publish firestore_rules_v75.rules in Firebase Console > Firestore Database > Rules.
3. Vercel must redeploy vercel.json because Permissions-Policy changes from camera=() to camera=(self).
4. Hard refresh after deploy.

TEST
1. Chỉnh sửa một cổng sự kiện -> QR check-in sinh viên -> Bật -> Lưu.
2. Event card should show QR check-in: Bật and button Quét QR check-in.
3. Open scanner -> Bật camera -> allow Camera permission.
4. Scan school QR CS210650 or another real member QR.
5. Member appears once in event check-in list.
6. Scan same QR again: duplicate warning, no second record.
7. Close modal: browser camera indicator must turn off.
8. If event is linked to an activity, check the activity attendance/score updated.
9. Test Hoàn tác.
10. Export Excel and verify there is no raw QR/image field.

SECURITY / PRIVACY
- Exact html5-qrcode version is pinned to 2.3.8.
- Firestore Rules require editAttendance for create/delete.
- Check-in documents are immutable after create.
- Rules bind eventId, semester, memberId and MSSV to existing Firestore member data.
- No public page has a check-in write path.
- Camera is allowed only for same-origin pages via Permissions-Policy camera=(self).
