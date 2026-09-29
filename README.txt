OUR STAGE CLUB MANAGER V69 — FAST QR + TRASH BULK + REOPEN QR

1. QR CREATION SPEED
Root cause of the visible ~5 second delay:
the previous create flow waited for / competed with several extra tasks after Firestore write:
- audit log write;
- reloading the attendance portal list;
- loading check-ins for many previous QR portals;
- reading the newly-created QR document again before rendering it.

V69:
- reacts immediately with a “Đang tạo QR…” state;
- performs only the required Firestore create before showing the real QR;
- renders the QR directly from the already-confirmed local data;
- does NOT re-read the same QR document;
- audit logging runs in the background;
- portal reconciliation runs later in the background;
- QR panel renders first, then only the newest 5 portal check-in counts are hydrated.

2. REOPEN QR
A closed or expired QR can be reopened while keeping:
- the SAME QR image;
- the SAME token/link;
- previous check-in history.

Admin chooses a new start/end time.
The public QR page already listens to the portal document and becomes usable again automatically.

Important:
One MSSV is still limited to one submission per QR token.
Reopening the same QR does not let the same MSSV submit a second time.

3. TRASH BIN BULK DELETE
Added:
- row checkboxes;
- Select all;
- selected count;
- Clear selection;
- “Xóa vĩnh viễn đã chọn”.

Bulk permanent deletion uses Firestore batches and asks for confirmation.

4. FIRESTORE RULES
V69 INCLUDES firestore_rules_v69.rules because reopening the same QR requires a server-side
Rule change. The rules also make the already-existing QR time editor valid server-side.

Publish:
Firebase Console -> Firestore Database -> Rules -> replace current Rules with
firestore_rules_v69.rules -> Publish.

5. SECURITY
- Reopen/edit QR still requires editAttendance permission.
- QR semester cannot be changed.
- Semester lock is enforced.
- Reopen requires valid timestamp range, server timestamp and authenticated UID.
- Public users gain no new read/write permissions.
- Trash bulk delete remains Admin/Super Admin only through existing rules.
- Existing V59/V68 security headers and dependency hardening are preserved.
