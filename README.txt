OUR STAGE CLUB MANAGER V44 — CONTINUATION INLINE EDIT

- Admin/BCN có editEvents có thể sửa trực tiếp Form Đồng hành trong bảng Điểm danh.
- Dropdown: Chưa điền / Tiếp tục / Dừng đồng hành.
- Có thể bấm trực tiếp cột Tiếp tục hoặc Dừng.
- Nếu đã có phản hồi: sửa phản hồi mới nhất.
- Nếu chưa có phản hồi: tạo phản hồi nội bộ adminManual.
- Chọn Chưa điền: chuyển toàn bộ phản hồi của MSSV đó vào Thùng rác rồi đồng bộ lại Điểm danh.
- Nếu thành viên gửi form mới sau đó, cơ chế kết quả gửi sau cùng của V43 tiếp tục được áp dụng.

V44 CÓ thay đổi Firestore Rules vì cần cho tài khoản có editEvents tạo phản hồi nội bộ ngay cả khi cổng đã đóng. Public create vẫn giữ điều kiện mở cổng/thời gian và không thể tạo adminManual.

Cập nhật: upload toàn bộ V44, Publish firestore_rules_v44.rules, sau đó hard refresh.
