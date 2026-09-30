OUR STAGE CLUB MANAGER V72 — EVENT EDIT / SYNC RECOVERY

FIXED
The Event Portal Edit button could surface the global toast:
“Có lỗi đồng bộ dữ liệu. Vui lòng thử lại.”
and the editor could appear unusable even when the event itself still existed.

V72 CHANGES
- All event Edit/Create entry points use safeOpenEventBuilder().
- The full async open flow is caught locally so it cannot become an unhandled Promise rejection.
- Editing uses cached event data if a one-time Firestore read temporarily fails.
- Legacy/malformed field records are normalized one-by-one before rendering.
- One malformed legacy field can no longer crash the whole event editor.
- Existing V71 field listeners remain: label/type/required/options/section/content/image edits.
- Preview/Save still synchronizes the visible controls one final time.

SAVE BEHAVIOR
- Event form configuration is written to eventPortals/{eventId} first.
- Once that write succeeds, the editor reports success immediately.
- Optional follow-up automation (event score activity / continuation activity) runs in background.
- A failure in that optional automation no longer makes a successfully saved form look unsaved.
- Generic save() is not called from event save, avoiding unrelated clubState/lookup sync work from
  being mistaken for an event-field error.
- Realtime Events from V68 remains intact and reconciles the event list.

OTHER FEATURES
V70 Google login, V69 QR/reopen/trash, V68 Eco Realtime, V65 attendance Excel,
V64 divisions and the existing security hardening are preserved.

FIRESTORE RULES
No Rules change is required for V72.
Keep V69 Rules already published.
Rules are intentionally not included in this ZIP.
