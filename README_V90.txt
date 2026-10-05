OUR STAGE CLUB MANAGER — V90 SESSION + TICKET + STAFF + SEATING

V90 tập trung vào 4 nhóm nâng cấp:

1. PHIÊN ĐĂNG NHẬP
- Chỉ tự đăng xuất sau 4 giờ không có thao tác.
- Cảnh báo trước 5 phút.

2. TICKET STUDIO
- Tick chọn nhiều vé và xóa hàng loạt; vé đã check-in được giữ lại.
- Trạng thái "Đã xuất vé" chỉ được ghi khi khách dùng cổng nhận vé; Admin preview không làm thay đổi trạng thái.
- Cổng nhận vé hỗ trợ Mã vé hoặc MSSV.
- Mỗi khách có thể chọn riêng mã tự tạo / MSSV / mã từ file.
- Vé chưa check-in có thể đổi riêng cách tạo mã sau khi phát hành.
- Kết quả đăng ký + Excel/CSV gộp theo MSSV và chống tạo vé trùng.
- Nếu sự kiện có chọn ghế, Ticket Studio lấy ghế từ kết quả đăng ký.

3. STAFF FALLBACK CHECK-IN
- Mỗi sự kiện có link tra cứu Staff có tên riêng.
- Staff nhập Mã vé hoặc MSSV khi QR không quét được.
- Admin chọn các trường an toàn được hiển thị; Họ tên luôn hiển thị.
- Email/SĐT không public qua link Staff.
- Không có danh sách người tham dự; chỉ lookup từng mã.
- Có rate limit chống dò dữ liệu.
- Staff phải bấm xác nhận check-in.
- QR scanner success chỉ hiện Họ tên + MSSV/Mã vé.

4. EVENT SEATING
- Event Builder có Seat Studio: Stage, nhiều khu ghế, hàng, số ghế/hàng, số bắt đầu, chiều tăng/giảm, X/Y, độ rộng.
- Có thể kéo khu ghế trực tiếp để căn chỉnh.
- Sau khi gửi form, khách chuyển sang bước chọn ghế.
- Ghế được giữ bằng Firestore transaction: 2 người chọn cùng ghế thì chỉ người commit thành công trước nhận ghế.
- Public chỉ nhận mã ghế và trạng thái occupied, không nhận PII của người giữ ghế.
- Kết quả sự kiện hiển thị/xuất Khu ghế và Ghế.
- Xóa phản hồi có ghế sẽ giải phóng ghế trước.
- Xóa sự kiện dọn seat claims và Staff links.

FILES / ROUTES MỚI
- api/event-seating.js
- seat-studio-admin.js
- seat-studio.css
- staff-checkin.html
- /staff-checkin -> /staff-checkin.html

FIRESTORE
- Bắt buộc publish firestore_rules_v90.rules trước khi dùng production.
- eventSeatClaims, eventSeatRateLimits, eventStaffLinks, eventStaffRateLimits là server-only.

VERCEL HOBBY
- Repo có 14 file vật lý trong /api; .vercelignore loại 2 API email cũ.
- V90 deploy 12 Serverless Functions, bằng giới hạn Hobby.
- Không thêm API file mới; server feature tiếp theo nên gộp vào API hiện có.

TEST SAU DEPLOY
1. Session idle 4 giờ.
2. Guest tạo vé -> Admin thấy "Đã xuất vé"; Admin preview không đánh dấu.
3. Xóa nhiều vé; checked-in ticket không bị xóa.
4. Link Staff chỉ thấy trường Admin chọn; check-in bằng Mã vé/MSSV.
5. QR ngoài BCN chỉ hiện Tên + MSSV/Mã vé.
6. 2 thiết bị cùng chọn một ghế -> chỉ một thiết bị thành công.
7. Xóa response có ghế -> ghế trống lại.
