"""
Router: Dashboard - Báo cáo doanh thu, thống kê.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime, timedelta, timezone
from database import get_db
from models import Booking, VisitHistory, User, AuditLog, Table, Area, Customer
from schemas import DailyStats, StaffPerformance, AuditLogOut
from auth import get_current_user, require_role

router = APIRouter(prefix="/api/dashboard", tags=["📊 Dashboard"])


@router.get("/daily-stats")
def daily_stats(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Thống kê theo ngày trong N ngày gần nhất."""
    today = datetime.now(timezone.utc).date()
    stats = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        # Đếm booking theo ngày
        bookings = db.query(Booking).filter(
            func.date(Booking.booking_time) == day
        ).all()
        total_bookings = len([b for b in bookings if b.status != "cancelled"])
        total_walkins = len([b for b in bookings if b.status == "checked_in"])
        # Doanh thu = tổng visit_history.total_amount trong ngày
        revenue = db.query(func.coalesce(func.sum(VisitHistory.total_amount), 0)).filter(
            func.date(VisitHistory.visit_date) == day
        ).scalar()
        stats.append(DailyStats(
            date=day.strftime("%Y-%m-%d"),
            total_bookings=total_bookings,
            total_walkins=total_walkins,
            total_revenue=float(revenue or 0)
        ))
    return stats


@router.get("/staff-performance")
def staff_performance(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Thành tích booking theo nhân viên."""
    query = db.query(
        User.id,
        User.full_name,
        func.count(Booking.id).label("total_bookings"),
        func.coalesce(func.sum(Booking.guest_count), 0).label("total_guests"),
    ).join(Booking, User.id == Booking.booked_by).filter(
        Booking.status.in_(["reserved", "checked_in", "completed"])
    )
    if start_date:
        query = query.filter(func.date(Booking.booking_time) >= start_date)
    if end_date:
        query = query.filter(func.date(Booking.booking_time) <= end_date)
    results = query.group_by(User.id, User.full_name).order_by(func.count(Booking.id).desc()).all()
    return [
        StaffPerformance(
            user_id=r.id,
            user_name=r.full_name,
            total_bookings=r.total_bookings,
            total_guests=int(r.total_guests),
        )
        for r in results
    ]


@router.get("/overview")
def dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Tổng quan: số bàn trống / đặt / có khách hôm nay."""
    today = datetime.now(timezone.utc).date()
    tables = db.query(Table).all()
    empty = len([t for t in tables if t.status == "empty"])
    reserved = len([t for t in tables if t.status == "reserved"])
    occupied = len([t for t in tables if t.status in ("occupied", "merged")])
    # Booking hôm nay
    today_bookings = db.query(Booking).filter(
        func.date(Booking.booking_time) == today
    ).all()
    pending = len([b for b in today_bookings if b.status == "reserved"])
    checked_in = len([b for b in today_bookings if b.status == "checked_in"])
    # Doanh thu hôm nay
    revenue_today = db.query(func.coalesce(func.sum(VisitHistory.total_amount), 0)).filter(
        func.date(VisitHistory.visit_date) == today
    ).scalar()
    # Tổng khách hàng
    total_customers = db.query(func.count()).select_from(VisitHistory).filter(
        func.date(VisitHistory.visit_date) == today
    ).scalar()
    return {
        "tables": {"empty": empty, "reserved": reserved, "occupied": occupied, "total": len(tables)},
        "bookings_today": {"pending": pending, "checked_in": checked_in, "total": len(today_bookings)},
        "revenue_today": float(revenue_today or 0),
        "visits_today": total_customers or 0,
    }


@router.get("/top-customers")
def top_customers(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Top khách hàng VIP (nhiều lần đến nhất)."""
    from models import Customer
    results = db.query(Customer).order_by(Customer.total_visits.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "total_visits": c.total_visits,
            "total_spent": c.total_spent,
        }
        for c in results
    ]


@router.get("/audit-logs", response_model=List[AuditLogOut])
def audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Nhật ký thao tác gần nhất."""
    logs = db.query(AuditLog).join(User).order_by(
        AuditLog.created_at.desc()
    ).limit(limit).all()
    result = []
    for log in logs:
        out = AuditLogOut.model_validate(log)
        out.user_name = log.user.full_name if log.user else ""
        result.append(out)
    return result
