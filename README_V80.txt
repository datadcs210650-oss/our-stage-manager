OUR STAGE CLUB MANAGER V80 — EVENT CLOSE + MOBILE MENU FIX

1) Khi sự kiện bị ĐÓNG thủ công (isOpen=false):
- API link check-in từ chối cấu hình và lượt quét ngay lập tức.
- Trang /check-in-su-kien tự kiểm tra trạng thái khoảng 1.5 giây/lần.
- Nếu sự kiện bị đóng khi camera đang mở, camera tự dừng và trang báo link tạm ngưng.
- Mọi lượt quét đều kiểm tra lại trạng thái server, nên không có khoảng trống cho check-in sau khi đóng.
- Link không bị xóa; khi mở lại sự kiện, link active cũ dùng lại được.
- Không cho tạo link check-in mới khi sự kiện đang đóng.

2) Menu điện thoại:
- Sidebar dùng 100dvh và vùng menu cuộn độc lập.
- Bật touch pan-y + momentum scrolling.
- Phần chọn học kỳ/đăng xuất vẫn nằm cố định ở đáy sidebar.
- Khi menu mở, trang phía sau không cuộn; chỉ menu cuộn.

DEPLOY TỪ V79:
- Ghi đè index.html
- Ghi đè check-in-su-kien.html
- Ghi đè api/event-checkin.js
- Không cần đổi Firestore Rules V78.
- Không cần nhập lại Environment Variables.
- Sau deploy, hard refresh (Mac: Cmd+Shift+R, Windows: Ctrl+Shift+R).

TEST NHANH:
A. Mở sự kiện + link check-in -> trang quét hoạt động.
B. Giữ trang quét đang mở, quay lại Admin -> Đóng cổng.
C. Trong khoảng ~1.5 giây trang quét phải tự đóng camera và báo sự kiện đã đóng.
D. Thử quét trong lúc đóng -> API phải từ chối.
E. Mở lại sự kiện -> reload link cũ -> hoạt động lại.
F. Trên điện thoại -> mở hamburger -> vuốt lên/xuống đến hết toàn bộ menu.
