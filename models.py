"""
ORM Models - Định nghĩa các bảng trong database.
Mỗi class = một bảng, mỗi attribute = một cột.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from datetime import date as date_type

from database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class TableStatus(str, enum.Enum):
    EMPTY = "empty"          # Bàn trống
    RESERVED = "reserved"     # Bàn đặt (khách chưa đến)
    OCCUPIED = "occupied"    # Bàn có khách (đã ngồi)
    MERGED = "merged"        # Bàn ghép


# ──────────────────────────────────────────────
# Bảng: users (nhân viên / quản lý / admin)
# ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default=UserRole.STAFF.value)  # admin / manager / staff
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Liên kết: mỗi booking có thể ghi nhận nhân viên nào tạo
    bookings = relationship("Booking", back_populates="booked_by_user")


# ──────────────────────────────────────────────
# Bảng: areas (khu vực: Tầng 1, Tầng 2, VIP...)
# ──────────────────────────────────────────────
class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    display_order = Column(Integer, default=0)  # Thứ tự hiển thị
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tables = relationship("Table", back_populates="area", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# Bảng: tables (bàn)
# ──────────────────────────────────────────────
class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)          # Tên bàn: "Bàn 1", "Bàn 2"
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    capacity = Column(Integer, default=4)              # Số ghế tối đa
    status = Column(String(20), default=TableStatus.EMPTY.value)
    merged_into_id = Column(Integer, ForeignKey("tables.id"), nullable=True)  # Bàn này đã gộp vào bàn nào (nếu có)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    area = relationship("Area", back_populates="tables")
    bookings = relationship("Booking", back_populates="table")
    merged_into = relationship("Table", remote_side=[id], foreign_keys=[merged_into_id], backref="merged_tables")


# ──────────────────────────────────────────────
# Bảng: customers (CRM - thông tin khách hàng)
# ──────────────────────────────────────────────
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), index=True, nullable=False)
    note = Column(Text, nullable=True)                # Ghi chú: "dị ứng hải sản", "khách quen"
    total_visits = Column(Integer, default=0)         # Tổng số lần đến
    total_spent = Column(Float, default=0.0)           # Tổng chi tiêu
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    visits = relationship("VisitHistory", back_populates="customer")


# ──────────────────────────────────────────────
# Bảng: bookings (phiếu đặt bàn)
# ──────────────────────────────────────────────
class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    guest_count = Column(Integer, nullable=False)
    booking_time = Column(DateTime(timezone=True), nullable=False)  # Giờ khách đến
    note = Column(Text, nullable=True)
    status = Column(String(30), default="reserved")    # reserved | checked_in | completed | cancelled
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    booked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    closed_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    table = relationship("Table", back_populates="bookings")
    booked_by_user = relationship("User", back_populates="bookings")


# ──────────────────────────────────────────────
# Bảng: visit_history (lịch sử tiêu dùng)
# ──────────────────────────────────────────────
class VisitHistory(Base):
    __tablename__ = "visit_history"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    visit_date = Column(DateTime(timezone=True), server_default=func.now())
    table_name = Column(String(50), nullable=True)
    guest_count = Column(Integer, default=0)
    total_amount = Column(Float, default=0.0)
    note = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="visits")


# ──────────────────────────────────────────────
# Bảng: audit_log (nhật ký thao tác)
# ──────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)      # "Tạo booking", "Hủy booking", "Đóng bàn"...
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


# ──────────────────────────────────────────────
# Bảng: table_blocks (khóa bàn theo ngày/giờ)
# VD: Khóa bàn "Tầng 1 - Bàn 2" vào ngày 25/04
#     Không cho booking giờ đến sau 20:00 vào ngày lễ 30/04
# ──────────────────────────────────────────────
class TableBlock(Base):
    __tablename__ = "table_blocks"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)  # Ngày bị khóa
    time_limit = Column(Time, nullable=True)  # Giờ đến tối đa. VD: 20:00 → không cho booking sau 20h. Null = khóa cả ngày.
    reason = Column(String(255), nullable=True)  # Lý do: "Nhà hàng nghỉ lễ", "Bàn hỏng", "Đặt riêng"
    is_holiday = Column(Boolean, default=False)  # Đánh dấu ngày lễ
    blocked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    table = relationship("Table", foreign_keys=[table_id])
    area = relationship("Area", foreign_keys=[area_id])
    blocker = relationship("User", foreign_keys=[blocked_by])
