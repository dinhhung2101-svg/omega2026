"""
Router: CRM - Quản lý khách hàng và lịch sử tiêu dùng.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Customer, VisitHistory, User, AuditLog
from backend.schemas import CustomerCreate, CustomerUpdate, CustomerOut
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/api/crm", tags=["👥 CRM"])


def _log(db: Session, user_id: int, action: str, details: str = None):
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.add(log)
    db.commit()


@router.get("/customers", response_model=List[CustomerOut])
def list_customers(
    search: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách khách hàng, có tìm kiếm theo tên/SĐT."""
    query = db.query(Customer)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Customer.name.ilike(pattern) | Customer.phone.ilike(pattern)
        )
    return query.order_by(Customer.total_visits.desc(), Customer.created_at.desc()).limit(100).all()


@router.get("/customers/lookup")
def lookup_customer(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tìm kiếm nhanh khách hàng (autocomplete đặt bàn).

    Route cố định /customers/lookup phải đứng trước /customers/{customer_id}
    để FastAPI không parse chữ lookup thành id số.
    """
    if not q or len(q) < 2:
        return []
    pattern = f"%{q}%"
    customers = db.query(Customer).filter(
        Customer.name.ilike(pattern) | Customer.phone.ilike(pattern)
    ).limit(10).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "note": c.note,
            "total_visits": c.total_visits,
        }
        for c in customers
    ]


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy chi tiết 1 khách hàng."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    return customer


@router.post("/customers", response_model=CustomerOut)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Thêm khách hàng mới vào CRM."""
    existing = db.query(Customer).filter(Customer.phone == data.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Số điện thoại đã tồn tại trong CRM")

    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    _log(db, current_user.id, "Thêm khách hàng CRM", f"Thêm khách hàng '{customer.name}' ({customer.phone})")
    return customer


@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager", "staff"))
):
    """Cập nhật thông tin khách hàng."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    _log(db, current_user.id, "Cập nhật khách hàng", f"Cập nhật khách hàng '{customer.name}'")
    return customer


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Xóa khách hàng (admin + manager)."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    db.delete(customer)
    db.commit()
    _log(db, current_user.id, "Xóa khách hàng", f"Xóa khách hàng '{customer.name}'")
    return {"message": "Đã xóa khách hàng"}


@router.get("/customers/{customer_id}/visits", response_model=List[dict])
def get_customer_visits(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy lịch sử tiêu dùng của khách hàng."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    visits = db.query(VisitHistory).filter(
        VisitHistory.customer_id == customer_id
    ).order_by(VisitHistory.visit_date.desc()).limit(50).all()

    return [
        {
            "id": v.id,
            "visit_date": v.visit_date,
            "table_name": v.table_name,
            "guest_count": v.guest_count,
            "total_amount": v.total_amount,
            "note": v.note,
        }
        for v in visits
    ]
