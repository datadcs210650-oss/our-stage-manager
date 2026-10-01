OUR STAGE CLUB MANAGER V76 — SECURE EVENT CHECK-IN

MỤC TIÊU
V76 mở rộng QR check-in theo từng sự kiện nhưng giữ nguyên nguyên tắc quyền riêng tư:
- Camera chỉ dùng để đọc QR ngay trên thiết bị.
- Không lưu ảnh, video, frame camera hoặc chuỗi QR gốc.
- QR thành viên do hệ thống cấp chỉ chứa đúng MSSV.
- Link quét dành cho người ngoài BCN không được đọc danh sách thành viên, phản hồi sự kiện, email hay số điện thoại.

LUỒNG CHECK-IN
1. Thành viên CLB + đã đăng ký trên cổng sự kiện:
   -> check-in ngay.
2. Thành viên CLB + chưa đăng ký:
   -> nếu Admin/Super Admin quét trong trang quản trị: hệ thống hỏi xác nhận trước khi check-in;
   -> nếu BCN hoặc người dùng link quét ngoài BCN quét: lưu trạng thái Chờ Admin;
   -> chỉ Admin/Super Admin được Duyệt/Từ chối.
3. Không phải thành viên CLB:
   -> chỉ được ghi nhận nếu sự kiện bật chế độ Check-in Public;
   -> lưu dưới nhóm Ngoài CLB để Admin có thể lọc/xuất riêng.
4. Một MSSV chỉ có một bản ghi check-in trong cùng một sự kiện.

CỔNG MÃ QR THÀNH VIÊN
- Admin mở menu "Mã QR thành viên" theo học kỳ.
- Thành viên truy cập link /ma-thanh-vien?semester=...
- Nhập MSSV; server xác minh MSSV thuộc danh sách thành viên học kỳ.
- QR trả về chỉ chứa MSSV, ví dụ CS210650.
- QR không tự hết hạn. Admin có thể vô hiệu hóa/kích hoạt lại theo MSSV.

LƯU Ý QUAN TRỌNG VỀ VÔ HIỆU HÓA
Vì QR theo yêu cầu chỉ chứa duy nhất MSSV, không có token bí mật riêng trong QR, hệ thống không thể phân biệt QR do Our Stage tạo với một QR khác cũng chứa chính MSSV đó. Vì vậy khi Admin vô hiệu hóa QR của một MSSV, mọi QR có cùng nội dung MSSV sẽ bị từ chối cho tới khi Admin kích hoạt lại.

LINK CHECK-IN NGOÀI BCN
- Admin bật QR check-in cho sự kiện.
- Tại thẻ sự kiện chọn "Link check-in ngoài BCN".
- Tạo link riêng /check-in-su-kien?token=...
- Token ngẫu nhiên dài, có thể vô hiệu hóa hoặc tạo lại ngay.
- Trang này chỉ có camera quét QR, không có ô nhập MSSV thủ công.
- Trang quét không trả về tên, email, số điện thoại, trạng thái thành viên/đăng ký sau một lượt check-in thành công.
- Thành viên chưa đăng ký chỉ hiện trạng thái "chờ Admin duyệt".

TRIỂN KHAI TỪ V75
1. Ghi đè các file trong gói PATCH vào root GitHub.
2. Giữ nguyên thư mục api/ và lib/ cũ nhưng thêm/ghi đè 2 API mới:
   - api/event-checkin.js
   - api/member-qr.js
3. Deploy Vercel.
4. Firebase Console -> Firestore Database -> Rules:
   dán toàn bộ firestore_rules_v76.rules rồi Publish.
5. Hard refresh:
   Mac: Command + Shift + R
   Windows: Ctrl + Shift + R
6. Environment Variables Firebase Admin từ V73 giữ nguyên, không nhập lại.

TEST NHANH
A. Cổng QR thành viên
- Admin mở cổng.
- Thành viên nhập MSSV hợp lệ -> QR hiện ra.
- Dùng app QR bất kỳ xác nhận nội dung chỉ là MSSV.
- Admin vô hiệu hóa -> check-in bằng MSSV đó phải bị chặn.
- Kích hoạt lại -> check-in hoạt động lại.

B. Thành viên đã đăng ký
- Đăng ký event bằng MSSV.
- Quét -> check-in ngay.

C. Thành viên chưa đăng ký
- Admin quét -> hỏi xác nhận.
- BCN/link ngoài BCN quét -> Chờ Admin.
- Admin mở danh sách QR check-in -> Duyệt hoặc Từ chối.

D. Public
- Bật "Public — cho phép sinh viên ngoài CLB".
- Quét MSSV không thuộc CLB -> được ghi nhận Ngoài CLB.
- Lọc Đối tượng = Ngoài CLB -> chỉ thấy nhóm public.
- Xuất Excel -> chỉ xuất theo bộ lọc hiện tại.

E. Link ngoài BCN
- Tạo link, mở trên điện thoại không đăng nhập.
- Camera quét được QR.
- Trang không hiển thị email/SĐT/danh sách thành viên.
- Vô hiệu hóa link -> link cũ ngừng hoạt động ngay.

BẢO MẬT
- Không commit Service Account JSON/private key lên GitHub.
- API Firebase Admin chạy server-side trên Vercel.
- Firestore Rules V76 khóa các collection token/QR admin khỏi public client.
- Link check-in là bearer secret: chỉ gửi cho người được giao nhiệm vụ và vô hiệu hóa sau sự kiện nếu không còn dùng.
