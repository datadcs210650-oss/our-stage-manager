# OSC V105: Account API consolidation (Vercel Hobby)

This release reduces root-level API entrypoints from **12 to 9** without changing client paths or account authorization.

| Existing client endpoint | Vercel rewrite | Server implementation |
| --- | --- | --- |
| `POST /api/account-create` | `/api/accounts?operation=create` | `lib/account-create.js` |
| `POST /api/account-update` | `/api/accounts?operation=update` | `lib/account-update.js` |
| `POST /api/account-password` | `/api/accounts?operation=password` | `lib/account-password.js` |
| `POST /api/account-delete` | `/api/accounts?operation=delete` | `lib/account-delete.js` |

All four handler implementations are **moved without functional changes** from `api/` into `lib/`.
The dispatcher (`api/accounts.js`) only selects an allowlisted operation; each handler independently enforces POST, Firebase authentication, manager permissions, target role checks, recent-login requirements, and rollback behavior as before.

Keep future reusable logic in `lib/`, not a new `api/` entrypoint, when an existing authenticated API can route it safely. Do not combine unrelated operations solely to reduce the count, and always retain the caller's permission guards.

## Verification
- `node --test tests/*.test.js` (includes route mapping, preserved handlers, role-security assertions, API budget).
- GitHub Actions does syntax, regression and high/critical dependency audit.
- After Vercel preview deploy, test old URLs by an unauthenticated GET to each: expected **405** (POST required), *not* 404. Do not call mutation endpoints with real data during smoke testing.
- After Production deploy, manually test creating/updating/locking a temporary BCN account and ensure deleted identities are never unintentionally recreated.
- Rollback: reset to the preceding `main` commit. Firestore/Auth schemas and actual records are unchanged by this migration.

Note: reducing the number of functions does not reduce Firebase usage or eliminate runtime limits, and successful CI alone does not prove an end-to-end authentication workflow.
