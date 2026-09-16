OUR STAGE CLUB MANAGER V30 — QR FIX

SỬA QR KHÔNG HIỆN
- Thay thư viện QR cũ bằng QRCode.js hợp lệ.
- Có CDN dự phòng.
- Sửa cấu trúc script <head> bị malformed.
- QR được render vào container tương thích với QRCode.js.
- Nếu thư viện QR không tải được, giao diện hiện thông báo thay vì vùng trắng.

QR ĐÚNG LINK + ĐÚNG HỌC KỲ
- Link mới: /diem-danh?token=...&semester=FA26
- Document QR lưu semester, semesterCode, semesterName.
- Trang điểm danh hiển thị rõ học kỳ.
- Nếu tham số semester trên URL không khớp document QR, form bị vô hiệu hóa.
- QR cũ vẫn hỗ trợ theo token để không phá dữ liệu đã tạo.

ĐÓNG QR = HẾT HIỆU LỰC NGAY
- Admin đóng QR => open=false ngay trên Firestore.
- Trang điểm danh dùng onSnapshot real-time trên document QR.
- Người đang mở trang sẽ mất form ngay khi QR bị đóng.
- Nếu cố gửi đúng lúc đóng, Firestore Rules vẫn chặn.
- QR cũng tự hết hiệu lực đúng giờ hết hạn.
- Học kỳ bị khóa vẫn chặn check-in mới.

ADMIN QR
- Hiển thị mã QR, link, học kỳ, mã kỳ, hết hạn.
- Có Mở link, Sao chép link, Đóng QR.
- Trạng thái QR cập nhật real-time nếu một Admin khác đóng.

CẬP NHẬT
1. Commit toàn bộ package V30 lên GitHub.
2. Chờ Vercel Ready.
3. Rules V30 giữ cơ chế bảo mật V29; có thể Publish firestore_rules_v30.rules để đồng bộ phiên bản.
4. Command + Shift + R.
