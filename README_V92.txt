OUR STAGE CLUB MANAGER — V92 ADVANCED EVENT SEATING

Mục tiêu V92: nâng Seat Studio thành sơ đồ ghế linh hoạt hơn, gần kiểu sơ đồ concert / hội trường nhiều khu.

ADMIN — SEAT STUDIO
- Bật/tắt chọn ghế theo từng Cổng sự kiện.
- Nhiều khu ghế, tối đa 30 khu.
- Kéo thả từng khu ghế trên canvas.
- Sân khấu cũng kéo thả được và chỉnh X / Y / chiều rộng / chiều cao.
- Mỗi hàng có thể có số lượng ghế khác nhau:
  A:30, B:30, C:28, D:24
  => phù hợp sơ đồ không đều như concert / nhà hát.
- Nhân bản khu ghế để dựng sơ đồ nhanh.
- Chỉnh tên khu, vị trí X/Y, độ rộng, số bắt đầu, hướng đánh số.
- Tối đa 2.500 ghế / sự kiện.
- Khi đã có ghế được xác nhận, Event Builder tiếp tục khóa thay đổi cấu trúc sơ đồ để tránh làm lệch seat ID.

PUBLIC REGISTRATION
- Khách điền form trước.
- Nếu sự kiện bật Seating, form được server xác thực rồi chuyển sang bước Chọn ghế.
- Ghế trống / đang chọn / đã có người chọn có legend rõ ràng.
- Sơ đồ hỗ trợ hàng có số ghế không đều.
- Hiển thị tổng ghế trống và số ghế đã được chọn.
- Poll trạng thái ghế định kỳ nhưng tránh render lại DOM nếu không có thay đổi để giao diện mượt hơn.
- Phiên chọn ghế được lưu trong sessionStorage để reload tab vẫn tiếp tục được.

CHỐNG TRANH CHẤP GHẾ
- Xác nhận ghế dùng Firestore server transaction.
- Hai người cùng bấm một ghế: chỉ transaction commit thành công trước được giữ ghế.
- Người thứ hai nhận lỗi “Ghế này vừa có người khác chọn” và sơ đồ tự refresh.
- Sau khi ghế đã xác nhận, public session không được đổi sang ghế khác. Đổi ghế phải do Ban tổ chức xử lý / giải phóng trước.

BẢO MẬT
- eventSeatClaims và eventSeatRateLimits là server-only trong Firestore Rules.
- Public state chỉ trả cấu trúc ghế, mã ghế và danh sách seat ID đã occupied; không trả tên / MSSV / email của người đang giữ ghế.
- claimToken chỉ lưu dạng SHA-256 hash trên Firestore.
- Phiên chọn ghế public hết hạn sau 2 giờ nếu chưa xác nhận.
- Rate limit hai lớp:
  + theo thiết bị / session;
  + theo IP với ngưỡng rộng hơn để không chặn mạng Wi-Fi chung của sự kiện.
- Input form tiếp tục được validate ở server trước khi tạo submission có Seating.

DEPLOY
- Không thêm Serverless Function mới. event-seating.js tiếp tục dùng function hiện có.
- Vercel Hobby vẫn ở 12 function sau khi .vercelignore loại 2 API email cũ.
- Không cần Environment Variable mới.
- firestore_rules_v92.rules giữ cùng mô hình quyền server-only như V91; nên publish V92 để phiên bản production khớp repo.

TEST BẮT BUỘC
1. Tạo sơ đồ có A:30, B:28, C:24 và kiểm tra tổng ghế.
2. Kéo khu ghế + sân khấu rồi lưu, mở lại Event Builder kiểm tra vị trí.
3. Mở cổng public: gửi form -> chuyển sang chọn ghế.
4. Dùng hai thiết bị chọn cùng ghế và bấm xác nhận gần như đồng thời -> chỉ một thiết bị thành công.
5. Thiết bị thua phải thấy ghế chuyển sang occupied và chọn ghế khác được.
6. Xóa / giải phóng response có ghế -> ghế trở lại trạng thái trống.
