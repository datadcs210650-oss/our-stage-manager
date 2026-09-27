OUR STAGE CLUB MANAGER V59 — SECURITY AUDIT & HARDENING

V59 keeps all V58 features and applies a defensive security pass.

Main changes:
- Firebase JS 12.19.0.
- SheetJS CE 0.20.3 instead of xlsx 0.18.5.
- Spreadsheet import limits: 8 MB, 10,000 rows, 100 columns.
- Event image file/type limits.
- Public member lookup never publishes finance proof/evidence.
- Existing public proof fields are scrubbed by an Admin migration.
- Public finance display becomes opt-in by default.
- Custom lookup key may remain private.
- New-tab links use noopener,noreferrer.
- Removed unnecessary QR second-CDN fallback.
- X-DNS-Prefetch-Control: off.

READ:
SECURITY_AUDIT_V59.md

IMPORTANT:
V59 deliberately does NOT include a Firestore Rules file because the exact deployed current Rules
were not present in V58. A client-code audit cannot guarantee database security without auditing
the deployed Rules.

Recommended next security step:
Audit the exact deployed Firestore Rules, then configure Firebase App Check and enable enforcement
after monitoring legitimate traffic.
