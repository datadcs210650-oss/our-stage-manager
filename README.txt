OUR STAGE CLUB MANAGER V26 — FREE LOOKUP BUILDER

CỔNG TRA CỨU TỰ DO ĐƯỢC XÂY DỰNG LẠI

1. THIẾT LẬP CỔNG
- Tên cổng.
- Gắn / không gắn học kỳ.
- Mô tả.
- Hướng dẫn trước khi tra cứu.
- Nhãn ô tra cứu.
- Placeholder.
- Nội dung nút Tra cứu.
- Tiêu đề kết quả.
- Thông báo tùy chỉnh khi không tìm thấy dữ liệu.
- Ghi chú sau kết quả.

2. TỰ TẠO CÁC TRƯỜNG THÔNG TIN
Ngay lúc tạo cổng, Admin tự khai báo:
- Tên cột Excel.
- Tên hiển thị.
- Kiểu dữ liệu.
- Công khai / ẩn.
- Chọn trường làm Khóa tra cứu.

Kiểu dữ liệu:
- Văn bản ngắn.
- Văn bản nhiều dòng.
- Số.
- Tiền tệ.
- Ngày.
- Email.
- Số điện thoại.
- Liên kết.

Có thể thêm tối đa 30 trường.

3. TẢI EXCEL MẪU
- Có nút Tải Excel mẫu ngay trong trình tạo cổng.
- Mỗi cổng đã tạo cũng có nút Tải Excel mẫu riêng.
- File tự sinh chính xác theo cấu trúc trường Admin đã thiết lập.
- Sheet DU LIEU chỉ có hàng tiêu đề, không có dòng giả.
- Sheet HUONG DAN ghi tên cổng, khóa tra cứu và danh sách trường.
- Khi upload file, hệ thống kiểm tra các cột đã cấu hình. Nếu thiếu cột sẽ yêu cầu dùng lại Excel mẫu.

4. AN TOÀN KHI CỔNG ĐÃ CÓ DỮ LIỆU
- Không cho đổi khóa tra cứu trực tiếp trong Thiết lập nếu đã có dữ liệu.
- Muốn đổi khóa, dùng Upload Excel + Thay toàn bộ dữ liệu cũ.
- Chế độ Merge không cho đổi khóa để tránh tạo bản ghi trùng / mất liên kết.
- Đổi tên hiển thị, kiểu dữ liệu hoặc Công khai/Ẩn sẽ tự đồng bộ lại dữ liệu công khai.

5. CỔNG PUBLIC
- Hiển thị hướng dẫn riêng.
- Nút tra cứu đổi được nội dung.
- Tiêu đề kết quả đổi được.
- Thông báo không tìm thấy đổi được.
- Email / điện thoại / liên kết có thể bấm trực tiếp khi Admin đặt đúng kiểu dữ liệu.

VẪN GIỮ
- Logo.
- Giao diện V25 Modern.
- Tra cứu thành viên.
- Cổng sự kiện + xuất/xóa kết quả.
- Quản lý tài khoản BCN.
- Real-time.
- Không có Kế hoạch công việc.

CẬP NHẬT
1. Commit toàn bộ package V26 lên GitHub.
2. Chờ Vercel deploy Ready.
3. Firestore Rules V26 không mở thêm quyền so với V25, nhưng có thể Publish firestore_rules_v26.rules để đồng bộ phiên bản.
4. Command + Shift + R sau khi deploy.
