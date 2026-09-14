OUR STAGE CLUB MANAGER V17 — EVENT THEO HỌC KỲ

MỚI TRONG V17

1. Sự kiện theo đúng học kỳ
- Mỗi sự kiện thuộc duy nhất một học kỳ.
- Menu Cổng sự kiện chỉ hiển thị sự kiện của học kỳ đang chọn.
- Khi đổi học kỳ ở sidebar, danh sách sự kiện tự đổi theo ngay.
- Khi tạo sự kiện, học kỳ được cố định theo học kỳ hiện tại.
- Không thể vô tình chuyển một sự kiện cũ sang kỳ khác khi chỉnh sửa.

2. Xóa sự kiện
- Admin/Super Admin có nút "Xóa sự kiện".
- Xóa luôn document sự kiện trên Firestore.
- Xóa toàn bộ submissions/phản hồi của sự kiện.
- Xóa sự kiện khỏi dữ liệu CLB.
- Có bước xác nhận vì thao tác không hoàn tác.

3. Vẫn giữ toàn bộ V16
- Vercel routes /tra-cuu và /su-kien
- Cổng sự kiện kiểu Google Forms
- Trắc nghiệm, checkbox, văn bản, ngày, giờ, ghi chú đậm/nghiêng/xuống dòng
- Hình ảnh / QR miễn phí bằng Firestore
- Tài khoản Admin / BCN và phân quyền
- Spark Free, không cần Firebase Storage

CẬP NHẬT
- Upload toàn bộ thư mục package lên Vercel.
- Firestore Rules V17 không thay đổi logic quyền so với V16 nhưng nên Publish file đi kèm để đồng bộ phiên bản.
