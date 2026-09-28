OUR STAGE CLUB MANAGER V62 — PHÂN BAN + THỨ TỰ IMPORT + MANUAL SYNC

1. NHÓM SINH VIÊN
- Mỗi thành viên có schoolType: fptu / external / unknown.
- Admin/Super Admin đánh dấu trong modal thành viên.
- BCN có quyền thành viên chỉ xem, không sửa hai trường phân loại này.
- Có bộ lọc Nhóm sinh viên trong danh sách thành viên.

2. PHÂN BAN NHIỀU-LỰA-CHỌN
- state.divisions lưu danh mục phân ban trong cấu hình CLB.
- Member.divisions là mảng ID nên một thành viên có thể thuộc nhiều phân ban.
- Dữ liệu cũ Ban/Bộ phận được nhận diện để tạo phân ban tương thích.
- Menu riêng “Phân ban” gồm:
  + danh sách phân ban;
  + số thành viên;
  + tỷ lệ hoạt động trung bình;
  + số đang hoạt động;
  + FPTU / trường khác;
  + bảng thành viên và tỷ lệ hoạt động từng người.
- Chỉ Admin/Super Admin tạo, đổi tên, xóa và đánh dấu phân ban.

3. GIỮ ĐÚNG THỨ TỰ UPLOAD EXCEL
- Member có displayOrder.
- Khi upload danh sách, các dòng hợp lệ được xếp đúng thứ tự file từ 1..N.
- Thành viên không có trong file được nối phía sau theo thứ tự ổn định hiện tại.
- Firestore load lại sẽ sort theo displayOrder, không còn xáo trộn theo thứ tự document.

4. BỎ REAL-TIME GIỮA ADMIN/BCN
- Không còn listener onSnapshot liên tục cho members / finance / events / clubState / notifications / approvals / audit / trash / QR list.
- Dữ liệu được GET một lần khi đăng nhập, đổi học kỳ hoặc khi bấm “Đồng bộ”.
- Listener realtime hồ sơ tài khoản của chính người đang đăng nhập vẫn giữ để có thể thu hồi quyền / vô hiệu hóa tài khoản ngay.
- QR Admin chuyển sang nút Làm mới lượt gửi.
- Giảm số Firestore read khi nhiều tài khoản BCN cùng mở trang.

5. CỔNG TRA CỨU THÀNH VIÊN
- Giữ tính năng sync lookup.
- Thay đổi của Admin vẫn dùng scheduleAutoLookupSync.
- Khi Admin bấm “Đồng bộ”, hệ thống tải dữ liệu mới từ Firestore rồi sync cổng tra cứu, nên thay đổi từ BCN cũng được đưa lên cổng mà không cần listener real-time.

6. FIRESTORE RULES
- V62 không cần thay Rules chỉ để lưu schoolType, divisions, displayOrder vì member docs hiện cho editMembers cập nhật các trường này.
- ZIP không chứa Rules.
