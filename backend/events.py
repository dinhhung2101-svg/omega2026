"""
Event Store - Shared SSE broadcast state.
Import từ bất kỳ đâu trong backend mà không cần circular import.
"""
import asyncio
import json
from typing import List, Dict, Any


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


# Singleton — dùng chung cho toàn bộ app
event_store = EventStore()
