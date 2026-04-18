"""
FastAPI Entry Point - Khởi tạo app, database, seed data mặc định.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from backend.database import engine, Base, SessionLocal
from backend.models import User, Area, Table
from backend.auth import get_password_hash


# Import routers
from backend.events import event_store
from backend.routers.auth import router as auth_router
from backend.routers.tables import router as tables_router
from backend.routers.booking import router as booking_router
from backend.routers.crm import router as crm_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.events import router as events_router
from backend.routers.blocking import router as blocking_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Chạy khi app start/stop:
    - Tạo database + tables nếu chưa có
    - Tạo tài khoản admin mặc định nếu chưa có
    - Tạo dữ liệu mẫu (khu vực + bàn) nếu chưa có
    """
    # 1. Tạo tất cả bảng (chạy 1 lần, không lỗi nếu đã có)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 2. Tạo admin mặc định nếu chưa có
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="Quản trị viên",
                role="admin",
                is_active=True,
            )
            db.add(admin)

            # Tạo thêm tài khoản mẫu
            manager = User(
                username="quanly",
                hashed_password=get_password_hash("quanly123"),
                full_name="Người Quản Lý",
                role="manager",
                is_active=True,
            )
            db.add(manager)

            staff = User(
                username="nhanvien",
                hashed_password=get_password_hash("nhanvien123"),
                full_name="Nhân Viên Booking",
                role="staff",
                is_active=True,
            )
            db.add(staff)

        # 3. Tạo khu vực + bàn mẫu nếu chưa có
        if not db.query(Area).first():
            # Tầng 1 - 6 bàn
            t1 = Area(name="Tầng 1", display_order=1)
            db.add(t1)
            db.flush()
            for i in range(1, 7):
                db.add(Table(name=f"Tầng 1 - Bàn {i}", area_id=t1.id, capacity=4))

            # Tầng 2 - 4 bàn
            t2 = Area(name="Tầng 2", display_order=2)
            db.add(t2)
            db.flush()
            for i in range(1, 5):
                db.add(Table(name=f"Tầng 2 - Bàn {i}", area_id=t2.id, capacity=6))

            # VIP - 2 bàn
            vip = Area(name="Phòng VIP", display_order=3)
            db.add(vip)
            db.flush()
            db.add(Table(name="VIP 1", area_id=vip.id, capacity=10))
            db.add(Table(name="VIP 2", area_id=vip.id, capacity=12))

            # Ngoài trời - 3 bàn
            ngoaitroi = Area(name="Khu Ngoài Trời", display_order=4)
            db.add(ngoaitroi)
            db.flush()
            for i in range(1, 4):
                db.add(Table(name=f"NGOÀI TRỜI - Bàn {i}", area_id=ngoaitroi.id, capacity=5))

        db.commit()
        print("✅ Database initialized with default data")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Database init error: {e}")
    finally:
        db.close()

    yield  # App đang chạy...

    # Cleanup khi tắt app
    print("👋 Shutting down...")


# ─── FastAPI App ───────────────────────────────
app = FastAPI(
    title="🍽️ Restaurant Booking API",
    description="API cho hệ thống đặt bàn nhà hàng - Booking, CRM, Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: cho phép origins từ env var (production) hoặc fallback local
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.environ.get("ALLOWED_ORIGINS"):
    ALLOWED_ORIGINS.extend(os.environ.get("ALLOWED_ORIGINS").split(","))
if os.environ.get("FRONTEND_URL"):
    ALLOWED_ORIGINS.append(os.environ.get("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký routers
app.include_router(auth_router)
app.include_router(tables_router)
app.include_router(booking_router)
app.include_router(crm_router)
app.include_router(dashboard_router)
app.include_router(events_router)
app.include_router(blocking_router)


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "🍽️ Restaurant Booking API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    # host 0.0.0.0: máy khác trong mạng LAN có thể gọi API (đổi API_BASE trên frontend nếu cần)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
