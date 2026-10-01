OUR STAGE CLUB MANAGER V77 — PORTAL RUNTIME FIX
================================================

MỤC TIÊU
- Sửa 2 lỗi:
  1) Trang /ma-thanh-vien báo cổng chưa mở/không tải được dù Admin đã mở.
  2) Trang /check-in-su-kien báo link không hợp lệ/vô hiệu hóa dù vừa tạo.

NGUYÊN NHÂN KỸ THUẬT ĐƯỢC SỬA
- Hai trang public phụ thuộc /api/member-qr và /api/event-checkin.
- V76 tạo/cập nhật cấu hình cổng và link bí mật trực tiếp từ trình duyệt Admin qua Firestore.
- Nếu API mới chưa deploy hoặc Firestore Rules chưa đồng bộ, trạng thái có thể lệch: Admin tưởng đã tạo/mở nhưng trang public không đọc được.
- Giao diện public V76 cũng ẩn lỗi API thật và luôn hiện thông báo chung, gây khó chẩn đoán.

V77 THAY ĐỔI
1. Mã QR thành viên
- Admin mở/đóng cổng qua /api/member-qr (Firebase Admin SDK), không ghi trực tiếp Firestore từ browser.
- Admin tải danh sách QR và bật/tắt QR qua cùng API.
- Trang public báo đúng trường hợp: API chưa deploy, cổng chưa mở, học kỳ khóa, MSSV không tồn tại, QR bị vô hiệu hóa.

2. Link check-in ngoài BCN
- Token link được tạo trên máy chủ bằng crypto.randomBytes(), không tạo ở browser.
- Tạo/list/vô hiệu hóa link đều đi qua /api/event-checkin.
- Link chỉ được trả cho Admin/Super Admin đã xác thực.
- Trang public báo đúng lỗi API, link vô hiệu, hoặc học kỳ khóa.

3. Bảo mật
- memberQrPortals, memberQrCards, eventScannerLinks chuyển thành server-only trong Rules V77.
- Browser không đọc trực tiếp token bí mật hoặc cấu hình QR nữa.
- Firebase Admin API vẫn kiểm tra quyền Admin/Super Admin cho thao tác quản trị.
- Trang check-in public vẫn không đọc email/SĐT/danh sách thành viên.

4. Chẩn đoán
Sau deploy có thể mở trực tiếp:
- /api/member-qr
- /api/event-checkin
Nếu đúng V77, mỗi URL sẽ trả JSON có "ok": true và "version": 77.

CÁCH DEPLOY PATCH
1. Upload/ghi đè các file trong V77 patch vào ROOT repo GitHub.
2. Đặc biệt phải có:
   /api/member-qr.js
   /api/event-checkin.js
   /lib/firebase-admin.js
   /ma-thanh-vien.html
   /check-in-su-kien.html
   /index.html
3. Vercel sẽ tự deploy.
4. Sau deploy kiểm tra hai URL API ở trên.
5. Firebase Console > Firestore Database > Rules:
   dán firestore_rules_v77.rules và Publish.
6. Hard refresh: Command+Shift+R / Ctrl+Shift+R.
7. Admin mở lại cổng QR thành viên và tạo lại link check-in ngoài BCN để chắc chắn dùng dữ liệu V77.

ENVIRONMENT VARIABLES
Giữ nguyên:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
Không cần nhập lại nếu V73 API đã chạy.
