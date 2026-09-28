OUR STAGE CLUB MANAGER V67 — SELECTED DIVISION FIX

BUG FIXED
When saving a member, the app called renderAll(), which also calls renderDivisions().
renderDivisions() referenced `selectedDivisionId`, but V64-V66 never declared that variable.

This caused:
ReferenceError: selectedDivisionId is not defined

and the save flow showed:
“Không lưu được thành viên: selectedDivisionId is not defined”

IMPORTANT
The Firestore member write may already have succeeded before this UI ReferenceError occurred.
V67 fixes the UI/runtime error so saving a member completes normally.

V67 CHANGES
- Declares global `selectedDivisionId = ""` with the other UI state variables.
- Adds a defensive type/reset guard in renderDivisions().
- Adds a defensive reset when the authorized app shell is opened.
- Keeps V66 login recovery, V65 attendance Excel scanning, V64 division recovery,
  V63 university configuration, and existing security hardening.

FIRESTORE RULES
No Firestore Rules change is required.
If hardened V60 Rules are already published, keep them.
