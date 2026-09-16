OUR STAGE CLUB MANAGER V28 — SIDEBAR SCROLL

ĐÃ SỬA SIDEBAR
- Logo/thương hiệu luôn ở trên.
- Toàn bộ danh sách menu nằm trong vùng cuộn riêng.
- Có thanh scrollbar ở cạnh phải của menu.
- Hỗ trợ con lăn chuột, trackpad Mac và kéo thanh cuộn.
- Học kỳ + Đăng xuất luôn nằm cố định phía dưới và không còn che các mục menu.
- Khi mở một mục, menu tự cuộn để giữ mục đang chọn trong vùng nhìn thấy.
- Các mục như Chờ duyệt, Nhật ký & Import, Thùng rác, Tài khoản BCN, Thiết lập giờ bấm được dễ dàng.

MÀN HÌNH NHỎ
- Với chiều rộng <= 1000px, sidebar trở lại cuộn theo trang để tránh hai vùng cuộn chồng nhau.

FIREBASE
- V28 chỉ sửa giao diện/UX.
- Không thay đổi cấu trúc dữ liệu.
- Không cần cập nhật Firestore Rules nếu Rules V27 của bạn đang hoạt động.
- Không thay đổi logo.

CẬP NHẬT
1. Commit toàn bộ package V28 lên GitHub.
2. Chờ Vercel deploy Ready.
3. Không cần thay Firestore Rules.
4. Bấm Command + Shift + R sau khi deploy.

---

OUR STAGE CLUB MANAGER V27 — COMPLETE SUITE

ĐÃ TRIỂN KHAI NHÓM TIỆN ÍCH TOÀN DIỆN
- Dashboard tổng quan + thao tác nhanh + biểu đồ tỷ lệ tham gia/thu chi + checklist.
- Cần chú ý cá nhân: cảnh báo dữ liệu, quỹ, phản hồi sự kiện, thông báo.
- Audit Log + lịch sử Import + hoàn tác cho điểm/quỹ/giao dịch.
- Thùng rác 30 ngày + khôi phục thành viên/giao dịch/sự kiện/phản hồi.
- Tìm kiếm toàn hệ thống + Command Palette ⌘K.
- Trung tâm thông báo.
- Nhân bản học kỳ + khóa dữ liệu học kỳ; chỉ Super Admin mở khóa.
- Mẫu sự kiện: Casting, Đóng quỹ, Workshop, Đăng ký sự kiện, Bình chọn.
- QR điểm danh có thời gian hiệu lực + Admin/BCN duyệt trước khi tính điểm.
- Import thành viên thông minh: tự map cột, cho map thủ công, lưu mapping, lịch sử import.
- Bộ lọc nâng cao + lưu bộ lọc.
- Tag thành viên + hồ sơ Timeline + ghi chú nội bộ.
- Cảnh báo dữ liệu trùng/thiếu và checklist sức khỏe dữ liệu.
- Chế độ chờ duyệt cho xóa thành viên/xóa giao dịch/import điểm danh hàng loạt của BCN.
- Preset phân quyền BCN.
- Menu yêu thích cá nhân.

KHÔNG CÓ KẾ HOẠCH CÔNG VIỆC / TASK.

DEPLOY
1. Commit toàn bộ package lên GitHub.
2. Chờ Vercel Ready.
3. Firebase > Firestore Database > Rules: Publish firestore_rules_v27.rules.
4. Command + Shift + R.

ROUTE MỚI
/diem-danh?token=...

LƯU Ý
- Tính năng QR dùng Firestore, không cần Firebase Storage/Blaze.
- Các thao tác xóa nhạy cảm đã chuyển sang Thùng rác/Approval thay vì mất ngay.
