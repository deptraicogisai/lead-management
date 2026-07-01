# Channel Icons

Đặt ảnh icon cho từng loại contact channel vào thư mục này.

## Quy ước tên file

Tên file = tên loại channel viết thường, định dạng `.png`:

| Channel   | File             |
| --------- | ---------------- |
| Telegram  | `telegram.png`   |
| Linkedin  | `linkedin.png`   |
| Teams     | `teams.png`      |
| Signal    | `signal.png`     |
| Facebook  | `facebook.png`   |
| Whatsapp  | `whatsapp.png`   |
| Other     | (không cần ảnh)  |

## Ghi chú

- Ảnh nên là hình vuông (ví dụ 64x64 hoặc 128x128), nền trong suốt.
- `Other` luôn dùng icon mặc định (lucide-react), không cần đặt ảnh.
- Khi chưa có ảnh, hệ thống tự fallback về icon mặc định (lucide-react),
  nên giao diện không bị vỡ.
- Đường dẫn truy cập: ảnh `public/icons/channels/telegram.png`
  sẽ được phục vụ tại `/icons/channels/telegram.png`.
