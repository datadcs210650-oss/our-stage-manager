# OSC — Nghiệm thu chức vụ BCN / Hồ sơ thành viên & rà soát bảo mật (2026-10-15)

## Chức năng mới
1. **Menu Tài khoản BCN:** nhấn `Chức vụ & nhiệm kỳ` để quản lý chức danh theo từng kỳ thay cho tab riêng trong Kho tài liệu.
2. Chọn học kỳ, tài khoản, nhập MSSV trùng với MSSV tại Hồ sơ thành viên, chọn chức vụ trong danh mục; thao tác chỉ đổi chức vụ **hiển thị**, không nâng quyền Firestore.
3. Admin quản lý danh mục chức vụ học kỳ, bổ nhiệm BCN; chỉ Chủ tịch bổ nhiệm Admin/Chủ tịch. Việc bàn giao quyền Chủ tịch là quy trình riêng xác nhận hai phía.
4. **Hồ sơ thành viên:** khi mở cá nhân, hệ thống yêu cầu Vercel API `leadership-member-profile` để tra cứu chức vụ qua MSSV + mã học kỳ. Nếu chưa có bản ghi, giữ chức vụ cũ của hồ sơ hoặc hiển thị chưa được ghi nhận. Không ghi vào `members` khi đọc, không thay đổi học kỳ cũ. Lịch sử nhiệm kỳ và số kỳ tham gia được hiển thị bên dưới.
5. **Kho Google Drive:** chỉ còn duyệt Drive, giải thích 3 bước kết nối Google và các quyền Viewer/Editor; không còn màn hình chức vụ trong Kho tài liệu.

## Rà soát bảo mật
- `leadership-member-profile` phải có quyền Admin/Chủ tịch hoặc BCN với `viewMembers===true`. API chỉ trả lại chức vụ/MSSV/lịch sử, không trả token hay dữ liệu nhạy cảm ngoài yêu cầu.
- `assign` kiểm tra MSSV đã bị chiếm, tài khoản đang hoạt động, khóa chức danh Chủ tịch cho role không hợp lệ, và Admin không được sửa vai trò Chủ tịch/Admin. Mỗi thay đổi lưu `oscLeadershipAudit`.
- Reset mật khẩu người khác qua `api/account-password.js` yêu cầu người quản trị **đăng nhập trong 10 phút gần đây**, kiểm tra role được phép nhắm tới và ghi audit không lưu mật khẩu.
- Bộ `firestore_rules_v96.rules`: từ chối **tất cả client writes** vào `users/{uid}`. Toàn bộ tạo, sửa, khóa tài khoản và MSSV/chức vụ thực hiện thông qua Firebase Admin SDK sau khi API xác thực. Ngăn xóa trực tiếp một tài khoản có lịch sử BCN qua Firebase client; các collection nhạy cảm được chặn bởi default deny.
- **Quan trọng:** đưa file .rules vào GitHub **không** tự cập nhật Firebase Security Rules. Cần người quản trị triển khai phiên bản này trong Firebase Console sau khi kiểm tra trên emulator. Không tuyên bố đã triển khai Firestore Rules nếu chưa xác thực.
- Các chức năng Google Drive V2 dùng token mã hóa của từng người; tình trạng Google OAuth và quyền Google thực tế chưa thể kiểm thử tự động nếu chưa có tài khoản được chủ sở hữu Drive chia sẻ quyền.

## Kiểm thử nghiệm thu sau khi deploy
1. Mở **Tài khoản BCN** → **Chức vụ & nhiệm kỳ**, chọn FA26, bổ nhiệm tài khoản bằng MSSV khớp Hồ sơ thành viên.
2. Mở **Hồ sơ thành viên**, chọn sinh viên đó: chức vụ đúng FA26 và số kỳ trong lịch sử hiển thị; thử sinh viên khác cùng tên nhưng MSSV khác — không bị gán nhầm.
3. Thay đổi học kỳ SP27, gán chức vụ khác; trở lại FA26 — chức vụ trước vẫn giữ; lịch sử ghi nhận cả hai.
4. Admin chỉ có thể sửa BCN; BCN không thể truy cập menu quản trị; BCN chỉ có `viewMembers=false` không thể gọi API tra cứu chức vụ.
5. Đổi MSSV sang MSSV đã liên kết người khác — API từ chối; sửa một bản ghi chức vụ cũ — hiển thị xác nhận và tạo nhật ký.
6. Kiểm tra menu Kho tài liệu không còn tab Chức vụ, người chưa liên kết Google nhận hướng dẫn kết nối; Viewer không thể upload; Editor có thể upload dưới 100 MB.
7. Thử thao tác cũ: đăng nhập email/Google, danh sách thành viên, điểm danh, hồ sơ PDF, Room Booking, sự kiện, ticket, thu chi.
8. Kiểm tra GitHub CI và Vercel Preview/Production cùng SHA; thử responsive trên máy tính và điện thoại.

## Rủi ro đã nhận diện và giới hạn xác minh
- Browser-side rendering đang duy trì app cũ ~1 MB HTML, nhiều API/Firestore rules theo thời gian; không thể cam kết toàn bộ tính năng cũ đã được E2E kiểm tra chỉ dựa trên CI cú pháp + unit tests.
- Vercel không có môi trường Google Drive tài khoản thử nghiệm và không thể đọc trực tiếp Firebase Rules đã publish; bắt buộc test end-to-end với Admin, Chủ tịch, BCN có quyền Viewer/Editor và Gmail CLB.
- Security Headers cũ vẫn dùng CSP `unsafe-inline` cho HTML legacy. Đây là khoản nợ kỹ thuật bảo mật, cần refactor frontend để loại bỏ. Không tự siết CSP trong lần này vì có thể khiến login và các phần khác ngừng hoạt động.
- `GET /api/operations?action=drive-callback` cần cấu hình OAuth đã phê duyệt từ Google Cloud (scope `drive` bị restricted); bản build Vercel READY không xác minh quyền Google.
- Không tự sửa Google Drive, Firebase Rules đang chạy hoặc di chuyển file trong lần cập nhật giao diện này.

## Rollback
Nếu cần quay lại phiên bản trước thay đổi này, revert merge PR triển khai giao diện/chức vụ từ GitHub và redeploy. Không xóa `users`, `oscPositionHistory`, `oscMssvOwners` hoặc Drive. Dữ liệu chức vụ lưu mới vẫn được bảo toàn.
