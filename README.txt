OUR STAGE CLUB MANAGER V68 — PDF SYNC FIX + ECO REALTIME

PDF HỌC KỲ
Fixed a real bug in the semester-end PDF:
- the report referenced `cfg` without declaring it;
- the report also depended on sequential event-response reads.

V68:
- defines the semester config correctly;
- refreshes only the CURRENT semester before creating the PDF;
- Members / Finance / Events refresh independently;
- event response counts use Promise.allSettled, so one event permission/network error
  no longer blocks the entire PDF;
- an empty ranking or transaction table no longer produces an invalid PDF table;
- PDF export is wrapped in its own error handler;
- Finance PDF also performs a scoped current-semester refresh.

REALTIME IS BACK — ECO MODE
Realtime Admin/BCN synchronization is re-enabled, but designed to limit Firestore load:

1. Current semester only
Listeners use:
- members where semester == current semester
- financeTransactions where semester == current semester
- eventPortals where semester == current semester

2. Permission-aware
A BCN only opens listeners for modules they are allowed to view.

3. Config is only one document
clubState/main is one realtime document listener.

4. UI updates are debounced
Many Firestore changes arriving together are rendered once after about 420 ms.

5. Hidden tabs pause after 90 seconds
Short tab switches keep listeners to avoid paying another initial snapshot.
If the tab stays hidden for 90 seconds, operational/config listeners stop.
They reconnect when the user returns.
The own-profile listener stays active so a disabled account can still be revoked.

6. QR submissions remain on-demand
QR check-in response listeners are NOT kept permanently between all accounts.
The QR panel still has a Refresh action.

7. Public member lookup is throttled
Realtime bursts are collapsed:
- normal changes wait ~2.5 seconds;
- at least 8 seconds between automatic full public-lookup syncs;
- Firestore writes are committed in batches rather than one network request per member.

MANUAL SYNC
The ↻ Sync button remains as a fallback.
Manual refresh now reads only the current semester instead of re-reading all semesters.

SECURITY
- Existing V59/V67 hardening remains.
- Realtime queries are permission-aware.
- No new public collection access is added.
- No eval/new Function.
- Firestore Rules are unchanged.
If hardened V60 Rules are already published, keep them.
