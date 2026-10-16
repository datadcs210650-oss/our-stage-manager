# OSC Drive Hub — hướng dẫn kích hoạt và bảo mật

## Trạng thái triển khai
Mã nguồn giao diện, API và kết nối Google Drive đã có trong repo; **không tự động có quyền với Drive cá nhân**. Hệ thống chỉ hoạt động sau khi Super Admin cấu hình OAuth của Google và cấp quyền trong trình duyệt.

## Kiến trúc
- Drive là nơi lưu file gốc, không lưu byte tệp trên Firestore hoặc Vercel.
- Super Admin kết nối tài khoản Google cá nhân, refresh token được mã hóa AES-256-GCM bằng khóa riêng trên Vercel.
- Firebase Auth ID token, hồ sơ Firestore `users/{uid}` và vai trò Admin/Super Admin được kiểm tra tại API.
- Drive API mặc định dùng phạm vi `https://www.googleapis.com/auth/drive.file`, giới hạn quyền với file do ứng dụng tạo hoặc được chọn/cấp quyền cho ứng dụng.
- **Thư mục do người khác sở hữu:** Chủ sở hữu chia sẻ thư mục cho Gmail đã kết nối OSC với vai trò **Editor (Người chỉnh sửa)**. Để liên kết một thư mục có sẵn chỉ bằng URL, Super Admin cần chủ động bấm **Kết nối thư mục chia sẻ**, đồng ý cảnh báo và cấp phạm vi `https://www.googleapis.com/auth/drive` trong trang Google. Phạm vi này có thể truy cập Drive rộng hơn thư mục OSC, nên **khuyến nghị dùng tài khoản Google riêng cho CLB** và quản lý bảo mật nghiêm ngặt.
- Không cần chuyển quyền sở hữu Drive cho Super Admin. Quản trị OSC và quyền sở hữu Google Drive là hai hệ thống phân quyền độc lập.
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
2. Đồng ý cấp phạm vi Drive đã khai báo, dùng đúng tài khoản Google **có quyền chỉnh sửa kho tài liệu** (không bắt buộc là chủ sở hữu). OSC tạo kho gốc trong Drive nếu chưa có.
3. Nếu dùng thư mục có sẵn thuộc Drive khác, Super Admin chọn **Kết nối thư mục chia sẻ** để cấp quyền ứng dụng, sau đó dán link thư mục và bấm **Thiết lập thư mục học kỳ**. Nếu để trống, OSC tự tạo trong kho gốc.
   - Lưu ý: Google có thể yêu cầu thêm OAuth test users/verification đối với phạm vi `drive` (sensitive/restricted). Đây là chính sách của Google, không phải lỗi website; chỉ cấp phép cho tài khoản phù hợp.
   - Nếu thấy lỗi **404**, kiểm tra URL thư mục còn tồn tại, Gmail đã được chia sẻ quyền Editor và đã kết nối ở chế độ phù hợp. **403** thường là thiếu quyền thao tác hoặc chính sách Drive chặn.
   - Chỉ Google mới xác nhận được quyền thư mục thực tế; thông báo “Đã cấp quyền Google” không chứng minh đường dẫn học kỳ còn truy cập được.
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


## Kiểm tra sau cập nhật 14/10/2026
- [ ] `node --check lib/osc-drive.js && node --check lib/drive-hub-handler.js && node --check lib/drive-oauth-handler.js && node --check drive-hub.js`
- [ ] `node --test tests/drive-hub.test.js` (cần `npm install` nếu thiếu firebase-admin)
- [ ] Super Admin xác nhận lại OAuth trên **đường dẫn Production chính thức**; preview Vercel không phải callback origin đăng ký.
- [ ] Thử thư mục **không thuộc sở hữu** người kết nối nhưng đã chia sẻ Editor: tạo thư mục con, liệt kê, tải file, xác nhận file nằm trong đúng folder.
- [ ] Thử link bị xóa, Viewer, chưa chia sẻ, token bị thu hồi: website phải báo rõ, không âm thầm hiển thị dữ liệu trống.
- [ ] Kiểm tra tính năng học kỳ, sự kiện, danh mục và upload với tài khoản Admin; BCN và người chưa đăng nhập không được xem/tạo kho.
- [ ] Trước khi triển khai production, xác nhận bản preview Vercel **READY**. Sau khi triển khai, xác nhận OAuth hoạt động thật và ghi nhận lỗi runtime nếu có.


## Cập nhật quản lý Google Drive — 14/10/2026
- **Kho Drive tổng:** tab riêng duyệt tệp và thư mục trực tiếp bên trong folder OSC kết nối, kể cả file đã được tải lên bằng Drive (phụ thuộc phạm vi OAuth). Super Admin được tạo thư mục, tải lên và đổi tên; Admin được xem.
- **Thư mục gốc học kỳ:** tab riêng duyệt trực tiếp folder học kỳ đã liên kết (kể cả khi nằm bên ngoài folder OSC tổng), khác với các danh mục và kho sự kiện. Đây là nơi kiểm tra được thư mục con đang nằm ở đâu.
- Trong mỗi thư mục có nút **Sao chép link**, **Mở Google Drive**, **Tạo thư mục con**, **Đổi tên** tệp/thư mục. Tệp được mở trên Google Drive (không tự động phân tích nội dung hoặc sao chép byte vào Vercel/Firestore).
- Tạo thư mục mới luôn gọi Google Drive với `parents: [ID thư mục đang mở]`; sau khi tạo, server truy vấn lại metadata và **báo lỗi nếu Google không xác nhận đúng cha**. Chức năng tạo mới không tự chuyển vào thư mục con hoặc tái sử dụng tên trùng.
- Đổi tên file chỉ gửi `name` bằng PATCH, không đưa vào `addParents/removeParents`; server bắt buộc kiểm tra file là con trực tiếp của thư mục đang mở và `capabilities.canRename` là true. Đổi tên danh mục OSC có cập nhật tên danh mục trong Firestore, giữ nguyên ID và link.
- Lưu ý quyền: OAuth giới hạn `drive.file` có thể không đọc các file do người khác tạo/tải trực tiếp vào Drive. Muốn xem toàn bộ file được chia sẻ, cần Super Admin cấp quyền **Kết nối thư mục chia sẻ** (`drive` scope) và tài khoản Google phải có quyền tương ứng.
- API và giao diện không tự xóa, di chuyển hay sửa quyền chia sẻ của tệp. Nếu Drive trả lỗi vị trí sai, hãy kiểm tra nơi Google thực tế đã lưu trước khi tạo lại.

### Bài kiểm tra cần chạy trên Drive thật
1. Vào Kho Drive tổng, mở thư mục mẹ A, tạo thư mục con B; bấm B tạo C, xác nhận A/B/C trên Google Drive (không có C đứng ngang hàng B).
2. Sao chép link B, mở đường dẫn từ OSC và kiểm tra Google Drive xác định đúng thư mục.
3. Đổi tên B, đổi tên một tài liệu trong B; kiểm tra link/ID và vị trí không thay đổi.
4. Truy cập tab Thư mục gốc học kỳ và kiểm tra những file Google Docs/PDF đã được đưa vào Drive từ bên ngoài OSC; nếu bị thiếu, kiểm tra OAuth scope.
5. Cố đổi tên tệp ngoài phạm vi được chọn bằng ID thủ công, tài khoản Viewer hoặc BCN: phải bị từ chối.
6. Kiểm tra GitHub Actions thành công, Vercel preview READY, cuối cùng kiểm tra Production sau merge.

