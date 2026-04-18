# Sử dụng Python 3.11 - đảm bảo có pre-built wheels cho mọi package
FROM python:3.11-slim

WORKDIR /app

# Copy requirements và install dependencies TRƯỚC
# Tách layer này ra để tận dụng Docker cache
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code
COPY . .

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
