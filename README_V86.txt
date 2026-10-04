OUR STAGE CLUB MANAGER V86 — NO EMAIL + QR CHECK-IN FEEDBACK

Thay đổi chính
1. Loại bỏ toàn bộ Email Center/Resend đã thêm ở V85. V86 quay về luồng nghiệp vụ không gửi email.
2. Check-in thành công chỉ hiển thị xác nhận tối đa 2.8 giây, sau đó tự trở về trạng thái Đang quét/Sẵn sàng.
3. Khi cùng một QR/MSSV đã check-in trước đó, hệ thống hiển thị cảnh báo rõ và không tạo lượt check-in thứ hai.
4. Bổ sung transaction cho cả lượt check-in chờ Admin. Hai thiết bị quét cùng QR gần như đồng thời: Firestore chỉ cho một request tạo bản ghi; request còn lại nhận duplicate=true.
5. Lỗi tạo system notification sau check-in chờ duyệt không còn làm API báo thất bại khi bản ghi check-in đã lưu thành công.
6. Tăng khoảng chống đọc lặp cùng QR trên cùng thiết bị lên 3.2 giây để giao diện ổn định, tránh camera đọc cùng một mã liên tục.

Triển khai từ V85
- Dùng full package V86 là sạch nhất.
- Nếu dùng patch: ghi đè index.html, check-in-su-kien.html, api/event-checkin.js, lib/firebase-admin.js, vercel.json, package.json và publish firestore_rules_v86.rules.
- XÓA khỏi repository: api/email-center.js và api/resend-webhook.js.
- Có thể xóa các Environment Variables RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME, RESEND_WEBHOOK_SECRET trên Vercel vì V86 không dùng nữa.
- Không xóa các biến FIREBASE_*.
