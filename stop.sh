#!/bin/bash
# Dừng tiến trình đang chiếm cổng dev (backend 8000, frontend Vite 5173/5174)

echo "Đang giải phóng cổng 8000, 5173, 5174..."

for port in 8000 5173 5174; do
  pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null && echo "  Đã dừng PID $pid (cổng $port)"
    done
  fi
done

sleep 1

for port in 8000 5173 5174; do
  pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null && echo "  Buộc dừng PID $pid (cổng $port)"
    done
  fi
done

echo "Xong. Kiểm tra: lsof -i :8000 -i :5173"
