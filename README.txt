OUR STAGE CLUB MANAGER V38 — ADVANCED SUITE + SECURITY

TÍNH NĂNG TRIỂN KHAI
1. Trung tâm điều hành thông minh trên Dashboard.
4. So sánh 2 học kỳ.
10. Báo cáo cuối kỳ PDF tự tổng hợp.
11. Hồ sơ thành viên 360°.
12. Trạng thái thành viên: Đang hoạt động / Tạm nghỉ / Rời CLB / Cựu thành viên.
19. Chặn trùng MSSV hoặc Email khi thêm/sửa + cảnh báo dữ liệu trùng hiện có.
23. Đánh dấu hàng loạt thành viên Rời CLB mà không xóa lịch sử.
29. Xuất hồ sơ thành viên PDF.
32. Một MSSV chỉ gửi một lần trên mỗi QR điểm danh.
38. Chọn và duyệt/từ chối hàng loạt lượt QR.
40. Xuất Excel báo cáo riêng cho hoạt động đang chọn.
51. Form Builder bổ sung Section; tiếp tục hỗ trợ mô tả, required, radio, checkbox, dropdown, date, time, number, email, MSSV, content, image.
59. Hẹn giờ mở/đóng cổng sự kiện. Firestore Rules kiểm tra thời gian ở server.
62. Tìm kiếm/lọc kết quả sự kiện theo nội dung, trạng thái xử lý, trạng thái điểm, đồng hành.
63. Xuất Excel tùy chọn trường/cột và áp dụng bộ lọc đang dùng.
68. Form đồng hành có báo cáo Không tiếp tục + Chưa phản hồi.
70. Mỗi cổng sự kiện có QR riêng + tải QR PNG.
80. Báo cáo tài chính PDF cuối kỳ.

BẢO MẬT
- Firestore vẫn là lớp kiểm soát quyền chính; public không được đọc kết quả sự kiện hoặc danh sách thành viên.
- Rules V38 chặn gửi sự kiện ngoài thời gian mở/đóng.
- QR điểm danh dùng document ID cố định theo MSSV chuẩn hóa và create-only; cùng MSSV không thể gửi lại cùng QR qua giao diện public.
- Không lưu members/finance/events vào localStorage.
- Các trang có dữ liệu/tra cứu dùng Cache-Control: no-store.
- Thêm HSTS, X-Frame-Options, Referrer-Policy, CSP và X-Permitted-Cross-Domain-Policies.
- Báo cáo PDF được tạo ngay trên trình duyệt bằng PDFMake; không upload dữ liệu sang dịch vụ PDF bên ngoài.

CẬP NHẬT BẮT BUỘC
1. Commit toàn bộ package V38 lên GitHub.
2. Chờ Vercel Ready.
3. Firebase > Firestore Database > Rules: dán firestore_rules_v38.rules và Publish.
4. Command + Shift + R.

LƯU Ý KIỂM THỬ
- Bộ build đã được kiểm tra cú pháp JavaScript, duplicate HTML ID, JSON Vercel và các pattern bảo mật Rules.
- Không hệ thống web nào có thể được cam kết tuyệt đối “không thể bị hack”; Rules, quyền tối thiểu và cập nhật dependency vẫn cần được duy trì.


V38 FINAL HARDENING / QA
- Thành viên cũ chưa có trường status được hiểu là “Đang hoạt động” ở bộ lọc, bảng và Excel.
- Bộ lọc trạng thái luôn có đủ: Đang hoạt động / Tạm nghỉ / Rời CLB / Cựu thành viên.
- PDF xuất hồ sơ / cuối kỳ / tài chính báo lỗi thân thiện nếu CDN PDF chưa tải, không làm vỡ trang.
- Form sự kiện bắt buộc có ít nhất một câu hỏi nhận câu trả lời; chỉ Section/Ảnh/Ghi chú không được lưu như form hoàn chỉnh.
- Bổ sung security headers Cross-Origin-Resource-Policy và X-DNS-Prefetch-Control.

18 HẠNG MỤC ĐÃ TRIỂN KHAI
1. Trung tâm điều hành thông minh.
4. So sánh học kỳ.
10. Báo cáo cuối kỳ PDF một nút.
11. Hồ sơ thành viên 360°.
12. Trạng thái thành viên.
19. Phát hiện MSSV/email trùng.
23. Đánh dấu Rời CLB hàng loạt.
29. Hồ sơ thành viên PDF.
32. Một MSSV chỉ gửi một lần cho mỗi QR.
38. Duyệt/Từ chối QR hàng loạt.
40. Báo cáo Excel theo hoạt động điểm danh.
51. Form Builder nâng cao có Section và các loại câu hỏi.
59. Hẹn giờ mở/đóng form, có kiểm tra phía Firestore Rules.
62. Lọc/tìm kết quả sự kiện nâng cao.
63. Xuất kết quả sự kiện theo cột tùy chọn.
68. Báo cáo Không tiếp tục / Chưa phản hồi cho form Đồng hành.
70. QR riêng cho từng cổng sự kiện.
80. Báo cáo tài chính PDF cuối kỳ.

BẢO MẬT
- Không thể cam kết bất kỳ website nào “100% không thể bị hack”. V38 áp dụng defense-in-depth: Firebase Auth, Firestore Rules, giới hạn public create/read, server-side rule cho thời gian form/QR, chống submit lặp MSSV ở QR bằng document ID, không lưu PII vận hành vào localStorage, CSP/HSTS/no-store và phân quyền theo module.
- Sau deploy cần smoke-test trên Vercel + Firebase thật vì kiểm tra trong package là kiểm tra tĩnh/cú pháp, không phải môi trường production thực tế.
