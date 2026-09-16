OUR STAGE CLUB MANAGER V33 — SEMESTER ISOLATION + COMPANION EVENT

1. DỮ LIỆU TÁCH RIÊNG THEO HỌC KỲ
- Nhật ký, Import, Thùng rác, Chờ duyệt, Thông báo dùng query semester == kỳ đang chọn.
- Thành viên, điểm, thu chi, sự kiện, QR, tra cứu và dashboard tiếp tục chỉ dùng kỳ đang chọn.
- Global Search chỉ tìm dữ liệu vận hành của kỳ đang xem.
- Chuyển từ kỳ mới về kỳ cũ sẽ không thấy thay đổi của kỳ mới.
- Hồ sơ cá nhân có thể xem lịch sử các kỳ trước, nhưng kỳ cũ không hiển thị kỳ tương lai.
- Tài khoản BCN và thiết lập tài khoản là dữ liệu toàn hệ thống nên không thuộc kỳ.

2. MÔ HÌNH HỌC KỲ CỐ ĐỊNH
Mỗi năm chỉ có 3 kỳ:
- Spring (SP)
- Summer (SU)
- Fall (FA)
Thứ tự: SP26 → SU26 → FA26 → SP27 → SU27 → FA27...
Tên kỳ và mã kỳ được hệ thống chuẩn hóa. Không tạo Winter hoặc mã tùy ý.

3. SỰ KIỆN “ĐỒNG HÀNH KỲ TIẾP THEO”
- Có nút riêng trong Cổng sự kiện.
- Kỳ tiếp theo phải được tạo trước và không bị khóa.
- Form mặc định hỏi Họ tên, MSSV, xác nhận tiếp tục đồng hành và ghi chú.
Nếu chọn CÓ:
- Tạo/cập nhật hồ sơ ở kỳ tiếp theo.
- Giữ thông tin cơ bản/tags/ghi chú; điểm và quỹ của kỳ mới bắt đầu riêng.
- Tự thêm hoạt động “Đồng hành kỳ tiếp theo → [kỳ]” vào Điểm danh hoạt động của kỳ nguồn.
- Tick hoạt động này cho thành viên.
- Ghi Audit Log ở cả kỳ nguồn và kỳ đích.
Nếu chọn KHÔNG: chỉ lưu phản hồi, không chuyển hồ sơ.

4. XÓA HỌC KỲ
Dọn thêm sự kiện/submissions, QR/check-ins, tra cứu tự do, Audit, Trash, Import, Approval và Notification đúng kỳ.

5. FIRESTORE RULES V33
BẮT BUỘC Publish firestore_rules_v33.rules.
Dữ liệu vận hành mới phải có semester; tra cứu tự do mới phải gắn học kỳ.

CẬP NHẬT
1. Commit toàn bộ package V33 lên GitHub.
2. Chờ Vercel Ready.
3. Firebase > Firestore Database > Rules > Publish firestore_rules_v33.rules.
4. Command + Shift + R.

DỮ LIỆU CŨ KHÔNG CÓ semester
Sẽ không còn hiển thị trong các màn hình theo kỳ để tránh trộn dữ liệu. Dữ liệu đó không tự bị xóa.
