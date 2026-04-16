"""
Wrapper entry point — uvicorn gọi 'main:app' từ repo root.
Repo root = thư mục chứa backend/ và frontend/

Khi Render chạy từ repo root (không dùng rootDir), wrapper này
đảm bảo Python tìm thấy package backend/ qua PYTHONPATH hoặc sys.path.
"""
import sys
import os
from pathlib import Path

# Khi chạy từ repo root, thêm repo root vào sys.path
_REPO_ROOT = Path(__file__).resolve().parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Đảm bảo PYTHONPATH luôn chứa repo root
if "PYTHONPATH" not in os.environ or _REPO_ROOT not in os.environ["PYTHONPATH"]:
    os.environ["PYTHONPATH"] = str(_REPO_ROOT)

from backend.main import app

__all__ = ["app"]
