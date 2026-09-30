OUR STAGE CLUB MANAGER V71 — EVENT FIELD EDITOR FIX

FIXED
The Event Portal field editor has been rebuilt so existing form fields can be edited
reliably on desktop and mobile.

WHAT CHANGED
- Field editing no longer depends only on inline oninput/onchange handlers.
- The editor now binds real JavaScript event listeners after each render.
- Label, type, required, options, section description, rich content and image caption
  are all written back to eventBuilderFields reliably.
- Before Preview or Save, the system reads the visible editor controls one final time.
  This avoids losing the last mobile/IME edit while an input is still focused.
- Field type changes re-render safely.
- Fields can be moved Up / Down.
- Delete field remains available.
- Image upload/change/remove remains available.
- Existing event configuration is still loaded from Firestore before editing.

SAVE SAFETY
- Firestore is written first.
- Local state is updated only after Firestore confirms success.
- Save button shows “Đang lưu…”.
- Permission-denied now shows a specific Events/semester-lock message instead of looking
  like the fields simply cannot be edited.

MOBILE
- Event field cards collapse to one column on small screens.
- Inputs use 16px text on phones to avoid iOS auto-zoom.
- All editor inputs explicitly keep pointer events enabled.

FIRESTORE RULES
No new Rules change is required for V71.
Keep the V69 Rules already published.
Rules are intentionally not included in this package.
