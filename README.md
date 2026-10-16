# Our Stage — Club Manager (OSC)

Hệ thống quản lý nội bộ Câu lạc bộ Our Stage: thành viên theo học kỳ, điểm danh, hoạt động, sự kiện/QR/vé, phân quyền BCN, Thu–Chi, Room Booking, tra cứu và lưu trữ qua Google Drive.

## Cấu trúc repository

| Thành phần | Đường dẫn | Ghi chú |
| --- | --- | --- |
| Quản trị OSC | `index.html` | Giao diện chính; các module dùng JS/CSS ở thư mục gốc |
| Trang công khai | `su-kien.html`, `diem-danh.html`, `tra-cuu*.html`, `ve-su-kien.html`, v.v. | Giữ đường dẫn qua `vercel.json` |
| Vercel Functions | `api/` | 9 entrypoint ở thời điểm dọn dẹp; các thao tác tài khoản dùng chung `api/accounts.js` |
| Server logic | `lib/` | Xác thực, phân quyền, Firebase, Google Drive, quản lý tài khoản và dịch vụ |
| Bài kiểm thử | `tests/` | Hồi quy chức năng và bảo mật; chạy ở GitHub Actions |
| Tài liệu đang dùng | `docs/` | Triển khai, phân quyền, Google Drive và kiến trúc API |
| Firebase Security Rules | `firestore_rules_v96.rules` | Bản mã nguồn mới nhất trong repository, **không** tự triển khai lên Firebase |
| Rules tham chiếu | `firestore_rules_v95.rules` | Bản đối chiếu gần nhất, chỉ dùng để tham khảo/khôi phục nếu cần |

## Kiểm tra trước khi triển khai

```bash
npm install --ignore-scripts
node --test tests/*.test.js
```

GitHub Actions thực hiện kiểm tra cú pháp JavaScript, kiểm thử hồi quy và `npm audit`. Vercel triển khai nhánh `main`; hãy kiểm tra Preview/Production và các thao tác quan trọng trước khi sử dụng hàng loạt.

**Bảo mật:** Không đưa API key bí mật, service-account JSON, Firebase Admin credentials, Google OAuth client secret hoặc token vào GitHub. Các biến bí mật được cấu hình riêng ở môi trường Vercel. Phân quyền phải được kiểm tra tại API/Firestore Rules, không chỉ ẩn nút ở giao diện.

## Tài liệu kỹ thuật

- [Kiến trúc API V105](docs/API_ARCHITECTURE_V105.md)
- [Triển khai & bảo mật Drive Hub](docs/README_DRIVE_HUB_SECURITY.md)
- [Rollout Drive V2 & phân quyền](docs/ROLLOUT_GOOGLE_DRIVE_V2_LEADERSHIP.md)
- [Rà soát Drive / Room Booking](docs/SECURITY_REVIEW_DRIVE_ROOM_2026-10-14.md)
- [Rà soát BCN](docs/SECURITY_UX_REVIEW_BCN_TERMS_2026-10-15.md)
- [Giao diện V96](docs/README_V96_STAGECRAFT.md)
- [Giao diện V97](docs/README_V97_UNIFIED_UI.md)

## Về việc dọn dẹp repository

Các README/báo cáo từng bản V64–V94 và Firestore Rules lịch sử đã được bỏ khỏi cây mã nguồn hiện hành vì không còn là cấu hình cần triển khai. **Lịch sử commit Git vẫn lưu các bản cũ**, có thể xem/khôi phục nếu cần. Giữ nguyên các tệp chạy thật, cấu hình Vercel/Firebase và toàn bộ bài kiểm thử. Không thay đổi hay xóa dữ liệu trên Firebase, Google Drive hoặc Production trong quá trình dọn dẹp.
