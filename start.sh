#!/bin/bash
# Script khởi động đồng thời backend và frontend

echo "========================================"
echo "  Restaurant Booking - Khởi động"
echo "========================================"

# Lấy thư mục chứa script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Tránh lỗi "Address already in use" khi đã chạy start.sh trước đó mà chưa tắt hết
port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}
if port_in_use 8000 || port_in_use 5173; then
  echo ""
  echo "⚠️  Cổng 8000 hoặc 5173 đang bị chiếm (thường do lần chạy trước)."
  echo "    Chạy:  bash \"$SCRIPT_DIR/stop.sh\""
  echo "    Rồi chạy lại start.sh."
  echo ""
  exit 1
fi

# Kiểm tra backend dependencies
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "📦 Đang tạo virtualenv cho backend..."
    python3 -m venv "$SCRIPT_DIR/backend/venv"
    source "$SCRIPT_DIR/backend/venv/bin/activate"
    pip install -r "$SCRIPT_DIR/backend/requirements.txt"
    echo "✅ Backend dependencies đã cài đặt"
fi

# Kiểm tra frontend dependencies
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "📦 Đang cài frontend dependencies..."
    cd "$SCRIPT_DIR/frontend" && npm install
    echo "✅ Frontend dependencies đã cài đặt"
fi

echo ""
echo "🚀 Đang khởi động backend (http://localhost:8000)..."
cd "$SCRIPT_DIR" && source backend/venv/bin/activate && python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "🌐 Đang khởi động frontend (http://localhost:5173)..."
cd "$SCRIPT_DIR/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  ✅ Hệ thống đã khởi động!"
echo "  🌐 Frontend: http://localhost:5173"
echo "  🔧 Backend:  http://localhost:8000"
echo "  📖 API Docs: http://localhost:8000/docs"
echo "========================================"
echo "  Nhấn Ctrl+C để dừng hệ thống"
echo "========================================"

# Đợi và bắt Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '👋 Đã dừng hệ thống'; exit" INT TERM

wait
