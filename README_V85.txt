OUR STAGE CLUB MANAGER V85 — EMAIL CENTER / RESEND
=================================================

MỤC TIÊU
- Xác nhận đăng ký sự kiện sau khi Admin duyệt.
- Nhắc lịch sự kiện do Admin chủ động thiết lập/chọn người nhận.
- Xác nhận đã đóng quỹ sau khi Admin duyệt/đánh dấu thủ công.
- Email Rule Builder, Template Email, Email Queue.
- Gửi ngay / chỉ lưu hàng đợi / lên lịch gửi / hủy lịch.
- Gửi thử, gửi lại email lỗi.
- Theo dõi Delivered / Bounced / Complained / Failed / Suppressed bằng Resend Webhook.
- Blacklist email lỗi nhiều lần.
- Chống gửi trùng, cooldown cùng người nhận, giới hạn email/người/ngày và giới hạn toàn hệ thống/ngày.

NGUYÊN TẮC QUAN TRỌNG
1. Không có thao tác import/tải kết quả nào tự động gửi email.
2. Các thao tác nghiệp vụ hoàn tất trước; email là BƯỚC CUỐI và cần Admin xác nhận riêng.
3. Admin có thể bỏ qua email bằng nút “Không gửi”.
4. Admin được chọn/bỏ chọn người nhận và có thể thêm email thủ công.
5. RESEND_API_KEY và RESEND_WEBHOOK_SECRET chỉ nằm trong Vercel Environment Variables, không đưa vào GitHub/index.html.
6. Collections Email Center bị Firestore Rules chặn truy cập trực tiếp từ browser; Admin UI đi qua Vercel API có Firebase Admin xác thực.

FILES MỚI / THAY ĐỔI
- index.html
- package.json
- vercel.json
- lib/firebase-admin.js
- api/email-center.js
- api/resend-webhook.js
- firestore_rules_v85.rules

CẤU HÌNH VERCEL ENVIRONMENT VARIABLES
Bắt buộc:
- RESEND_API_KEY              = API key lấy từ Resend
- RESEND_FROM_EMAIL           = địa chỉ gửi thuộc domain đã verify, ví dụ no-reply@mail.tenmiencuaban.vn
- RESEND_WEBHOOK_SECRET       = signing secret của webhook Resend (whsec_...)

Tùy chọn:
- RESEND_FROM_NAME            = OUR STAGE CLUB

Giữ nguyên các biến Firebase Admin đang có:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

Sau khi thêm/sửa Environment Variables phải Redeploy Vercel.

CẤU HÌNH RESEND
1. Verify domain gửi trong Resend trước khi dùng production sender.
2. Tạo Webhook endpoint:
   https://ourstageclubmanager.vercel.app/api/resend-webhook
3. Chọn các event:
   - email.scheduled
   - email.sent
   - email.delivered
   - email.delivery_delayed
   - email.bounced
   - email.complained
   - email.failed
   - email.suppressed
4. Copy signing secret của webhook vào Vercel biến RESEND_WEBHOOK_SECRET.
5. Không đưa API key/webhook secret vào source code.

FIRESTORE RULES
Firebase Console -> Firestore Database -> Rules:
- thay rules hiện tại bằng firestore_rules_v85.rules
- Publish

V85 giữ toàn bộ rules cũ và bổ sung:
- các trường trạng thái duyệt đăng ký sự kiện;
- server-only deny cho emailTemplates/emailRules/emailQueue/emailBlacklist/emailRecipientState/emailDedupe/emailGlobalState/emailGlobalReservations/emailWebhookEvents/emailSettings.

HEALTH CHECK
Sau deploy mở:
- https://ourstageclubmanager.vercel.app/api/email-center
  Kỳ vọng: ok=true, version=85, configured=true sau khi có RESEND_API_KEY + RESEND_FROM_EMAIL.

- https://ourstageclubmanager.vercel.app/api/resend-webhook
  Kỳ vọng: ok=true, version=85, configured=true sau khi có RESEND_WEBHOOK_SECRET.

