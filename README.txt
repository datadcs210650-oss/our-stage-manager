OUR STAGE CLUB MANAGER V72 — EVENT DATETIME RUNTIME FIX

BUG FIXED
The Event Portal editor could crash immediately with:

dateTimeLocalValue is not defined

This prevented Admin from opening and editing event fields even though the field editor
itself had already been fixed in V71.

ROOT CAUSE
V71 referenced dateTimeLocalValue() in:
- Event open time
- Event close time
- QR time editor

but that helper function was missing. There was a differently named helper
localDateTimeInputValue() later in the file, so the runtime stopped before the event
field editor could be used.

V72 CHANGES
- Adds one safe dateTimeLocalValue() utility.
- Handles Firestore Timestamp, JavaScript Date and string values.
- Invalid or empty dates safely return an empty datetime-local value.
- localDateTimeInputValue() now delegates to the same helper.
- Event date values are escaped before rendering.
- Event field editor normalizes older/malformed field arrays before rendering.
- Keeps all V71 field editing behavior:
  label, type, required, options, sections, rich content, images, move up/down, delete.

SECURITY
No permissions are loosened.
No Firestore Rules change is required.
Keep Firestore Rules V69 currently published.

GOOGLE LOGIN
Unrelated to this fix. V70/V71 behavior remains: a Google account still needs a valid
users/{UID} profile with active=true and role superadmin/admin/bcn before it can enter
the admin system.
