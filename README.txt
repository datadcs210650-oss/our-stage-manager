OUR STAGE CLUB MANAGER V57 — PER-ROW SCORING + CUSTOM EXPORTS

1. LOGO SIDEBAR
Logo gốc có phần hình nằm lệch trong canvas PNG trong suốt, nên dù thẻ ảnh đã căn giữa
thì hình logo nhìn vẫn lệch trong nền trắng.

V57 tạo riêng:
logo-sidebar-centered.png

Artwork được crop theo alpha và đặt lại đúng tâm của canvas. Sidebar chỉ dùng asset này.
Logo chính logo.png vẫn giữ nguyên cho các trang/PDF khác.

2. MỖI DÒNG HOẠT ĐỘNG CÓ HÌNH THỨC RIÊNG
Thiết lập > Hoạt động:
Mỗi dòng có thể chọn:
- Tickbox
- Nhập điểm

Select ở đầu nhóm chỉ còn là mặc định cho DÒNG MỚI, không ép tất cả dòng cùng loại.

Dữ liệu cũ:
Nếu item chưa có mode, V57 lấy mode cũ của group và lưu logic tương thích.

3. GIỚI HẠN ĐIỂM TỐI ĐA
Với dòng “Nhập điểm”:
- Input có min=0.
- Input có max=Điểm tối đa.
- JavaScript kiểm tra lại trước khi ghi Firestore.
- Ví dụ Điểm tối đa = 6: nhập 6 được, nhập 6.5/7/10 bị từ chối.
- Nếu muốn giảm Điểm tối đa xuống thấp hơn số điểm cao nhất đang có, hệ thống không cho
  đến khi Admin chỉnh điểm thành viên trước.

4. ĐỔI TICKBOX / NHẬP ĐIỂM
Nếu đổi hình thức của một hoạt động:
- Tickbox -> Nhập điểm: thành viên đã tick được quy đổi thành đủ điểm tối đa.
- Nhập điểm -> Tickbox: điểm > 0 được quy đổi thành đã tick.
- Dữ liệu thành viên được đồng bộ Firestore.
- Cột khóa thì không được đổi hình thức.

5. XUẤT DANH SÁCH THÀNH VIÊN HỌC KỲ
Nút Xuất DS học kỳ có thể chọn chính xác thông tin muốn xuất:
- Họ và tên
- MSSV
- Email
- Số điện thoại
- Ban / Bộ phận
- Chức vụ
- Trạng thái
- Ghi chú
- Các trường thành viên tùy chỉnh khác nếu có

Có Chọn tất cả / Bỏ chọn.

6. XUẤT DANH SÁCH TỪNG HOẠT ĐỘNG / SỰ KIỆN
Nút “Xuất báo cáo hoạt động” mở cổng xác nhận:
- Chỉ Có tham gia
- Chỉ Không tham gia
- Cả hai

Có thể chọn thông tin thành viên muốn xuất:
Họ tên, MSSV, Email, SĐT và các trường tùy chỉnh khác.

File luôn kèm:
- Tham gia
- Điểm
và sheet THONG TIN ghi rõ hình thức, điểm tối đa, bộ lọc, học kỳ.

7. KHÓA CỘT
Tính năng khóa cột từ V56 vẫn giữ nguyên.
Cột khóa không thể:
- nhập tay
- đổi hình thức
- đổi điểm tối đa
- import Excel
- duyệt QR cộng điểm
- nhận điểm từ event portal

8. FIRESTORE RULES
V57 không thay Firestore Rules.
ZIP không chứa Rules.
