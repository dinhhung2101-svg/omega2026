"""
Router: Authentication - Đăng nhập, đăng xuất, quản lý tài khoản.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional

from database import get_db
from models import User, AuditLog
from schemas import UserCreate, UserOut, Token
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_role, ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/api/auth", tags=["🔐 Authentication"])


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Đăng nhập bằng username/password, trả về JWT token."""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa"
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserOut)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Tạo tài khoản mới (chỉ admin)."""
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")

    new_user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    _log_action(db, current_user.id, "Tạo tài khoản", f"Tạo tài khoản {new_user.username} ({new_user.role})")
    return new_user


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin user hiện tại."""
    return current_user


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager"))
):
    """Danh sách tài khoản (admin + manager)."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.put("/users/{user_id}/toggle-active", response_model=UserOut)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Kích hoạt / vô hiệu hóa tài khoản (chỉ admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản của mình")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    _log_action(db, current_user.id, "Thay đổi trạng thái tài khoản",
                f"{'Kích hoạt' if user.is_active else 'Vô hiệu hóa'} tài khoản {user.username}")
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Xóa tài khoản (chỉ admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản của mình")

    db.delete(user)
    db.commit()
    _log_action(db, current_user.id, "Xóa tài khoản", f"Xóa tài khoản {user.username}")
    return {"message": "Đã xóa tài khoản"}


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    full_name: Optional[str] = None,
    role: Optional[str] = None,
    password: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Cập nhật thông tin tài khoản (chỉ admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    if full_name:
        user.full_name = full_name
    if role:
        user.role = role
    if password:
        user.hashed_password = get_password_hash(password)

    db.commit()
    db.refresh(user)
    _log_action(db, current_user.id, "Cập nhật tài khoản", f"Cập nhật tài khoản {user.username}")
    return user


def _log_action(db: Session, user_id: int, action: str, details: str = None):
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.add(log)
    db.commit()
