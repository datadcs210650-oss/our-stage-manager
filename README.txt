OUR STAGE CLUB MANAGER V32 — QR SINGLE HARD FIX + DOWNLOAD

SỬA TRIỆT ĐỂ LỖI 2 MÃ QR
- Nguyên nhân thực tế: QRCode.js tạo canvas và sau đó có thể tạo thêm img fallback bất đồng bộ.
- V31 chỉ ẩn/xóa tại thời điểm render nên img fallback vẫn có thể xuất hiện sau.
- V32 xử lý 3 lớp:
  1. CSS ép mọi img bên trong QR container display:none!important.
  2. JavaScript xóa mọi img fallback và canvas dư.
  3. MutationObserver theo dõi trong 3 giây đầu để xóa img xuất hiện trễ.
- Kết quả: trong modal chỉ có đúng MỘT canvas QR.

TẢI MÃ QR
- Trong modal QR có nút “Tải QR PNG”.
- Danh sách QR cũng có nút “Tải QR”.
- File tải xuống là PNG 900x900.
- Tên file gồm hoạt động + học kỳ, ví dụ:
  QR_Dau_Ky_FALL_2026.png
- QR tải về dùng đúng URL:
  /diem-danh?token=...&semester=FA26

VẪN GIỮ
- Đóng QR = link hết hiệu lực ngay nhưng giữ lượt gửi.
- Xóa QR = xóa vĩnh viễn QR và toàn bộ check-in.
- QR đúng học kỳ.
- Real-time lượt gửi.
- Học kỳ khóa thì QR không nhận check-in mới.
- Logo giữ nguyên.

FIRESTORE
- Không thay đổi quyền so với V31.
- Không bắt buộc Publish Rules V32 nếu Rules V31/V30 đang chạy đúng.

CẬP NHẬT
1. Commit toàn bộ package V32 lên GitHub.
2. Chờ Vercel Ready.
3. Không cần đổi Firestore Rules nếu đang dùng V31/V30.
4. Bấm Command + Shift + R.
5. Nếu vẫn thấy 2 QR, mở DevTools/Application và Clear site data một lần vì bản CSS cũ có thể đang bị browser cache.
