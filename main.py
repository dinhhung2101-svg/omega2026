"""
Wrapper entry point — uvicorn gọi 'main:app' từ repo root.
Repo root = thư mục chứa backend/ và frontend/
"""
import sys
from pathlib import Path

# Thêm repo root vào sys.path để Python tìm thấy package backend/
_REPO_ROOT = Path(__file__).resolve().parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.main import app

__all__ = ["app"]
