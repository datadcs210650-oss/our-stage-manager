OUR STAGE CLUB MANAGER V23 — ACCOUNT FIX

- Sửa xóa tài khoản BCN: API có timeout và Firestore fallback nếu Failed to fetch.
- Thêm menu Tài khoản của tôi cho mọi role.
- Hiển thị tên, email, vai trò, trạng thái, mật khẩu dạng che.
- Đổi mật khẩu trực tiếp bằng mật khẩu hiện tại, không gửi email.
- Bỏ reset password qua email.
- account-create/update/delete có fallback có giới hạn khi Vercel API tạm lỗi.
- Firestore Rules V23 giới hạn fallback theo role.

Cập nhật: commit toàn bộ package, Publish firestore_rules_v23.rules, rồi Command+Shift+R.
