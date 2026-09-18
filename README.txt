OUR STAGE CLUB MANAGER V46 — PERMISSION UI + DATE COLUMN + LOOKUP PRIVACY

SỬA DỨT ĐIỂM PHÂN QUYỀN BCN
Nguyên nhân giao diện bản trước có thể vẫn thấy menu:
V40 có CSS `.nav button[data-tab]{display:flex!important}` nên có thể thắng class `.hidden`.

V46:
- Có CSS riêng `.nav button[data-tab].hidden { display:none!important }`.
- JS đặt trực tiếp `display:none!important` cho menu/nút không được cấp quyền.
- Section không có quyền bị ẩn vật lý + inert.
- Workspace Dock loại bỏ cửa sổ không được phép.
- Global Search và Favorites không hiện module không được phép.
- Khi Admin thay đổi quyền BCN realtime, giao diện render lại ngay và dọn nội dung cũ.
- BCN có quyền Xem nhưng không Sửa chỉ thấy dữ liệu, không thấy nút thao tác.

THIẾT LẬP HOẠT ĐỘNG
Bảng hoạt động được làm lại thành 4 cột rõ ràng:
1. Tên hoạt động
2. Ngày hoạt động
3. Điểm
4. Xóa

Ngày hoạt động dùng input type=date, có lịch chọn ngày.
Dữ liệu cũ dd/mm/yyyy tự chuyển để hiển thị trong ô lịch và vẫn lưu tương thích dạng dd/mm/yyyy.

TRA CỨU THÀNH VIÊN
V46 KHÔNG HIỂN THỊ BẤT KỲ HOẠT ĐỘNG ĐỒNG HÀNH NÀO trên public:
- Không Form Đồng hành.
- Không Đã điền/Chưa điền.
- Không Tiếp tục/Dừng.
- Không tên hoạt động Đồng hành.
- Không điểm Đồng hành.

Hoạt động bình thường vẫn hiển thị.

MIGRATION V46
Admin đăng nhập lần đầu sẽ:
- Rà publicLookupSemesters của tất cả kỳ.
- Xóa toàn bộ activity row Đồng hành đã publish từ bản cũ.
- Xóa metadata continuation nếu từng bị publish nhầm.
- Không sửa dữ liệu quản trị nội bộ.
- Chạy một lần qua marker settings/privacyMigrationV46.

FIRESTORE RULES
V46 không thay đổi Firestore Rules.
ZIP không chứa file Rules.

CẬP NHẬT
1. Thay toàn bộ V46 lên GitHub.
2. Không cần Publish Firestore Rules.
3. Chờ Vercel Ready.
4. Command + Shift + R.
5. Đăng nhập ADMIN một lần để migration V46 chạy.
6. Đăng xuất, đăng nhập BCN giới hạn quyền để kiểm tra menu.