QUY TRÌNH TEST KHUYẾN NGHỊ
A. Gửi thử
1. Admin -> Email & Thông báo -> Gửi thử.
2. Chọn email của Admin.
3. Xác nhận gửi.
4. Kiểm tra Queue: Sent -> Delivered sau khi webhook về.

B. Duyệt đăng ký
1. Cổng sự kiện -> bật “Duyệt đăng ký + email”.
2. Một người đăng ký có email hợp lệ.
3. Admin -> Xem kết quả -> Duyệt đăng ký.
4. Nghiệp vụ được lưu trước.
5. Modal Email bước cuối xuất hiện.
6. Chọn/bỏ chọn người nhận -> Gửi ngay / Hàng đợi / Lên lịch -> Xác nhận.
7. Bấm “Không gửi” phải đóng modal mà không tạo email.

C. Nhắc lịch
1. Chỉnh sự kiện -> bật “Nhắc lịch email”.
2. Cài thời gian diễn ra + số phút nhắc trước + địa điểm.
3. Thẻ sự kiện -> Email nhắc lịch.
4. Chọn người nhận.
5. Lên lịch / Queue / Gửi ngay -> Xác nhận.
6. Email đã lên lịch có nút Hủy lịch trong Email Center.

D. Đóng quỹ
1. Admin đánh dấu một thành viên từ Chưa đóng -> Đã đóng hoặc duyệt form đóng quỹ.
2. Trạng thái đóng quỹ lưu trước.
3. Modal Email bước cuối xuất hiện.
4. Admin xác nhận mới tạo/gửi email.

E. IMPORT KHÔNG GỬI EMAIL
1. Thu Chi -> upload danh sách đóng quỹ.
2. Áp dụng danh sách.
3. Không được tự tạo/gửi email.
4. Nếu cần gửi, Admin chủ động dùng Email Center sau đó.

F. Anti-spam
- Gửi cùng trigger/context/template tới cùng email trong cửa sổ duplicate -> phải bị chặn.
- Gửi quá gần theo cooldown -> phải bị chặn.
- Đạt max/người/ngày -> phải bị chặn.
- Đạt giới hạn toàn hệ thống/ngày -> phải bị chặn.
- Lịch gửi tương lai được tính vào giới hạn của NGÀY GỬI, không phải ngày tạo lịch.

G. Webhook/Blacklist
- Delivered cập nhật Delivered.
- Bounced/Failed tăng bộ đếm lỗi.
- Complained hoặc Suppressed blacklist ngay.
- Đạt ngưỡng Bounce/Failed -> blacklist.
- Admin có thể gỡ blacklist thủ công.

H. Retry / Cancel
- Failed -> Gửi lại.
- Scheduled -> Hủy lịch.
- Cancel phải xóa reservation/dedupe liên quan để có thể lên lịch lại hợp lệ.

THIẾT LẬP CHỐNG SPAM MẶC ĐỊNH
- Email trùng: 30 phút
- Cooldown cùng người: 5 phút
- Tối đa 5 email/người/ngày
- Bounce/Failed threshold: 2
- Tối đa 50 người/lần Admin xác nhận
- Giới hạn hệ thống: 90 email/ngày (Admin có thể chỉnh 1–100)

LƯU Ý LÊN LỊCH
- V85 chỉ chấp nhận lịch gửi sau hiện tại ít nhất 30 giây.
- Tối đa 30 ngày trước thời điểm gửi.
- Hệ thống đặt quota reservation theo ngày THỰC TẾ email sẽ được giao.

ROLLBACK / AN TOÀN NGHIỆP VỤ
- Nếu Email Center không mở được sau khi Admin duyệt đăng ký/đóng quỹ, nghiệp vụ đã lưu vẫn giữ nguyên và hệ thống báo riêng lỗi email.
- Email không được phép làm rollback trạng thái đăng ký hoặc đóng quỹ.
- Import không gọi Email Center.

