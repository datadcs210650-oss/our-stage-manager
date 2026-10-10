# OUR STAGE CLUB — V96 Stagecraft UI

V96 Stagecraft is a presentation/accessibility redesign layered on the existing OSC manager. It does not replace Firebase Auth, Firestore rules, V95 APIs, permission checks, QR logic, Ticket Studio, Seat Studio, event validation, or business data.

## Direction
- Burgundy/ink theatrical shell with warm paper surfaces and champagne-gold accents.
- Lower visual noise, clearer hierarchy and denser professional dashboard rhythm.
- Stage-light gradients are decorative CSS only; no remote image dependency.
- Existing navigation, forms, modals, tables and workflows remain intact.

## Usability
- Persistent collapsible sidebar and existing command palette retained.
- Page-context helper under the title.
- Skip-to-content, aria-current, visible focus and mobile 44px targets.
- 16px mobile inputs to avoid iOS focus zoom.
- Reduced-motion support.
- Stronger table/readability treatment with tabular numerals.

## Security boundary
V96 UI files make no network requests and contain no credentials. They do not alter Firebase initialization, session/security code, Firestore Security Rules, API authorization, Admin/BCN permissions, seat transactions, capacity guards, ticketing or check-in logic.

Research references used: Vercel Web Interface Guidelines and 2026 dashboard navigation redesign; Linear UI redesign and command menu; Stripe Dashboard workflow/context patterns and accessible color systems; WCAG 2.2 focus and target-size guidance.
