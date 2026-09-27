# OUR STAGE CLUB MANAGER V59 — Security Audit

## Scope reviewed
- index.html
- su-kien.html
- diem-danh.html
- tra-cuu.html
- tra-cuu-tu-do.html
- firebase-public-config.js
- vercel.json
- .github security files

## Fixed in V59

### HIGH — SheetJS xlsx 0.18.5
V58 parsed uploaded Excel files using xlsx 0.18.5.
That line has known prototype-pollution and ReDoS issues when reading crafted spreadsheets.

V59:
- moves to SheetJS CE 0.20.3 from the authoritative SheetJS CDN;
- rejects spreadsheet files above 8 MB;
- caps sheet dimensions at 10,000 rows / 100 columns;
- disables formula, HTML, style and VBA parsing features not needed by this workflow.

### MEDIUM — old Firebase JavaScript SDK
V58 used Firebase JS 10.14.1.
V59 updates all Firebase compat scripts to 12.19.0.

### MEDIUM — finance proof exposed in the public semester lookup
V58 copied `proof` from private finance transactions into public lookup metadata.
If that field contains transfer evidence or a private reference, it can become public.

V59:
- never publishes `proof`;
- removes the public “Minh chứng” column;
- migrates old public metadata and removes existing proof fields;
- makes public finance display opt-in by default for new/undefined portal configs.

### MEDIUM — free lookup key forced public
V58 forced the field used as a lookup key to also be displayed publicly.
V59 lets the lookup key remain private.

### LOW/MEDIUM — resource-exhaustion inputs
V59 adds spreadsheet and event-image size/type limits before expensive processing.

### LOW — reverse tabnabbing
Identified dynamic `_blank` windows now use `noopener,noreferrer`.

### LOW — second-CDN fallback
V59 removes the QR library fallback to a second CDN.

## Good controls already present
- Admin/BCN authentication uses Firebase Auth.
- Auth persistence is SESSION.
- Operational member / finance / event arrays are stripped from localStorage.
- Public form values are generally HTML-escaped before rendering.
- Rich-text formatting escapes HTML before adding strong/em/br markup.
- Event answers are not persisted in localStorage/sessionStorage.
- Submitted public-event inputs are cleared from the DOM after a successful write.
- No `eval()` or `new Function()` was found.
- HSTS, CSP, frame blocking, no-referrer, Permissions-Policy and no-store headers are configured.
- GitHub CodeQL / Dependabot / SECURITY.md exist.

## IMPORTANT: Firestore Rules were not supplied in V58
This is the largest remaining security uncertainty.

Front-end checks such as `canEditModule()`, hidden menu items, disabled buttons and locked columns
are NOT sufficient security against direct Firestore REST/SDK requests.

The exact DEPLOYED Firestore Rules must be separately reviewed to verify:
- private `/members`, finance, users, audit logs, trash, approvals and event results are never public;
- BCN rights are enforced server-side, not only in the UI;
- BCN cannot update their own `role`, `active` or permission fields;
- public member lookup permits only the intended public access pattern and cannot list private data;
- public event/attendance creates validate allowed fields, string sizes, status, time window and immutable fields;
- every unspecified collection is denied by default.

## IMPORTANT: Firebase App Check is still recommended
Public event and attendance portals intentionally allow unauthenticated writes.
Security Rules validate authorization/data, but App Check adds an abuse layer against automated clients.

Recommended production rollout:
1. Firebase Console > App Check.
2. Register the Web app; for new web integrations, prefer reCAPTCHA Enterprise.
3. Add App Check to the client.
4. Monitor App Check metrics.
5. Enable enforcement for Firestore and Authentication only after legitimate traffic is verified.

## CSP limitation
The app still uses many inline scripts and inline `onclick` handlers.
Therefore CSP currently requires `script-src 'unsafe-inline'`, which weakens CSP as an XSS fallback.

I did not find a direct exploitable public XSS path in this package because dynamic public values
are escaped in the main render paths. Removing `unsafe-inline` completely requires a larger
JavaScript refactor to external files + `addEventListener()`.

## Firebase Web API key
The Firebase Web API key in `firebase-public-config.js` is a public client identifier, not a
service-account secret. Still restrict it in Google Cloud to the Firebase APIs the site needs and
the expected HTTP referrers.

Never commit real:
- service-account private keys / JSON credentials
- OAuth client secrets
- Stripe `sk_live_...` secrets
- GitHub access tokens
- database passwords
