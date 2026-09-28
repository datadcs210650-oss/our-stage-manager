OUR STAGE CLUB MANAGER V66 — LOGIN ACCESS RECOVERY

FIXED
The login flow no longer treats every post-login JavaScript / migration / collection-load
failure as “Không thể kiểm tra quyền truy cập”.

ROOT CAUSE IN V65
validateAccess() wrapped ALL of these in one try/catch:
- read users/{uid}
- load clubState
- initialize collections
- load preferences
- load members/finance/events
- legacy member/division migration
- render UI
- suite/QR loaders

Therefore a migration or UI/data error after a successful authentication could throw and
the app would incorrectly report an access-check error and sign the user out.

V66
Authorization is now decided only by:
1. Firebase Authentication user exists.
2. users/{UID} document can be read.
3. active === true.
4. role is superadmin / admin / bcn.

After that, data/bootstrap operations are isolated:
- A failed member migration cannot sign the user out.
- A locked old semester cannot make the legacy migration block login.
- Members / Finance / Events load independently.
- A render error cannot sign an authorized user out.
- The UI can open and shows a warning asking Admin to press Sync if a noncritical dataset fails.
- Profile read has a short retry for transient Firestore/network failures.
- Password login now uses password-specific Firebase error messages instead of Google error text.

SECURITY
This does NOT bypass authentication or Firestore authorization.
A missing/disabled/invalid-role users/{UID} profile is still denied.
Permission-denied when reading the user's own profile is still denied.

FIRESTORE PROFILE REQUIRED
users/{Firebase Auth UID}:
- active: true
- role: "superadmin", "admin", or "bcn"
- permissions: map (for BCN)

If the account still cannot enter after V66, the new error text identifies whether:
- users/{UID} is missing,
- active is not true,
- role is invalid,
- Firestore Rules deny the self-profile read.

RULES
V66 does not change Firestore Rules.
If you published hardened V60 Rules, keep them.
