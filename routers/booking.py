"""
Router: Booking - Đặt bàn, check-in, đóng bàn, gộp/chuyển/tách bàn.
Sự kiện real-time được broadcast qua SSE.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional

from database import get_db
from models import Table, Booking, Customer, User, VisitHistory, AuditLog, Area, TableBlock
from schemas import BookingCreate, BookingUpdate, BookingOut, MergeTables, TransferTable
from auth import get_current_user, require_role
from datetime import time as time_type

router = APIRouter(prefix="/api/bookings", tags=["📋 Booking"])


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────
def _table_out(table: Table) -> dict:
    """Chuyển Table object thành dict cho broadcast."""
    return {
        "id": table.id,
        "name": table.name,
        "area_id": table.area_id,
        "status": table.status,
        "merged_into_id": table.merged_into_id,
    }


def _booking_out(b: Booking) -> BookingOut:
    """Chuyển Booking object thành BookingOut schema."""
    out = BookingOut.model_validate(b)
    out.table_name = b.table.name if b.table else ""
    out.area_name = b.table.area.name if b.table and b.table.area else ""
    out.booked_by_name = b.booked_by_user.full_name if b.booked_by_user else ""
    out.merged_table_ids = []  # Endpoint cụ thể sẽ set khi cần
    return out


def _log(db: Session, user_id: int, action: str, details: str = None):
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.add(log)
    db.commit()


def _check_table_block(db: Session, table: Table, booking_time: datetime) -> None:
    """
    Kiểm tra xem bàn có bị khóa vào ngày/giờ này không.
    Nếu bị khóa → raise HTTPException.

    Bug đã fix: datetime có thể bị timezone-aware (UTC) trong khi date storage dùng naive local.
    Fix: dùng .replace(tzinfo=None) để strip timezone, rồi so sánh bằng date object.
    """
    from datetime import timedelta, time as time_type

    # Strip timezone info nếu có — để so sánh đúng với DB storage
    bt = booking_time
    if bt.tzinfo is not None:
        bt = bt.replace(tzinfo=None)

    booking_date = bt.date()
    booking_time_of_day = bt.time()

    # Tìm block: theo bàn cụ thể HOẶC theo khu vực (table_id=None)
    blocks = db.query(TableBlock).filter(
        (
            (TableBlock.table_id == table.id) |
            ((TableBlock.table_id == None) & (TableBlock.area_id == table.area_id))
        )
    ).filter(
        func.date(TableBlock.date) == booking_date
    ).all()

    for block in blocks:
        # Strip timezone từ block date nếu có
        block_date = block.date
        if block_date.tzinfo is not None:
            block_date = block_date.replace(tzinfo=None)

        if block_date.date() != booking_date:
            continue

        if block.time_limit is None:
            date_str = booking_date.strftime("%d/%m/%Y")
            reason_str = f". Lý do: {block.reason}" if block.reason else ""
            raise HTTPException(
                status_code=403,
                detail=f"Bàn '{table.name}' đã bị khóa vào ngày {date_str}{reason_str}. Không thể đặt."
            )
        if booking_time_of_day > block.time_limit:
            date_str = booking_date.strftime("%d/%m/%Y")
            time_limit_str = block.time_limit.strftime("%H:%M")
            reason_str = f". Lý do: {block.reason}" if block.reason else ""
            raise HTTPException(
                status_code=403,
                detail=f"Ngày {date_str} không nhận booking sau {time_limit_str} cho bàn '{table.name}'{reason_str}."
            )


# ──────────────────────────────────────────────
# BOOKINGS
# ──────────────────────────────────────────────
@router.get("", response_model=List[BookingOut])
def list_bookings(
    date: str = None,
    status: str = None,
    table_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Danh sách booking, lọc theo ngày / trạng thái / bàn.
    date format: YYYY-MM-DD
    """
    query = db.query(Booking).join(Table).join(Area)

    if date:
        query = query.filter(
            func.date(Booking.booking_time) == datetime.strptime(date, "%Y-%m-%d").date()
        )
    if status:
        query = query.filter(Booking.status == status)
    if table_id:
        query = query.filter(Booking.table_id == table_id)

    bookings = query.order_by(Booking.booking_time.desc()).all()
    return [_booking_out(b) for b in bookings]


