# OUR STAGE CLUB — V97 Unified UI

V97 is a presentation-only redesign of the internal OSC admin workspace.

## Scope
- Standardizes spacing, cards, toolbars, notes, tables, forms, responsive behavior, and modal layout across every admin menu.
- Refines Attendance, Members, Member Profiles, Divisions, Finance, Lookup portals, Events, Operations, Ticket Studio, Member QR, Account, Approval/Audit/Trash, Accounts, and Settings.
- Rebuilds Event Builder layout into a responsive 12-column configuration grid while preserving every existing input ID and save handler.
- Uses the existing sans-serif system stack only.

## Safety boundary
V97 does not modify Firebase initialization, authentication, Firestore rules, permissions, APIs, event submission logic, QR/check-in, Ticket Studio logic, Seat Studio transactions, capacity guards, or data schemas.

The V97 stylesheet contains no network requests, credentials, or JavaScript.

## Rollback
Remove the single `osc-v97-unified.css` link from `index.html` to return to the V96.1 interface without affecting data or backend logic.
