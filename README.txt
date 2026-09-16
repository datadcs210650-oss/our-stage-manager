OUR STAGE CLUB MANAGER V43 — CONTINUATION LATEST RESULT + EVENT QR FIX

1. FORM ĐỒNG HÀNH: KẾT QUẢ SAU CÙNG LUÔN THẮNG
- Hệ thống nhóm phản hồi theo MSSV.
- So sánh createdAt và chỉ lấy phản hồi gửi sau cùng làm trạng thái chính thức.
- Ví dụ: lần 1 chọn “Tiếp tục”, lần 2 chọn “Dừng” -> Điểm danh hiển thị Dừng.
- Nếu xóa lần 2, hệ thống tự quay về kết quả lần 1.
- Nếu xóa hết phản hồi của MSSV, trạng thái Form Đồng hành và điểm liên quan bị xóa khỏi Điểm danh.
- Phản hồi cũ hiển thị “Đã bị thay thế”; phản hồi mới nhất hiển thị “Kết quả mới nhất”.

2. ADMIN CÓ THỂ CHỈNH SỬA KẾT QUẢ FORM ĐỒNG HÀNH
- Trong Kết quả sự kiện -> mỗi phản hồi Đồng hành có nút “Chỉnh sửa kết quả”.
- Có thể sửa các câu trả lời, MSSV, lựa chọn Có/Không và ghi chú.
- Sau khi lưu, hệ thống đồng bộ lại Điểm danh ngay.
- Nếu sửa MSSV, hệ thống đồng bộ cả MSSV cũ và MSSV mới để không để lại trạng thái sai.
- Chỉnh phản hồi cũ không làm nó thành phản hồi mới; thứ tự vẫn dựa trên thời gian gửi ban đầu.

3. XÓA / KHÔI PHỤC PHẢN HỒI ĐỒNG HÀNH
- Xóa một phản hồi -> đồng bộ lại trạng thái theo phản hồi còn lại mới nhất.
- Xóa hàng loạt -> đồng bộ lại tất cả MSSV bị ảnh hưởng.
- Khôi phục phản hồi từ Thùng rác -> tự tính lại kết quả mới nhất.
- Dữ liệu Điểm danh không còn bị “kẹt” sau khi phản hồi bị xóa.

4. QR CỔNG SỰ KIỆN
- Không render QRCode.js trực tiếp vào vùng hiển thị nữa.
- Hệ thống tạo QR ở vùng tách biệt, lấy PNG từ canvas rồi đưa đúng một ảnh vào modal.
- Tránh lỗi QR trắng / không hiện / canvas-img fallback.
- Có trạng thái loading và thông báo fallback.
- Tải QR PNG dùng cùng bộ tạo QR đã ổn định của QR điểm danh.

5. GIAO DIỆN
- Card phản hồi cũ được làm mờ nhẹ.
- Badge rõ “Kết quả mới nhất” / “Đã bị thay thế”.
- Modal chỉnh sửa Đồng hành responsive.
- Modal QR sự kiện responsive và không tràn màn hình.

6. FIRESTORE RULES
V43 KHÔNG THAY ĐỔI mô hình quyền Firestore.
Admin đã có quyền editEvents để chỉnh/xóa submission từ Rules hiện tại.
Theo yêu cầu, ZIP V43 KHÔNG chứa file Firestore Rules.

CẬP NHẬT
1. Commit toàn bộ package V43 lên GitHub.
2. Không cần thay Firebase Rules.
3. Chờ Vercel Ready.
4. Command + Shift + R.

RÀ SOÁT
- JavaScript syntax.
- Duplicate HTML ID.
- Latest-wins reconciliation.
- Delete/bulk-delete/restore synchronization.
- Edit result workflow.
- Event QR single-image rendering.
- Không có Firestore Rules trong package.
