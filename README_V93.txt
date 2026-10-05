OUR STAGE CLUB MANAGER — V93 EVENT RESPONSE DESTINATIONS

Mục tiêu V93
- Sửa lỗi người trả lời “Không tham gia” vẫn bị chuyển sang bước chọn ghế.
- Thêm “Đích đến theo từng lựa chọn” cho câu hỏi Trắc nghiệm trong Event Builder.
- Quyết định có được chọn ghế hay không ở phía server, không chỉ ẩn giao diện phía client.

ADMIN — EVENT BUILDER
Mỗi lựa chọn của trường Trắc nghiệm có 3 đích đến:
1. Mặc định theo cổng
2. Đi đến Chọn ghế
3. Kết thúc form • Không chọn ghế

Cấu hình được lưu trong field.optionDestinations.
Ví dụ:
{
  "Có, tôi tham gia": "seat",
  "Không, tôi không tham gia": "submit"
}

PUBLIC FLOW
- Người dùng gửi form.
- API event-seating xác thực phản hồi và tính nextDestination.
- nextDestination = "seat": tạo phiên chọn ghế và chuyển sang Seat Studio.
- nextDestination = "submit": lưu phản hồi với seatSelectionRequired=false, seatStatus="not-required" và kết thúc form ngay.
- Không tạo claimToken/seat session cho phản hồi không cần ghế.

TƯƠNG THÍCH FORM CŨ
Nếu câu hỏi Trắc nghiệm có nội dung liên quan “tham gia” nhưng chưa được Admin gán đích đến:
- lựa chọn mang nghĩa “Không / Không tham gia / Không thể tham gia / Từ chối” tự động kết thúc form;
- các lựa chọn còn lại tiếp tục theo luồng mặc định của cổng.
Nhờ đó form xác nhận tham gia cũ được sửa lỗi ngay cả trước khi Admin cấu hình destination.

BẢO MẬT / TOÀN VẸN GHẾ
- API mới là nguồn quyết định cuối cùng về quyền chọn ghế.
- Phản hồi có seatSelectionRequired=false không thể dùng public-claim-seat để chiếm ghế.
- Luồng chống tranh chấp ghế bằng Firestore transaction của V92 vẫn giữ nguyên.

FILES
- event-routing-admin.js
- event-routing-public.js
- index.html
- su-kien.html
- api/event-seating.js

KIỂM TRA
1. Cấu hình câu “Bạn có xác nhận tham gia?”:
   - “Có” -> Chọn ghế
   - “Không” -> Kết thúc form
2. Gửi “Không”: phải hiện trang gửi thành công, không mở Seat Studio.
3. Kiểm tra submission: seatSelectionRequired=false, seatStatus=not-required.
4. Gửi “Có”: phải mở Seat Studio bình thường.
5. Hai người chọn cùng một ghế: chỉ người xác nhận trước giữ ghế.
