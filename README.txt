OUR STAGE CLUB MANAGER V61 — PUBLIC BRAND ALIGNMENT FIX

V61 is based on the V59 security-hardened package.

FIXED
- Logo and OUR STAGE text on public pages no longer get pushed far apart.
- The cause was a global `margin-left:auto; margin-right:auto` applied to logo images
  inside flex brand rows.
- Topbar brand remains compact and left-aligned.
- Main page brand is centered as one cohesive logo + text group.
- Free Lookup header specifically keeps logo and “OUR STAGE / Cổng tra cứu thông tin”
  together in the center area.
- Logo artwork still uses `logo-ui-centered.png`, so it remains visually centered
  inside the white logo tile.
- Mobile layout is preserved.

SECURITY
- Keeps all V59 security hardening.
- No Firestore Rules changes.
- No Rules file included.
