OUR STAGE CLUB MANAGER V83 — ACTIVITY VISIBILITY + STICKY ATTENDANCE COLUMNS

CẬP NHẬT CHÍNH
1. Thiết lập > Hoạt động có cột “Cổng tra cứu”. Admin có thể ẩn/hiện riêng từng hoạt động trên cổng tra cứu thành viên.
2. Hoạt động bị ẩn vẫn tồn tại đầy đủ trong hệ thống nội bộ, bảng điểm danh và điểm tổng; chỉ bị loại khỏi danh sách Hoạt động trong kỳ được công khai ở cổng tra cứu.
3. Khi cổng tra cứu của học kỳ đã được tạo, thao tác Ẩn/Hiện sẽ đồng bộ ngay. Nếu đồng bộ thất bại, hệ thống tự hoàn tác trạng thái để tránh giao diện Admin và dữ liệu công khai bị lệch.
4. Điểm danh hoạt động có bộ chọn “Cố định đến”. Chọn MSSV sẽ cố định STT + Họ và tên + MSSV; chỉ phần cột bên phải cuộn ngang. Có thể chọn bất kỳ cột lá nào đang hiển thị.
5. Thiết lập cố định cột được lưu riêng theo tài khoản + học kỳ trên trình duyệt, không ảnh hưởng người dùng khác.

TRIỂN KHAI
- Nếu đang ở V82: ghi đè index.html và package.json từ patch V83.
- Không cần thay Firebase Rules.
- Không cần nhập lại Environment Variables.
- Sau khi Vercel deploy: Command + Shift + R.

TEST NHANH
A. Ẩn hoạt động
- Thiết lập > Hoạt động > Cổng tra cứu > chọn “Đang hiện” để chuyển thành “Đang ẩn”.
- Mở cổng tra cứu của học kỳ và tra cứu một MSSV: hoạt động vừa ẩn không còn xuất hiện.
- Bảng Điểm danh vẫn còn cột đó và dữ liệu điểm không thay đổi.

B. Cố định cột
- Điểm danh hoạt động > “Cố định đến” > MSSV.
- Kéo thanh ngang: STT, Họ và tên, MSSV đứng yên; các cột từ Điểm tổng trở đi cuộn ngang.
- Chọn cột khác để thay đổi điểm cố định hoặc chọn Không cố định để trả về mặc định.
