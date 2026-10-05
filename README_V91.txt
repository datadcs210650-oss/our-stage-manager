OUR STAGE CLUB MANAGER — V91 FINAL STABILITY PASS

Mục tiêu V91:
- Phiên Admin chỉ hết hạn sau đúng 4 giờ không có thao tác.
- Không còn reset thời gian chỉ vì quay lại tab; nếu tab ngủ/background quá 4 giờ, hệ thống kiểm tra và đăng xuất ngay khi quay lại.
- Giữ cảnh báo trước 5 phút.

TICKET STUDIO
- Chọn nhiều vé và xóa hàng loạt; vé đã check-in không bị xóa.
- Trạng thái Đã xuất vé sau khi khách thật sự tạo vé ở cổng nhận vé.
- Hỗ trợ nhập mã vé hoặc MSSV tại cổng nhận vé.
- Mỗi khách có codeMode riêng: tự tạo số / MSSV / mã nhập từ file.
- Admin có thể recode từng vé chưa check-in.
- Dữ liệu đăng ký + Excel/CSV có thể gộp theo MSSV.
- Có chống tạo vé trùng khi import lặp.

STAFF FALLBACK CHECK-IN
- Mỗi sự kiện có link Staff riêng, có thể đặt tên.
- Staff nhập mã vé hoặc MSSV khi QR không quét được.
- Admin chọn trường được public; Họ tên luôn hiển thị.
- Không public email/SĐT.
- Có rate-limit chống dò mã.
- Sau check-in QR chỉ hiển thị Họ tên + MSSV hoặc Mã vé.

EVENT SEATING
- Event Builder có Seat Studio.
- Admin tạo nhiều khu ghế, hàng, ghế mỗi hàng, số bắt đầu, hướng số, vị trí X/Y, chiều rộng và kéo thả khu trên canvas.
- Tối đa 2.500 ghế.
- Sau khi gửi form, khách chuyển sang chọn ghế.
- Giữ ghế bằng Firestore transaction: hai người chọn cùng ghế thì chỉ transaction commit trước thành công.
- Public chỉ nhận seat ID/label và trạng thái occupied, không nhận PII người giữ ghế.
- Xóa phản hồi sẽ giải phóng ghế.
- Sau khi có ghế đã chọn, hệ thống khóa thay đổi cấu trúc sơ đồ để tránh lệch dữ liệu.

DEPLOY
- Vercel Hobby: repo có 14 file /api nhưng .vercelignore bỏ 2 API email cũ => 12 Serverless Functions, đúng giới hạn Hobby.
- Không thêm Environment Variable mới.

FIRESTORE
- Publish firestore_rules_v91.rules trước khi dùng Staff fallback / Event Seating production.
- eventSeatClaims, eventSeatRateLimits, eventStaffLinks, eventStaffRateLimits, ticketStudios và ticketLookupRateLimits đều server-only.

TEST BẮT BUỘC SAU DEPLOY
1. Đăng nhập, để tab background > 4h ở môi trường test rút ngắn timer nếu cần, quay lại phải bị đăng xuất.
2. Tạo 2 vé, tick chọn và xóa nhiều; vé checked-in phải được giữ.
3. Khách tạo vé -> Admin thấy Đã xuất vé.
4. Link Staff chỉ thấy các trường Admin bật.
5. QR scanner chỉ hiện Tên + MSSV/Mã vé sau check-in.
6. Hai thiết bị cùng xác nhận một ghế -> chỉ một thiết bị thành công.
7. Xóa response có ghế -> ghế trống lại.
