# Restaurant Booking System - Hệ thống đặt bàn nhà hàng

Một web app hoàn chỉnh để quản lý đặt bàn nhà hàng, CRM khách hàng, và báo cáo doanh thu.

![Tech Stack](https://img.shields.io/badge/Python-FastAPI-purple) ![Tech Stack](https://img.shields.io/badge/Frontend-React-blue) ![Tech Stack](https://img.shields.io/badge/Styling-TailwindCSS-cyan) ![Tech Stack](https://img.shields.io/badge/Database-SQLite-orange)

---

## 🎯 Tính năng chính

### 1. Đặt Bàn (Booking)
- Hiển thị sơ đồ bàn theo khu vực với màu sắc trạng thái
- **Đặt bàn trước**: Tên khách, SĐT, số khách, giờ đến, ghi chú
- **Mở bàn vãng lai**: Cho khách không đặt trước
- **Check-in**: Khi khách đến → bàn chuyển sang "Có khách"
- **Đóng bàn**: Thanh toán xong → bàn trở về "Trống"
- **Hủy bàn**: Nếu khách huỷ
- **Gộp bàn / Tách bàn / Chuyển bàn**: Quản lý linh hoạt theo nhu cầu
- **Real-time**: Tất cả máy trạm cập nhật trạng thái bàn ngay lập tức (SSE)

### 2. CRM - Quản lý Khách hàng
- Lưu tên, SĐT, ghi chú khách hàng
- Tích hợp autocomplete khi đặt bàn (gõ tên/SĐT → hiện khách đã lưu)
- Lịch sử tiêu dùng chi tiết từng khách
- Thống kê lượt đến và tổng chi tiêu

### 3. Dashboard - Báo cáo
- Tổng quan: Bàn trống / đặt / có khách hôm nay
- Biểu đồ doanh thu theo ngày (14 ngày)
- Biểu đồ lượt đặt bàn / vãng lai
- Thành tích booking theo nhân viên
- Top khách hàng VIP

### 4. Cài đặt
- **Tài khoản**: Tạo / sửa / xóa nhân viên (Admin / Quản lý / Nhân viên)
- **Khu vực & Bàn**: Thêm / sửa / xóa khu vực và bàn
- Nhật ký thao tác (Audit Log)

---

## 🚀 Cách chạy

### Cách 1: Script tự động (Khuyến nghị)
```bash
cd ~/restaurant-booking
chmod +x start.sh
./start.sh
```

### Cách 2: Chạy thủ công

**Terminal 1 - Backend:**
```bash
cd ~/restaurant-booking/backend
python3 -m venv venv
source venv/bin/activate        # (Trên Windows: venv\Scripts\activate)
pip install -r requirements.txt
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd ~/restaurant-booking/frontend
npm install
npm run dev
```

Sau đó mở trình duyệt: **http://localhost:5173**

---

## 🔑 Tài khoản mặc định

| Username | Password | Vai trò | Quyền |
|----------|----------|---------|-------|
| `admin` | `admin123` | Admin | Toàn quyền |
| `quanly` | `quanly123` | Quản lý | Đặt bàn, Dashboard, Cài đặt khu/bàn |
| `nhanvien` | `nhanvien123` | Nhân viên | Đặt bàn, Xem CRM |

---

## 🌐 Kiến trúc

```
restaurant-booking/
├── backend/
│   ├── main.py           # FastAPI entry point
│   ├── database.py       # SQLite config
│   ├── models.py         # ORM models
│   ├── schemas.py        # Pydantic validation
│   ├── auth.py           # JWT authentication
│   └── routers/
│       ├── auth.py       # Đăng nhập, tài khoản
│       ├── tables.py     # Khu vực, bàn
│       ├── booking.py     # Đặt bàn, check-in, đóng bàn
│       ├── crm.py         # Khách hàng
│       ├── dashboard.py   # Báo cáo
│       └── events.py     # Real-time SSE
├── frontend/
│   ├── src/
│   │   ├── pages/        # Booking, CRM, Dashboard, Settings
│   │   ├── components/   # Layout, Sidebar, UI components
│   │   ├── context/      # Auth context
│   │   ├── api/          # API client
│   │   └── hooks/        # useSSE
│   └── ...
└── start.sh              # Script khởi động
```

---

## 🔧 Nâng cấp trong tương lai

Dự án được thiết kế dễ mở rộng:
- **PostgreSQL**: Đổi `DATABASE_URL` trong `backend/database.py`
- **SMS Notification**: Tích hợp Twilio/VNPT vào `booking.py`
- **QR Code bàn**: Thêm endpoint `/api/tables/{id}/qrcode`
- **Docker**: Viết Dockerfile để deploy lên server
- **HTTPS**: Đặt sau Nginx/Caddy proxy

---

## 👨‍💻 Tác giả

Hệ thống được xây dựng bằng FastAPI + React + TailwindCSS + SQLite.
Thiết kế hỗ trợ nhiều máy trạm cùng truy cập qua WiFi nội bộ.
