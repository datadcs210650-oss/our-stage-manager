OUR STAGE CLUB MANAGER V51 — EVENT PORTAL FIELDS FIX

LỖI ĐƯỢC KHẮC PHỤC
Cổng sự kiện có thể hiện tiêu đề và nút “Gửi thông tin” nhưng phần câu hỏi bị trống.

V51 sửa theo 3 lớp:

1. PUBLIC EVENT
- Không chỉ đọc event.fields.
- Có thể khôi phục schema cũ từ:
  fields
  formFields
  questions
  schema.fields
  form.fields
- Tự đổi tên type cũ như paragraph/dropdown/checkbox/tel/studentId...
  sang type hiện tại.
- Nếu schema cũ không có câu hỏi nhận câu trả lời, public tự thêm bộ trường cơ bản
  thay vì để trang trắng.
- renderFields có try/catch riêng; lỗi một schema cũ không làm mất toàn bộ form.
- Có dòng trạng thái số trường để dễ nhận biết dữ liệu đã tải.
- Bỏ mọi min-height rỗng của form; nút Gửi nằm ngay sau các trường.

2. ADMIN
- Event health chỉ được xem là hợp lệ khi có ít nhất một trường nhận câu trả lời.
- Tự đọc schema cũ và chuyển về fields chuẩn.
- Schema mới dùng fieldSchemaVersion 4.
- Mỗi event có nút “Đồng bộ trường form”.
- Bấm Mở cổng hoặc QR sự kiện sẽ thử đồng bộ field schema trước.
- repairCurrentSemesterEventFields tiếp tục sửa tự động khi Admin mở module Sự kiện.

3. KHÔNG THAY RULES
V51 không nới hoặc thay Firestore Rules.
ZIP không chứa Firestore Rules.

FIREBASE / REALTIME
Website này dùng project `clb-our`.
Luồng realtime của Admin/Public đang dùng Cloud Firestore `onSnapshot`, không dùng
Firebase Realtime Database.

Nếu một project Firebase KHÁC chạm quota Realtime Database, project `clb-our` không
bị trừ chung quota đó. Trường hợp ngoại lệ là nhiều project cùng gắn với một Cloud
Billing account bị suspended/closed; khi đó các project gắn vào billing account đó
có thể cùng bị ảnh hưởng.

CẬP NHẬT
1. Commit toàn bộ V51 lên GitHub.
2. Không cần Publish Firestore Rules.
3. Giữ vercel.json trong package.
4. Chờ Vercel Ready.
5. Command + Shift + R.
6. Vào Admin > Cổng sự kiện > bấm “Đồng bộ trường form” ở sự kiện cũ một lần nếu cần.
