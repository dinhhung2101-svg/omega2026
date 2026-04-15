# Restaurant Booking System

Hệ thống đặt bàn nhà hàng - Backend API (Python FastAPI)

## Cách chạy

```bash
cd backend
pip install -r requirements.txt
python main.py
```

API chạy tại: http://localhost:8000
Swagger docs: http://localhost:8000/docs

## Tài khoản mặc định

| Username | Password | Vai trò |
|----------|----------|---------|
| admin | admin123 | Admin |
| quanly | quanly123 | Quản lý |
| nhanvien | nhanvien123 | Nhân viên |

## API Endpoints

- `POST /api/auth/login` - Đăng nhập
- `GET /api/tables-with-areas` - Danh sách bàn theo khu vực
- `POST /api/bookings` - Đặt bàn
- `POST /api/bookings/{id}/check-in` - Check-in khách
- `POST /api/bookings/{id}/close` - Đóng bàn
- `GET /api/crm/customers` - Danh sách khách hàng
- `GET /api/dashboard/overview` - Tổng quan dashboard
- `GET /api/events` - SSE real-time events
