OUR STAGE CLUB MANAGER V31 — SINGLE QR + DELETE QR

SỬA LỖI 2 MÃ QR
- Nguyên nhân: QRCode.js sinh cả canvas và img dự phòng.
- V30 vô tình ép cả canvas và img cùng hiển thị, nên nhìn thành 2 QR xếp dọc.
- V31 chỉ hiển thị đúng MỘT mã QR.
- Nếu canvas tồn tại thì img dự phòng bị ẩn.
- Nếu trình duyệt không dùng được canvas thì img mới được hiển thị.

XÓA QR ĐÃ TẠO
- Mỗi QR trong danh sách có nút Xóa QR.
- Modal QR cũng có nút Xóa QR.
- Khi xóa:
  1. Xóa toàn bộ check-in của QR.
  2. Xóa document attendancePortals/{token}.
  3. Link QR mất hiệu lực ngay.
  4. Người đang mở trang /diem-danh sẽ nhận realtime document-not-exist và bị vô hiệu hóa.
  5. Ghi Audit Log thao tác xóa.

ĐÓNG QR
- Vẫn giữ cơ chế Đóng QR = open:false.
- Link mất hiệu lực ngay nhưng dữ liệu/lượt gửi được giữ lại.
- Xóa QR = xóa vĩnh viễn QR và lượt gửi.

FIRESTORE RULES
- Không cần mở thêm quyền so với V30.
- Rules hiện tại đã cho người có quyền editAttendance xóa portal/check-in khi học kỳ đang mở.
- Có file firestore_rules_v31.rules để đồng bộ phiên bản.

CẬP NHẬT
1. Commit toàn bộ package V31 lên GitHub.
2. Chờ Vercel Ready.
3. Nếu đang dùng Rules V30 thì không bắt buộc Publish lại Rules.
4. Command + Shift + R.
