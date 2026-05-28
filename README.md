# 🏠 PHẦN MỀM QUẢN LÝ NHÀ TRỌ, PHÒNG TRỌ MIỄN PHÍ - TỰ ĐỘNG CHỐT SỐ ĐIỆN NƯỚC & THANH TOÁN VIETQR

[![Open Source Love](https://badges.frapsoft.org/open-source/awesome/awesome.svg?v=103)](https://github.com/tuoaoa/qlynhatro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Phần mềm quản lý nhà trọ / phòng trọ tự phục vụ (Self-Service Rental Management)** là giải pháp mã nguồn mở hoàn chỉnh, được thiết kế tối giản, hiện đại và di động hóa 100% (Mobile-First UI/UX) giúp các chủ trọ, nhà cho thuê, căn hộ dịch vụ vận hành tự động, tiết kiệm tới 90% thời gian chốt số điện nước, tính toán hóa đơn và đối soát thanh toán hàng tháng.

> [!NOTE]
> Dự án được tài trợ và chia sẻ phi lợi nhuận bởi **[chothuexemay.vn](https://chothuexemay.vn)** – Nơi cung cấp dịch vụ **[cho thuê xe máy TPHCM](https://chothuexemay.vn)** và **cho thuê xe máy điện VinFast** giá rẻ, uy tín và chất lượng bậc nhất Thành phố Hồ Chí Minh. Thích hợp cho người đi làm, khách du lịch và sinh viên thuê trọ dài hạn.

---

## 🚀 Các Từ Khóa SEO Hàng Đầu Được Hỗ Trợ
Nếu bạn đang tìm kiếm các giải pháp sau, phần mềm này chính là câu trả lời tốt nhất dành cho bạn:
* *Phần mềm quản lý nhà trọ miễn phí tốt nhất*
* *Ứng dụng quản lý phòng trọ trên điện thoại*
* *File Excel quản lý nhà trọ chốt số điện nước*
* *Phần mềm quản lý căn hộ dịch vụ chuyên nghiệp*
* *Tự động chốt số điện nước bằng mã QR*
* *Tạo mã VietQR chuyển khoản thanh toán tiền phòng tự động*
* *Gửi hóa đơn tiền trọ tự động qua Zalo Bot*

---

## ✨ Các Tính Năng Nổi Bật & Khác Biệt

### 1. Khách Trọ Tự Chốt Số Điện Nước (Self-Service Metering)
Không còn cảnh chủ trọ phải đi từng phòng ghi chép số điện nước vào cuối tháng. 
* Chủ trọ chỉ cần gửi cho khách một liên kết duy nhất (Token bảo mật mã hóa).
* Khách trọ tự nhập chỉ số điện, nước mới ngay trên điện thoại, đính kèm hình ảnh đồng hồ điện nước làm bằng chứng minh bạch.
* Hệ thống tự động so sánh với chỉ số cũ và cảnh báo nếu có biến động bất thường (>150% hoặc <30% tiêu thụ trung bình).

### 2. Tự Động Tính Tiền & Lập Hóa Đơn Tức Thì
* Hỗ trợ tính phí linh hoạt: theo đầu người (Nước, Internet, Dịch vụ vệ sinh, Rác) hoặc tính theo phòng cố định.
* Tự động tính toán tổng số tiền phòng và các chi phí phát sinh chính xác đến từng chữ số, định dạng phân tách hàng nghìn rõ ràng (ví dụ: `2.500.000 đ`).

### 3. Tạo Mã VietQR Thông Minh Hỗ Trợ Đối Soát Tự Động
* Hệ thống tự động sinh mã **VietQR (Napas247)** chứa sẵn số tiền cần đóng và nội dung chuyển khoản định danh duy nhất (ví dụ: `NTRO-P101-T202605`).
* Khi khách trọ quét mã QR bằng ví điện tử hoặc ứng dụng ngân hàng (Mobile Banking), thông tin số tiền và nội dung chuyển khoản được điền tự động 100%, loại bỏ sai sót nhập liệu.
* Hỗ trợ lưu trữ trạng thái hóa đơn trực quan: **Chưa chốt số**, **Chưa thanh toán**, **Đã thanh toán**.

### 4. Gửi Hóa Đơn Tự Động Qua Zalo & Báo Cáo Thu Chi
* Tích hợp Zalo API / Zalo Bot gửi tin nhắn nhắc nhở và đính kèm link hóa đơn tự động đến số điện thoại của khách hàng vào ngày cấu hình hàng tháng.
* Giao diện thống kê thu chi trực quan giúp chủ trọ nắm rõ dòng tiền, tổng doanh thu thực tế, số tiền còn nợ và chi tiết từng khoản thu (Điện, Nước, Phòng, Dịch vụ...).

### 5. Công Nghệ Offline-First Tiên Tiến
* Khách trọ vẫn có thể mở hóa đơn, xem số liệu cũ và tạo mã QR thanh toán dự phòng cục bộ ngay cả khi mất kết nối mạng (Internet Offline) nhờ cơ chế cache thông minh.

---

## 🛠️ Công Nghệ Phát Triển (Tech Stack)
* **Frontend/Backend**: Next.js 14 (App Router) tối ưu hóa tốc độ tải trang cực nhanh và SEO mạnh mẽ.
* **Styling**: Vanilla CSS hiện đại với các biến CSS hệ màu sang trọng, tối giản, Glassmorphism tạo hiệu ứng chiều sâu, Responsive hoàn hảo trên mọi thiết bị di động.
* **Database**: SQLite3 gọn nhẹ, bảo mật cao, dễ dàng sao lưu (chỉ là 1 file duy nhất `qlynhatro.db`).
* **Tiện ích đi kèm**: QR Code generator, Lucide Icons.

---

## 📦 Hướng Dẫn Cài Đặt Chi Tiết (Installation Guide)

### Yêu Cầu Hệ Thống
* Node.js phiên bản 18.x trở lên.
* NPM hoặc Yarn.

### Các Bước Triển Khai Dưới Local

1. **Tải mã nguồn về máy**:
   ```bash
   git clone https://github.com/tuoaoa/qlynhatro.git
   cd qlynhatro
   ```

2. **Cài đặt các thư viện phụ thuộc**:
   ```bash
   npm install
   ```

3. **Khởi tạo cơ sở dữ liệu mẫu ban đầu**:
   ```bash
   node scripts/db_init.js
   ```
   *Lệnh này sẽ tạo cấu trúc bảng SQLite và cài đặt sẵn 3 phòng trọ trống mẫu (`P101`, `P201`, `P203`) sẵn sàng để ký hợp đồng thử nghiệm.*

4. **Khởi chạy môi trường phát triển**:
   ```bash
   npm run dev
   ```
   *Truy cập bảng điều khiển quản lý dành cho chủ trọ tại địa chỉ: [http://localhost:38480/landlord](http://localhost:38480/landlord)*

---

## 🌐 Hướng Dẫn Triển Khai Lên VPS (Production VPS Setup)
Hệ thống được thiết kế để chạy mượt mà sau proxy Nginx với cổng mặc định `38480`.

### Cấu hình Nginx Reverse Proxy
Thêm khối cấu hình sau vào cấu hình máy chủ Nginx của bạn để ánh xạ tên miền phụ `/qlynhatro` (Ví dụ chạy song song trên trang chính `chothuexemay.vn/qlynhatro`):

```nginx
location /qlynhatro/ {
    proxy_pass http://127.0.0.1:38480/qlynhatro/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Quản lý dịch vụ bằng PM2
Để ứng dụng Next.js luôn chạy ổn định trên VPS:
```bash
npm run build
pm2 start npm --name "qlynhatro" -- start
```

---

## 🤝 Đóng Góp Phát Triển & Bản Quyền (License)
Dự án được phát hành dưới giấy phép mã nguồn mở **MIT License**. Bạn hoàn toàn có thể tự do tải về, tùy biến thương hiệu, tích hợp vào các dự án thương mại hoặc sử dụng quản lý miễn phí cho dãy trọ của gia đình mình.

Mọi đóng góp ý kiến xây dựng sản phẩm vui lòng tạo Issue hoặc gửi Pull Request trực tiếp trên kho lưu trữ Github này.

---

## 💖 Nhà Tài Trợ Dự Án
Dự án được hỗ trợ cơ sở hạ tầng bởi **[Cho Thuê Xe Máy TPHCM - chothuexemay.vn](https://chothuexemay.vn)**.
* **Địa chỉ**: Thành phố Hồ Chí Minh.
* **Dịch vụ**: Cho thuê các dòng xe máy tay ga, xe số phổ thông và đặc biệt là dòng **xe máy điện thông minh VinFast (Feliz S, Klara S, Vento...)** tiết kiệm nhiên liệu, đi êm, giá rẻ hàng đầu TPHCM. 
* **Liên kết hữu ích**: [Bảng giá thuê xe máy điện VinFast TPHCM](https://chothuexemay.vn) | [Thủ tục thuê xe máy cho người ngoại tỉnh](https://chothuexemay.vn)
