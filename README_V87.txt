OUR STAGE CLUB MANAGER V87 — TICKET STUDIO
==========================================

MỤC TIÊU
- Thêm module Ticket Studio cho từng Cổng sự kiện.
- Admin upload ảnh nền vé, căn vị trí Họ tên / Mã vé / QR ngay trên mẫu.
- Admin import Excel/CSV để preview trước; KHÔNG tạo vé ngay khi vừa upload file.
- Chỉ khi bấm “Xác nhận tạo vé” dữ liệu mới được ghi.
- Mã vé có 3 chế độ:
  1) Hệ thống tự tạo mã chỉ gồm chữ số, 6–14 số (mặc định 8).
  2) Lấy cột “Mã vé” từ file.
  3) Dùng MSSV làm mã vé.
- Mã do Admin cung cấp hỗ trợ A-Z, 0-9, dấu chấm, gạch ngang, gạch dưới; hệ thống tự chuẩn hóa chữ hoa.
- Mỗi vé có QR token riêng, QR KHÔNG chứa họ tên / email / MSSV / mã vé hiển thị.
- Người nhận vé dùng link công khai, nhập mã vé, hệ thống dựng vé và cho tải PNG.
- QR Ticket Studio dùng chung máy quét của Cổng sự kiện.
- Hai thiết bị quét cùng một QR gần đồng thời: Firestore Transaction chỉ cho một lượt check-in; thiết bị còn lại nhận “đã check-in trước đó”.
- Vé có thể Thu hồi / Hủy / Cấp lại. Cấp lại giữ mã vé nhưng đổi QR token, QR cũ mất hiệu lực ngay.
- Vé có thể lưu Hạng vé và Ghế từ file import.

LUỒNG SỬ DỤNG
1. Tạo Cổng sự kiện như bình thường và bật QR check-in nếu muốn quét vé.
2. Vào Ticket Studio -> chọn sự kiện.
3. Upload mẫu vé (PNG/JPG/WebP). Ảnh sẽ được tối ưu cục bộ trước khi lưu.
4. Kéo các khung Họ tên / Mã vé / QR hoặc chỉnh X/Y/Rộng/Cao -> Lưu mẫu vé.
5. Chọn chế độ mã vé -> Chọn Excel/CSV -> kiểm tra Preview -> Xác nhận tạo vé.
6. Mở “Cổng nhận vé” -> Sao chép link gửi cho người tham dự.
7. Người tham dự mở link -> nhập mã vé -> tải vé PNG.
8. Tại sự kiện, dùng “Quét / duyệt QR” hoặc “Link check-in ngoài BCN” để quét QR trên vé.

CỘT IMPORT HỖ TRỢ
- Họ và tên (bắt buộc)
- MSSV
- Email
- Mã vé (bắt buộc nếu chọn chế độ dùng mã trong file)
- Hạng vé
- Ghế

AN TOÀN DỮ LIỆU
- Ticket Studio được quản lý qua Firebase Admin API; browser không được đọc trực tiếp collection ticketStudios.
- Cổng nhận vé dùng token ngẫu nhiên nằm trong URL fragment (#event=...), không nằm trong query string thông thường.
- Public lookup có rate limit theo phiên trình duyệt và IP để hạn chế đoán mã vé hàng loạt.
- Template ảnh được tối ưu để nằm an toàn trong giới hạn tài liệu Firestore; V87 không cần Firebase Storage.
- QR vé dùng opaque token. Thu hồi/cấp lại làm QR cũ mất hiệu lực.
- Vé đã check-in không thể thu hồi/hủy/xóa cho tới khi Admin hoàn tác check-in.

TRẠNG THÁI VÉ
- issued: Đã phát hành / chưa check-in
- checked_in: Đã check-in
- revoked: Đã thu hồi
- cancelled: Đã hủy

DEPLOY TỪ V86
Upload/ghi đè đúng cấu trúc các file sau:
- index.html
- check-in-su-kien.html
- ve-su-kien.html
- ticket-studio-admin.js
- ticket-studio.css
- api/ticket-studio.js
- api/event-checkin.js
- firestore_rules_v87.rules
- vercel.json
- package.json

Sau đó:
1. Firebase Console -> Firestore Database -> Rules -> dán firestore_rules_v87.rules -> Publish.
2. Vercel deploy lại.
3. Không cần thêm Environment Variable mới.
4. Không cần Firebase Storage.
5. Trên Mac hard refresh bằng Command + Shift + R.

KIỂM TRA SAU DEPLOY
- /api/ticket-studio phải trả service ticket-studio, version 87.
- /api/event-checkin phải trả version 87.
- Vào Admin -> Ticket Studio và thử 1 sự kiện test với 2–3 vé trước khi import danh sách lớn.
- Test cùng một QR trên 2 thiết bị: máy đầu check-in thành công, máy sau phải báo đã check-in trước đó và không tạo bản ghi thứ hai.

LƯU Ý
- Cổng nhận vé độc lập với cổng đăng ký sự kiện. Đóng đăng ký không tự đóng cổng nhận vé hoặc link check-in.
- Không mở cổng nhận vé khi chưa lưu mẫu vé; server sẽ chặn để tránh người dùng nhận trang vé lỗi.
- Bản V87 sử dụng một mẫu vé chính cho mỗi sự kiện; Hạng vé/Ghế vẫn được lưu theo từng vé.
