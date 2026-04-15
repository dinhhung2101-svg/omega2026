"""
Cấu hình database — hỗ trợ SQLite (local) và PostgreSQL/SQLite (production).
Đặt DATABASE_URL để dùng database khác, không đặt = dùng SQLite local.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Production: PostgreSQL hoặc bất kỳ SQLAlchemy URL nào
# Local: tự dùng SQLite trong thư mục backend
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    _db_path = os.path.join(os.path.dirname(__file__), "restaurant.db")
    _url = f"sqlite:///{_db_path}"
    engine = create_engine(_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency dùng trong FastAPI endpoint để lấy session DB."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
