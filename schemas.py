"""
Pydantic Schemas - Định nghĩa validation cho data nhận vào / trả ra từ API.
Bảo vệ data, tự động convert kiểu, tự động generate Swagger docs.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date as date_type, time as time_type


# ──────────────────────────────────────────────
# Auth Schemas
# ──────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="staff")


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Area Schemas
# ──────────────────────────────────────────────
class AreaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_order: int = 0


class AreaUpdate(BaseModel):
    name: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class AreaOut(BaseModel):
    id: int
    name: str
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Table Schemas
# ──────────────────────────────────────────────
class TableCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    area_id: int
    capacity: int = Field(default=4, ge=1, le=50)


class TableUpdate(BaseModel):
    name: Optional[str] = None
    area_id: Optional[int] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    merged_into_id: Optional[int] = None


class TableOut(BaseModel):
    id: int
    name: str
    area_id: int
    area_name: str = ""
    capacity: int
    status: str
    merged_into_id: Optional[int] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Customer (CRM) Schemas
# ──────────────────────────────────────────────
class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=6, max_length=20)
    note: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    note: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str
    note: Optional[str]
    total_visits: int
    total_spent: float
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Booking Schemas
# ──���───────────────────────────────────────────
class BookingCreate(BaseModel):
    table_id: int
    customer_name: str = Field(..., min_length=1, max_length=100)
    customer_phone: str = Field(..., min_length=6, max_length=20)
    guest_count: int = Field(..., ge=1)
    booking_time: datetime
    note: Optional[str] = None
    customer_id: Optional[int] = None
    merged_table_ids: Optional[List[int]] = Field(default_factory=list, description="Danh sách ID các bàn cần gộp (ngoài table_id)")


class BookingUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    guest_count: Optional[int] = None
    booking_time: Optional[datetime] = None
    note: Optional[str] = None


class BookingOut(BaseModel):
    id: int
    table_id: int
    table_name: str = ""
    area_name: str = ""
    customer_name: str
    customer_phone: str
    guest_count: int
    booking_time: datetime
    note: Optional[str]
    status: str
    booked_by_name: str = ""
    check_in_time: Optional[datetime]
    closed_time: Optional[datetime]
    created_at: datetime
    merged_table_ids: List[int] = Field(default_factory=list, description="Các bàn đã gộp với bàn chính")

    class Config:
        from_attributes = True


class TableAction(BaseModel):
    """Schema chung cho các action: gộp bàn, chuyển bàn, mở bàn khách vãng lai"""
    table_id: int


class MergeTables(BaseModel):
    from_table_id: int
    to_table_id: int


class TransferTable(BaseModel):
    from_table_id: int
    to_table_id: int


# ──────────────────────────────────────────────
# Dashboard Schemas
# ──────────────────────────────────────────────
class DailyStats(BaseModel):
    date: str
    total_bookings: int
    total_walkins: int
    total_revenue: float


class StaffPerformance(BaseModel):
    user_id: int
    user_name: str
    total_bookings: int
    total_guests: int


class AuditLogOut(BaseModel):
    id: int
    user_id: int
    user_name: str = ""
    action: str
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# TableBlock Schemas (Khóa bàn)
# ──────────────────────────────────────────────
class TableBlockCreate(BaseModel):
    """Tạo khóa bàn."""
    table_id: Optional[int] = Field(default=None, description="ID bàn cụ thể. Null = khóa cả khu vực")
    area_id: Optional[int] = Field(default=None, description="ID khu vực. Null = khóa bàn cụ thể")
    date: date_type = Field(..., description="Ngày bị khóa (YYYY-MM-DD)")
    time_limit: Optional[time_type] = Field(
        default=None,
        description="Giờ đến tối đa. VD: 20:00 → không cho booking sau 20h. Null = khóa cả ngày."
    )
    reason: Optional[str] = Field(default=None, max_length=255, description="Lý do khóa")
    is_holiday: bool = Field(default=False, description="Đánh dấu ngày lễ")

    def model_post_init(self, __context):
        if self.table_id is None and self.area_id is None:
            raise ValueError("Phải chọn ít nhất table_id hoặc area_id")


class TableBlockOut(BaseModel):
    id: int
    table_id: Optional[int]
    area_id: Optional[int]
    date: datetime
    time_limit: Optional[time_type]
    reason: Optional[str]
    is_holiday: bool
    blocked_by: int
    blocked_by_name: str = ""
    table_name: Optional[str] = ""
    area_name: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True