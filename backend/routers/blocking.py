"""
Router: Table Blocking - Khóa bàn theo ngày/giờ.
Chỉ admin và manager được phép thao tác khóa bàn.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date as date_type, datetime, time as time_type, timezone
from pydantic import BaseModel

from backend.database import get_db
from backend.models import TableBlock, Table, Area, User, AuditLog
from backend.schemas import TableBlockCreate, TableBlockOut
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/api/blocks", tags=["🔒 Khóa Bàn"])


def _block_out(b: TableBlock) -> TableBlockOut:
    out = TableBlockOut.model_validate(b)
    out.blocked_by_name = b.blocker.full_name if b.blocker else ""
    if b.table:
        out.table_name = b.table.name
    if b.area:
        out.area_name = b.area.name
    return out


def _log(db: Session, user_id: int, action: str, details: str = None):
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.add(log)
    db.commit()


# ──────────────────────────────────────────────
# Danh sách khóa bàn
# ──────────────────────────────────────────────
@router.get("", response_model=List[TableBlockOut])
def list_blocks(
    block_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách tất cả khóa bàn. Lọc theo ngày (YYYY-MM-DD) nếu cần."""
    query = db.query(TableBlock)

    if block_date:
        try:
            target = datetime.strptime(block_date, "%Y-%m-%d").date()
            query = query.filter(func.date(TableBlock.date) == target)
        except ValueError:
            raise HTTPException(status_code=400, detail="Định dạng ngày không hợp lệ, dùng YYYY-MM-DD")

    blocks = query.order_by(TableBlock.date.desc()).all()
    return [_block_out(b) for b in blocks]


