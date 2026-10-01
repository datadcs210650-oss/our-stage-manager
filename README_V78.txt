OUR STAGE CLUB MANAGER V78 — CHECK-IN STABILITY & QR DOWNLOAD

MỤC TIÊU
- Thêm nút tải QR thành viên về PNG.
- Ảnh tải về chỉ có QR + MSSV, không có dòng ghi chú thời hạn/vô hiệu hóa.
- Bỏ ví dụ MSSV cố định khỏi giao diện.
- Sửa camera quét QR Admin và link ngoài BCN tương thích nhiều thiết bị hơn.
- Bảo đảm lượt quét từ link ngoài BCN xuất hiện trong Admin để duyệt.
- Tăng ổn định và giảm lộ token link check-in.

CÁC SỬA CHÍNH
1. ma-thanh-vien.html
   - Nút "Tải mã QR".
   - PNG 1080x980, QR rõ nét + MSSV, không chứa ghi chú.
   - Bỏ ví dụ MSSV cố định.

2. QR check-in Admin
   - Tự chọn camera sau nếu có; nếu không dùng camera đầu tiên.
   - Thông báo lỗi Camera rõ hơn (bị từ chối / không có camera / camera đang bận).
   - Danh sách check-in lấy qua API Firebase Admin, không phụ thuộc listener Firestore client.
   - Poll khoảng 2.2 giây khi modal mở.
   - Duyệt/Từ chối/Hoàn tác làm mới danh sách ngay.
   - Nếu Admin quét lại một lượt đang "Chờ Admin", xác nhận sẽ duyệt đúng lượt đó thay vì kẹt trạng thái duplicate.

3. Kết quả check-in trong giao diện sự kiện
   - Thẻ sự kiện hiển thị tổng lượt và số "chờ duyệt".
   - Khi trang Cổng sự kiện đang mở, số liệu tự làm mới mỗi 5 giây.
   - Link ngoài BCN quét thành viên chưa đăng ký -> Pending -> Admin thấy và duyệt.

4. Link check-in ngoài BCN
   - Link mới dùng #token=... thay vì ?token=...
   - Token không nằm trong URL request gửi tới web server/access log.
   - Link cũ dạng ?token=... vẫn dùng được và trang tự chuyển sang fragment.

5. Bảo mật
   - API danh sách check-in yêu cầu Firebase ID Token và quyền xem Điểm danh.
   - API chỉ trả các trường cần cho check-in; không trả email/SĐT/thông tin liên hệ.
   - Firestore Rules V78 giới hạn đọc qrCheckins cho viewAttendance hoặc editEvents (không còn viewEvents-only).
   - memberQrPortals/memberQrCards/eventScannerLinks vẫn server-only.
   - Không lưu ảnh/video/frame camera hoặc QR payload gốc.
   - Không có service-account private key trong package.

CẬP NHẬT TỪ V77
Upload/ghi đè ở root GitHub:
- index.html
- ma-thanh-vien.html
- check-in-su-kien.html
- api/event-checkin.js
- api/member-qr.js
- package.json
- firestore_rules_v78.rules (file để publish trong Firebase, không bắt buộc deploy web)

Giữ nguyên:
- lib/firebase-admin.js
- các API account V73/V77
- các file portal khác nếu đang đúng V77
- Environment Variables Vercel hiện tại

FIRESTORE RULES
Firebase Console -> Firestore Database -> Rules -> dán firestore_rules_v78.rules -> Publish.

TEST SAU DEPLOY
1. /api/event-checkin -> version 78.
2. /api/member-qr -> version 78.
3. Mã QR thành viên -> nhập MSSV hợp lệ -> tạo QR -> Tải mã QR -> PNG chỉ có QR + MSSV.
4. Admin -> Cổng sự kiện -> Quét / duyệt QR -> Bật camera -> quét QR.
5. Thành viên đã đăng ký -> check-in ngay.
6. Thành viên chưa đăng ký -> Admin quét: hỏi xác nhận; link ngoài BCN quét: Chờ Admin.
7. Giữ trang Cổng sự kiện mở -> số Chờ duyệt tự tăng trong tối đa khoảng 5 giây.
8. Mở Quét / duyệt QR -> pending xuất hiện trong danh sách -> Duyệt/Từ chối được.
9. Sự kiện Public -> MSSV ngoài CLB được ghi nhận và lọc riêng.
10. Link check-in mới có dạng /check-in-su-kien#token=...

LƯU Ý
Không cần nhập lại FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY trên Vercel.
