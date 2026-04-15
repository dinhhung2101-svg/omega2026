"""
Wrapper entry point at repo root — uvicorn calls 'main:app' from here.
Redirects to backend.main:app so the full backend package is loaded.
"""
from backend.main import app

__all__ = ["app"]
