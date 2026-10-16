# OUR STAGE — Báo cáo rà soát bảo mật và hồi quy (14/10/2026)

## Phạm vi kiểm tra
- Đối chiếu mã nguồn tại repo `our-stage-manager`: `lib/firebase-admin.js`, `api/operations.js`, `lib/drive-*.js`, `lib/osc-drive.js`, các API tài khoản, sự kiện, check-in, chỗ ngồi, vé, `firestore_rules_v95.rules`, `vercel.json` và các script Room Booking / Drive Hub.
- Kiểm tra cú pháp mọi JavaScript ở root / `api/` / `lib/`, kiểm thử chức năng, và `npm audit --omit=dev --audit-level=high` qua GitHub Actions.
- Đây là **rà soát tĩnh và kiểm thử hồi quy có giới hạn**, chưa phải pentest hoàn chỉnh, chưa xác nhận được Firestore rules thực tế đang publish trên Firebase hay truy cập Google Drive của một tài khoản người dùng thực.

## Lỗi đã khắc phục
1. **Drive folder ID tampering (quyền truy cập):** API list, tạo thư mục con, tải tệp nhận `folderId` từ trình duyệt. Trước khi dùng ID đó, API xác minh từng cấp `parents` bằng Google Drive metadata, chỉ chấp nhận ID trong danh mục đã liên kết; chặn ID ngoài vùng, file giả thư mục, shortcut, node đã xóa, vòng lặp và độ sâu quá giới hạn. Chặn ở API, không chỉ ở frontend.
2. **Tạo thư mục con:** đưa vào tính năng đa cấp (12 cấp), đường dẫn breadcrumb, xem file và tải tệp vào thư mục đang mở. Nội dung tệp vẫn lưu ở Drive, không nằm trong Firestore.
3. **Nhập booking ngày đã qua:** các endpoint tạo một phòng / lập lịch tuần / sửa đều từ chối ngày trước hôm nay theo `Asia/Ho_Chi_Minh` (kể cả request tự chế từ ngoài trình duyệt). Lịch sử không thể được đổi thành booking mới. UI đặt `min` cho input ngày và vô hiệu nút thêm phòng ở ngày đã qua.
4. **Hồi quy tự động:** test bỏ qua máy người dùng và UTC khi xét ngày; test ancestry, shortcut, chuỗi ID, vòng lặp, folder ngoài danh mục, giới hạn cấp thư mục; syntax check tất cả API/browser scripts và quét lỗ hổng dependency mức high/critical.

## Đối chiếu các lớp bảo vệ đang có trong mã
- API Drive Hub gọi `requireUser` và giới hạn Admin/Super Admin; tạo kết nối Drive và đổi thư mục học kỳ chỉ cho Super Admin.
- `requireUser` ở Firebase Admin SDK đối chiếu ID token (bao gồm trạng thái revoked), hồ sơ `users/{uid}`, `active`, vai trò.
- Refresh token Google được mã hóa AES-256-GCM trước khi lưu; OAuth dùng nonce một lần kèm HttpOnly cookie. Tuyệt đối không ghi/log token hoặc upload session URL.
- `firestore_rules_v95.rules` kết thúc bằng deny-by-default; không có đường cho client trực tiếp vào collection `driveHub*`, `roomBookings`.
- `vercel.json` áp các header HSTS, anti-frame, no-store và CSP.

## Rủi ro còn tồn tại / việc quản trị bắt buộc
1. **Cao — Google OAuth scope `drive`:** khi Super Admin tự chọn chế độ thư mục chia sẻ, tài khoản Google cấp quyền rất rộng. Dùng tài khoản Google dành riêng cho OSC, bật MFA và chỉ chia sẻ các folder cần thiết. Chưa kiểm thử OAuth thực và quyền Editor end-to-end.
2. **Cao — Mật khẩu quản trị:** Admin/Super Admin có quyền cấp lại mật khẩu cho tài khoản cấp thấp theo thiết kế. Kiểm tra quy trình phê duyệt/nhật ký, bảo vệ đăng nhập MFA của Super Admin; hạn chế tài khoản Admin được cấp.
3. **Trung bình/Cao — Chính sách CSP có `unsafe-inline` và nhiều script CDN:** chưa thể xóa tùy tiện vì `index.html` vẫn chứa code nhúng; cần refactor JS ra file riêng, triển khai CSP nonce/hash và bỏ CDN không cần thiết trong đợt kế tiếp.
4. **Trung bình — Repository là public:** source không mặc nhiên là bí mật, nhưng công khai cấu trúc website giúp người ngoài nghiên cứu mặt tấn công. Cân nhắc chuyển private sau khi xác minh Vercel/GitHub integration; tuyệt đối không commit khóa Firebase service account, OAuth client secret, mã token hay dữ liệu thành viên.
5. **Chưa xác minh trên môi trường thật:** so sánh và publish Firestore rules đang dùng; Google OAuth test users/verification; độ an toàn của chức năng upload tệp lớn, thời gian sống resumable sessions và chia sẻ thư mục ngoài OSC.
6. **Rủi ro vận hành:** thao tác đổi folder học kỳ có dữ liệu sự kiện, quyền Drive bị thu hồi hay Google API quota cần thêm tình huống E2E và quy trình backup/rollback.

## Kiểm tra nghiệm thu
- Drive: tạo thư mục con → thư mục cháu → tải file → quay lại folder cha; thử gọi API folder ID của thư mục ngoài OSC (phải báo 403); thử Viewer, Google token bị thu hồi và link đã xóa.
- Booking: nhập hôm qua (UI bị chặn, API HTTP 422), hôm nay và ngày mai (được phép nếu hợp lệ); nhập cả tuần có một ngày đã qua (hủy toàn bộ); sửa booking lịch sử (không cho phép).
- Tài khoản: Super Admin/Admin hoạt động; BCN và người chưa đăng nhập không gọi được API Drive/booking thay đổi dữ liệu.
- Xác minh đúng commit được triển khai Production `READY` và kiểm tra thao tác trực tiếp trên website trước khi xem như hoàn tất E2E.

**Không có báo cáo nào có thể cam kết 100% không còn lỗ hổng hoặc không phát sinh lỗi.**
