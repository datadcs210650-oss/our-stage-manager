OUR STAGE CLUB MANAGER V52 — EVENT INPUT + SUBMIT FIX

LỖI ĐƯỢC SỬA
Cổng sự kiện có thể tải được tiêu đề/trường nhưng người dùng không nhập ổn định,
mất focus/mất dữ liệu hoặc không gửi được.

V52 sửa ở cả NHẬP và GỬI:

1. FIELD KHÔNG BỊ DỰNG LẠI LIÊN TỤC
Firestore có thể trả snapshot cache rồi snapshot server.
Bản cũ gọi renderFields() lại mỗi snapshot và thay toàn bộ innerHTML của form.
Điều này có thể làm mất focus/giá trị vừa nhập.

V52:
- Tạo schema signature.
- Nếu schema không đổi, không replace DOM input.
- Giữ draft trong RAM khi buộc phải render lại.
- Không dùng localStorage/sessionStorage cho nội dung form.

2. INPUT CÓ DOM KEY AN TOÀN
- Không dùng trực tiếp field.id của Firestore làm CSS selector/input id.
- Mỗi field dùng ef_0, ef_1, ef_2...
- answers vẫn lưu bằng field.id gốc, nên không phá dữ liệu kết quả.

3. BẢO ĐẢM FIELD TƯƠNG TÁC
- pointer-events:auto
- input/textarea/select visible + enabled
- bỏ disabled/readonly từ dữ liệu legacy
- z-index riêng cho form
- caret và touch interaction được bật rõ ràng

4. SUBMIT ĐƯỢC LÀM LẠI
- Dùng native <form submit> thay vì button onclick.
- Button có type=submit.
- Thu thập câu trả lời bằng data-field-index và DOM key an toàn.
- Không dùng querySelector với field.id tùy ý.
- Trong lúc gửi mới khóa form.
- Nếu gửi lỗi, nội dung đã nhập vẫn giữ nguyên.
- Báo riêng:
  permission-denied
  resource-exhausted
  unavailable

5. FIREBASE
V52 vẫn dùng project `clb-our`.
Nếu project Firebase khác hết quota Realtime Database thì không làm các input HTML
của cổng này bị khóa. Nếu V52 báo resource-exhausted khi bấm Gửi thì mới cần kiểm tra
quota của chính project clb-our.

6. FIRESTORE RULES
V52 không thay đổi Firestore Rules.
ZIP không chứa file Rules.

CẬP NHẬT
1. Commit toàn bộ package V52 lên GitHub.
2. Không Publish Rules.
3. Chờ Vercel Ready.
4. Command + Shift + R.
5. Admin > Cổng sự kiện > “Mở cổng / Test nhập”.
6. Nhập thử Họ tên + MSSV và bấm Gửi.
Nếu Firestore từ chối ghi, V52 sẽ hiện mã/nguyên nhân dễ hiểu hơn thay vì trang im lặng.
