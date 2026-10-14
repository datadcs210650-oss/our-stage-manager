# OSC — Hướng dẫn nghiệm thu và an toàn triển khai Drive V2 + Chức vụ học kỳ

## 1. Mục tiêu triển khai
- Mã quyền Firestore `superadmin` không đổi, nhãn UI là **Chủ tịch**. Admin có chức danh tùy chỉnh.
- Các tài khoản BCN/Admin/Chủ tịch liên kết Google Drive **riêng từng người**. Không dùng token toàn cục để thực hiện thao tác V2.
- Link học kỳ là duy nhất; Chair thay đổi khi cần; hệ thống V2 chỉ đọc thư mục hiện hành. Drive cũ không tự xóa/di chuyển.
- Tên email chủ sở hữu Gmail CLB được lưu riêng (không nhất thiết trùng tài khoản Google Chair). Các thư mục phải thuộc **My Drive**; Shared drives áp dụng cơ chế dung lượng khác.
- File 100 MiB trở xuống được tải trực tiếp từ trình duyệt đến Google Drive bằng token thành viên; file lớn hơn được dẫn đến đúng folder trên Drive.
- MSSV, chức vụ và học kỳ được ghi trong hồ sơ; `users/{uid}/oscPositionHistory/{SP26|SU26|FA26}` lưu bản ghi nhiệm kỳ.
- Bàn giao Chủ tịch là yêu cầu/tiếp nhận xác thực gần đây, đổi quyền bằng giao dịch Firestore và thu hồi phiên Firebase.

## 2. Các bước quản trị bắt buộc trên Google Cloud (không thể tự động làm chỉ bằng code)
1. Mở **Google Cloud Console → APIs & Services** (hoặc Google Auth Platform), kiểm tra **Google Drive API** enabled.
2. Kiểm tra OAuth Client tại `DRIVE_OAUTH_CLIENT_ID` / `DRIVE_OAUTH_CLIENT_SECRET` trên Vercel; redirect URI được cho phép phải khớp `https://ourstageclubmanager.vercel.app/api/operations?action=drive-callback`.
3. Xác minh trạng thái OAuth Consent Screen, quyền Drive `https://www.googleapis.com/auth/drive`, người dùng thử nghiệm (nếu vẫn là Testing), yêu cầu xác minh ứng dụng và khả năng bị Google giới hạn. Scope Drive toàn phần là **restricted**, chỉ cấp sau khi từng tài khoản đồng ý.
4. Không gửi Client Secret hoặc Encryption Key vào chat, GitHub, logs hay file công khai.
5. Người dùng **phải đồng ý cấp quyền Drive**, ngoài Firebase Google Login; không có cơ chế tự cấp quyền cho họ.

## 3. Firebase/Vercel
- Kiểm tra Firebase Authentication Google Provider (nếu dùng Google Sign-In). Không bắt buộc tạo dự án mới.
- Kiểm tra và publish Firestore Rules hiện hành. Các collection nhạy cảm `driveHubUserTokens`, `driveHubOAuthStates`, `driveHubUploadSessions`, `driveHubAuditV2`, `oscMssvOwners`, `oscLeadershipHandoff`, `oscLeadershipAudit` và subcollection `oscPositionHistory` phải deny client direct reads/writes; chỉ backend Admin SDK thao tác.
- Chưa xác nhận được Rules đã triển khai thực tế từ môi trường này.
- Đảm bảo các biến môi trường OAuth, `DRIVE_TOKEN_ENCRYPTION_KEY` AES-256 (32 bytes base64), Firebase Admin SDK tồn tại trên Vercel. Không tự đổi key mã hóa sau khi đã có token.
- Cập nhật GitHub có triển khai Vercel tự động. Xác minh commit SHA preview/production trùng GitHub, GitHub Actions pass; kiểm tra logs thực tế.

