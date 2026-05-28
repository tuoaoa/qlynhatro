# PRODUCT PLAN (FINAL REFITS): Hệ Thống Tự Tính Tiền Phòng Trọ (qlynhatro)

Một hệ thống quản lý phòng trọ tối giản, vận hành khép kín di động cực kỳ bền bỉ và thực dụng: **"Khách tự chốt số & Thanh toán tự phục vụ" (Tenant Self-Service Billing)**.

Thiết kế loại bỏ hoàn toàn gánh nặng "AI rườm rà" hay "SaaS cồng kềnh", định hướng sản phẩm dạng mua đứt / tự vận hành (self-host) ổn định trọn đời.

---

## 1. Triết Lý Sản Phẩm Mới & Các Phản Biện Tối Ưu
- **Tenant Self-Service:** Khách thuê tự nhập số, hệ thống tự động tính hóa đơn và thanh toán. Giảm 99% tác vụ thủ công của chủ nhà.
- **Bảo Mật Đường Dẫn HMAC Signature:** Link chốt số được bảo mật chặt chẽ dạng `/r/A203?t=token&m=2026-05&s=hash`. Token xoay vòng hàng tháng, tự động hết hạn, chống chia sẻ nhầm hoặc tự đoán link.
- **Trạng thái chốt số chặt chẽ (Tenant Confirmation State):** 
  - `PENDING_METER`: Chờ khách tự nhập chỉ số mới.
  - `PENDING_CONFIRMATION`: Khách nhập xong, xem bảng tính nháp hóa đơn chi tiết để tự rà soát.
  - `PENDING_PAYMENT`: Khách bấm "Xác nhận hóa đơn chính xác", hiển thị mã thanh toán VietQR.
  - `PAID`: Chủ nhà duyệt đã nhận hoặc đối soát ngân hàng khớp lệnh.
- **VietQR Độc Lập Hoàn Toàn (Hybrid QR Resilience):**
  - Sử dụng API nhanh `img.vietqr.io` làm mặc định để có hình ảnh QR Napas247 đẹp mắt.
  - **Tích hợp bộ dự phòng cục bộ (Local QR Engine):** Nếu API ngoài lỗi hoặc chậm, client-side tự động dùng thư viện `qrcode` cục bộ tạo trực tiếp chuỗi tài khoản và mã chuyển khoản `NTRO-[Room]-[Month]` trên thẻ canvas. Đảm bảo an toàn thanh toán 100% không sợ downtime.
- **Gửi Hóa Đơn & Mở Tháng Hàng Loạt (Bulk Operations):**
  - **Mở Tháng Mới:** 1 chạm khởi tạo hàng loạt hóa đơn tháng mới cho tất cả các phòng đang thuê, tự động chuyển số cũ = số mới của tháng trước.
  - **Nhắc nợ hàng loạt (Bulk Unpaid Reminders):** 1 chạm quét toàn bộ phòng quá hạn và soạn tin nhắn đòi tiền qua Zalo.

---

## 2. Schema Database SQLite Được Thiết Kế Lại (Final SQLite Schema)

```sql
-- 1. Bảng Khu Trọ
CREATE TABLE properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Cấu Hình Đơn Giá (Mặc định cho mỗi khu trọ)
CREATE TABLE property_configs (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES properties(id),
    electricity_price REAL NOT NULL, -- Giá điện/kWh (ví dụ: 3500)
    water_price REAL NOT NULL,       -- Giá nước/m3 (ví dụ: 15000)
    internet_price REAL DEFAULT 0,   -- Phí internet phòng cố định
    service_price REAL DEFAULT 0,    -- Phí rác, vệ sinh cố định
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Phòng
CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES properties(id),
    room_number TEXT NOT NULL,       -- Ví dụ: A203
    price REAL NOT NULL,             -- Giá thuê gốc
    status TEXT DEFAULT 'VACANT',   -- VACANT, OCCUPIED, MAINTENANCE
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Khách Thuê
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cccd TEXT,
    deposit REAL DEFAULT 0,
    start_date TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng Hóa Đơn Tháng & Tự Chốt Số
CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id),
    tenant_id TEXT REFERENCES tenants(id),
    billing_month TEXT NOT NULL,       -- Định dạng YYYY-MM
    access_token TEXT UNIQUE NOT NULL,  -- Token truy cập duy nhất hàng tháng
    token_expires_at DATETIME NOT NULL, -- Thời hạn hết hạn token
    
    -- Chỉ số điện nước (Khách tự nhập)
    electricity_old REAL NOT NULL,
    electricity_new REAL,
    water_old REAL NOT NULL,
    water_new REAL,
    meter_photo_url TEXT,
    
    -- Phân tích hóa đơn chi tiết
    room_amount REAL NOT NULL,
    electricity_amount REAL DEFAULT 0,
    water_amount REAL DEFAULT 0,
    internet_amount REAL DEFAULT 0,
    service_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    
    -- Trạng thái
    status TEXT DEFAULT 'PENDING_METER', -- PENDING_METER, PENDING_CONFIRMATION, PENDING_PAYMENT, PAID
    anomaly_status TEXT DEFAULT 'NONE',   -- NONE, ABNORMAL_HIGH, ABNORMAL_LOW, NEGATIVE
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Bản Đồ Giao Diện Quick Mode Của Chủ Trọ (Single-Screen Dashboard)
Màn hình chủ nhà chia làm 4 tab hành động:
- **Tab 1: Chưa chốt số (Pending Readings):** Có nút "Mở tháng mới hàng loạt" để tạo bill hàng loạt. Kèm theo nút "Gửi nhắc nhở chốt số" qua Zalo cá nhân.
- **Tab 2: Bất thường (Anomalies):** Hiển thị các phòng có mức tiêu thụ điện nước nhảy vọt hoặc sụt giảm bất thường, cho phép chủ nhà duyệt nhanh hoặc yêu cầu khách kiểm tra lại.
- **Tab 3: Chưa nộp tiền (Unpaid Invoices):** Hiển thị các phòng đang có hóa đơn trạng thái `PENDING_PAYMENT`. Có nút "1 chạm duyệt Đã nhận tiền" và nút "Nhắc nợ hàng loạt".
- **Tab 4: Thu nhập ròng (Expected vs Collected):** Thống kê dòng tiền thực tế thu về đối chiếu với doanh thu lý thuyết.

---

## 4. Chiến Lược Backup Đơn Giản Nhất
- **Daily SQLite Snapshot:** File cơ sở dữ liệu `qlynhatro.db` là một file phẳng duy nhất. Mỗi đêm lúc 01:00 AM, một script cronjob đơn giản sẽ nén file DB, mã hóa nhẹ và đồng bộ lên một thư mục dự phòng an toàn cục bộ trên VPS. Việc khôi phục khi lỗi server chỉ mất đúng 10 giây (copy đè file).
