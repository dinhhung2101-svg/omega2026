"""
Server-Sent Events (SSE) - Real-time broadcast cho tất cả các máy trạm.
Khi bàn thay đổi trạng thái, tất cả trình duyệt đang mở sẽ nhận được thông báo ngay lập tức.
"""
import asyncio
from typing import List, Dict, Any
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
import json

router = APIRouter(tags=["⚡ Real-time SSE"])


class EventStore:
    """Lưu trữ danh sách client đang kết nối SSE."""

    def __init__(self):
        self.clients: List[asyncio.Queue] = []

    async def connect(self) -> asyncio.Queue:
        """Client mới kết nối → tạo queue riêng, thêm vào danh sách."""
        queue = asyncio.Queue()
        self.clients.append(queue)
        return queue

    async def disconnect(self, queue: asyncio.Queue):
        """Client ngắt kết nối → xóa khỏi danh sách."""
        self.clients = [q for q in self.clients if q is not queue]

    async def broadcast(self, message: Dict[str, Any]):
        """Gửi sự kiện đến tất cả client đang kết nối."""
        for queue in self.clients:
            await queue.put(json.dumps(message, default=str))


event_store = EventStore()


@router.get("/api/events")
async def sse_events():
    """
    Endpoint SSE: trình duyệt gọi API này để nhận thông báo real-time.
    Mỗi khi bàn thay đổi trạng thái → tất cả trình duyệt đều cập nhật giao diện ngay.
    """
    async def event_generator():
        queue = await event_store.connect()
        try:
            while True:
                # Chờ message mới từ broadcast, timeout 30s để keep-alive
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30)
                    yield {"event": "update", "data": message}
                except asyncio.TimeoutError:
                    # Keep-alive: gửi comment để giữ kết nối
                    yield {"event": "keep-alive", "data": ""}
        finally:
            await event_store.disconnect(queue)

    return EventSourceResponse(event_generator())
