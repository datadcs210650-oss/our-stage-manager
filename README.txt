OUR STAGE CLUB MANAGER V39
COMPANION STATUS + FINANCE TABLE SCROLL + PDF LOGO + PRIVACY

1. ĐỒNG HÀNH TRONG ĐIỂM DANH HOẠT ĐỘNG
Nhóm “Đồng hành CLB” không còn hiển thị một checkbox khó hiểu.
Mỗi hoạt động Đồng hành kỳ tiếp theo được mở thành 3 cột:
- Trạng thái Form: Đã điền / Chưa điền.
- Tiếp tục đồng hành.
- Dừng đồng hành.

Phía trên bảng có bảng tóm tắt:
- Bao nhiêu thành viên đã điền.
- Bao nhiêu tiếp tục.
- Bao nhiêu dừng đồng hành.

“Chưa điền” là trạng thái riêng, KHÔNG bị tính thành Dừng đồng hành.

Khi Admin xử lý phản hồi Đồng hành, hệ thống lưu metadata tối thiểu vào
members/{memberId}.continuationResponses/{eventId}:
- responded
- decision yes/no
- targetSemester
- sourceEventId
- respondedAt

Điểm danh chỉ cần đọc hồ sơ thành viên đã được phân quyền; không phải mở quyền
đọc toàn bộ câu trả lời sự kiện cho tài khoản chỉ có quyền Điểm danh.
Phản hồi cũ đã xử lý cũng được backfill metadata khi bộ xử lý sự kiện chạy lại,
không chuyển thành viên hoặc cộng điểm lần hai.

2. DANH SÁCH ĐÓNG QUỸ
- Hai bảng Đã đóng / Chưa đóng có thanh cuộn ngang riêng.
- Họ và tên căn giữa.
- MSSV căn giữa.
- Bảng có min-width để không bị cắt cột ở cửa sổ hẹp.

3. HỒ SƠ THÀNH VIÊN
Tên hiển thị không còn “360°”.
Dùng tên: “Hồ sơ thành viên”.

Nút Hồ sơ PDF mở hộp tùy chọn:
- Chọn học kỳ cần xuất.
- Thông tin cơ bản.
- Thông tin liên hệ.
- Điểm & đóng quỹ.
- Hoạt động đã tham gia.
- Lịch sử học kỳ.
- Ghi chú nội bộ.

Thông tin liên hệ và Ghi chú nội bộ mặc định TẮT để hạn chế đưa dữ liệu nhạy cảm
vào file PDF không cần thiết.

4. PDF
Toàn bộ file PDF do hệ thống tạo:
- Có logo OUR STAGE CLUB.
- Dùng font Roboto thông thường.
- Có footer “OUR STAGE CLUB • Tài liệu nội bộ”.
- Có số trang.
- Metadata PDF có author/creator là OUR STAGE CLUB.

Áp dụng cho:
- Hồ sơ thành viên.
- Báo cáo cuối kỳ.
- Báo cáo tài chính.

5. BẢO MẬT
V39 siết Firestore Rules đối với event submissions:
- Người có quyền Sự kiện có thể xử lý đầy đủ.
- Người chỉ có quyền Tài chính chỉ được sửa các field xử lý tài chính.
- Người chỉ có quyền Điểm danh chỉ được sửa các field trạng thái điểm.
- Không còn quyền editAttendance/editFinance cập nhật tùy ý toàn bộ submission.

Public vẫn:
- Không đọc danh sách phản hồi sự kiện.
- Không đọc danh sách thành viên.
- Không list dữ liệu tra cứu công khai.
- Các entry page nhạy cảm giữ Cache-Control no-store.
- CSP / HSTS / X-Frame-Options / Referrer-Policy tiếp tục được giữ.

6. CẬP NHẬT
BẮT BUỘC:
1) Commit toàn bộ package V39 lên GitHub.
2) Chờ Vercel Ready.
3) Firebase -> Firestore Database -> Rules.
4) Dán firestore_rules_v39.rules.
5) Publish.
6) Command + Shift + R.

LƯU Ý
Không có hệ thống web nào có thể cam kết tuyệt đối 100% không bị tấn công.
V39 giảm bề mặt rủi ro bằng cách giữ dữ liệu nhạy cảm sau Authentication,
không mở quyền public read, giới hạn update field ở Firestore Rules và giảm
thông tin cá nhân mặc định trong PDF.