@router.get("/by-date", response_model=List[BookingOut])
def bookings_by_date(
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách booking trong 1 ngày cụ thể (YYYY-MM-DD), bao gồm tất cả trạng thái."""
    try:
        target = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Định dạng ngày không hợp lệ, dùng YYYY-MM-DD")

    bookings = db.query(Booking).join(Table).join(Area).filter(
        func.date(Booking.booking_time) == target
    ).order_by(Booking.booking_time.asc()).all()

    return [_booking_out(b) for b in bookings]


@router.get("/active", response_model=List[BookingOut])
def list_active_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách booking đang hoạt động (reserved + checked_in)."""
    bookings = db.query(Booking).filter(
        Booking.status.in_(["reserved", "checked_in"])
    ).join(Table).join(Area).order_by(Booking.booking_time.desc()).all()
    return [_booking_out(b) for b in bookings]


@router.get("/search")
def search_bookings(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tìm kiếm booking theo tên / SĐT khách."""
    if not q or len(q) < 2:
        return []
    pattern = f"%{q}%"
    results = db.query(Booking).filter(
        or_(
            Booking.customer_name.ilike(pattern),
            Booking.customer_phone.ilike(pattern)
        )
    ).filter(Booking.status.in_(["reserved", "checked_in"])).limit(20).all()
    return [_booking_out(b) for b in results]


@router.post("", response_model=BookingOut)
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Đặt bàn mới.
    - Bàn chính (table_id) phải đang ở trạng thái 'empty'
    - Các bàn gộp (merged_table_ids) phải cùng khu vực và đều 'empty'
    - Tự động tạo customer mới nếu chưa có trong CRM
    - Khi check-in: bàn chính → 'merged', các bàn gộp → 'empty' (bàn phụ)
    """
    table = db.query(Table).filter(Table.id == data.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    if table.status != "empty":
        raise HTTPException(status_code=400, detail=f"Bàn '{table.name}' hiện không trống (đang: {table.status})")

    # Kiểm tra khóa bàn
    _check_table_block(db, table, data.booking_time)

    # Kiểm tra và lấy các bàn gộp
    merged_tables = []
    if data.merged_table_ids:
        for mid in data.merged_table_ids:
            mtable = db.query(Table).filter(Table.id == mid).first()
            if not mtable:
                raise HTTPException(status_code=404, detail=f"Không tìm thấy bàn gộp ID={mid}")
            if mtable.status != "empty":
                raise HTTPException(status_code=400, detail=f"Bàn gộp '{mtable.name}' không trống (đang: {mtable.status})")
            if mtable.area_id != table.area_id:
                raise HTTPException(status_code=400, detail=f"Bàn gộp '{mtable.name}' phải cùng khu vực với bàn chính")
            if mtable.id == table.id:
                raise HTTPException(status_code=400, detail="Bàn gộp không được trùng với bàn chính")
            merged_tables.append(mtable)

    # Nếu có customer_id từ CRM, lấy thông tin chuẩn; không có thì tạo mới CRM
    customer_id = data.customer_id
    if customer_id:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if customer:
            data.customer_name = customer.name
            data.customer_phone = customer.phone
    else:
        # Tạo mới CRM: tìm theo SĐT, nếu chưa có thì tạo
        existing = db.query(Customer).filter(Customer.phone == data.customer_phone).first()
        if existing:
            customer_id = existing.id
        else:
            new_crm = Customer(name=data.customer_name, phone=data.customer_phone)
            db.add(new_crm)
            db.flush()   # lấy ID ngay mà chưa commit
            customer_id = new_crm.id

    # Tạo booking cho bàn chính
    booking = Booking(
        **data.model_dump(exclude={"customer_id", "merged_table_ids"}),
        booked_by=current_user.id,
        status="reserved",
        customer_id=customer_id,   # gán customer_id đã xử lý ở trên
    )
    db.add(booking)

    # Đánh dấu các bàn gộp là reserved
    for mtable in merged_tables:
        mtable.status = "reserved"

    # Đánh dấu bàn chính là reserved
    # Nếu có bàn gộp, đánh dấu bàn chính sẽ là merged khi check-in
    table.status = "reserved"

    db.commit()
    db.refresh(booking)

    _log(db, current_user.id, "Đặt bàn",
         f"Đặt bàn '{table.name}' (gộp {len(merged_tables)} bàn) cho '{booking.customer_name}' ({booking.customer_phone}), {booking.guest_count} khách, giờ: {booking.booking_time}")

    # Broadcast thay đổi
    from events import event_store as _es
    tables_changed = [_table_out(table)]
    for mtable in merged_tables:
        tables_changed.append(_table_out(mtable))
    _es.broadcast({"type": "table_update", "tables": tables_changed})

    # Trả về booking kèm danh sách bàn gộp
    out = _booking_out(booking)
    out.merged_table_ids = [t.id for t in merged_tables]
    return out


@router.put("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    data: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật thông tin booking (chỉ khi chưa check-in)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")
    if booking.status not in ["reserved"]:
        raise HTTPException(status_code=400, detail="Chỉ có thể cập nhật booking chưa check-in")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(booking, field, value)
    db.commit()
    db.refresh(booking)

    _log(db, current_user.id, "Cập nhật booking", f"Cập nhật booking #{booking.id} của '{booking.customer_name}'")
    return _booking_out(booking)


# ──────────────────────────────────────────────
# CHECK-IN (Khách đã đến)
# ──────────────────────────────────────────────
@router.post("/{booking_id}/check-in", response_model=BookingOut)
def check_in_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Khách đến nhà hàng → bàn chính chuyển 'merged', các bàn gộp chuyển 'empty'."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")
    if booking.status != "reserved":
        raise HTTPException(status_code=400, detail="Booking này đã check-in hoặc đã đóng")

    table = booking.table

    # Tìm các bàn gộp (cùng khu vực, cùng giờ booking, đang reserved)
    merged_tables = db.query(Table).filter(
        Table.area_id == table.area_id,
        Table.status == "reserved",
        Table.id != table.id
    ).join(Booking, Booking.table_id == Table.id).filter(
        Booking.status == "reserved",
        Booking.booking_time == booking.booking_time,
        Booking.customer_phone == booking.customer_phone
    ).all()

    # Nếu tìm được bàn gộp → bàn chính thành merged, bàn gộp thành empty
    is_merged_booking = len(merged_tables) > 0

    table.status = "merged" if is_merged_booking else "occupied"
    booking.status = "checked_in"
    booking.check_in_time = datetime.now(timezone.utc)

    # Các bàn gộp → empty
    for mtable in merged_tables:
        mtable.status = "empty"
        # Cập nhật booking của bàn gộp
        mbooking = db.query(Booking).filter(
            Booking.table_id == mtable.id,
            Booking.status == "reserved"
        ).first()
        if mbooking:
            mbooking.status = "checked_in"
            mbooking.table_id = table.id  # Chuyển booking sang bàn chính
            mbooking.check_in_time = datetime.now(timezone.utc)

    # Tạo lịch sử tiêu dùng
    visit = VisitHistory(
        customer_id=booking.customer_id if booking.customer_id else None,
        booking_id=booking.id,
        table_name=table.name,
        guest_count=booking.guest_count,
    )
    db.add(visit)

    # Cập nhật tổng lượt đến của khách
    if booking.customer_id:
        customer = db.query(Customer).filter(Customer.id == booking.customer_id).first()
        if customer:
            customer.total_visits += 1

    db.commit()
    db.refresh(booking)

    _log(db, current_user.id, "Check-in",
         f"Khách '{booking.customer_name}' đến, ngồi bàn '{table.name}'" +
         (f" (gộp {len(merged_tables)} bàn)" if is_merged_booking else ""))

    from events import event_store as _es
    tables_changed = [_table_out(table)]
    for mtable in merged_tables:
        tables_changed.append(_table_out(mtable))
    _es.broadcast({"type": "table_update", "tables": tables_changed})

    out = _booking_out(booking)
    out.merged_table_ids = [t.id for t in merged_tables]
    return out


# ──────────────────────────────────────────────
# MỞ BÀN (Walk-in - không đặt trước)
# ──────────────────────────────────────────────
class WalkInRequest(BaseModel):
    table_id: int
    customer_name: str
    customer_phone: str
    guest_count: int = Field(..., ge=1, le=50)
    note: Optional[str] = None
    customer_id: Optional[int] = None


@router.post("/walk-in", response_model=BookingOut)
def walk_in_booking(
    req: WalkInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mở bàn cho khách không đặt trước (walk-in)."""
    table = db.query(Table).filter(Table.id == req.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    if table.status not in ["empty"]:
        raise HTTPException(status_code=400, detail=f"Bàn '{table.name}' hiện không trống")

    # Kiểm tra khóa bàn
    _check_table_block(db, table, datetime.now(timezone.utc))

    # Tìm hoặc tạo CRM
    if req.customer_id:
        customer = db.query(Customer).filter(Customer.id == req.customer_id).first()
    else:
        customer = db.query(Customer).filter(Customer.phone == req.customer_phone).first()
    if not customer:
        customer = Customer(name=req.customer_name, phone=req.customer_phone)
        db.add(customer)
        db.flush()

    booking = Booking(
        table_id=req.table_id,
        customer_id=customer.id,
        customer_name=req.customer_name,
        customer_phone=req.customer_phone,
        guest_count=req.guest_count,
        booking_time=datetime.now(timezone.utc),
        note=req.note,
        booked_by=current_user.id,
        status="checked_in",
        check_in_time=datetime.now(timezone.utc),
    )
    db.add(booking)
    table.status = "occupied"

    # Tăng tổng lượt đến
    customer.total_visits = (customer.total_visits or 0) + 1

    visit = VisitHistory(
        customer_id=customer.id,
        booking_id=None,
        table_name=table.name,
        guest_count=req.guest_count,
    )
    db.add(visit)

    db.commit()
    db.refresh(booking)

    _log(db, current_user.id, "Mở bàn (walk-in)", f"Mở bàn '{table.name}' cho '{req.customer_name}', {req.guest_count} khách")

    from events import event_store as _es
    _es.broadcast({"type": "table_update", "tables": [_table_out(table)]})

    return _booking_out(booking)


class CloseBookingRequest(BaseModel):
    total_amount: float = 0.0
    note: Optional[str] = None


class CancelBookingRequest(BaseModel):
    reason: Optional[str] = None


class UnmergeRequest(BaseModel):
    table_id: int
    new_table_id: int
    guest_count: int = Field(..., ge=1, le=50)


# ──────────────────────────────────────────────
# ĐÓNG BÀN (Checkout)
# ──────────────────────────────────────────────
@router.post("/{booking_id}/close", response_model=BookingOut)
def close_booking(
    booking_id: int,
    req: CloseBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đóng bàn: khách thanh toán xong, bàn trở về trống."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")
    if booking.status not in ["reserved", "checked_in"]:
        raise HTTPException(status_code=400, detail="Booking này đã đóng hoặc hủy")

    table = booking.table
    was_merged = table.status == "merged"

    # Tìm các bàn gộp nếu là bàn merged
    merged_tables = []
    if was_merged:
        merged_tables = db.query(Table).filter(
            Table.merged_into_id == table.id
        ).all()

    table.status = "empty"
    table.merged_into_id = None
    booking.status = "completed"
    booking.closed_time = datetime.now(timezone.utc)

    # Reset các bàn gộp về empty
    for mtable in merged_tables:
        mtable.status = "empty"
        mtable.merged_into_id = None

    # Cập nhật lịch sử tiêu dùng với số tiền
    visit = db.query(VisitHistory).filter(
        VisitHistory.booking_id == booking.id
    ).order_by(VisitHistory.id.desc()).first()
    if visit:
        visit.total_amount = req.total_amount
        if req.note:
            visit.note = req.note

    # Cập nhật tổng chi tiêu khách
    if booking.customer_id and req.total_amount > 0:
        customer = db.query(Customer).filter(Customer.id == booking.customer_id).first()
        if customer:
            customer.total_spent += req.total_amount

    db.commit()
    db.refresh(booking)

    _log(db, current_user.id, "Đóng bàn",
         f"Đóng bàn '{table.name}' của '{booking.customer_name}', doanh thu: {req.total_amount:,}đ" +
         (f" (gộp {len(merged_tables)} bàn)" if was_merged else ""))

    from events import event_store as _es
    tables_changed = [_table_out(table)]
    for mtable in merged_tables:
        tables_changed.append(_table_out(mtable))
    _es.broadcast({"type": "table_update", "tables": tables_changed})

    out = _booking_out(booking)
    out.merged_table_ids = [t.id for t in merged_tables]
    return out


# ──────────────────────────────────────────────
# HỦY BOOKING
# ──────────────────────────────────────────────
@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    req: CancelBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Hủy booking, bàn trở về trống."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")
    if booking.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Booking này đã hoàn thành hoặc hủy trước đó")

    table = booking.table
    was_merged = table.status == "merged"

    # Tìm các bàn gộp nếu là bàn merged
    merged_tables = []
    if was_merged:
        merged_tables = db.query(Table).filter(
            Table.merged_into_id == table.id
        ).all()

    table.status = "empty"
    table.merged_into_id = None
    booking.status = "cancelled"

    # Reset các bàn gộp về empty
    for mtable in merged_tables:
        mtable.status = "empty"
        mtable.merged_into_id = None

    db.commit()

    _log(db, current_user.id, "Hủy booking",
         f"Hủy booking #{booking.id} của '{booking.customer_name}' - Lý do: {req.reason or 'Không rõ'}")

    from events import event_store as _es
    tables_changed = [_table_out(table)]
    for mtable in merged_tables:
        tables_changed.append(_table_out(mtable))
    _es.broadcast({"type": "table_update", "tables": tables_changed})

    return {"message": "Đã hủy booking"}


# ──────────────────────────────────────────────
# GỘP BÀN
# ──────────────────────────────────────────────
@router.post("/merge")
def merge_tables(
    data: MergeTables,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Gộp bàn trống vào bàn đang có khách để mở rộng chỗ ngồi.

    Bàn chính (to_table) phải đang có khách (occupied/merged).
    Bàn gộp (from_table) phải đang trống (empty) và cùng khu vực.
    Sau khi gộp: from_table → merged_into_id = to_table.id, to_table giữ nguyên status.
    """
    from_table = db.query(Table).filter(Table.id == data.from_table_id).first()
    to_table = db.query(Table).filter(Table.id == data.to_table_id).first()

    if not from_table or not to_table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    if to_table.status not in ["occupied", "merged"]:
        raise HTTPException(status_code=400, detail="Bàn chính phải đang có khách mới gộp được")
    if from_table.status != "empty":
        raise HTTPException(status_code=400, detail="Bàn gộp phải đang trống mới gộp được")
    if from_table.area_id != to_table.area_id:
        raise HTTPException(status_code=400, detail="Hai bàn phải cùng khu vực mới gộp được")

    # Cập nhật mối quan hệ merged (bàn trống gộp vào bàn chính)
    from_table.merged_into_id = to_table.id
    # to_table giữ nguyên trạng thái (occupied hoặc merged), không cần đổi

    db.commit()

    _log(db, current_user.id, "Gộp bàn",
         f"Gộp bàn trống '{from_table.name}' vào '{to_table.name}'")

    from events import event_store as _es
    _es.broadcast({
        "type": "table_update",
        "tables": [_table_out(from_table), _table_out(to_table)]
    })

    return {
        "message": f"Đã gộp bàn trống '{from_table.name}' vào '{to_table.name}'",
        "from_table": _table_out(from_table),
        "to_table": _table_out(to_table)
    }


# ──────────────────────────────────────────────
# CHUYỂN BÀN
# ──────────────────────────────────────────────
@router.post("/transfer")
def transfer_table(
    data: TransferTable,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Chuyển khách từ bàn này sang bàn khác.

    - Từ bàn occupied/merged → bàn empty
    - Nếu bàn nguồn là merged: chỉ chuyển 1 booking, bàn nguồn vẫn giữ trạng thái merged nếu còn bàn gộp khác
    """
    from_table = db.query(Table).filter(Table.id == data.from_table_id).first()
    to_table = db.query(Table).filter(Table.id == data.to_table_id).first()

    if not from_table or not to_table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    if from_table.status not in ["occupied", "merged"]:
        raise HTTPException(status_code=400, detail="Bàn nguồn không có khách")
    if to_table.status not in ["empty"]:
        raise HTTPException(status_code=400, detail="Bàn đích phải đang trống")

    from_bookings = db.query(Booking).filter(
        Booking.table_id == from_table.id,
        Booking.status.in_(["reserved", "checked_in"])
    ).all()
    for b in from_bookings:
        b.table_id = to_table.id

    # Cập nhật mối quan hệ merged
    # Nếu from_table đang gộp vào 1 bàn khác
    if from_table.merged_into_id:
        # Các bàn gộp khác vào cùng 1 bàn
        other_merged = db.query(Table).filter(
            Table.merged_into_id == from_table.merged_into_id,
            Table.id != from_table.id
        ).count()
        if other_merged > 0:
            from_table.merged_into_id = None
        else:
            # Không còn bàn nào gộp vào cùng, chuyển bàn gốc về occupied
            main_table = db.query(Table).filter(Table.id == from_table.merged_into_id).first()
            if main_table:
                main_table.status = "occupied"
            from_table.merged_into_id = None

    from_table.status = "empty"
    to_table.status = "occupied"

    db.commit()

    _log(db, current_user.id, "Chuyển bàn",
         f"Chuyển khách từ bàn '{from_table.name}' sang bàn '{to_table.name}'")

    from events import event_store as _es
    _es.broadcast({
        "type": "table_update",
        "tables": [_table_out(from_table), _table_out(to_table)]
    })

    return {"message": f"Đã chuyển bàn '{from_table.name}' → '{to_table.name}'"}


# ──────────────────────────────────────────────
# TÁCH BÀN
# ──────────────────────────────────────────────
@router.post("/unmerge")
def unmerge_table(
    req: UnmergeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Tách bàn: tách 1 nhóm khách ra từ bàn ghép (merged) sang bàn trống.

    Bàn ghép giữ lại 1 nhóm khách, bàn mới nhận nhóm khách còn lại.
    """
    merged_table = db.query(Table).filter(Table.id == req.table_id).first()
    new_table = db.query(Table).filter(Table.id == req.new_table_id).first()

    if not merged_table or not new_table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    if merged_table.status != "merged":
        raise HTTPException(status_code=400, detail="Bàn không phải bàn ghép")
    if new_table.status != "empty":
        raise HTTPException(status_code=400, detail="Bàn muốn tách ra phải đang trống")

    # Tạo booking mới cho bàn tách
    main_booking = db.query(Booking).filter(
        Booking.table_id == merged_table.id,
        Booking.status == "checked_in"
    ).first()

    if main_booking:
        new_booking = Booking(
            table_id=new_table.id,
            customer_name=main_booking.customer_name + " (tách bàn)",
            customer_phone=main_booking.customer_phone,
            guest_count=req.guest_count,
            booking_time=datetime.now(timezone.utc),
            booked_by=current_user.id,
            status="checked_in",
            check_in_time=datetime.now(timezone.utc),
        )
        db.add(new_booking)
        visit = VisitHistory(
            booking_id=None,
            table_name=new_table.name,
            guest_count=req.guest_count,
        )
        db.add(visit)

    # Xóa mối quan hệ merged
    old_merged_from_id = None
    merged_from = db.query(Table).filter(Table.merged_into_id == merged_table.id).first()
    if merged_from:
        old_merged_from_id = merged_from.id
        merged_from.merged_into_id = None

    new_table.status = "occupied"
    merged_table.status = "occupied"

    # Nếu không còn bàn nào gộp vào merged_table, chuyển về occupied
    still_merged = db.query(Table).filter(
        Table.merged_into_id == merged_table.id
    ).first()
    if not still_merged:
        merged_table.status = "occupied"

    db.commit()

    _log(db, current_user.id, "Tách bàn",
         f"Tách bàn '{new_table.name}' từ bàn ghép '{merged_table.name}', {req.guest_count} khách")

    from events import event_store as _es
    tables_updated = [_table_out(merged_table), _table_out(new_table)]
    if merged_from:
        tables_updated.append(_table_out(merged_from))
    _es.broadcast({
        "type": "table_update",
        "tables": tables_updated
    })

    return {
        "message": f"Đã tách bàn '{new_table.name}' từ bàn ghép",
        "new_table": _table_out(new_table),
        "merged_table": _table_out(merged_table)
    }
