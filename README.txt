OUR STAGE CLUB MANAGER V65 — ATTENDANCE EXCEL SCAN FIX

FIXED
Upload DS tham gia Excel now actually marks attendance and immediately updates
the visible attendance table.

ROOT CAUSE
Since V62 removed persistent member realtime listeners, the old Excel import wrote
scores to Firestore but did not update the local member state. The write could succeed
while the current attendance table still looked unchecked until a manual refresh.

V65 FIX
1. After a successful Firestore batch write, local member scores are updated immediately.
2. The attendance table, member views, division stats and visible lookup settings refresh.
3. Public member lookup synchronization remains enabled for Admin.
4. The Admin approval path for bulk attendance also refreshes local state after approval.

ROBUST EXCEL SCANNING
For every Excel row, V65 scans the full current-semester member list:
1. exact MSSV in recognized MSSV column;
2. exact MSSV in any Excel cell;
3. MSSV embedded with other text in a cell;
4. exact full name;
5. full name in any Excel cell.

MSSV is always preferred over name.

If the same member appears more than once in Excel:
- the preview flags duplicate rows;
- the member is only marked once.

If a name is ambiguous:
- the system does not guess;
- Admin can manually choose the member in the preview.

Large Excel files:
- entire file is still processed;
- preview is limited to 600 rows to avoid browser slowdown.

BEHAVIOR
- Checkbox activity: matched member becomes checked.
- Number activity: matched member receives the configured maximum score.
- Members absent from the Excel file keep their existing attendance/score.
- Locked activity columns remain protected.
- Semester mismatch after file selection is blocked.

SECURITY
- Existing V59/V64 hardening is preserved.
- Spreadsheet security limits remain: size, rows, columns.
- No new persistent Admin/BCN realtime listener is introduced.
- Firestore Rules are unchanged; no Rules file is included.
