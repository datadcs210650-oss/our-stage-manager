OUR STAGE CLUB MANAGER V37 — WIDE TABLE + COMPANION EVENT + PRIVACY

1. BẢNG ĐIỂM DANH CÓ THANH CUỘN NGANG RÕ RÀNG
- Thêm thanh kéo ngang riêng phía trên bảng Điểm danh hoạt động.
- Thanh trên và bảng bên dưới đồng bộ scrollLeft hai chiều.
- Có thể kéo bằng chuột/trackpad.
- Bảng có max-height để thanh cuộn ngang phía dưới cũng dễ tiếp cận.
- Bảng tự cập nhật chiều rộng khi thêm/xóa cột hoạt động hoặc resize cửa sổ.

2. FORM “ĐỒNG HÀNH KỲ TIẾP THEO”
Có ở cả:
- Nút riêng “Đồng hành kỳ tiếp theo” trong Cổng sự kiện.
- Mục “Đồng hành kỳ tiếp theo” trong Dùng mẫu.

Quy tắc kỳ:
SP → SU → FA → SP năm kế tiếp.

Ví dụ FA26 → SP27.
Kỳ tiếp theo phải được tạo trước và không bị khóa.

Form mặc định:
- Họ và tên.
- MSSV.
- Xác nhận Có/Không tiếp tục đồng hành.
- Ghi chú gửi BCN.

Nếu chọn CÓ:
- Tìm thành viên ở kỳ hiện tại bằng MSSV.
- Tạo/cập nhật thành viên ở kỳ tiếp theo.
- Giữ thông tin hồ sơ, tags, ghi chú.
- Kỳ mới bắt đầu scores={} và fundPaid=false nếu là hồ sơ mới.
- Tự thêm nhóm “Đồng hành CLB” vào Điểm danh hoạt động.
- Tự thêm cột “Đồng hành kỳ tiếp theo → [Tên kỳ]”.
- Thành viên được tick cột này.
- Nếu form đồng hành có nhập Điểm hoạt động, cột đồng hành dùng đúng số điểm đó; để trống thì cột có 0 điểm.
- Phản hồi được xử lý tự động khi Admin đang online và được rà lại mỗi 30 giây.

Nếu chọn KHÔNG:
- Không chuyển hồ sơ sang kỳ tiếp theo.
- Phản hồi vẫn giữ trong Kết quả sự kiện.

3. BẢO MẬT THÔNG TIN CÁ NHÂN
V37 bổ sung:
- Không còn lưu members / transactions / events vào localStorage.
- localStorage chỉ cache cấu hình không chứa danh sách thành viên.
- Khi đăng xuất, cache nhạy cảm được làm sạch.
- Realtime query chỉ tải members / finance / events của học kỳ đang chọn, giảm dữ liệu cá nhân không cần thiết trong trình duyệt.
- Khi đổi học kỳ, listener cũ bị hủy và tải đúng dữ liệu kỳ mới.
- Firestore vẫn giữ: public chỉ CREATE phản hồi sự kiện, không được READ kết quả.
- Public lookup không được LIST toàn bộ dữ liệu.
- Thêm Vercel security headers:
  X-Frame-Options DENY
  Referrer-Policy no-referrer
  X-Content-Type-Options nosniff
  Permissions-Policy
  Content-Security-Policy
- Trang Admin và form public chính dùng Cache-Control: no-store.

4. FIRESTORE RULES
- Rules V37 giữ mô hình quyền V36; không mở public read dữ liệu thành viên/phản hồi.
- Nếu đang dùng Rules V36 thì quyền dữ liệu chính không thay đổi.
- Có thể Publish firestore_rules_v37.rules để đồng bộ phiên bản.

5. CẬP NHẬT
- Commit TOÀN BỘ package V37 lên GitHub, bao gồm vercel.json.
- Chờ Vercel Ready.
- Publish firestore_rules_v37.rules nếu muốn đồng bộ Rules.
- Command + Shift + R.


RÀ SOÁT CUỐI: PASS
- JavaScript syntax đã kiểm tra.
- Không duplicate HTML ID.
- Thanh cuộn ngang bảng Điểm danh đã gắn đồng bộ hai chiều.
- Form Đồng hành có template + nút riêng + tự chuyển dữ liệu sang kỳ tiếp theo.
- Điểm form Đồng hành không bị cộng hai lần.
- Nhật ký / Import / Thùng rác / Chờ duyệt / Thông báo tách theo học kỳ.
- Dữ liệu thành viên/thu chi/sự kiện không lưu trong localStorage.
- Vercel có security headers và no-store cho trang nhạy cảm.
