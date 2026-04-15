"""
Router: Tables & Areas - Quản lý khu vực và bàn.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Area, Table, User, AuditLog, TableBlock
from schemas import AreaCreate, AreaUpdate, AreaOut, TableCreate, TableUpdate, TableOut
from auth import get_current_user, require_role

router = APIRouter(prefix="/api", tags=["🪑 Tables & Areas"])


# ─────────────── AREAS ───────────────
@router.get("/areas", response_model=List[AreaOut])
def list_areas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách khu vực (sắp xếp theo display_order)."""
    return db.query(Area).filter(Area.is_active == True).order_by(Area.display_order).all()


@router.post("/areas", response_model=AreaOut)
def create_area(
    area_data: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Tạo khu vực mới (admin + manager)."""
    existing = db.query(Area).filter(Area.name == area_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên khu vực đã tồn tại")
    area = Area(**area_data.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)
    _log(db, current_user.id, "Tạo khu vực", f"Tạo khu vực '{area.name}'")
    return area


@router.put("/areas/{area_id}", response_model=AreaOut)
def update_area(
    area_id: int,
    area_data: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Cập nhật khu vực (admin + manager)."""
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Không tìm thấy khu vực")

    if area_data.name is not None:
        area.name = area_data.name
    if area_data.display_order is not None:
        area.display_order = area_data.display_order
    if area_data.is_active is not None:
        area.is_active = area_data.is_active

    db.commit()
    db.refresh(area)
    _log(db, current_user.id, "Cập nhật khu vực", f"Cập nhật khu vực '{area.name}'")
    return area


@router.delete("/areas/{area_id}")
def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Xóa khu vực và toàn bộ bàn bên trong (chỉ admin)."""
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Không tìm thấy khu vực")

    db.delete(area)
    db.commit()
    _log(db, current_user.id, "Xóa khu vực", f"Xóa khu vực '{area.name}' và các bàn bên trong")
    return {"message": "Đã xóa khu vực và các bàn"}


# ─────────────── TABLES ───────────────
@router.get("/tables", response_model=List[TableOut])
def list_tables(
    area_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách tất cả bàn, có thể lọc theo khu vực."""
    query = db.query(Table, Area.name.label("area_name")).join(Area)
    if area_id:
        query = query.filter(Table.area_id == area_id)
    rows = query.order_by(Area.display_order, Table.name).all()
    result = []
    for table, area_name in rows:
        out = TableOut.model_validate(table)
        out.area_name = area_name
        result.append(out)
    return result


@router.get("/tables-with-areas", response_model=List[dict])
def list_tables_with_areas(
    block_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trả về cấu trúc phân cấp: [{area, tables: []}].
    Nếu truyền block_date (YYYY-MM-DD) sẽ trả thêm thông tin khóa cho từng bàn.
    """
    from datetime import datetime, timedelta, time as time_type

    areas = db.query(Area).filter(Area.is_active == True).order_by(Area.display_order).all()
    result = []

    # Nếu có block_date → lấy danh sách khóa trong ngày đó
    block_map = {}  # table_id -> TableBlock info
    area_block_map = {}  # area_id -> TableBlock info

    if block_date:
        try:
            target_date = datetime.strptime(block_date, "%Y-%m-%d").date()
        except ValueError:
            target_date = None

        if target_date:
            # Dùng func.date() để so sánh theo ngày — an toàn với timezone
            blocks = db.query(TableBlock).filter(
                func.date(TableBlock.date) == target_date
            ).all()
            for b in blocks:
                if b.table_id:
                    block_map[b.table_id] = b
                if b.area_id:
                    area_block_map[b.area_id] = b

    for area in areas:
        tables = db.query(Table).filter(Table.area_id == area.id).order_by(Table.name).all()
        table_list = []
        for t in tables:
            tdata = {
                "id": t.id,
                "name": t.name,
                "capacity": t.capacity,
                "status": t.status,
            }
            # Gắn thông tin khóa
            if block_date and target_date:
                tdata["is_blocked"] = False
                tdata["block_time_limit"] = None
                tdata["block_reason"] = None
                tdata["is_holiday"] = False

                # Ưu tiên block bàn cụ thể
                block = block_map.get(t.id)
                if not block:
                    # Thử block theo khu vực
                    block = area_block_map.get(area.id)

                if block:
                    tdata["is_blocked"] = block.time_limit is None
                    tdata["block_time_limit"] = block.time_limit.strftime("%H:%M") if block.time_limit else None
                    tdata["block_reason"] = block.reason
                    tdata["is_holiday"] = block.is_holiday

            table_list.append(tdata)
        result.append({
            "id": area.id,
            "name": area.name,
            "tables": table_list
        })
    return result


@router.post("/tables", response_model=TableOut)
def create_table(
    table_data: TableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Tạo bàn mới (admin + manager)."""
    area = db.query(Area).filter(Area.id == table_data.area_id, Area.is_active == True).first()
    if not area:
        raise HTTPException(status_code=400, detail="Khu vực không tồn tại")

    existing = db.query(Table).filter(
        Table.area_id == table_data.area_id,
        Table.name == table_data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên bàn đã tồn tại trong khu vực này")

    table = Table(**table_data.model_dump(), status="empty")
    db.add(table)
    db.commit()
    db.refresh(table)
    _log(db, current_user.id, "Tạo bàn", f"Tạo bàn '{table.name}' tại '{area.name}'")
    out = TableOut.model_validate(table)
    out.area_name = area.name
    return out


@router.put("/tables/{table_id}", response_model=TableOut)
def update_table(
    table_id: int,
    table_data: TableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Cập nhật bàn (admin + manager)."""
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    if table_data.name is not None:
        table.name = table_data.name
    if table_data.area_id is not None:
        table.area_id = table_data.area_id
    if table_data.capacity is not None:
        table.capacity = table_data.capacity
    if table_data.status is not None:
        table.status = table_data.status

    db.commit()
    db.refresh(table)
    area = db.query(Area).filter(Area.id == table.area_id).first()
    _log(db, current_user.id, "Cập nhật bàn", f"Cập nhật bàn '{table.name}'")
    out = TableOut.model_validate(table)
    out.area_name = area.name if area else ""
    return out


@router.delete("/tables/{table_id}")
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Xóa bàn (chỉ admin)."""
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn")

    db.delete(table)
    db.commit()
    _log(db, current_user.id, "Xóa bàn", f"Xóa bàn '{table.name}'")
    return {"message": "Đã xóa bàn"}


def _log(db: Session, user_id: int, action: str, details: str = None):
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.add(log)
    db.commit()