@router.get("/active", response_model=List[TableBlockOut])
def list_active_blocks(
    block_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách khóa bàn đang active (ngày khóa >= hôm nay)."""
    today = datetime.now(timezone.utc).date()
    query = db.query(TableBlock).filter(func.date(TableBlock.date) >= today)

    if block_date:
        try:
            target = datetime.strptime(block_date, "%Y-%m-%d").date()
            query = query.filter(func.date(TableBlock.date) == target)
        except ValueError:
            raise HTTPException(status_code=400, detail="Định dạng ngày không hợp lệ, dùng YYYY-MM-DD")

    blocks = query.order_by(TableBlock.date.asc()).all()
    return [_block_out(b) for b in blocks]


# ──────────────────────────────────────────────
# Tạo khóa bàn (khóa 1 bàn hoặc cả khu vực)
# ──────────────────────────────────────────────
@router.post("", response_model=TableBlockOut)
def create_block(
    data: TableBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """
    Tạo khóa cho bàn hoặc khu vực.

    - Chỉ khóa bàn cụ thể: truyền table_id
    - Khóa cả khu vực: truyền area_id (tất cả bàn trong khu vực bị khóa)
    - time_limit = null → khóa cả ngày (không cho đặt)
    - time_limit = 20:00 → không cho booking giờ đến sau 20h
    """
    block_date = datetime.combine(data.date, time_type(0, 0))

    # Validate: có bàn hoặc khu vực
    if data.table_id:
        table = db.query(Table).filter(Table.id == data.table_id).first()
        if not table:
            raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    elif data.area_id:
        area = db.query(Area).filter(Area.id == data.area_id, Area.is_active == True).first()
        if not area:
            raise HTTPException(status_code=404, detail="Không tìm thấy khu vực")
    else:
        raise HTTPException(status_code=400, detail="Phải chọn ít nhất table_id hoặc area_id")

    # Kiểm tra trùng: không cho khóa trùng bàn + ngày
    existing = db.query(TableBlock).filter(
        TableBlock.table_id == data.table_id,
        TableBlock.area_id == data.area_id,
        TableBlock.date == block_date
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Đã có khóa cho bàn này vào ngày {data.date}. Vui lòng xóa khóa cũ trước."
        )

    block = TableBlock(
        table_id=data.table_id,
        area_id=data.area_id,
        date=block_date,
        time_limit=data.time_limit,
        reason=data.reason,
        is_holiday=data.is_holiday,
        blocked_by=current_user.id,
    )
    db.add(block)
    db.commit()
    db.refresh(block)

    target_name = data.table_id and f"bàn '{block.table.name}'" or f"khu vực '{block.area.name}'"
    time_hint = f" không nhận booking sau {data.time_limit}" if data.time_limit else " cả ngày"
    _log(db, current_user.id, "Khóa bàn",
         f"Khóa {target_name} vào ngày {data.date}{time_hint}. Lý do: {data.reason or 'Không có'}")

    return _block_out(block)


# ──────────────────────────────────────────────
# Tạo nhiều khóa cùng lúc (quét khoảng ngày)
# VD: Khóa bàn VIP từ 20/04 → 30/04
# ──────────────────────────────────────────────
class TableBlockBulkCreate(BaseModel):
    table_id: Optional[int] = None
    area_id: Optional[int] = None
    start_date: date_type
    end_date: date_type
    time_limit: Optional[time_type] = None
    reason: Optional[str] = None
    is_holiday: bool = False

    class Config:
        arbitrary_types_allowed = True


@router.post("/bulk", response_model=List[TableBlockOut])
def create_blocks_bulk(
    data: TableBlockBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """
    Tạo khóa hàng loạt cho 1 bàn hoặc 1 khu vực trong khoảng ngày.
    VD: Khóa "VIP 1" từ 20/04 đến 30/04.
    """
    from datetime import timedelta

    if data.start_date > data.end_date:
        raise HTTPException(status_code=400, detail="Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")

    # Giới hạn tối đa 90 ngày để tránh lỗi
    if (data.end_date - data.start_date).days > 90:
        raise HTTPException(status_code=400, detail="Khoảng ngày không được vượt quá 90 ngày")

    if not data.table_id and not data.area_id:
        raise HTTPException(status_code=400, detail="Phải chọn ít nhất table_id hoặc area_id")

    if data.table_id:
        table = db.query(Table).filter(Table.id == data.table_id).first()
        if not table:
            raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
    elif data.area_id:
        area = db.query(Area).filter(Area.id == data.area_id, Area.is_active == True).first()
        if not area:
            raise HTTPException(status_code=404, detail="Không tìm thấy khu vực")

    created = []
    current = data.start_date
    while current <= data.end_date:
        block_date = datetime.combine(current, time_type(0, 0))

        existing = db.query(TableBlock).filter(
            TableBlock.table_id == data.table_id,
            TableBlock.area_id == data.area_id,
            TableBlock.date == block_date
        ).first()

        if not existing:
            block = TableBlock(
                table_id=data.table_id,
                area_id=data.area_id,
                date=block_date,
                time_limit=data.time_limit,
                reason=data.reason,
                is_holiday=data.is_holiday,
                blocked_by=current_user.id,
            )
            db.add(block)
            created.append(block)

        current += timedelta(days=1)

    db.commit()
    for b in created:
        db.refresh(b)

    target_name = data.table_id and f"bàn" or f"khu vực"
    _log(db, current_user.id, "Khóa bàn (hàng loạt)",
         f"Khóa {target_name} từ {data.start_date} đến {data.end_date}. Lý do: {data.reason or 'Không có'}")

    return [_block_out(b) for b in created]


# ──────────────────────────────────────────────
# Xóa khóa bàn (mở khóa)
# ──────────────────────────────────────────────
@router.delete("/{block_id}")
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Xóa khóa bàn (mở khóa)."""
    block = db.query(TableBlock).filter(TableBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa bàn")

    block_date_str = block.date.strftime("%Y-%m-%d")
    target_name = f"bàn '{block.table.name}'" if block.table else f"khu vực '{block.area.name}'"

    db.delete(block)
    db.commit()

    _log(db, current_user.id, "Mở khóa bàn",
         f"Mở khóa {target_name} vào ngày {block_date_str}")

    return {"message": "Đã mở khóa bàn"}


@router.delete("/by-date/{block_date}")
def delete_blocks_by_date(
    block_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Xóa tất cả khóa bàn trong 1 ngày (dọn ngày lễ cũ)."""
    try:
        target = datetime.strptime(block_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Định dạng ngày không hợp lệ")

    deleted = db.query(TableBlock).filter(
        func.date(TableBlock.date) == target
    ).delete()
    db.commit()

    _log(db, current_user.id, "Xóa khóa theo ngày",
         f"Xóa {deleted} khóa bàn trong ngày {block_date}")

    return {"message": f"Đã xóa {deleted} khóa bàn trong ngày {block_date}"}
