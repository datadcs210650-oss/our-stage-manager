OUR STAGE CLUB MANAGER V42 — MODAL LAYOUT FIX

MỤC TIÊU
Sửa lỗi giao diện như ảnh:
- Cửa sổ Tạo/Chỉnh sửa Cổng sự kiện bị sidebar đè lên.
- Topbar / workspace nằm trên modal.
- Nội dung modal dài làm nút Lưu bị mất phía dưới.
- Modal trên màn hình nhỏ dễ tràn ngang.

NGUYÊN NHÂN
Overlay cũ dùng z-index: 50.
Trong giao diện mới:
- Sidebar: z-index 120.
- Topbar: z-index 70.
Vì vậy sidebar và topbar nằm TRÊN modal.

V42 SỬA
1. Modal/Overlay dùng layer riêng z-index 10000.
2. Backdrop phủ TOÀN BỘ sidebar, topbar và nội dung phía sau.
3. Event Builder có cửa sổ riêng tối đa 1080px, luôn nằm trong viewport.
4. max-height dựa trên 100dvh nên không tràn ra ngoài màn hình.
5. Header modal sticky: nút X luôn nhìn thấy.
6. Footer modal sticky: Hủy / Lưu luôn nhìn thấy.
7. Chỉ nội dung bên trong modal cuộn.
8. Khi modal mở, trang phía sau bị khóa scroll.
9. Escape đóng lớp modal trên cùng.
10. Preview / Custom Export tiếp tục nằm trên Event Builder.
11. Mobile <=760px tự chuyển form về 1 cột và modal gần full-screen.
12. Toast luôn nằm trên modal.
13. Không thay đổi dữ liệu, Firebase Auth, Firestore hoặc quyền truy cập.

FIRESTORE RULES
V42 KHÔNG THAY ĐỔI FIRESTORE RULES.
Theo yêu cầu, package V42 KHÔNG chứa file Firestore Rules.
Giữ nguyên Rules hiện tại đang chạy trên Firebase.

CẬP NHẬT
- Thay toàn bộ package V42 lên GitHub.
- Không cần vào Firebase Rules.
- Chờ Vercel Ready.
- Command + Shift + R.

RÀ SOÁT
- JavaScript syntax.
- Duplicate HTML ID.
- Event Builder modal class.
- Modal z-index > Sidebar/Topbar.
- Sticky header/footer.
- Mobile one-column layout.
- Không có Firestore Rules trong package.
