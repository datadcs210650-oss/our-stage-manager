OUR STAGE CLUB MANAGER — V94 TICKET STUDIO GATING + NAMED EVENT LINKS + EVENT SECURITY

1. TICKET STUDIO THEO TỪNG SỰ KIỆN
- Event Builder có thêm công tắc "Ticket Studio".
- Chỉ sự kiện có ticketStudioEnabled=true mới xuất hiện trong Ticket Studio.
- Nút Ticket Studio trên thẻ sự kiện chỉ hiện khi sự kiện đã bật Ticket Studio.
- API Ticket Studio cũng kiểm tra cờ này; không thể truy cập bằng cách gọi API trực tiếp nếu sự kiện chưa bật.
- Tắt Ticket Studio sẽ làm link nhận vé của sự kiện không còn sử dụng được cho tới khi bật lại.

2. XÓA MẪU VÉ
- Ticket Studio có nút "Xóa mẫu vé đã upload".
- Xóa mẫu sẽ:
  + xóa backgroundDataUrl,
  + reset kích thước/bố cục về mặc định,
  + tự đóng cổng nhận vé,
  + giữ nguyên danh sách vé đã tạo.

3. LINK CỔNG SỰ KIỆN CÓ TÊN SỰ KIỆN
- Link mới có dạng:
  /su-kien/<ten-su-kien>?event=<eventId>
- Vercel rewrite /su-kien/:slug -> /su-kien.html.
- Tab trình duyệt tự đổi thành "<Tên sự kiện> • Our Stage".
- Link cũ /su-kien?event=<eventId> vẫn tiếp tục hoạt động.

4. TĂNG CƯỜNG BẢO MẬT CỔNG ĐĂNG KÝ
- Tất cả phản hồi public, kể cả sự kiện không dùng ghế, đều đi qua /api/event-seating.
- Không còn ghi trực tiếp submission từ browser vào Firestore.
- Server kiểm tra:
  + trạng thái mở/đóng và lịch mở cổng,
  + học kỳ bị khóa,
  + field ID lạ,
  + email/MSSV/điện thoại/số,
  + radio/select/checkbox có đúng option đã cấu hình,
  + kích thước payload,
  + rate limit theo thiết bị + IP,
  + Sec-Fetch-Site và Content-Type,
  + đích đến submit/chọn ghế.
- Sự kiện không bật ghế mặc định kết thúc form sau khi gửi.
- Nếu option bắt buộc đi tới Chọn ghế nhưng sự kiện chưa bật sơ đồ ghế, server từ chối thay vì tạo trạng thái sai.

5. FIRESTORE RULES
- Thêm firestore_rules_v94.rules.
- Direct public create vào eventPortals/{eventId}/submissions/{sid} bị tắt.
- Public registration phải đi qua trusted Vercel API dùng Firebase Admin SDK.
- Admin/BCN manual submission và restore vẫn giữ quyền theo rule hiện có.

FILES
- index.html
- su-kien.html
- ticket-studio-admin.js
- api/ticket-studio.js
- api/event-seating.js
- vercel.json
- firestore_rules_v94.rules

LƯU Ý TRIỂN KHAI
- Vercel sẽ nhận code từ GitHub main theo cấu hình dự án.
- Repo hiện không có GitHub Actions deploy Firestore Rules.
- Để lớp bảo mật Firestore V94 có hiệu lực thực tế, cần publish nội dung firestore_rules_v94.rules vào Firebase Firestore Rules.
