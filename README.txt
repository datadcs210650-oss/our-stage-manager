OUR STAGE CLUB MANAGER V29 — SYNC + HARD LOCK + MEMBER STATS

ĐÃ SỬA
1. Tạo tài khoản BCN không còn phụ thuộc Vercel API cho tài khoản mới.
2. Nếu email đã tồn tại trong Firebase Auth nhưng chưa có profile, nhập đúng mật khẩu hiện tại để liên kết.
3. QR điểm danh có panel real-time trên giao diện Admin; lượt gửi xuất hiện ngay cả khi modal QR đã đóng.
4. Trang QR bật Firestore auto long-polling để ổn định đồng bộ.
5. Khóa học kỳ áp dụng cho cả Admin/Super Admin/BCN ở các module vận hành.
6. Chỉ khi mở khóa trong Thiết lập mới chỉnh sửa lại được.
7. Rules V29 thực thi khóa học kỳ phía Firestore.
8. Hồ sơ thành viên có thống kê cá nhân qua các học kỳ.
9. Dashboard có bảng xếp hạng thành viên hoạt động nhiều nhất trong kỳ.

TIÊU CHÍ XẾP HẠNG
- Số hoạt động tham gia.
- Nếu bằng nhau: điểm hoạt động.
- Nếu vẫn bằng: điểm tổng.
- Sau cùng: tên.

CẬP NHẬT
- Commit toàn bộ package V29 lên GitHub.
- Chờ Vercel Ready.
- Firebase > Firestore Database > Rules: Publish firestore_rules_v29.rules.
- Command + Shift + R.

RULES V29 LÀ BẮT BUỘC để QR real-time và khóa học kỳ hoạt động đúng.
