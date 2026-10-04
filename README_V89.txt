OUR STAGE CLUB MANAGER — V89 TICKET STUDIO UNIFIED

V89 tập trung hợp nhất Ticket Studio với Cổng sự kiện và Link check-in ngoài BCN.

- Ticket Studio không có máy quét riêng. QR vé được quét qua Link check-in ngoài BCN của Cổng sự kiện.
- Link ngoài BCN có thể đặt tên điểm quét (Cổng A, Bàn 1...) và chỉ hiển thị thông tin tối thiểu của mã vừa quét.
- Trang quét hiển thị rõ họ tên, MSSV hoặc mã vé, hạng vé/ghế, trạng thái đăng ký và cảnh báo quét trùng.
- Vé có MSSV trùng với kết quả đăng ký sẽ nhận biết trạng thái "Có đăng ký".
- Ticket Studio có thể nạp kết quả đăng ký của sự kiện, tải thêm Excel/CSV và gộp theo MSSV (fallback email).
- Dữ liệu file tải lên có thể bổ sung/chỉnh thông tin trước khi Admin xác nhận tạo vé.
- Admin chỉnh được tên, MSSV, email, hạng vé và ghế của khách mời sau khi tạo vé.
- Nếu vé đã check-in, không cho đổi MSSV cho đến khi hoàn tác check-in; các trường an toàn khác vẫn chỉnh được.
- Mã vé tự tạo 8–14 chữ số; chế độ MSSV tự xử lý xung đột mã bằng hậu tố số.
- Trang nhận vé bỏ hai hộp hướng dẫn cố định bên dưới nút Tạo vé; thông báo chỉ hiện khi đang xử lý/kết quả/lỗi.
- QR vé vẫn là token ngẫu nhiên, không chứa PII. Lookup mã vé tiếp tục có rate limit.
- Firestore Ticket Studio và rate-limit collections vẫn server-only. V89 không cần Environment Variable mới.
- firestore_rules_v89.rules có cùng mô hình quyền V88; nếu Rules V88 đã publish đúng thì không bắt buộc publish lại chỉ vì V89.

Kiểm thử sau deploy:
1. Nạp đăng ký + Excel có cùng MSSV -> preview chỉ còn một khách.
2. Tạo vé -> mở cổng nhận vé -> nhập mã -> tải PNG.
3. Tạo/đặt tên Link check-in ngoài BCN trong Cổng sự kiện.
4. Quét QR vé -> trang scanner hiện đúng người vừa check-in.
5. Quét lại cùng QR -> báo đã check-in trước đó, không sinh bản ghi trùng.
6. Kiểm tra Admin QR results có tên điểm quét.
