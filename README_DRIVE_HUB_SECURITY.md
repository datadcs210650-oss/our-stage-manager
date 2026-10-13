# OSC Drive Hub — hướng dẫn kích hoạt và bảo mật

## Trạng thái triển khai
Mã nguồn giao diện, API và kết nối Google Drive đã có trong repo; **không tự động có quyền với Drive cá nhân**. Hệ thống chỉ hoạt động sau khi Super Admin cấu hình OAuth của Google và cấp quyền trong trình duyệt.

## Kiến trúc
- Drive là nơi lưu file gốc, không lưu byte tệp trên Firestore hoặc Vercel.
- Super Admin kết nối tài khoản Google cá nhân, refresh token được mã hóa AES-256-GCM bằng khóa riêng trên Vercel.
- Firebase Auth ID token, hồ sơ Firestore `users/{uid}` và vai trò Admin/Super Admin được kiểm tra tại API.
- Drive API dùng phạm vi `https://www.googleapis.com/auth/drive.file` để giới hạn tác động đến các tài liệu do OSC tạo hoặc được người dùng cấp quyền.
- Hồ sơ học kỳ: `driveHubSemesters/{semester}`; sự kiện: `driveHubEvents/{eventId}`; file metadata: `driveHubFiles/{fileId}`.
- Các collection này nên **để Firestore client deny toàn bộ**; chỉ Firebase Admin SDK được phép truy cập.
- Mỗi học kỳ được đặt vào một folder của Drive tổng; mỗi sự kiện có folder con gồm Kế hoạch sự kiện, Content truyền thông, Thiết kế & Media, Kịch bản & Tài liệu, Báo cáo & Recap. Có thể thêm danh mục.
- Các tệp lớn được chuyển từ trình duyệt trực tiếp đến một Google resumable upload session đã được cấp bởi API. URL phiên upload là bearer capability cực kỳ nhạy cảm; không ghi log, lưu cache hoặc chia sẻ.
- Giới hạn mỗi tệp là 500 MB; giao diện sẽ hướng dẫn tải trực tiếp lên Google Drive nếu yêu cầu vượt giới hạn hoặc bị trình duyệt/Google từ chối.
- Mọi thao tác trên menu Kho tài liệu hiện chỉ dành cho Admin/Super Admin. BCN chưa được cấp quyền truy cập, theo nguyên tắc mặc định từ chối.

## Bước cấu hình bắt buộc trên Google Cloud
1. Tạo hoặc chọn một Google Cloud Project riêng cho OSC (không dùng khóa Firebase Service Account để truy cập My Drive cá nhân).
2. Bật Google Drive API.
3. Tạo OAuth consent screen, xác định loại người dùng (tài khoản Gmail cá nhân thường là External), thiết lập Test users hoặc xuất bản theo chính sách Google.
4. Tạo OAuth Client loại Web application và khai báo Authorized redirect URI **chính xác**:
   `https://ourstageclubmanager.vercel.app/api/operations?action=drive-callback`
5. Không chèn Client Secret, refresh token, encryption key vào JavaScript, GitHub hay form công khai.

## Biến môi trường trên Vercel (Production)
- `DRIVE_OAUTH_CLIENT_ID`: OAuth client ID.
- `DRIVE_OAUTH_CLIENT_SECRET`: OAuth client secret.
- `DRIVE_TOKEN_ENCRYPTION_KEY`: khóa bí mật ngẫu nhiên 32 byte, base64. Tạo bằng `openssl rand -base64 32` trên máy cá nhân. Không đưa giá trị cho người khác.
Đặt cả ba giá trị ở Vercel → Project → Settings → Environment Variables, target Production; redeploy sau khi thiết lập. Không đưa những giá trị bí mật vào chat.

## Sử dụng
1. Đăng nhập OSC với tài khoản Super Admin → Kho tài liệu → Kết nối Google.
2. Đồng ý cấp phạm vi Drive đã khai báo, dùng **đúng tài khoản Google sở hữu kho tài liệu**. OSC tạo kho gốc trong Drive nếu chưa có.
3. Thiết lập thư mục cho học kỳ, để trống nếu muốn OSC tự tạo trong kho gốc.
4. Admin/Super Admin tạo kho cho từng sự kiện từ Cổng sự kiện, thêm danh mục, xem danh sách file.
5. Tải file → trình duyệt kết nối phiên resumable upload → API kiểm tra file trên Drive và ghi metadata sau khi thành công.

## Bảo mật cần theo dõi
- Không đặt thư mục tổng ở chế độ “Bất kỳ ai có liên kết”.
- Bật MFA cho Google của chủ kho và tài khoản Admin/Super Admin OSC.
- Khi đổi người quản trị, thực hiện quy trình chuyển quyền; ứng dụng hiện **không** tự động di chuyển file giữa hai chủ sở hữu khác nhau.
- Xóa/khoá tài khoản OSC phải lập tức ngăn thao tác API sau đó; phiên upload đã cấp là quyền tạm thời với thời hạn riêng của Google.
- Không đổi `DRIVE_TOKEN_ENCRYPTION_KEY` nếu chưa có quy trình chuyển mã hóa token đã lưu.
- Kiểm tra lịch sử truy cập và Google OAuth app định kỳ.
- Quy trình upload trực tiếp còn cần E2E trên tài khoản Google đã cấp quyền thực tế; syntax check và deploy READY không chứng minh thành công khi mạng yếu/CORS/Google quota.
- Tránh dùng file HTML/JS/script có khả năng thực thi; upload validator chặn các đuôi nguy hiểm được biết đến, nhưng không thay thế quét malware.
