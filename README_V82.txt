OUR STAGE CLUB MANAGER V82 — INDEPENDENT CHECK-IN LINKS

CHANGE
- Closing an event registration portal no longer disables delegated check-in links.
- Event registration (event.isOpen) and scanner-link availability are independent.
- Admin can temporarily close and reopen the same scanner link without changing its token.
- Creating a scanner link is allowed even when event registration is closed, provided QR check-in is enabled and the semester is unlocked.
- Only one delegated scanner link is active per event at a time when reactivated.

DEPLOY FROM V81
Replace:
- index.html
- check-in-su-kien.html
- api/event-checkin.js
- package.json

No Firestore Rules change is required from V81.
No Vercel Environment Variables need to be entered again.

TEST
1. Close event registration. Public event form must reject new registrations.
2. Keep scanner link open. The delegated scanner page must still scan/check in.
3. Temporarily close scanner link. Existing scanner URL must immediately stop working on its next server poll/request.
4. Reopen the same scanner link. Same URL/token works again.
5. Open/close event registration repeatedly; scanner-link state must not change.