## 4. Kịch bản nghiệm thu thực tế bắt buộc
1. Gmail CLB tạo thư mục `FA26` trong My Drive (Restricted), chia sẻ BCN Viewer, BCN Editor và Chủ tịch Editor; Chair liên kết thư mục bằng đúng Gmail CLB owner.
2. BCN chưa liên kết OAuth: trang yêu cầu kết nối; không cấp link hoặc danh sách tài liệu.
3. BCN không được chia sẻ thư mục: Google trả 403/404; không hiển thị link và dữ liệu.
4. BCN Viewer: liệt kê file, có link xem, không có quyền tạo thư mục/upload/share nếu Google canShare=false.
5. BCN Editor: tạo folder lồng nhiều cấp, upload file nhỏ, mở Drive xác nhận chính xác `parents` và file thuộc tài khoản cá nhân; quota bị trừ đúng tài khoản tạo file.
6. Tệp 120 MB: website từ chối upload, đưa link đúng thư mục đang mở. Tài khoản Viewer không thấy nút upload.
7. Chế độ nội bộ: mời email ngoài OSC bị từ chối từ backend; chuyển chính sách cho phép ngoài và cấp Viewer/Commenter/Editor theo Google, kiểm tra canShare.
8. Tắt công khai trong OSC: không có chức năng cấp liên kết mới; **quyền công khai cũ trên Google Drive không tự bị thu hồi**. Cần chủ sở hữu rà soát ACL.
9. Chủ tịch đổi liên kết kỳ: phải xác minh lại owner Gmail CLB; Drive cũ không bị thay đổi; OSC V2 đọc root mới và upload session cũ không được xác nhận như phiên hiện hành.
10. Tạo tài khoản mới có MSSV/ chức danh/ học kỳ, sửa thông tin và xem lịch sử kỳ; MSSV trùng bị HTTP 409; kỳ cũ vẫn giữ.
11. Khi BCN kết thúc: dùng **Chỉnh sửa → Khóa**, không xóa hồ sơ có lịch sử. Kiểm tra người đã khóa không truy cập API.
12. Bàn giao Chủ tịch: người nhận cần email Firebase verified và đăng nhập gần đây (trong 10 phút), tự xác nhận trong 30 phút; tài khoản cũ bị hạ quyền, cả hai đăng nhập lại, tài liệu Drive vẫn do người tải lên sở hữu.
13. Room Booking: Admin vẫn tạo booking bình thường, nhưng chỉ Chủ tịch được cấu hình slot, cả UI và API.
14. Regression test hệ thống cũ: đăng nhập, hồ sơ thành viên, điểm danh, sự kiện, QR, thu chi, Ticket Studio, nhập/xuất file, chức năng lịch phòng.

## 5. Những rủi ro chưa thể cam kết loại trừ
- Google scope `drive` yêu cầu xác minh và có thể bị từ chối cấp quyền cho BCN ngoài danh sách thử nghiệm; xác thực OAuth multi-account chưa được kiểm tra trong CI.
- Sharing policy của OSC không thể kiểm soát thao tác chia sẻ qua Drive trực tiếp; quyền công khai đã tồn tại phải được owner rà soát.
- Chỉ My Drive thông thường có mô hình file do người tạo sở hữu và chiếm dung lượng họ. Shared drives Google Workspace khác.
- Mở tệp rất lớn bằng link Drive là lựa chọn vận hành; không thay đổi quota/ngưỡng API của Google.
- Hệ thống vẫn tồn tại CSP `unsafe-inline` từ mã HTML cũ. Cần đợt refactor riêng để triển khai CSP nonce/hash và giảm phụ thuộc CDN.
- Tính năng lịch sử tài khoản bảo vệ bản ghi có MSSV khỏi xóa cứng; nếu tài khoản từng bị xóa trước đợt triển khai thì không thể khôi phục lịch sử không còn trong cơ sở dữ liệu.
- Không có cơ sở để bảo đảm 100% không có lỗ hổng hay lỗi khi chưa kiểm thử E2E Google Drive và quy tắc Firebase trên production.

## 6. Rollback
- Mã Production trước PR dự án: commit `b30e91a34f6086fca560d000b626f51b8a7dde75`.
- Nếu bản mới gây lỗi, revert merge commit/roll back deployment Vercel sau khi đánh giá dữ liệu; **không xóa collection/token mới hay chuyển file Google Drive** chỉ để rollback mã.
- Không thay đổi email owner, khóa mã hóa hoặc revoke tất cả người dùng trong bước rollback nếu chưa có phương án dự phòng.
