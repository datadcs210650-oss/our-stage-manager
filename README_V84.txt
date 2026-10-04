OUR STAGE CLUB MANAGER V84 — STICKY COLUMN UX FIX

Mục tiêu:
- Sửa tình trạng người dùng không thấy chỗ chọn "Cố định cột" ngay cạnh bảng điểm danh.
- Làm cơ chế sticky cột ổn định hơn khi resize, đổi kích thước bảng và dữ liệu render lại.

Thay đổi:
1. Chuyển bộ chọn cố định cột ra một thanh riêng ngay phía trên bảng điểm danh.
2. Có trạng thái rõ ràng "Đang cố định đến: ..." và nút "Bỏ cố định".
3. Chọn MSSV => STT + Họ và tên + MSSV đứng yên, phần bên phải cuộn ngang.
4. Chọn bất kỳ cột nào => toàn bộ cột từ cột đó về bên trái được cố định.
5. Tự tính lại offset sticky sau render và resize, dùng ResizeObserver nếu trình duyệt hỗ trợ.
6. Giữ lựa chọn riêng theo tài khoản + học kỳ trong trình duyệt; tự nhận lựa chọn V83 cũ.
7. Không đổi Firestore schema, API, Rules hoặc dữ liệu.

Triển khai từ V83:
- Ghi đè index.html và package.json.
- Không cần thay api/, lib/, vercel.json hay Firestore Rules.
- Sau deploy: Command + Shift + R.
